// Migration recon — READ-ONLY scan of source (this project) and target (mkog).
// Zero writes on either side. Outputs a JSON report.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SOURCE_URL = Deno.env.get("SUPABASE_URL");
    const SOURCE_SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const TARGET_URL = Deno.env.get("TARGET_SUPABASE_URL");
    const TARGET_SR = Deno.env.get("TARGET_SUPABASE_SERVICE_ROLE_KEY");

    if (!SOURCE_URL || !SOURCE_SR) throw new Error("Missing SOURCE env");
    if (!TARGET_URL || !TARGET_SR)
      throw new Error("Missing TARGET_SUPABASE_URL or TARGET_SUPABASE_SERVICE_ROLE_KEY");

    const source = createClient(SOURCE_URL, SOURCE_SR, {
      auth: { persistSession: false },
    });
    const target = createClient(TARGET_URL, TARGET_SR, {
      auth: { persistSession: false },
    });

    const report: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      source_url: SOURCE_URL,
      target_url: TARGET_URL,
    };

    // ---- 1) SOURCE: identify eligible payable users ----
    // Eligible = has role 'member' OR 'institute' AND no excluded role
    const EXCLUDED = ["early_access", "setter", "admin", "super_admin"];
    // Note: 'closer' doesn't exist on source, skip safely.

    const { data: allRoles, error: rolesErr } = await source
      .from("user_roles")
      .select("user_id, role");
    if (rolesErr) throw new Error(`source.user_roles: ${rolesErr.message}`);

    const rolesByUser = new Map<string, Set<string>>();
    for (const r of allRoles ?? []) {
      if (!rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, new Set());
      rolesByUser.get(r.user_id)!.add(r.role);
    }

    const eligibleUserIds: string[] = [];
    const breakdown = { member_only: 0, institute_only: 0, both: 0 };
    for (const [uid, roles] of rolesByUser.entries()) {
      const hasExcluded = EXCLUDED.some((r) => roles.has(r));
      if (hasExcluded) continue;
      const hasMember = roles.has("member");
      const hasInstitute = roles.has("institute");
      if (!hasMember && !hasInstitute) continue;
      eligibleUserIds.push(uid);
      if (hasMember && hasInstitute) breakdown.both++;
      else if (hasMember) breakdown.member_only++;
      else breakdown.institute_only++;
    }

    report.source_total_users_with_roles = rolesByUser.size;
    report.source_eligible_users_count = eligibleUserIds.length;
    report.source_eligible_breakdown = breakdown;

    // ---- 2) TARGET: skip-list (existing auth.users) ----
    const targetUserIds = new Set<string>();
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error } = await target.auth.admin.listUsers({
        page,
        perPage,
      });
      if (error) throw new Error(`target.listUsers p${page}: ${error.message}`);
      for (const u of data.users) targetUserIds.add(u.id);
      if (data.users.length < perPage) break;
      page++;
      if (page > 50) break; // safety
    }
    report.target_existing_users_count = targetUserIds.size;

    // ---- 3) Overlap ----
    const overlap = eligibleUserIds.filter((id) => targetUserIds.has(id));
    const toMigrate = eligibleUserIds.filter((id) => !targetUserIds.has(id));
    report.overlap_count_will_skip = overlap.length;
    report.users_to_migrate_count = toMigrate.length;
    report.overlap_sample = overlap.slice(0, 10);

    // ---- 4) Per-user volume on source (sample first 5 to estimate) ----
    const sampleProfiles = await source
      .from("profiles")
      .select("user_id, first_name, display_name")
      .in("user_id", toMigrate.slice(0, 5));
    report.sample_users_to_migrate = sampleProfiles.data ?? [];

    // Aggregate counts on source for eligible users
    const tablesToCount = [
      "profiles",
      "user_roles",
      "custom_setups",
      "user_custom_variables",
      "user_variable_types",
      "user_personal_trades",
      "user_executions",
      "user_cycles",
      "user_quest_flags",
      "user_successes",
      "user_notifications",
      "user_video_views",
      "user_trade_analyses",
      "verification_requests",
      "admin_trade_notes",
    ];
    const sourceCounts: Record<string, number | string> = {};
    for (const t of tablesToCount) {
      try {
        const q = source.from(t).select("*", { count: "exact", head: true });
        // admin_trade_notes has no user_id col
        const { count, error } =
          t === "admin_trade_notes"
            ? await q
            : await q.in("user_id", eligibleUserIds);
        if (error) sourceCounts[t] = `ERR: ${error.message}`;
        else sourceCounts[t] = count ?? 0;
      } catch (e) {
        sourceCounts[t] = `EXC: ${(e as Error).message}`;
      }
    }
    report.source_row_counts_for_eligible_users = sourceCounts;

    // ---- 5) TARGET: enum app_role check (does 'institute' exist?) ----
    let targetEnumValues: string[] | string = "unknown";
    try {
      // Use a probe insert/select via pg_enum is not possible without RPC.
      // Workaround: try to list distinct roles already used.
      const { data: usedRoles } = await target
        .from("user_roles")
        .select("role")
        .limit(1000);
      const used = Array.from(new Set((usedRoles ?? []).map((r) => r.role)));
      targetEnumValues = `used_roles_observed: ${used.join(", ")} (full enum values cannot be introspected without RPC)`;
    } catch (e) {
      targetEnumValues = `ERR: ${(e as Error).message}`;
    }
    report.target_app_role_observed = targetEnumValues;

    // ---- 6) TARGET: storage buckets ----
    const { data: buckets, error: buckErr } = await target.storage.listBuckets();
    if (buckErr) report.target_buckets = `ERR: ${buckErr.message}`;
    else
      report.target_buckets = (buckets ?? []).map((b) => ({
        id: b.id,
        public: b.public,
      }));

    // ---- 7) TARGET: imported_from_prod column presence on profiles ----
    let importedFlagPresent: boolean | string = "unknown";
    try {
      const { error } = await target
        .from("profiles")
        .select("imported_from_prod")
        .limit(1);
      importedFlagPresent = !error;
      if (error) importedFlagPresent = `not present (${error.message})`;
    } catch (e) {
      importedFlagPresent = `EXC: ${(e as Error).message}`;
    }
    report.target_profiles_imported_flag_ready = importedFlagPresent;

    // ---- 8) TARGET: shared tables already populated? ----
    const sharedChecks: Record<string, number | string> = {};
    for (const t of ["trades", "cycles", "videos", "bonus_videos", "quest_step_configs"]) {
      try {
        const { count, error } = await target
          .from(t)
          .select("*", { count: "exact", head: true });
        sharedChecks[t] = error ? `ERR: ${error.message}` : count ?? 0;
      } catch (e) {
        sharedChecks[t] = `EXC: ${(e as Error).message}`;
      }
    }
    report.target_shared_table_counts = sharedChecks;

    return new Response(JSON.stringify(report, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message, stack: (e as Error).stack }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
