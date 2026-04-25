// Read-only status check on TARGET (mkog) — no writes.
// Verifies what was actually inserted after a (possibly timed-out) migration-execute call.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const TARGET_URL = Deno.env.get("TARGET_SUPABASE_URL")!;
    const TARGET_SR = Deno.env.get("TARGET_SUPABASE_SERVICE_ROLE_KEY")!;
    const target = createClient(TARGET_URL, TARGET_SR, {
      auth: { persistSession: false },
    });

    // Count auth users with imported flag
    const allAuthUsers: { id: string; email: string | null; created_at: string }[] = [];
    let page = 1;
    while (true) {
      const { data, error } = await target.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(`listUsers: ${error.message}`);
      for (const u of data.users) {
        allAuthUsers.push({ id: u.id, email: u.email ?? null, created_at: u.created_at });
      }
      if (data.users.length < 1000) break;
      page++;
      if (page > 50) break;
    }
    const importedAuth = allAuthUsers.filter((u) => u.email?.includes("@imported-prod.oracle.local"));

    // Count imported profiles
    const { count: importedProfiles } = await target
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("imported_from_prod", true);

    // List most recent imported profiles
    const { data: recentImported } = await target
      .from("profiles")
      .select("user_id, first_name, display_name, imported_at")
      .eq("imported_from_prod", true)
      .order("imported_at", { ascending: false })
      .limit(20);

    // Trigger state check (best-effort: try inserting a test no-op via RPC if exposed)
    // We can't query pg_trigger directly via JS client, so just report.

    return new Response(JSON.stringify({
      target_total_auth_users: allAuthUsers.length,
      target_imported_auth_users: importedAuth.length,
      target_imported_profiles: importedProfiles ?? 0,
      recent_imported_profiles: recentImported ?? [],
      sample_imported_emails: importedAuth.slice(0, 10).map(u => u.email),
    }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
