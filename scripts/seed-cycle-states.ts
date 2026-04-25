/**
 * seed-cycle-states.ts
 * Crée 8 users de test sur mkog couvrant tous les états de progression des cycles.
 * But : permettre à l'équipe de vérifier que chaque user voit bien ce qu'il devrait voir.
 *
 * Usage : npx tsx scripts/seed-cycle-states.ts
 *
 * Idempotent : supprime et recrée les users à chaque exécution.
 * Email domain : @cycle-test.internal
 * Password : Oracle2026!
 *
 * USERS CRÉÉS :
 *   test.nouveau          → Nouvel EA, aucun cycle initialisé
 *   test.ebauche-partiel  → Ébauche 7/15 trades (in_progress)
 *   test.ebauche-pret     → Ébauche 15/15, prêt à soumettre (in_progress)
 *   test.ebauche-pending  → Ébauche soumise, en attente admin (pending_review)
 *   test.ebauche-rejetee  → Ébauche rejetée avec feedback admin (rejected)
 *   test.cycle1-encours   → C0 validé, C1 en cours 10/25 (in_progress)
 *   test.cycle1-pending   → C0 validé, C1 complet en attente admin (pending_review)
 *   test.avance           → C0+C1 validés, C2 en cours 0/25 (in_progress)
 */

import { createClient } from '@supabase/supabase-js';

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://mkogljvoqqcnqrgcnfau.supabase.co';
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rb2dsanZvcXFjbnFyZ2NuZmF1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTgxOTEyNywiZXhwIjoyMDkxMzk1MTI3fQ.AMP1gT0K6pAvAyWPko2RoX_LaZQVqH1d2IC2hAxWf2U';

const PASSWORD = 'Oracle2026!';
const EMAIL_DOMAIN = '@cycle-test.internal';
const EA_EXPIRES = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Cycle IDs (mkog DB) ──────────────────────────────────────────────────────

const CYCLES: Record<number, { id: string; tradeStart: number; tradeEnd: number; total: number }> = {
  0: { id: '28ea5255-d146-498f-b9bb-668b70aac178', tradeStart: 1,   tradeEnd: 15,  total: 15 },
  1: { id: 'fd33e66e-9133-440e-b07e-d0307d93e9dd', tradeStart: 16,  tradeEnd: 40,  total: 25 },
  2: { id: 'cb6a5ee0-334f-4507-b518-aca9e68861ff', tradeStart: 41,  tradeEnd: 65,  total: 25 },
  3: { id: '5d5aaf25-2e7a-4369-93bb-d6e2f132bc12', tradeStart: 66,  tradeEnd: 90,  total: 25 },
  4: { id: '06db3e4d-519d-40f4-9cb8-b6d8fbdfacd9', tradeStart: 91,  tradeEnd: 115, total: 25 },
  5: { id: '49030a61-e0fd-4716-ae65-56ded59e0da6', tradeStart: 116, tradeEnd: 165, total: 50 },
  6: { id: '611f1a98-d190-4374-9bcd-f695c73fe8d5', tradeStart: 166, tradeEnd: 215, total: 50 },
  7: { id: '70257529-3160-4082-a073-f2794d1d48a3', tradeStart: 216, tradeEnd: 265, total: 50 },
  8: { id: '32bdbcaa-1c62-4247-b55a-873091e8a198', tradeStart: 266, tradeEnd: 314, total: 49 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type CycleStatus = 'locked' | 'in_progress' | 'pending_review' | 'validated' | 'rejected';

interface CycleOverride {
  status: CycleStatus;
  admin_feedback?: string;
}

/**
 * Insère les 9 rows user_cycles pour un user.
 * Par défaut : cycle 0 = in_progress, cycles 1-8 = locked.
 * Retourne un map cycleNum → user_cycle_id.
 */
async function createUserCycles(
  userId: string,
  overrides: Record<number, CycleOverride> = {}
): Promise<Record<number, string>> {
  const now = new Date().toISOString();

  const rows = Object.entries(CYCLES).map(([numStr, c]) => {
    const num = Number(numStr);
    const override = overrides[num];
    const status: CycleStatus = override?.status ?? (num === 0 ? 'in_progress' : 'locked');
    const isActive = status !== 'locked';
    const isValidated = status === 'validated';

    return {
      user_id: userId,
      cycle_id: c.id,
      status,
      started_at: isActive ? now : null,
      completed_at: isValidated ? now : null,
      verified_at: isValidated ? now : null,
      admin_feedback: override?.admin_feedback ?? null,
    };
  });

  const { error } = await sb.from('user_cycles').insert(rows);
  if (error) throw new Error(`createUserCycles: ${error.message}`);

  // Récupère les IDs créés
  const { data, error: fetchErr } = await sb
    .from('user_cycles')
    .select('id, cycle_id')
    .eq('user_id', userId);
  if (fetchErr) throw new Error(`fetchUserCycles: ${fetchErr.message}`);

  const idMap: Record<number, string> = {};
  for (const row of data ?? []) {
    const cycleNum = Object.entries(CYCLES).find(([, c]) => c.id === row.cycle_id)?.[0];
    if (cycleNum !== undefined) idMap[Number(cycleNum)] = row.id;
  }
  return idMap;
}

/**
 * ÉBAUCHE (cycle 0) — phase d'analyse.
 * Insère N rows dans user_trade_analyses (checkboxes cochés).
 * Pas de FXReplay, pas de user_executions.
 */
async function addTradeAnalyses(userId: string, tradeNumbers: number[]): Promise<void> {
  const rows = tradeNumbers.map((n) => ({ user_id: userId, trade_number: n }));
  const { error } = await sb.from('user_trade_analyses').insert(rows);
  if (error) throw new Error(`addTradeAnalyses: ${error.message}`);
}

/**
 * Marque N premières vidéos comme vues pour un user.
 * Si n === 'all', marque toutes les vidéos.
 */
async function addVideoViews(userId: string, count: number | 'all'): Promise<void> {
  const { data: videos, error } = await sb.from('videos').select('id').order('created_at', { ascending: true });
  if (error || !videos?.length) { console.warn('    ⚠ Aucune vidéo en DB'); return; }
  const toMark = count === 'all' ? videos : videos.slice(0, count);
  if (!toMark.length) return;
  const rows = toMark.map((v) => ({ user_id: userId, video_id: v.id }));
  const { error: insertErr } = await sb.from('user_video_views').insert(rows);
  if (insertErr) console.warn(`    ⚠ addVideoViews: ${insertErr.message}`);
}

/**
 * CYCLES 1-8 — phase de récolte (FXReplay).
 * Insère des user_executions en copiant les données des trades Oracle.
 * accurate=true  → timestamps identiques (diff=0 → "match" à la vérif).
 * accurate=false → décalage +48h (diff=48h → "error" à la vérif).
 */
async function addExecutions(userId: string, tradeNumbers: number[], accurate = true): Promise<void> {
  const { data: oracleTrades, error } = await sb
    .from('trades')
    .select('trade_number, trade_date, entry_time, direction, rr')
    .in('trade_number', tradeNumbers);

  if (error) throw new Error(`fetchOracleTrades: ${error.message}`);
  if (!oracleTrades?.length) {
    console.warn(`    ⚠ No oracle trades found for: ${tradeNumbers.join(',')}`);
    return;
  }

  const executions = oracleTrades.map((t) => {
    let tradeDate = t.trade_date as string;
    if (!accurate) {
      const d = new Date(`${t.trade_date}T00:00:00`);
      d.setDate(d.getDate() + 2); // +48h → "error" dans compareExecution
      tradeDate = d.toISOString().split('T')[0];
    }
    // trades: 'LONG'/'SHORT' — user_executions constraint: 'Long'/'Short'
    const direction = t.direction === 'LONG' ? 'Long' : t.direction === 'SHORT' ? 'Short' : (t.direction ?? 'Long');
    return {
      user_id: userId,
      trade_number: t.trade_number,
      trade_date: tradeDate,
      entry_time: t.entry_time ?? '09:00',
      direction,
      rr: t.rr ?? 1.0,
    };
  });

  const { error: insertErr } = await sb.from('user_executions').insert(executions);
  if (insertErr) throw new Error(`addExecutions: ${insertErr.message}`);
}

/**
 * Crée un user complet : auth + profile + role EA + setup custom.
 * Supprime tout existant d'abord (idempotent).
 */
async function setupUser(
  slug: string,
  firstName: string,
  setup: (userId: string) => Promise<void>
): Promise<void> {
  const email = `test.${slug}${EMAIL_DOMAIN}`;
  console.log(`\n→ ${email}`);

  // 1. Nettoyage de l'existant
  const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const existing = users.find((u) => u.email === email);
  if (existing) {
    console.log(`  Nettoyage de ${existing.id.slice(0, 8)}...`);
    await sb.from('verification_requests').delete().eq('user_id', existing.id);
    await sb.from('user_executions').delete().eq('user_id', existing.id);
    await sb.from('user_cycles').delete().eq('user_id', existing.id);
    await sb.from('user_video_views').delete().eq('user_id', existing.id);
    await sb.from('user_trade_analyses').delete().eq('user_id', existing.id);
    await sb.from('user_roles').delete().eq('user_id', existing.id);
    await sb.auth.admin.deleteUser(existing.id);
    await sleep(400);
  }

  // 2. Création auth
  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: firstName },
  });
  if (createErr) throw new Error(`createUser: ${createErr.message}`);
  const userId = created.user.id;
  console.log(`  Auth user créé : ${userId.slice(0, 8)}`);

  // 3. Attente trigger profile (Supabase crée le profil via trigger auth.users)
  await sleep(600);

  // 4. Profil actif
  await sb.from('profiles').upsert(
    { user_id: userId, first_name: firstName, display_name: firstName, status: 'active' },
    { onConflict: 'user_id' }
  );

  // 5. Pas de rôle early_access par défaut — ces users sont des membres clients post-EA
  // (isEarlyAccess = false → ils voient les panels AVE et les cycles)
  // setup() peut surcharger en ajoutant un rôle EA si besoin

  // 6. Setup spécifique au scénario
  await setup(userId);
  console.log(`  ✓`);
}

// ─── Scénarios ────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seed cycle states — mkog\n');

  // ── 1. Nouveau — aucun cycle ──────────────────────────────────────────────
  // Panel 1 → "Démarrer" | Panel 2 → "Saisir ma data" | Panel 3 → coming soon
  await setupUser('nouveau', 'Alex', async (_userId) => {
    // 0 vidéos, 0 cycles, 0 exécutions
  });

  // ── 2. Ébauche partielle — 7/15 ──────────────────────────────────────────
  // Panel 1 → "Reprendre" (2/N vues) | Panel 2 → "Reprendre la récolte" 7/15
  await setupUser('ebauche-partiel', 'Benoit', async (userId) => {
    await addVideoViews(userId, 2);
    await createUserCycles(userId, { 0: { status: 'in_progress' } });
    await addTradeAnalyses(userId, [1, 2, 3, 4, 5, 6, 7]);
    await addExecutions(userId, [1, 2, 3, 4, 5, 6, 7], true);
  });

  // ── 3. Ébauche prête — 15/15, pas encore soumise ─────────────────────────
  // Panel 1 → "Revoir les vidéos" (toutes vues) | Panel 2 → "Récolter" (prêt à soumettre)
  await setupUser('ebauche-pret', 'Clara', async (userId) => {
    await addVideoViews(userId, 'all');
    await createUserCycles(userId, { 0: { status: 'in_progress' } });
    const all15 = Array.from({ length: 15 }, (_, i) => i + 1);
    await addTradeAnalyses(userId, all15);
    await addExecutions(userId, all15, true);
  });

  // ── 4. Ébauche pending_review ─────────────────────────────────────────────
  // Panel 2 → orange "Voir mon avancement" | Panel 3 → bleu "En cours de vérification"
  await setupUser('ebauche-pending', 'David', async (userId) => {
    await addVideoViews(userId, 'all');
    const cycleIds = await createUserCycles(userId, { 0: { status: 'pending_review' } });
    const all15 = Array.from({ length: 15 }, (_, i) => i + 1);
    await addTradeAnalyses(userId, all15);
    await addExecutions(userId, all15, true);
    await sb.from('verification_requests').insert({
      user_id: userId,
      cycle_id: CYCLES[0].id,
      user_cycle_id: cycleIds[0],
      status: 'pending',
      requested_at: new Date().toISOString(),
    });
  });

  // ── 5. Ébauche rejetée avec feedback ─────────────────────────────────────
  // Panel 2 → "Reprendre la récolte" (à corriger) | Panel 3 → coming soon
  await setupUser('ebauche-rejetee', 'Emma', async (userId) => {
    await addVideoViews(userId, 'all');
    await createUserCycles(userId, {
      0: {
        status: 'rejected',
        admin_feedback:
          "Plusieurs trades mal timés (>24h d'écart). Reprends les trades 4, 7 et 12, vérifie tes horaires sur FXReplay et resoumets.",
      },
    });
    const all15 = Array.from({ length: 15 }, (_, i) => i + 1);
    await addTradeAnalyses(userId, all15);
    await addExecutions(userId, all15, false); // inaccurate → diff 48h
  });

  // ── 6. Cycle 1 en cours — 10/25 ──────────────────────────────────────────
  // Panel 2 → "Reprendre la récolte" 10/25 | Panel 3 → "Termine le Cycle 1 (10/25)"
  await setupUser('cycle1-encours', 'Felix', async (userId) => {
    await addVideoViews(userId, 'all');
    await createUserCycles(userId, {
      0: { status: 'validated' },
      1: { status: 'in_progress' },
    });
    const c0 = Array.from({ length: 15 }, (_, i) => i + 1);      // trades 1-15
    const c1 = Array.from({ length: 10 }, (_, i) => i + 16);     // trades 16-25
    await addExecutions(userId, [...c0, ...c1], true);
  });

  // ── 7. Cycle 1 pending_review — complet en attente ───────────────────────
  // Panel 2 → orange | Panel 3 → bleu "Validation demandée il y a X heures"
  await setupUser('cycle1-pending', 'Gaia', async (userId) => {
    await addVideoViews(userId, 'all');
    const cycleIds = await createUserCycles(userId, {
      0: { status: 'validated' },
      1: { status: 'pending_review' },
    });
    const c0 = Array.from({ length: 15 }, (_, i) => i + 1);      // trades 1-15
    const c1 = Array.from({ length: 25 }, (_, i) => i + 16);     // trades 16-40
    await addExecutions(userId, [...c0, ...c1], true);
    await sb.from('verification_requests').insert({
      user_id: userId,
      cycle_id: CYCLES[1].id,
      user_cycle_id: cycleIds[1],
      status: 'pending',
      requested_at: new Date().toISOString(),
    });
  });

  // ── 8. Avancé — C0+C1 validés, C2 en cours (pas commencé) ───────────────
  // Panel 2 → "Saisir ma data" (C2 0/25) | Panel 3 → "Termine le Cycle 2 (0/25)"
  await setupUser('avance', 'Hugo', async (userId) => {
    await addVideoViews(userId, 'all');
    await createUserCycles(userId, {
      0: { status: 'validated' },
      1: { status: 'validated' },
      2: { status: 'in_progress' },
    });
    // Exécutions pour les cycles validés (permet au calcul de progression d'être correct)
    const c0 = Array.from({ length: 15 }, (_, i) => i + 1);  // trades 1-15
    const c1 = Array.from({ length: 25 }, (_, i) => i + 16); // trades 16-40
    await addExecutions(userId, [...c0, ...c1], true);
    // C2 : 0 exécutions → progress affichée 0/25 → correct pour "vient de démarrer"
  });

  // ── 9. EA precall — accès trial, pas encore appelé ───────────────────────
  // Voit dashboard EA (pas les panels AVE), timer countdown, no admin tabs
  await setupUser('ea-precall', 'Inès', async (userId) => {
    await addVideoViews(userId, 1); // 1 vidéo vue
    await sb.from('user_roles').insert({
      user_id: userId,
      role: 'early_access',
      early_access_type: 'precall',
      expires_at: new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString(), // expire dans 6j
    });
  });

  // ── 10. EA postcall — accès étendu post-appel ─────────────────────────────
  // Même interface EA mais expire dans 14j
  await setupUser('ea-postcall', 'Jordan', async (userId) => {
    await addVideoViews(userId, 3);
    await sb.from('user_roles').insert({
      user_id: userId,
      role: 'early_access',
      early_access_type: 'postcall',
      expires_at: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
    });
  });

  // ─── Résumé ───────────────────────────────────────────────────────────────
  console.log('\n✅ Seed terminé !\n');
  console.log('Mot de passe universel : Oracle2026!\n');
  console.log('┌──────────────────────────────────────────────────────────────────────────┐');
  console.log('│ Email                                         │ Rôle   │ État attendu     │');
  console.log('├──────────────────────────────────────────────────────────────────────────┤');
  console.log('│ test.nouveau@cycle-test.internal              │ client │ 3 panels, vierge │');
  console.log('│ test.ebauche-partiel@cycle-test.internal      │ client │ Ébauche 7/15     │');
  console.log('│ test.ebauche-pret@cycle-test.internal         │ client │ Ébauche 15/15    │');
  console.log('│ test.ebauche-pending@cycle-test.internal      │ client │ Vérif en attente │');
  console.log('│ test.ebauche-rejetee@cycle-test.internal      │ client │ Ébauche rejetée  │');
  console.log('│ test.cycle1-encours@cycle-test.internal       │ client │ C1 en cours 10/25│');
  console.log('│ test.cycle1-pending@cycle-test.internal       │ client │ C1 pending (🔵)  │');
  console.log('│ test.avance@cycle-test.internal               │ client │ C2 démarré 0/25  │');
  console.log('│ test.ea-precall@cycle-test.internal           │ EA     │ Dashboard EA 6j  │');
  console.log('│ test.ea-postcall@cycle-test.internal          │ EA     │ Dashboard EA 14j │');
  console.log('└──────────────────────────────────────────────────────────────────────────┘');
}

main().catch((err) => {
  console.error('\n❌ Erreur :', err.message);
  process.exit(1);
});
