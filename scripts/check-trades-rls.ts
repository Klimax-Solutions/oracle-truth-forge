import { createClient } from '@supabase/supabase-js';

const MKOG_URL = 'https://mkogljvoqqcnqrgcnfau.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rb2dsanZvcXFjbnFyZ2NuZmF1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTgxOTEyNywiZXhwIjoyMDkxMzk1MTI3fQ.AMP1gT0K6pAvAyWPko2RoX_LaZQVqH1d2IC2hAxWf2U';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rb2dsanZvcXFjbnFyZ2NuZmF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MTkxMjcsImV4cCI6MjA5MTM5NTEyN30.AJi3XH4Ij0tVuC8AkWrINjCjGnW1YnKGsIhADVl1JhM';

const sbAdmin = createClient(MKOG_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false }});

async function run() {
  // Sign in as Charles (super_admin)
  const sbCharles = createClient(MKOG_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false }});
  const { data: signIn, error: signInErr } = await sbCharles.auth.signInWithPassword({
    email: 'charles.terrier.7@gmail.com',
    password: 'Oracle2026!'
  });
  if (signInErr) { console.log('Charles login error:', signInErr.message); }
  else {
    const { count: charlesCount } = await sbCharles.from('trades').select('*', { count: 'exact', head: true });
    console.log('Charles (super_admin) voit:', charlesCount, 'trades');
    await sbCharles.auth.signOut();
  }

  // Sign in as EA user
  const sbEA = createClient(MKOG_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false }});
  const { data: signInEA, error: signInEAErr } = await sbEA.auth.signInWithPassword({
    email: 'test.nouveau@cycle-test.internal',
    password: 'Oracle2026!'
  });
  if (signInEAErr) { console.log('EA login error:', signInEAErr.message); }
  else {
    const { count: eaCount } = await sbEA.from('trades').select('*', { count: 'exact', head: true });
    console.log('test.nouveau (EA) voit:', eaCount, 'trades');
    // Test is_early_access
    const { data: isEA } = await sbEA.rpc('is_early_access' as any);
    const { data: isAdm } = await sbEA.rpc('is_admin' as any);
    console.log('  is_early_access():', isEA, '| is_admin():', isAdm);
    await sbEA.auth.signOut();
  }

  // Sign in as avance (C0+C1 validated)
  const sbAvance = createClient(MKOG_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false }});
  await sbAvance.auth.signInWithPassword({ email: 'test.avance@cycle-test.internal', password: 'Oracle2026!' });
  const { count: avanceCount } = await sbAvance.from('trades').select('*', { count: 'exact', head: true });
  const { data: isEAAvance } = await sbAvance.rpc('is_early_access' as any);
  console.log('test.avance (C0+C1) voit:', avanceCount, 'trades | is_early_access:', isEAAvance);
  await sbAvance.auth.signOut();
}
run().catch(console.error);
