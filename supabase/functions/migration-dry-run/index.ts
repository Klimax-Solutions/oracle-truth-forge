// Migration dry-run — SIMULATION. Zero writes on either side.
// For each eligible user, lists exactly what WOULD be inserted/copied.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PER_USER_TABLES = [
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
] as const;

const STORAGE_BUCKETS = [
  "trade-screenshots",
  "success-screenshots",
  "avatars",
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") ?? "0", 10); // 0 = all
    const verbose = url.searchParams.get("verbose") === "1";

    const SOURCE_URL = Deno.env.get("SUPABASE_URL")!;
    const SOURCE_SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const TARGET_URL = Deno.env.get("TARGET_SUPABASE_URL")!;
    const TARGET_SR = Deno.env.get("TARGET_SUPABASE_SERVICE_ROLE_KEY")!;

    const source = createClient(SOURCE_URL, SOURCE_SR, {
      auth: { persistSession: false },
    });
    const target = createClient(TARGET_URL, TARGET_SR, {
      auth: { persistSession: false },
    });

    // ---- 1) Source: identify eligible users ----
    const EXCLUDED = ["early_access", "setter", "admin", "super_admin"];
    const { data: allRoles, error: rolesErr } = await source
      .from("user_roles")
      .select("user_id, role");
    if (rolesErr) throw new Error(`source.user_roles: ${rolesErr.message}`);

    const rolesByUser = new Map<string, Set<string>>();
    for (const r of allRoles ?? []) {
      if (!rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, new Set());
      rolesByUser.get(r.user_id)!.add(r.role);
    }

    const eligible: string[] = [];
    for (const [uid, roles] of rolesByUser.entries()) {
      if (EXCLUDED.some((r) => roles.has(r))) continue;
      if (!roles.has("member") && !roles.has("institute")) continue;
      eligible.push(uid);
    }

    // ---- 2) Target skip-list ----
    const targetUserIds = new Set<string>();
    let page = 1;
    while (true) {
      const { data, error } = await target.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error) throw new Error(`target.listUsers p${page}: ${error.message}`);
      for (const u of data.users) targetUserIds.add(u.id);
      if (data.users.length < 1000) break;
      page++;
      if (page > 50) break;
    }

    const toMigrate = eligible.filter((id) => !targetUserIds.has(id));
    const toSkip = eligible.filter((id) => targetUserIds.has(id));

    // ---- 3) Apply optional limit (for fast dry-run testing) ----
    const subset = limit > 0 ? toMigrate.slice(0, limit) : toMigrate;

    // ---- 4) Profiles map for display names ----
    const { data: profiles } = await source
      .from("profiles")
      .select("user_id, first_name, display_name")
      .in("user_id", subset);
    const profileByUid = new Map(
      (profiles ?? []).map((p) => [p.user_id, p]),
    );

    // ---- 5) Per-user counts (parallel batches of 10 to avoid rate limits) ----
    const perUserReports: Array<Record<string, unknown>> = [];
    const totals: Record<string, number> = {};
    for (const t of PER_USER_TABLES) totals[t] = 0;
    let totalStorageFiles = 0;
    let totalStorageBytes = 0;

    const BATCH = 8;
    for (let i = 0; i < subset.length; i += BATCH) {
      const chunk = subset.slice(i, i + BATCH);
      const results = await Promise.all(
        chunk.map(async (uid) => {
          const profile = profileByUid.get(uid);
          const counts: Record<string, number | string> = {};

          // Per-table counts
          for (const t of PER_USER_TABLES) {
            let q = source.from(t).select("*", { count: "exact", head: true });
            // custom_setups has no user_id col — use created_by OR assigned_to
            if (t === "custom_setups") {
              q = q.or(`created_by.eq.${uid},assigned_to.eq.${uid}`);
            } else {
              q = q.eq("user_id", uid);
            }
            const { count, error } = await q;
            if (error) {
              counts[t] = `ERR: ${error.message}`;
            } else {
              counts[t] = count ?? 0;
              totals[t] += count ?? 0;
            }
          }

          // admin_trade_notes via verification_requests of this user
          // (admin_trade_notes has no user_id col — link via verification_request_id)
          const { data: vrIds } = await source
            .from("verification_requests")
            .select("id")
            .eq("user_id", uid);
          let atnCount = 0;
          if (vrIds && vrIds.length > 0) {
            const { count } = await source
              .from("admin_trade_notes")
              .select("*", { count: "exact", head: true })
              .in("verification_request_id", vrIds.map((v) => v.id));
            atnCount = count ?? 0;
          }
          counts["admin_trade_notes"] = atnCount;
          totals["admin_trade_notes"] = (totals["admin_trade_notes"] ?? 0) + atnCount;

          // Storage scan
          const storage: Record<string, { files: number; bytes: number }> = {};
          let userFiles = 0;
          let userBytes = 0;
          for (const bucket of STORAGE_BUCKETS) {
            const { data: files, error: stErr } = await source.storage
              .from(bucket)
              .list(uid, { limit: 1000 });
            if (stErr || !files) {
              storage[bucket] = { files: 0, bytes: 0 };
              continue;
            }
            const fileCount = files.length;
            const byteSum = files.reduce(
              (s, f) => s + (f.metadata?.size ?? 0),
              0,
            );
            storage[bucket] = { files: fileCount, bytes: byteSum };
            userFiles += fileCount;
            userBytes += byteSum;
          }
          totalStorageFiles += userFiles;
          totalStorageBytes += userBytes;

          return {
            user_id: uid,
            first_name: profile?.first_name ?? null,
            display_name: profile?.display_name ?? null,
            roles: Array.from(rolesByUser.get(uid) ?? []),
            counts,
            storage,
            storage_total_files: userFiles,
            storage_total_mb: +(userBytes / 1024 / 1024).toFixed(2),
          };
        }),
      );
      perUserReports.push(...results);
    }

    // ---- 6) Build response ----
    const summary = {
      timestamp: new Date().toISOString(),
      source_eligible_total: eligible.length,
      target_existing_users: targetUserIds.size,
      will_migrate: toMigrate.length,
      will_skip_overlap: toSkip.length,
      simulated_in_this_run: subset.length,
      totals_to_insert: totals,
      total_storage_files: totalStorageFiles,
      total_storage_mb: +(totalStorageBytes / 1024 / 1024).toFixed(2),
    };

    const response: Record<string, unknown> = { summary };
    if (verbose) {
      response.users = perUserReports;
    } else {
      // Compact view: top 10 by activity
      response.users_top10_by_executions = perUserReports
        .slice()
        .sort(
          (a, b) =>
            ((b.counts as Record<string, number>).user_executions ?? 0) -
            ((a.counts as Record<string, number>).user_executions ?? 0),
        )
        .slice(0, 10)
        .map((u) => ({
          first_name: u.first_name,
          display_name: u.display_name,
          executions: (u.counts as Record<string, number>).user_executions,
          personal_trades: (u.counts as Record<string, number>)
            .user_personal_trades,
          cycles: (u.counts as Record<string, number>).user_cycles,
          storage_mb: u.storage_total_mb,
        }));
      response.users_no_first_name = perUserReports
        .filter((u) => !u.first_name)
        .map((u) => ({
          user_id: u.user_id,
          display_name: u.display_name,
        }));
    }

    return new Response(JSON.stringify(response, null, 2), {
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
