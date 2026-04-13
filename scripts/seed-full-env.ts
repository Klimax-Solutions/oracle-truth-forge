/**
 * FULL Oracle Test Environment Seed
 * Creates a realistic prod-like environment with:
 * - 50 auth users (already created by seed-test-users.ts)
 * - 3 master cycles + 60 oracle trades
 * - User cycles at various stages
 * - User executions (trade entries)
 * - Verification requests + admin trade notes
 * - EA activity tracking
 * - Videos, quests, followups, notifications
 * - Security alerts
 *
 * Usage: SUPABASE_SERVICE_ROLE_KEY=xxx npx tsx scripts/seed-full-env.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mkogljvoqqcnqrgcnfau.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Set SUPABASE_SERVICE_ROLE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ──
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysAgo));
  d.setHours(randInt(8, 18), randInt(0, 59), 0, 0);
  return d.toISOString();
}
function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

const DIRECTIONS = ['LONG', 'SHORT'];
const TIMEFRAMES = ['M1', 'M5', 'M15', 'H1'];
const SETUPS = ['Break & Retest', 'OrderBlock', 'FVG', 'Liquidity Sweep', 'ChoCh'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// ── Main ──
async function main() {
  console.log('🚀 Full Oracle environment seed starting...\n');

  // ── 1. Get existing users (created by seed-test-users.ts) ──
  console.log('📦 Loading existing users...');
  const { data: profiles } = await supabase.from('profiles').select('user_id, first_name, display_name').order('created_at');
  if (!profiles || profiles.length === 0) {
    console.error('❌ No profiles found. Run seed-test-users.ts first.');
    process.exit(1);
  }
  console.log(`   Found ${profiles.length} profiles`);

  // Get admin user (Charles)
  const { data: adminRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'super_admin');
  const adminUserId = adminRoles?.[0]?.user_id || profiles[0].user_id;
  console.log(`   Admin user: ${adminUserId.slice(0, 8)}`);

  // Users with early_access role (the ones who can have cycles)
  const { data: eaRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'early_access');
  const eaUserIds = eaRoles?.map(r => r.user_id) || [];
  console.log(`   EA users: ${eaUserIds.length}`);

  // ── 2. Master Cycles ──
  console.log('\n📊 Creating master cycles...');
  const cycleData = [
    { cycle_number: 1, name: 'Cycle 1 — Fondamentaux', description: 'Apprentissage des setups de base', phase: 1, trade_start: 1, trade_end: 20, total_trades: 20 },
    { cycle_number: 2, name: 'Cycle 2 — Consolidation', description: 'Perfectionnement et gestion du risque', phase: 2, trade_start: 21, trade_end: 40, total_trades: 20 },
    { cycle_number: 3, name: 'Cycle 3 — Maîtrise', description: 'Autonomie complète et stratégies avancées', phase: 3, trade_start: 41, trade_end: 60, total_trades: 20 },
  ];

  const cycleIds: string[] = [];
  for (const c of cycleData) {
    const { data: existing } = await supabase.from('cycles').select('id').eq('cycle_number', c.cycle_number).maybeSingle();
    if (existing) {
      cycleIds.push(existing.id);
      console.log(`   ⚡ Cycle ${c.cycle_number} already exists`);
    } else {
      const { data, error } = await supabase.from('cycles').insert(c).select('id').single();
      if (error) { console.error(`   ❌ Cycle ${c.cycle_number}: ${error.message}`); continue; }
      cycleIds.push(data.id);
      console.log(`   ✅ Cycle ${c.cycle_number}: ${c.name}`);
    }
  }

  // ── 3. Master Trades (60 oracle reference trades) ──
  console.log('\n📈 Creating master oracle trades...');
  const { data: existingTrades } = await supabase.from('trades').select('trade_number').order('trade_number');
  const existingTradeNums = new Set(existingTrades?.map(t => t.trade_number) || []);

  let tradesCreated = 0;
  for (let i = 1; i <= 60; i++) {
    if (existingTradeNums.has(i)) continue;

    const dir = Math.random() > 0.35 ? 'LONG' : 'SHORT';
    const rr = pick([1.5, 2, 2.5, 3, 3.5, 4, 5]);
    const entryHour = randInt(8, 16);
    const entryMin = randInt(0, 59);
    const daysAgo = 60 - i + randInt(0, 2);

    const { error } = await supabase.from('trades').insert({
      user_id: adminUserId,
      trade_number: i,
      trade_date: pastDate(daysAgo),
      day_of_week: pick(DAYS),
      direction: dir,
      entry_time: `${String(entryHour).padStart(2, '0')}:${String(entryMin).padStart(2, '0')}`,
      exit_time: `${String(entryHour + randInt(1, 3)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}`,
      rr,
      entry_timeframe: pick(TIMEFRAMES),
      context_timeframe: pick(['H4', 'D1']),
      setup_type: pick(SETUPS),
      entry_model: pick(['Impulsive', 'Corrective', 'Range Break']),
      direction_structure: pick(['HH-HL', 'LH-LL', 'Range', 'ChoCh']),
      sl_placement: pick(['Below structure', 'Below wick', 'Below OB']),
      news_day: Math.random() > 0.7,
      news_label: Math.random() > 0.7 ? pick(['NFP', 'CPI', 'FOMC', 'ECB', 'GDP']) : null,
      comment: Math.random() > 0.5 ? pick([
        'Setup propre, entrée sur M5 OB',
        'Contexte H4 bullish, break de structure M15',
        'Sweep de liquidité + FVG M5',
        'ChoCh M15 + confirmation M1',
        'Range break avec volume',
      ]) : null,
    });

    if (error) { console.error(`   ❌ Trade ${i}: ${error.message}`); }
    else tradesCreated++;
  }
  console.log(`   ✅ ${tradesCreated} trades created (${existingTradeNums.size} already existed)`);

  // ── 4. User Cycles ──
  console.log('\n🔄 Creating user cycles...');
  const userCycleMap: Record<string, { id: string; cycleIdx: number; status: string }[]> = {};
  let ucCreated = 0;

  // Take ~25 EA users for cycles
  const cycleUsers = eaUserIds.slice(0, Math.min(25, eaUserIds.length));

  for (let i = 0; i < cycleUsers.length; i++) {
    const userId = cycleUsers[i];
    userCycleMap[userId] = [];

    // How many cycles this user has progressed through
    let numCycles: number;
    if (i < 5) numCycles = 3; // advanced: all 3 cycles
    else if (i < 12) numCycles = 2; // intermediate: 2 cycles
    else numCycles = 1; // beginner: 1 cycle

    for (let c = 0; c < numCycles && c < cycleIds.length; c++) {
      const isLast = c === numCycles - 1;
      let status: string;
      let completedTrades: number;

      if (!isLast) {
        status = 'validated';
        completedTrades = 20;
      } else {
        // Last cycle: various statuses
        const roll = Math.random();
        if (roll < 0.25) { status = 'in_progress'; completedTrades = randInt(5, 18); }
        else if (roll < 0.5) { status = 'pending_review'; completedTrades = 20; }
        else if (roll < 0.8) { status = 'validated'; completedTrades = 20; }
        else { status = 'rejected'; completedTrades = 20; }
      }

      const { data: existingUC } = await supabase.from('user_cycles').select('id')
        .eq('user_id', userId).eq('cycle_id', cycleIds[c]).maybeSingle();

      if (existingUC) {
        userCycleMap[userId].push({ id: existingUC.id, cycleIdx: c, status });
        continue;
      }

      const totalRr = +(completedTrades * pick([1.5, 2, 2.5, 3]) * (Math.random() > 0.2 ? 1 : -0.5)).toFixed(1);

      const { data, error } = await supabase.from('user_cycles').insert({
        user_id: userId,
        cycle_id: cycleIds[c],
        status,
        started_at: randomDate(50 - c * 15),
        completed_at: completedTrades === 20 ? randomDate(30 - c * 10) : null,
        completed_trades: completedTrades,
        total_rr: totalRr,
        admin_feedback: status === 'rejected' ? 'Quelques trades ne correspondent pas aux setups Oracle. Revoir les entrées M5.' : null,
        verified_at: status === 'validated' ? randomDate(20) : null,
        verified_by: status === 'validated' ? adminUserId : null,
      }).select('id').single();

      if (error) { console.error(`   ❌ UserCycle ${userId.slice(0, 6)} C${c + 1}: ${error.message}`); }
      else {
        userCycleMap[userId].push({ id: data.id, cycleIdx: c, status });
        ucCreated++;
      }
    }
  }
  console.log(`   ✅ ${ucCreated} user_cycles created`);

  // ── 5. User Executions ──
  console.log('\n📝 Creating user executions...');
  let execCreated = 0;

  for (const userId of Object.keys(userCycleMap)) {
    for (const uc of userCycleMap[userId]) {
      const tradeStart = cycleData[uc.cycleIdx].trade_start;
      const numTrades = uc.status === 'in_progress' ? randInt(5, 18) : 20;

      for (let t = 0; t < numTrades; t++) {
        const tradeNum = tradeStart + t;
        const dir = Math.random() > 0.35 ? 'LONG' : 'SHORT';
        const isMatch = Math.random() > 0.15; // 85% match oracle
        const entryHour = randInt(8, 16);
        const rr = isMatch ? pick([1.5, 2, 2.5, 3, 3.5]) : pick([0.5, 1, -1, -0.5]);

        const { error } = await supabase.from('user_executions').insert({
          user_id: userId,
          trade_number: tradeNum,
          trade_date: pastDate(60 - tradeNum + randInt(0, 2)),
          direction: isMatch ? dir : pick(DIRECTIONS),
          entry_time: `${String(entryHour + (isMatch ? 0 : randInt(0, 2))).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}`,
          entry_timeframe: pick(TIMEFRAMES),
          setup_type: pick(SETUPS),
          rr,
          result: rr > 0 ? 'win' : rr === 0 ? 'break_even' : 'loss',
          notes: Math.random() > 0.7 ? pick([
            'Bonne entrée, respect du plan',
            'Hésitation à l\'entrée, à améliorer',
            'SL touché, mauvais timing',
            'TP atteint rapidement, setup parfait',
            'Entrée tardive mais profitable',
          ]) : null,
        });

        if (!error) execCreated++;
      }
    }
  }
  console.log(`   ✅ ${execCreated} user_executions created`);

  // ── 6. Verification Requests ──
  console.log('\n🔍 Creating verification requests...');
  let vrCreated = 0;

  for (const userId of Object.keys(userCycleMap)) {
    for (const uc of userCycleMap[userId]) {
      if (!['pending_review', 'validated', 'rejected'].includes(uc.status)) continue;

      const vrStatus = uc.status === 'pending_review' ? 'pending' : uc.status === 'validated' ? 'approved' : 'rejected';

      const { data: existingVR } = await supabase.from('verification_requests').select('id')
        .eq('user_cycle_id', uc.id).maybeSingle();
      if (existingVR) continue;

      const { data, error } = await supabase.from('verification_requests').insert({
        user_id: userId,
        user_cycle_id: uc.id,
        cycle_id: cycleIds[uc.cycleIdx],
        status: vrStatus,
        requested_at: randomDate(15),
        reviewed_at: vrStatus !== 'pending' ? randomDate(10) : null,
        reviewed_by: vrStatus !== 'pending' ? adminUserId : null,
        assigned_to: vrStatus === 'pending' ? adminUserId : null,
        admin_comments: vrStatus === 'rejected' ? 'Trades 12 et 17 ne matchent pas les setups Oracle.' : null,
      }).select('id').single();

      if (error) { console.error(`   ❌ VR: ${error.message}`); }
      else { vrCreated++; }
    }
  }
  console.log(`   ✅ ${vrCreated} verification_requests created`);

  // ── 7. EA Activity Tracking ──
  console.log('\n📡 Creating activity tracking...');
  let actCreated = 0;

  for (const userId of eaUserIds.slice(0, 30)) {
    const isOnline = Math.random() > 0.7;
    const tabs = ['execution', 'setup', 'data-analysis', 'videos', 'results'];

    const { data: existing } = await supabase.from('ea_activity_tracking').select('id').eq('user_id', userId).maybeSingle();
    if (existing) continue;

    const { error } = await supabase.from('ea_activity_tracking').insert({
      user_id: userId,
      active_tab: pick(tabs),
      last_heartbeat: isOnline ? new Date().toISOString() : randomDate(3),
      button_clicks: {
        continuer_ma_recolte: randInt(0, 15),
        acceder_a_oracle: randInt(0, 8),
        video_bonus: randInt(0, 5),
      },
    });

    if (!error) actCreated++;
  }
  console.log(`   ✅ ${actCreated} activity records created`);

  // ── 8. Videos ──
  console.log('\n🎥 Creating videos...');
  const videoData = [
    { title: 'Introduction à Oracle', description: 'Présentation du système Oracle et ses fondamentaux', embed_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', accessible_roles: ['early_access', 'member'], sort_order: 1 },
    { title: 'Setup Break & Retest', description: 'Comment identifier et exécuter un Break & Retest', embed_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', accessible_roles: ['early_access', 'member'], sort_order: 2 },
    { title: 'Gestion du Risque', description: 'Position sizing et money management', embed_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', accessible_roles: ['early_access', 'member'], sort_order: 3 },
    { title: 'Order Blocks Avancés', description: 'Identification des OB institutionnels', embed_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', accessible_roles: ['member'], sort_order: 4 },
    { title: 'Psychologie du Trading', description: 'Gérer ses émotions en live', embed_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', accessible_roles: ['early_access', 'member'], sort_order: 5 },
    { title: 'Session London Setup', description: 'Exploiter l\'ouverture de Londres', embed_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', accessible_roles: ['member'], sort_order: 6 },
    { title: 'Bonus: Prop Firm Strategy', description: 'Passer les challenges de prop firms', embed_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', accessible_roles: ['member'], sort_order: 7 },
    { title: 'FAQ & Questions Fréquentes', description: 'Réponses aux questions courantes', embed_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', accessible_roles: ['early_access', 'member'], sort_order: 8 },
  ];

  let vidCreated = 0;
  for (const v of videoData) {
    const { data: existing } = await supabase.from('videos').select('id').eq('title', v.title).maybeSingle();
    if (existing) continue;
    const { error } = await supabase.from('videos').insert({ ...v, created_by: adminUserId });
    if (!error) vidCreated++;
  }
  console.log(`   ✅ ${vidCreated} videos created`);

  // ── 9. Quest Step Configs ──
  console.log('\n🏆 Creating quest configs...');
  const questData = [
    { target_role: 'early_access', target_phase: 'phase_1', step_label: 'Regarder la vidéo d\'introduction', step_order: 1, action_label: 'Voir la vidéo', action_url: '/dashboard?tab=videos' },
    { target_role: 'early_access', target_phase: 'phase_1', step_label: 'Configurer ton setup Oracle', step_order: 2, action_label: 'Aller au Setup', action_url: '/dashboard?tab=setup' },
    { target_role: 'early_access', target_phase: 'phase_1', step_label: 'Exécuter ton premier trade', step_order: 3, action_label: 'Commencer', action_url: '/dashboard?tab=execution' },
    { target_role: 'early_access', target_phase: 'phase_1', step_label: 'Analyser 5 trades Oracle', step_order: 4, action_label: 'Data Analysis', action_url: '/dashboard?tab=data-analysis' },
    { target_role: 'early_access', target_phase: 'phase_1', step_label: 'Compléter le Cycle 1', step_order: 5, action_label: 'Continuer', action_url: '/dashboard?tab=execution' },
  ];

  let qCreated = 0;
  for (const q of questData) {
    const { data: existing } = await supabase.from('quest_step_configs').select('id').eq('step_label', q.step_label).maybeSingle();
    if (existing) continue;
    const { error } = await supabase.from('quest_step_configs').insert({ ...q, created_by: adminUserId });
    if (!error) qCreated++;
  }
  console.log(`   ✅ ${qCreated} quest steps created`);

  // ── 10. User Quest Flags ──
  console.log('\n🚩 Creating quest flags...');
  let flagCreated = 0;
  for (const userId of eaUserIds.slice(0, 20)) {
    const numFlags = randInt(1, 5);
    for (let f = 0; f < numFlags; f++) {
      const flagKey = `quest_phase_1_step_${f + 1}`;
      const { data: existing } = await supabase.from('user_quest_flags').select('id').eq('user_id', userId).eq('flag_key', flagKey).maybeSingle();
      if (existing) continue;
      const { error } = await supabase.from('user_quest_flags').insert({
        user_id: userId,
        flag_key: flagKey,
        completed_at: randomDate(20),
      });
      if (!error) flagCreated++;
    }
  }
  console.log(`   ✅ ${flagCreated} quest flags created`);

  // ── 11. Security Alerts ──
  console.log('\n🚨 Creating security alerts...');
  let alertCreated = 0;
  const alertUsers = eaUserIds.slice(0, 5);
  for (const userId of alertUsers) {
    const { data: existing } = await supabase.from('security_alerts').select('id').eq('user_id', userId).maybeSingle();
    if (existing) continue;
    const { error } = await supabase.from('security_alerts').insert({
      user_id: userId,
      alert_type: pick(['third_device_login', 'suspicious_ip', 'brute_force_attempt']),
      device_info: `Chrome ${randInt(110, 125)}.0 | Windows 11 | 1920x1080`,
      resolved: Math.random() > 0.5,
      resolved_at: Math.random() > 0.5 ? randomDate(5) : null,
      resolved_by: Math.random() > 0.5 ? adminUserId : null,
    });
    if (!error) alertCreated++;
  }
  console.log(`   ✅ ${alertCreated} security alerts created`);

  // ── 12. EA Lead Notes ──
  console.log('\n📝 Creating lead notes...');
  let noteCreated = 0;
  const { data: eaRequests } = await supabase.from('early_access_requests').select('id').limit(30);
  for (const req of (eaRequests || []).slice(0, 20)) {
    const numNotes = randInt(1, 3);
    for (let n = 0; n < numNotes; n++) {
      const { error } = await supabase.from('ea_lead_notes').insert({
        request_id: req.id,
        author_id: adminUserId,
        note: pick([
          'Premier contact WhatsApp — intéressé par le programme',
          'Rappel envoyé, attend le bon moment pour commencer',
          'A déjà de l\'expérience en trading, cherche un système',
          'Budget confirmé, on planifie le call',
          'Motivé, a vu les résultats sur Instagram',
          'Demande plus d\'infos sur la durée du programme',
          'Call prévu semaine prochaine',
          'Hésitant sur le prix, relancer dans 3 jours',
        ]),
      });
      if (!error) noteCreated++;
    }
  }
  console.log(`   ✅ ${noteCreated} lead notes created`);

  // ── 13. User Followups ──
  console.log('\n📋 Creating user followups...');
  let fuCreated = 0;
  // Take 5 "paid" users for followup
  const { data: paidRequests } = await supabase.from('early_access_requests').select('user_id').not('paid_at', 'is', null).limit(5);
  for (const req of (paidRequests || [])) {
    if (!req.user_id) continue;
    for (let day = 1; day <= randInt(5, 14); day++) {
      const { error } = await supabase.from('user_followups').insert({
        user_id: req.user_id,
        day_number: day,
        contact_date: pastDate(30 - day),
        contacted_by: adminUserId,
        call_done: day % 3 === 0,
        message_sent: true,
        correct_actions: Math.random() > 0.2,
        is_blocked: Math.random() > 0.85,
        notes: day === 1 ? 'Premier jour — onboarding fait, accès configuré' : (Math.random() > 0.6 ? pick([
          'Progresse bien, a exécuté 3 trades',
          'Bloqué sur le setup, appel de support',
          'Très actif, déjà 2 cycles',
          'Absent — relancer demain',
        ]) : null),
      });
      if (!error) fuCreated++;
    }
  }
  console.log(`   ✅ ${fuCreated} followup entries created`);

  // ── 14. EA Global Settings ──
  console.log('\n⚙️  Creating global settings...');
  const globalSettings = [
    { setting_key: 'precall_video_url', setting_value: 'https://www.youtube.com/embed/dQw4w9WgXcQ' },
    { setting_key: 'precall_cta_url', setting_value: 'https://cal.com/contact.capitalmercure/oracle' },
    { setting_key: 'default_timer_hours', setting_value: '72' },
  ];
  for (const s of globalSettings) {
    const { data: existing } = await supabase.from('ea_global_settings').select('id').eq('setting_key', s.setting_key).maybeSingle();
    if (existing) continue;
    await supabase.from('ea_global_settings').insert({ ...s, updated_by: adminUserId });
  }
  console.log(`   ✅ Global settings configured`);

  // ── 15. Notifications ──
  console.log('\n🔔 Creating notifications...');
  let notifCreated = 0;
  for (const userId of eaUserIds.slice(0, 15)) {
    const numNotifs = randInt(2, 5);
    for (let n = 0; n < numNotifs; n++) {
      const notifType = pick(['cycle_validated', 'cycle_rejected', 'new_video', 'timer_warning', 'welcome']);
      const messages: Record<string, string> = {
        cycle_validated: 'Ton cycle a été validé ! Le prochain est débloqué.',
        cycle_rejected: 'Cycle rejeté — vérifie les trades marqués et réessaie.',
        new_video: 'Nouvelle vidéo disponible : Psychologie du Trading',
        timer_warning: 'Ton accès Early Access expire dans 24h.',
        welcome: 'Bienvenue sur Oracle ! Commence par la vidéo d\'introduction.',
      };

      const { error } = await supabase.from('user_notifications').insert({
        user_id: userId,
        type: notifType,
        message: messages[notifType],
        read: Math.random() > 0.4,
        sender_id: adminUserId,
      });
      if (!error) notifCreated++;
    }
  }
  console.log(`   ✅ ${notifCreated} notifications created`);

  // ── Done ──
  console.log('\n' + '═'.repeat(50));
  console.log('✅ FULL SEED COMPLETE');
  console.log('═'.repeat(50));
  console.log('\nYour test environment now has:');
  console.log('  • 3 master cycles (60 oracle trades)');
  console.log('  • ~25 users with cycle progression');
  console.log('  • ~300+ user trade executions');
  console.log('  • Verification requests (pending/approved/rejected)');
  console.log('  • Activity tracking for 30 users');
  console.log('  • 8 videos + 5 quest steps');
  console.log('  • Security alerts, notifications, lead notes');
  console.log('  • User followups for paid clients');
  console.log('\n📌 Test password for all users: TestOracle2026!');
}

main().catch(console.error);
