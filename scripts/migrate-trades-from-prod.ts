/**
 * migrate-trades-from-prod.ts
 * Remplace les trades existants sur mkog par les 314 trades de référence Oracle exportés depuis prod.
 *
 * Usage : npx tsx scripts/migrate-trades-from-prod.ts
 *
 * Source CSV : ~/Downloads/trades-export-2026-04-24_10-50-58.csv
 * Cible DB   : mkogljvoqqcnqrgcnfau (mkog TEST)
 *
 * Ce script :
 *   1. Lit le CSV (séparateur ;)
 *   2. Supprime toutes les dépendances (user_executions, user_trade_analyses) qui référencent les trades existants
 *   3. Supprime tous les trades existants sur mkog
 *   4. Insère les 314 trades en préservant les IDs et toutes les données
 *   5. user_id prod (017110fe-...) → NULL (FK optionnelle sur mkog)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://mkogljvoqqcnqrgcnfau.supabase.co';
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rb2dsanZvcXFjbnFyZ2NuZmF1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTgxOTEyNywiZXhwIjoyMDkxMzk1MTI3fQ.AMP1gT0K6pAvAyWPko2RoX_LaZQVqH1d2IC2hAxWf2U';

const CSV_PATH = path.join(
  process.env.HOME || '/Users/charlesterrier',
  'Downloads/trades-export-2026-04-24_10-50-58.csv'
);

// user_id de référence sur mkog (super_admin — remplace le user_id prod qui n'existe pas ici)
const MKOG_REFERENCE_USER_ID = 'c0d7a328-7d9f-4bec-86ed-4a7937d49d3c';

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── CSV Parsing ──────────────────────────────────────────────────────────────

function parseBoolean(val: string): boolean | null {
  if (val === 'true') return true;
  if (val === 'false') return false;
  return null;
}

function parseNullable(val: string): string | null {
  return val === '' || val === 'null' ? null : val;
}

interface TradeRow {
  id: string;
  trade_number: number;
  trade_date: string;
  day_of_week: string | null;
  direction: string;
  direction_structure: string | null;
  entry_time: string | null;
  exit_time: string | null;
  trade_duration: string | null;
  rr: number | null;
  stop_loss_size: string | null;
  stop_loss_points: number | null;
  setup_type: string | null;
  entry_timing: string | null;
  entry_model: string | null;
  target_timing: string | null;
  speculation_hl_valid: boolean | null;
  target_hl_valid: boolean | null;
  news_day: boolean | null;
  news_label: string | null;
  comment: string | null;
  screenshot_m15_m5: string | null;
  created_at: string;
  screenshot_m1: string | null;
  user_id: string; // mapped to mkog reference user
  sl_placement: string | null;
  tp_placement: string | null;
  context_timeframe: string | null;
  entry_timeframe: string | null;
}

function parseCSV(filePath: string): TradeRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim() !== '');
  const headers = lines[0].split(';');

  const trades: TradeRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    if (cols.length < headers.length) continue;

    const get = (name: string) => cols[headers.indexOf(name)] ?? '';

    trades.push({
      id: get('id'),
      trade_number: parseInt(get('trade_number'), 10),
      trade_date: get('trade_date'),
      day_of_week: parseNullable(get('day_of_week')),
      direction: get('direction'), // "Long" / "Short" — already correct format
      direction_structure: parseNullable(get('direction_structure')),
      entry_time: parseNullable(get('entry_time')),
      exit_time: parseNullable(get('exit_time')),
      trade_duration: parseNullable(get('trade_duration')),
      rr: get('rr') ? parseFloat(get('rr')) : null,
      stop_loss_size: parseNullable(get('stop_loss_size')),
      stop_loss_points: get('stop_loss_points') ? parseFloat(get('stop_loss_points')) : null,
      setup_type: parseNullable(get('setup_type')),
      entry_timing: parseNullable(get('entry_timing')),
      entry_model: parseNullable(get('entry_model')),
      target_timing: parseNullable(get('target_timing')),
      speculation_hl_valid: parseBoolean(get('speculation_hl_valid')),
      target_hl_valid: parseBoolean(get('target_hl_valid')),
      news_day: parseBoolean(get('news_day')),
      news_label: parseNullable(get('news_label')),
      comment: parseNullable(get('comment')),
      screenshot_m15_m5: parseNullable(get('screenshot_m15_m5')),
      created_at: get('created_at') || new Date().toISOString(),
      screenshot_m1: parseNullable(get('screenshot_m1')),
      user_id: MKOG_REFERENCE_USER_ID, // prod user_id remplacé par compte référence mkog
      sl_placement: parseNullable(get('sl_placement')),
      tp_placement: parseNullable(get('tp_placement')),
      context_timeframe: parseNullable(get('context_timeframe')),
      entry_timeframe: parseNullable(get('entry_timeframe')),
    });
  }

  return trades;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📂 Lecture du CSV...');
  const trades = parseCSV(CSV_PATH);
  console.log(`   ${trades.length} trades parsés`);

  if (trades.length === 0) {
    console.error('❌ Aucun trade parsé — vérifier le chemin et le format CSV');
    process.exit(1);
  }

  // 1. Suppression de toutes les user_executions (pas de trade_id FK — référencées par trade_number)
  console.log('\n🗑  Suppression des user_executions existants...');
  const { error: delExecErr, count: delExecCount } = await sb
    .from('user_executions')
    .delete({ count: 'exact' })
    .gte('trade_number', 0); // condition toujours vraie

  if (delExecErr) {
    console.warn('   ⚠️  user_executions delete warning:', delExecErr.message);
  } else {
    console.log(`   ${delExecCount ?? '?'} user_executions supprimés`);
  }

  // 2. Suppression de tous les user_trade_analyses
  console.log('\n🗑  Suppression des user_trade_analyses existants...');
  // Essayer avec un filtre générique (la table peut avoir des colonnes différentes)
  const { error: delAnalysisErr, count: delAnalysisCount } = await sb
    .from('user_trade_analyses')
    .delete({ count: 'exact' })
    .gte('trade_number', 0);

  if (delAnalysisErr) {
    // Si pas de colonne trade_number, essayer avec id
    const { error: delAnalysisErr2, count: delAnalysisCount2 } = await sb
      .from('user_trade_analyses')
      .delete({ count: 'exact' })
      .not('id', 'is', null);
    if (delAnalysisErr2) {
      console.warn('   ⚠️  user_trade_analyses delete warning:', delAnalysisErr2.message);
    } else {
      console.log(`   ${delAnalysisCount2 ?? '?'} user_trade_analyses supprimés`);
    }
  } else {
    console.log(`   ${delAnalysisCount ?? '?'} user_trade_analyses supprimés`);
  }

  // 3. Suppression de tous les trades existants
  console.log('\n🗑  Suppression des trades existants sur mkog...');
  const { error: delTradesErr, count: delTradesCount } = await sb
    .from('trades')
    .delete({ count: 'exact' })
    .not('id', 'is', null); // supprimer tout

  if (delTradesErr) {
    console.error('❌ Erreur suppression trades:', delTradesErr.message);
    process.exit(1);
  }
  console.log(`   ${delTradesCount ?? '?'} trades supprimés`);

  // 4. Insertion des 314 trades par batches de 50
  console.log('\n📥 Insertion des 314 trades de référence...');
  const BATCH = 50;
  let inserted = 0;

  for (let i = 0; i < trades.length; i += BATCH) {
    const batch = trades.slice(i, i + BATCH);
    const { error: insErr } = await sb.from('trades').insert(batch);
    if (insErr) {
      console.error(`❌ Erreur insertion batch ${i}-${i + BATCH}:`, insErr.message);
      process.exit(1);
    }
    inserted += batch.length;
    process.stdout.write(`   ${inserted}/${trades.length}...\r`);
  }

  console.log(`\n✅ ${inserted} trades insérés avec succès`);

  // 5. Vérification rapide
  const { count: finalCount } = await sb
    .from('trades')
    .select('*', { count: 'exact', head: true });
  console.log(`\n🔍 Vérification finale : ${finalCount} trades dans la DB mkog`);

  if (finalCount !== 314) {
    console.warn(`⚠️  Attendu 314, trouvé ${finalCount}`);
  } else {
    console.log('✅ Migration complète !');
    console.log('\n📌 Prochaines étapes :');
    console.log('   1. npx tsx scripts/seed-cycle-states.ts  → recréer les users de test');
    console.log('   2. vercel --prod                          → déployer le frontend');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
