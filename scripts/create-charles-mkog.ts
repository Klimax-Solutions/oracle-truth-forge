/**
 * Crée le compte charles.terrier.7@gmail.com sur mkog avec rôle super_admin + admin.
 * À ne lancer qu'une seule fois. Idempotent.
 */
import { createClient } from '@supabase/supabase-js';

const MKOG_URL = 'https://mkogljvoqqcnqrgcnfau.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rb2dsanZvcXFjbnFyZ2NuZmF1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTgxOTEyNywiZXhwIjoyMDkxMzk1MTI3fQ.AMP1gT0K6pAvAyWPko2RoX_LaZQVqH1d2IC2hAxWf2U';
const sb = createClient(MKOG_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false }});

const EMAIL = 'charles.terrier.7@gmail.com';
const PASSWORD = 'Oracle2026!';

async function main() {
  // Check if already exists
  const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 200 });
  let charlesUser = users.find(u => u.email === EMAIL);

  if (charlesUser) {
    console.log('✓ Compte existant :', charlesUser.id);
  } else {
    // Create
    const { data, error } = await sb.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { first_name: 'Charles', display_name: 'Charles' }
    });
    if (error) { console.error('❌ Create error:', error.message); process.exit(1); }
    charlesUser = data.user;
    console.log('✓ Compte créé :', charlesUser!.id);
  }

  const userId = charlesUser!.id;

  // Ensure profile
  await sb.from('profiles').upsert({
    user_id: userId,
    first_name: 'Charles',
    display_name: 'Charles'
  }, { onConflict: 'user_id' });

  // Add super_admin and admin roles (upsert)
  for (const role of ['super_admin', 'admin'] as const) {
    const { error } = await sb.from('user_roles').upsert(
      { user_id: userId, role },
      { onConflict: 'user_id,role' }
    );
    if (error) console.warn(`  ⚠️  ${role} role:`, error.message);
    else console.log(`  ✓ role ${role}`);
  }

  // Check is_admin() exists and test
  const { data: isAdm, error: admErr } = await sb.rpc('is_admin' as any, {}, 
    { headers: { 'X-Supabase-Impersonate': userId } } as any
  );
  console.log('\nis_admin() test (may not work via service role):', isAdm, admErr?.message);

  console.log('\n✅ Charles est super_admin sur mkog !');
  console.log('   Email :', EMAIL);
  console.log('   Password :', PASSWORD);
  console.log('   Sur localhost:3004, connecte-toi avec ces credentials.');
}
main().catch(console.error);
