/**
 * upload-oracle-screenshots.mjs
 * ==============================
 * Upload les 314 × 2 screenshots Oracle vers Supabase Storage,
 * puis met à jour la table `trades` avec les chemins.
 *
 * Usage :
 *   # TEST (mkog — défaut) :
 *   node scripts/upload-oracle-screenshots.mjs
 *
 *   # PROD (Lovable — pggkwyhtplxyarctuoze) :
 *   SUPABASE_URL=https://pggkwyhtplxyarctuoze.supabase.co \
 *   SUPABASE_SERVICE_KEY=<clé_service_prod> \
 *   node scripts/upload-oracle-screenshots.mjs
 *
 * Pré-requis :
 *   - Extraire oracle-screenshots.zip dans /tmp/oracle-screenshots-raw/oracle-screenshots/
 *   - Avoir les clés Supabase dans les variables d'environnement (ou .env.local)
 *
 * Ce que fait le script :
 *   1. Crée le bucket `oracle-screenshots` (public) s'il n'existe pas
 *   2. Upload tous les fichiers trade_N_m15.ext et trade_N_m5.ext
 *   3. Met à jour trades.screenshot_m15_m5 et trades.screenshot_m1
 *   4. Affiche un rapport final (succès, manquants, erreurs)
 */

import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, extname } from 'path';

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL
  || 'https://mkogljvoqqcnqrgcnfau.supabase.co';

const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rb2dsanZvcXFjbnFyZ2NuZmF1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTgxOTEyNywiZXhwIjoyMDkxMzk1MTI3fQ.AMP1gT0K6pAvAyWPko2RoX_LaZQVqH1d2IC2hAxWf2U';

const SCREENSHOTS_DIR = '/tmp/oracle-screenshots-raw/oracle-screenshots';
const BUCKET_NAME = 'oracle-screenshots';
const CONCURRENCY = 5; // uploads en parallèle

// ── Init ──────────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const log = {
  info:    (msg) => console.log(`  ℹ  ${msg}`),
  ok:      (msg) => console.log(`  ✓  ${msg}`),
  warn:    (msg) => console.log(`  ⚠  ${msg}`),
  error:   (msg) => console.error(`  ✗  ${msg}`),
  section: (msg) => console.log(`\n${'─'.repeat(60)}\n  ${msg.toUpperCase()}\n${'─'.repeat(60)}`),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Trouve le fichier d'un trade (supporte .png et .jpg) */
function findFile(dir, tradeNum, type) {
  for (const ext of ['png', 'jpg']) {
    const path = join(dir, `trade_${tradeNum}_${type}.${ext}`);
    if (existsSync(path)) return { path, filename: `trade_${tradeNum}_${type}.${ext}` };
  }
  return null;
}

/** Upload un fichier vers le bucket Supabase */
async function uploadFile(localPath, storagePath, mimeType) {
  const buffer = readFileSync(localPath);
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true, // overwrite si déjà présent
    });
  if (error) throw new Error(error.message);
  return data.path;
}

/** Exécute des promesses par batch de N en parallèle */
async function runInBatches(items, batchSize, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
    process.stdout.write(`\r  Upload : ${Math.min(i + batchSize, items.length)}/${items.length}`);
  }
  console.log('');
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  Oracle Screenshots Upload');
  console.log(`  Target : ${SUPABASE_URL}`);
  console.log(`  Bucket : ${BUCKET_NAME}`);
  console.log(`  Source : ${SCREENSHOTS_DIR}`);
  console.log('════════════════════════════════════════════════════════════\n');

  // 1. Vérifier que le dossier source existe
  if (!existsSync(SCREENSHOTS_DIR)) {
    log.error(`Dossier source introuvable : ${SCREENSHOTS_DIR}`);
    log.info('Extraire le ZIP : unzip oracle-screenshots.zip -d /tmp/oracle-screenshots-raw');
    process.exit(1);
  }

  // 2. Créer le bucket oracle-screenshots (public) s'il n'existe pas
  log.section('1. bucket setup');
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);

  if (bucketExists) {
    log.ok(`Bucket "${BUCKET_NAME}" existe déjà`);
  } else {
    log.info(`Création du bucket "${BUCKET_NAME}" (public)…`);
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024, // 10 MB max
    });
    if (error) {
      log.error(`Impossible de créer le bucket : ${error.message}`);
      process.exit(1);
    }
    log.ok(`Bucket "${BUCKET_NAME}" créé avec succès`);
  }

  // 3. Lire l'index.csv
  log.section('2. lecture index.csv');
  const csvPath = join(SCREENSHOTS_DIR, 'index.csv');
  const csvLines = readFileSync(csvPath, 'utf-8').trim().split('\n').slice(1); // skip header
  log.ok(`${csvLines.length} trades dans l'index`);

  // 4. Préparer la liste des uploads
  const uploadTasks = [];
  const report = {
    total: csvLines.length,
    uploaded_m15: 0,
    uploaded_m5: 0,
    missing_m15: [],
    missing_m5: [],
    errors: [],
  };

  for (const line of csvLines) {
    const [tradeNum] = line.split(',');
    const num = parseInt(tradeNum);

    const m15 = findFile(SCREENSHOTS_DIR, num, 'm15');
    const m5  = findFile(SCREENSHOTS_DIR, num, 'm5');

    if (m15) {
      const mime = m15.filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
      uploadTasks.push({ tradeNum: num, type: 'm15', localPath: m15.path, storagePath: m15.filename, mime });
    } else {
      report.missing_m15.push(num);
    }

    if (m5) {
      const mime = m5.filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
      uploadTasks.push({ tradeNum: num, type: 'm5', localPath: m5.path, storagePath: m5.filename, mime });
    } else {
      report.missing_m5.push(num);
    }
  }

  log.ok(`${uploadTasks.length} fichiers à uploader`);
  if (report.missing_m15.length > 0)
    log.warn(`M15 manquants (${report.missing_m15.length}) : trades ${report.missing_m15.join(', ')}`);
  if (report.missing_m5.length > 0)
    log.warn(`M5 manquants (${report.missing_m5.length}) : trades ${report.missing_m5.join(', ')}`);

  // 5. Upload en parallèle
  log.section('3. upload fichiers');
  log.info(`Uploading avec ${CONCURRENCY} workers en parallèle…`);

  const results = await runInBatches(uploadTasks, CONCURRENCY, async (task) => {
    await uploadFile(task.localPath, task.storagePath, task.mime);
    return task;
  });

  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      const task = result.value;
      if (task.type === 'm15') report.uploaded_m15++;
      else report.uploaded_m5++;
    } else {
      const task = uploadTasks[i];
      report.errors.push({ trade: task?.tradeNum, type: task?.type, error: result.reason?.message });
    }
  }

  log.ok(`${report.uploaded_m15} m15 uploadés`);
  log.ok(`${report.uploaded_m5} m5 uploadés`);
  if (report.errors.length > 0)
    log.error(`${report.errors.length} erreurs d'upload`);

  // 6. Mettre à jour la table trades
  log.section('4. mise à jour table trades');
  log.info('Mise à jour des colonnes screenshot_m15_m5 et screenshot_m1…');

  let dbUpdated = 0;
  let dbErrors = 0;

  // Regrouper par trade_number pour faire une seule requête par trade
  const tradeMap = new Map();
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const task = result.value;
    if (!tradeMap.has(task.tradeNum)) tradeMap.set(task.tradeNum, {});
    const entry = tradeMap.get(task.tradeNum);
    if (task.type === 'm15') entry.screenshot_m15_m5 = task.storagePath;
    if (task.type === 'm5')  entry.screenshot_m1 = task.storagePath;
  }

  const dbTasks = Array.from(tradeMap.entries());
  const dbResults = await runInBatches(dbTasks, 10, async ([tradeNum, fields]) => {
    const { error } = await supabase
      .from('trades')
      .update(fields)
      .eq('trade_number', tradeNum);
    if (error) throw new Error(`trade ${tradeNum}: ${error.message}`);
    return tradeNum;
  });

  for (const result of dbResults) {
    if (result.status === 'fulfilled') dbUpdated++;
    else {
      dbErrors++;
      log.error(result.reason?.message || 'DB error');
    }
  }

  log.ok(`${dbUpdated} trades mis à jour en DB`);
  if (dbErrors > 0) log.error(`${dbErrors} erreurs DB`);

  // 7. Rapport final
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  RAPPORT FINAL');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`  Total trades dans index   : ${report.total}`);
  console.log(`  M15 uploadés              : ${report.uploaded_m15}/${report.total}`);
  console.log(`  M5 uploadés               : ${report.uploaded_m5}/${report.total}`);
  console.log(`  Trades avec M15 manquant  : ${report.missing_m15.length}`);
  console.log(`  Trades avec M5 manquant   : ${report.missing_m5.length}`);
  console.log(`  Erreurs upload            : ${report.errors.length}`);
  console.log(`  Trades mis à jour en DB   : ${dbUpdated}`);
  console.log(`  Erreurs DB                : ${dbErrors}`);
  console.log('════════════════════════════════════════════════════════════\n');

  if (report.errors.length > 0) {
    console.log('  Détail des erreurs upload :');
    for (const e of report.errors.slice(0, 10)) {
      console.log(`    trade ${e.trade} (${e.type}) : ${e.error}`);
    }
  }

  // 8. Export JSON du rapport
  const reportPath = '/tmp/oracle-upload-report.json';
  const fullReport = {
    timestamp: new Date().toISOString(),
    target: SUPABASE_URL,
    bucket: BUCKET_NAME,
    ...report,
    db_updated: dbUpdated,
    db_errors: dbErrors,
  };
  readFileSync; // just to confirm the import is used
  import('fs').then(fs => {
    fs.writeFileSync(reportPath, JSON.stringify(fullReport, null, 2));
    log.ok(`Rapport JSON exporté : ${reportPath}`);
  });

  const hasErrors = report.errors.length > 0 || dbErrors > 0;
  process.exit(hasErrors ? 1 : 0);
}

main().catch(err => {
  console.error('\n  ERREUR FATALE :', err.message);
  process.exit(1);
});
