/**
 * Seed 50 fake users on the TEST Supabase for CRM testing.
 * Creates auth users (no email sent), profiles, user_roles, early_access_requests, user_sessions.
 *
 * Usage: npx tsx scripts/seed-test-users.ts
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars (test project)
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

// ── Fake data ──

const FIRST_NAMES = [
  'Lucas', 'Hugo', 'Léo', 'Raphaël', 'Arthur', 'Louis', 'Jules', 'Adam',
  'Mathis', 'Nathan', 'Théo', 'Gabriel', 'Maxime', 'Enzo', 'Antoine',
  'Alexandre', 'Victor', 'Paul', 'Nolan', 'Thomas', 'Clément', 'Romain',
  'Nicolas', 'Pierre', 'Julien', 'Dylan', 'Yanis', 'Kevin', 'Mehdi',
  'Sofiane', 'Ibrahim', 'Moussa', 'Omar', 'Youssef', 'Karim', 'Samir',
  'Damien', 'Franck', 'Olivier', 'Sébastien', 'Jordan', 'Bryan', 'William',
  'Adrien', 'Thibault', 'Aurélien', 'Florian', 'Bastien', 'Quentin', 'Axel',
];

const DOMAINS = ['gmail.com', 'outlook.fr', 'hotmail.com', 'icloud.com', 'protonmail.com'];

const CONTACT_METHODS = ['whatsapp', 'email', null];
const CALL_OUTCOMES = ['contracted', 'closing_in_progress', 'not_closed', null];
const SETTER_NAMES = ['Saram', 'Clément', 'Mimi'];
const CLOSER_NAMES = ['Charles', 'Enzo'];

function randomDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysAgo));
  d.setHours(Math.floor(Math.random() * 14) + 8);
  d.setMinutes(Math.floor(Math.random() * 60));
  return d.toISOString();
}

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.floor(Math.random() * daysAhead) + 1);
  d.setHours(Math.floor(Math.random() * 8) + 10); // 10h-18h
  d.setMinutes([0, 15, 30, 45][Math.floor(Math.random() * 4)]);
  return d.toISOString();
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// ── User profiles to create ──

interface FakeUser {
  firstName: string;
  email: string;
  phone: string;
  // Pipeline stage
  stage: 'pending' | 'approved_precall' | 'contacted' | 'call_booked' | 'call_done' | 'paid' | 'expired';
}

function generateUsers(): FakeUser[] {
  const users: FakeUser[] = [];
  const stages: FakeUser['stage'][] = [
    // 8 pending (just submitted form)
    ...Array(8).fill('pending'),
    // 10 approved precall (approved, not yet contacted)
    ...Array(10).fill('approved_precall'),
    // 8 contacted (setter reached out)
    ...Array(8).fill('contacted'),
    // 7 call_booked (call scheduled)
    ...Array(7).fill('call_booked'),
    // 7 call_done (call happened, various outcomes)
    ...Array(7).fill('call_done'),
    // 5 paid (closed deals)
    ...Array(5).fill('paid'),
    // 5 expired (timer ran out)
    ...Array(5).fill('expired'),
  ];

  for (let i = 0; i < 50; i++) {
    const firstName = FIRST_NAMES[i];
    const domain = pick(DOMAINS);
    const email = `${firstName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}.test${i}@${domain}`;
    const phone = `+336${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`;
    users.push({ firstName, email, phone, stage: stages[i] });
  }
  return users;
}

// ── Main ──

async function main() {
  console.log('🚀 Seeding 50 fake users on test Supabase...\n');

  const users = generateUsers();
  let created = 0;
  let skipped = 0;

  for (const user of users) {
    const isPending = user.stage === 'pending';
    const isApproved = !isPending;
    const needsAuthUser = isApproved; // Only create auth user for approved+

    let userId: string | null = null;

    // ── Create auth user (no email sent) ──
    if (needsAuthUser) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: 'TestOracle2026!',
        email_confirm: true,
        user_metadata: { display_name: user.firstName },
      });

      if (error) {
        if (error.message.includes('already been registered')) {
          // Find existing
          const { data: { users: existing } } = await supabase.auth.admin.listUsers();
          const found = existing?.find(u => u.email === user.email);
          if (found) {
            userId = found.id;
            console.log(`  ⚡ ${user.email} already exists, using ${userId.slice(0, 8)}`);
          }
        } else {
          console.error(`  ❌ Auth error for ${user.email}: ${error.message}`);
          skipped++;
          continue;
        }
      } else {
        userId = data.user.id;
      }
    }

    // ── Build early_access_request row ──
    const createdAt = randomDate(60);
    const reviewedAt = isApproved ? randomDate(55) : null;
    const contacted = ['contacted', 'call_booked', 'call_done', 'paid'].includes(user.stage);
    const contactMethod = contacted ? pick(['whatsapp', 'email']) : null;
    const callBooked = ['call_booked', 'call_done', 'paid'].includes(user.stage);
    const callDone = ['call_done', 'paid'].includes(user.stage);
    const callScheduledAt = callBooked ? (callDone ? randomDate(10) : futureDate(7)) : null;
    const setterName = contacted ? pick(SETTER_NAMES) : (isApproved && Math.random() > 0.3 ? pick(SETTER_NAMES) : null);
    const closerName = callBooked ? pick(CLOSER_NAMES) : null;
    const callOutcome = callDone ? (user.stage === 'paid' ? 'contracted' : pick(['contracted', 'closing_in_progress', 'not_closed'])) : null;
    const callDebrief = callDone && Math.random() > 0.3 ? pick([
      'Très motivé, budget OK, attend le bon moment',
      'Hésite entre Oracle et un autre programme',
      'Budget serré mais vraiment intéressé',
      'A déjà tradé, veut passer au niveau supérieur',
      'Débutant total, besoin de rassurance',
      'Convaincu par les résultats, prêt à investir',
    ]) : null;
    const callNoShow = callDone && Math.random() > 0.85;
    const offerAmount = callDone ? pick(['1500', '2500', '3000', '5000', '3500']) : null;
    const checkoutUnlocked = user.stage === 'paid';
    const paidAmount = user.stage === 'paid' ? parseFloat(offerAmount || '2500') : null;
    const paidAt = user.stage === 'paid' ? randomDate(5) : null;

    let status: string;
    if (isPending) status = 'en_attente';
    else if (user.stage === 'expired') status = 'approuvée';
    else status = 'approuvée';

    // Check if email already in early_access_requests
    const { data: existing } = await supabase
      .from('early_access_requests')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();

    if (existing) {
      console.log(`  ⏭️  ${user.email} already in EA requests, skipping`);
      skipped++;
      continue;
    }

    const { error: insertErr } = await supabase
      .from('early_access_requests')
      .insert({
        first_name: user.firstName,
        email: user.email,
        phone: user.phone,
        status,
        created_at: createdAt,
        reviewed_at: reviewedAt,
        contacted,
        contact_method: contactMethod,
        form_submitted: true,
        call_booked: callBooked,
        call_done: callDone,
        user_id: userId,
        setter_name: setterName,
        closer_name: closerName,
        call_scheduled_at: callScheduledAt,
        call_outcome: callOutcome,
        call_debrief: callDebrief,
        call_no_show: callNoShow,
        offer_amount: offerAmount,
        checkout_unlocked: checkoutUnlocked,
        paid_amount: paidAmount,
        paid_at: paidAt,
      });

    if (insertErr) {
      console.error(`  ❌ Insert EA error for ${user.email}: ${insertErr.message}`);
      skipped++;
      continue;
    }

    // ── Profile ──
    if (userId) {
      await supabase.from('profiles').upsert({
        user_id: userId,
        first_name: user.firstName,
        display_name: user.firstName,
        status: 'active',
        created_at: createdAt,
      }, { onConflict: 'user_id' });

      // ── User role ──
      const eaType = user.stage === 'expired' ? 'precall' : (callDone ? 'postcall' : 'precall');
      const expiresAt = user.stage === 'expired'
        ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // expired yesterday
        : new Date(Date.now() + (Math.random() * 7 + 1) * 24 * 60 * 60 * 1000).toISOString();

      await supabase.from('user_roles').upsert({
        user_id: userId,
        role: 'early_access',
        early_access_type: eaType,
        expires_at: expiresAt,
      }, { onConflict: 'user_id,role' });

      // ── Fake sessions ──
      const sessionCount = Math.floor(Math.random() * 20) + 1;
      for (let s = 0; s < Math.min(sessionCount, 3); s++) {
        await supabase.from('user_sessions').insert({
          user_id: userId,
          session_token: crypto.randomUUID(),
          device_fingerprint: `TestDevice|1920x1080|fr-FR|${s}`,
          created_at: randomDate(30),
        }).then(() => {}); // ignore errors (duplicate fingerprint)
      }
    }

    const stageEmoji: Record<string, string> = {
      pending: '⏳', approved_precall: '✅', contacted: '📞',
      call_booked: '📅', call_done: '🎯', paid: '💰', expired: '⏰',
    };
    console.log(`  ${stageEmoji[user.stage]} ${user.firstName.padEnd(12)} ${user.stage.padEnd(16)} ${user.email}`);
    created++;
  }

  console.log(`\n✅ Done: ${created} created, ${skipped} skipped`);
  console.log('\n📌 All test users have password: TestOracle2026!');
  console.log('📌 Setter names: Saram, Clément, Mimi');
  console.log('📌 Closer names: Charles, Enzo');
}

main().catch(console.error);
