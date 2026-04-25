// FK reference check: compare cycles/videos between source (pggk) and target (mkog)
// to detect UUID mismatches before continuing migration.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const source = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const target = createClient(
      Deno.env.get("TARGET_SUPABASE_URL")!,
      Deno.env.get("TARGET_SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // ---- cycles ----
    const { data: srcCycles } = await source.from("cycles").select("id, cycle_number, name").order("cycle_number");
    const { data: tgtCycles } = await target.from("cycles").select("id, cycle_number, name").order("cycle_number");
    const srcCycleIds = new Set((srcCycles ?? []).map((c: { id: string }) => c.id));
    const tgtCycleIds = new Set((tgtCycles ?? []).map((c: { id: string }) => c.id));
    const cycleIdOverlap = [...srcCycleIds].filter((id) => tgtCycleIds.has(id)).length;

    const cycleMap: Array<{ cycle_number: number; src_id: string; tgt_id: string | null; match: boolean }> = [];
    for (const sc of srcCycles ?? []) {
      const tc = (tgtCycles ?? []).find((t: { cycle_number: number }) => t.cycle_number === sc.cycle_number);
      cycleMap.push({
        cycle_number: sc.cycle_number,
        src_id: sc.id,
        tgt_id: tc?.id ?? null,
        match: tc?.id === sc.id,
      });
    }

    // ---- videos ----
    const { data: srcVideos } = await source.from("videos").select("id, title");
    const { data: tgtVideos } = await target.from("videos").select("id, title");
    const srcVideoIds = new Set((srcVideos ?? []).map((v: { id: string }) => v.id));
    const tgtVideoIds = new Set((tgtVideos ?? []).map((v: { id: string }) => v.id));
    const videoIdOverlap = [...srcVideoIds].filter((id) => tgtVideoIds.has(id)).length;

    return new Response(JSON.stringify({
      cycles: {
        source_count: srcCycles?.length ?? 0,
        target_count: tgtCycles?.length ?? 0,
        uuid_overlap: cycleIdOverlap,
        all_match: cycleIdOverlap === (srcCycles?.length ?? 0),
        per_cycle: cycleMap,
      },
      videos: {
        source_count: srcVideos?.length ?? 0,
        target_count: tgtVideos?.length ?? 0,
        uuid_overlap: videoIdOverlap,
        all_match: videoIdOverlap === (srcVideos?.length ?? 0),
        source_titles: (srcVideos ?? []).map((v: { title: string }) => v.title),
        target_titles: (tgtVideos ?? []).map((v: { title: string }) => v.title),
      },
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
