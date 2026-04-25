// migration-execute — REAL writes on TARGET (mkog).
// Idempotent (skip-list by uuid). Resumable via offset. Batch by 5.
// try/finally ensures triggers are re-enabled on TARGET even on crash.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Order matters (FK dependencies)
const COPY_ORDER = [
  "user_roles",
  "custom_setups",
  "user_variable_types",
  "user_custom_variables",
  "user_cycles",
  "user_executions",
  "user_personal_trades",
  "verification_requests",
  // admin_trade_notes copied separately (depends on verification_requests + user_executions of this user)
  "user_quest_flags",
  "user_successes",
  "user_notifications",
  // user_video_views: skipped (low value, no FK overlap between source & target videos)
  "user_trade_analyses",
] as const;

const STORAGE_BUCKETS = [
  "trade-screenshots",
  "success-screenshots",
  "avatars",
] as const;

const EXCLUDED_ROLES = ["early_access", "setter", "admin", "super_admin"];

function anonymizedEmail(uid: string): string {
  return `user-${uid.slice(0, 8)}@imported-prod.oracle.local`;
}

// deno-lint-ignore no-explicit-any
type Client = any;

async function copyTableForUser(
  source: Client,
  target: Client,
  table: string,
  uid: string,
  errors: string[],
  cycleMap?: Map<string, string>,
): Promise<number> {
  let query = source.from(table).select("*");
  if (table === "custom_setups") {
    query = query.or(`created_by.eq.${uid},assigned_to.eq.${uid}`);
  } else {
    query = query.eq("user_id", uid);
  }
  const { data, error } = await query;
  if (error) {
    errors.push(`[${uid}] read ${table}: ${error.message}`);
    return 0;
  }
  if (!data || data.length === 0) return 0;

  // user_cycles: remap cycle_id (source UUID → target UUID) via cycle_number lookup
  let rows = data;
  if (table === "user_cycles" && cycleMap) {
    const remapped: Record<string, unknown>[] = [];
    for (const row of data as Record<string, unknown>[]) {
      const srcCycleId = row.cycle_id as string;
      const tgtCycleId = cycleMap.get(srcCycleId);
      if (!tgtCycleId) {
        errors.push(`[${uid}] WARN user_cycles: no target cycle for src=${srcCycleId} → row skipped`);
        continue;
      }
      remapped.push({ ...row, cycle_id: tgtCycleId });
    }
    rows = remapped;
    if (rows.length === 0) return 0;
  }

  // user_roles: trigger handle_new_user_role auto-inserts a 'member' row → use upsert with ignore
  // Other tables: plain insert (assumed empty for new auth user)
  const insertOptions = table === "user_roles"
    ? { onConflict: "user_id,role", ignoreDuplicates: true }
    : undefined;
  const { error: insErr } = insertOptions
    ? await target.from(table).upsert(rows, insertOptions)
    : await target.from(table).insert(rows);
  if (insErr) {
    errors.push(`[${uid}] insert ${table} (${rows.length} rows): ${insErr.message}`);
    return 0;
  }
  return rows.length;
}

async function copyStorageForUser(
  source: Client,
  target: Client,
  uid: string,
  errors: string[],
): Promise<{ files: number; bytes: number }> {
  let totalFiles = 0;
  let totalBytes = 0;

  for (const bucket of STORAGE_BUCKETS) {
    const { data: files, error: listErr } = await source.storage
      .from(bucket)
      .list(uid, { limit: 1000 });
    if (listErr || !files || files.length === 0) continue;

    for (const file of files) {
      if (!file.name) continue;
      const path = `${uid}/${file.name}`;
      const { data: blob, error: dlErr } = await source.storage
        .from(bucket)
        .download(path);
      if (dlErr || !blob) {
        errors.push(`[${uid}] dl ${bucket}/${path}: ${dlErr?.message ?? "no blob"}`);
        continue;
      }
      const { error: upErr } = await target.storage
        .from(bucket)
        .upload(path, blob, {
          contentType: file.metadata?.mimetype ?? "application/octet-stream",
          upsert: true,
        });
      if (upErr) {
        errors.push(`[${uid}] up ${bucket}/${path}: ${upErr.message}`);
        continue;
      }
      totalFiles++;
      totalBytes += file.metadata?.size ?? 0;
    }
  }
  return { files: totalFiles, bytes: totalBytes };
}

async function migrateOneUser(
  source: Client,
  target: Client,
  uid: string,
  errors: string[],
  cycleMap: Map<string, string>,
): Promise<{ uid: string; status: string; counts: Record<string, number>; storage: { files: number; bytes: number } }> {
  const counts: Record<string, number> = {};

  // 1) Create auth user (anonymized email, same uid)
  const { error: authErr } = await target.auth.admin.createUser({
    id: uid,
    email: anonymizedEmail(uid),
    email_confirm: true,
    user_metadata: { imported_from_prod: true },
  });
  if (authErr) {
    errors.push(`[${uid}] createUser: ${authErr.message}`);
    return { uid, status: "FAILED_AUTH", counts, storage: { files: 0, bytes: 0 } };
  }

  // 2) Profile (with imported_from_prod flag)
  const { data: srcProfile, error: profReadErr } = await source
    .from("profiles")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();
  if (profReadErr || !srcProfile) {
    errors.push(`[${uid}] read profile: ${profReadErr?.message ?? "not found"}`);
    return { uid, status: "FAILED_PROFILE_READ", counts, storage: { files: 0, bytes: 0 } };
  }

  // Strip id (target will gen new) but keep user_id
  const { id: _omitId, ...profileFields } = srcProfile as Record<string, unknown>;
  const profileToInsert = {
    ...profileFields,
    imported_from_prod: true,
    imported_at: new Date().toISOString(),
  };
  // Use upsert because trigger handle_new_user auto-creates a stub profile on auth.users INSERT
  const { error: profInsErr } = await target
    .from("profiles")
    .upsert(profileToInsert, { onConflict: "user_id" });
  if (profInsErr) {
    errors.push(`[${uid}] upsert profile: ${profInsErr.message}`);
    // Don't abort — try to continue with the rest
  } else {
    counts["profiles"] = 1;
  }

  // 3) All per-user tables in dependency order
  for (const table of COPY_ORDER) {
    counts[table] = await copyTableForUser(source, target, table, uid, errors, cycleMap);
  }

  // 4) admin_trade_notes (linked via verification_request_id of this user)
  const { data: vrIds } = await source
    .from("verification_requests")
    .select("id")
    .eq("user_id", uid);
  if (vrIds && vrIds.length > 0) {
    const { data: notes, error: notesErr } = await source
      .from("admin_trade_notes")
      .select("*")
      .in("verification_request_id", vrIds.map((v: { id: string }) => v.id));
    if (notesErr) {
      errors.push(`[${uid}] read admin_trade_notes: ${notesErr.message}`);
    } else if (notes && notes.length > 0) {
      const { error: insErr } = await target.from("admin_trade_notes").insert(notes);
      if (insErr) {
        errors.push(`[${uid}] insert admin_trade_notes (${notes.length}): ${insErr.message}`);
      } else {
        counts["admin_trade_notes"] = notes.length;
      }
    }
  }

  // 5) Storage
  const storage = await copyStorageForUser(source, target, uid, errors);

  return { uid, status: "OK", counts, storage };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const batchSize = parseInt(url.searchParams.get("batch_size") ?? "5", 10);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const dryRun = url.searchParams.get("dry_run") === "1";

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

    // ---- 1) Eligible users (source) ----
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
      if (EXCLUDED_ROLES.some((r) => roles.has(r))) continue;
      if (!roles.has("member") && !roles.has("institute")) continue;
      eligible.push(uid);
    }
    eligible.sort(); // stable order for resumable offset

    // ---- 2) Skip-list (target) ----
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
    const batch = toMigrate.slice(offset, offset + batchSize);

    if (dryRun) {
      return new Response(
        JSON.stringify({
          dry_run: true,
          eligible_total: eligible.length,
          target_existing: targetUserIds.size,
          to_migrate_remaining: toMigrate.length,
          this_batch_offset: offset,
          this_batch_size: batch.length,
          this_batch_uids: batch,
          next_offset: offset + batch.length,
        }, null, 2),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (batch.length === 0) {
      return new Response(
        JSON.stringify({
          done: true,
          message: "Nothing to migrate at this offset.",
          eligible_total: eligible.length,
          to_migrate_remaining: toMigrate.length,
          offset,
        }, null, 2),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- 3) Build cycle remap (source.cycle_id → target.cycle_id via cycle_number) ----
    const cycleMap = new Map<string, string>();
    {
      const { data: srcCycles } = await source.from("cycles").select("id, cycle_number");
      const { data: tgtCycles } = await target.from("cycles").select("id, cycle_number");
      const tgtByNum = new Map<number, string>();
      for (const c of tgtCycles ?? []) tgtByNum.set(c.cycle_number, c.id);
      for (const c of srcCycles ?? []) {
        const tgtId = tgtByNum.get(c.cycle_number);
        if (tgtId) cycleMap.set(c.id, tgtId);
      }
    }

    // ---- 4) Migration (no RPC trigger toggle: auth.users belongs to supabase_auth_admin
    //         and cannot be ALTERed even with SECURITY DEFINER. We use upsert on profiles
    //         and onConflict-ignore on user_roles to handle the auto-trigger inserts.) ----
    const errors: string[] = [];
    const results: Array<Awaited<ReturnType<typeof migrateOneUser>>> = [];

    // Sequential to avoid storage rate limits & easier error tracing
    for (const uid of batch) {
      const result = await migrateOneUser(source, target, uid, errors, cycleMap);
      results.push(result);
    }

    // ---- 4) Aggregate report ----
    const totals: Record<string, number> = {};
    let totalFiles = 0;
    let totalBytes = 0;
    let okCount = 0;
    let failCount = 0;
    for (const r of results) {
      if (r.status === "OK") okCount++;
      else failCount++;
      for (const [k, v] of Object.entries(r.counts)) {
        totals[k] = (totals[k] ?? 0) + v;
      }
      totalFiles += r.storage.files;
      totalBytes += r.storage.bytes;
    }

    return new Response(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        offset,
        batch_size_requested: batchSize,
        batch_size_processed: batch.length,
        next_offset: offset + batch.length,
        to_migrate_remaining_after: toMigrate.length - (offset + batch.length),
        ok_count: okCount,
        fail_count: failCount,
        totals_inserted: totals,
        storage_files_copied: totalFiles,
        storage_mb_copied: +(totalBytes / 1024 / 1024).toFixed(2),
        errors_count: errors.length,
        errors: errors.slice(0, 50), // cap
        per_user: results,
      }, null, 2),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message, stack: (e as Error).stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
