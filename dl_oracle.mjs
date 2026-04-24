import { createClient } from "@supabase/supabase-js";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { execSync } from "node:child_process";

const SUPABASE_URL = "https://pggkwyhtplxyarctuoze.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error("Missing SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

const supabase = createClient(SUPABASE_URL, KEY);
const OUT = "/tmp/oracle-screenshots";
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

// 1. List all files in oracle/ folder
const { data: files, error: listErr } = await supabase.storage
  .from("trade-screenshots")
  .list("oracle", { limit: 2000, sortBy: { column: "name", order: "asc" } });
if (listErr) { console.error(listErr); process.exit(1); }
console.log(`Found ${files.length} files in oracle/`);

// 2. Download in parallel batches
const BATCH = 20;
let done = 0, failed = 0;
for (let i = 0; i < files.length; i += BATCH) {
  const batch = files.slice(i, i + BATCH);
  await Promise.all(batch.map(async (f) => {
    const { data, error } = await supabase.storage
      .from("trade-screenshots")
      .download(`oracle/${f.name}`);
    if (error || !data) { failed++; console.error("✗", f.name, error?.message); return; }
    await writeFile(`${OUT}/${f.name}`, Buffer.from(await data.arrayBuffer()));
    done++;
  }));
  process.stdout.write(`\r${done}/${files.length} (failed: ${failed})`);
}
console.log("");

// 3. Build CSV index from DB
const { data: trades, error: tErr } = await supabase
  .from("trades")
  .select("trade_number, trade_date, direction, screenshot_m15_m5, screenshot_m1")
  .order("trade_number", { ascending: true });
if (tErr) { console.error(tErr); process.exit(1); }

const csv = [
  "trade_number,trade_date,direction,context_file,entry_file",
  ...trades.map(t => [
    t.trade_number,
    t.trade_date ?? "",
    t.direction ?? "",
    t.screenshot_m15_m5 ? t.screenshot_m15_m5.replace(/^oracle\//, "") : "",
    t.screenshot_m1 ? t.screenshot_m1.replace(/^oracle\//, "") : "",
  ].join(","))
].join("\n");
await writeFile(`${OUT}/index.csv`, csv);
console.log(`Wrote index.csv (${trades.length} trades)`);

// 4. Zip it
execSync(`cd /tmp && rm -f /mnt/documents/oracle-screenshots.zip && zip -rq /mnt/documents/oracle-screenshots.zip oracle-screenshots`);
const sz = execSync(`du -h /mnt/documents/oracle-screenshots.zip | cut -f1`).toString().trim();
console.log(`✓ ZIP created: ${sz}`);
