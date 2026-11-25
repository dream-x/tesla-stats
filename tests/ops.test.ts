import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tesla-ops-"));
process.env.DATABASE_PATH = path.join(dir, "t.db");
process.env.BACKUP_DIR = path.join(dir, "backups");
process.env.BACKUP_KEEP = "2";

test("runBackup writes a readable copy and keeps only the newest files", async () => {
  const { runBackup } = await import("../src/lib/ops");
  const { getDb } = await import("../src/lib/db");
  getDb().prepare("INSERT INTO snapshots (ts, odometer_km, source) VALUES (1, 100, 'manual')").run();
  fs.mkdirSync(process.env.BACKUP_DIR!, { recursive: true });
  for (const f of ["tesla-20200101-0000.db", "tesla-20200102-0000.db", "unrelated.txt"]) {
    fs.writeFileSync(path.join(process.env.BACKUP_DIR!, f), "x");
  }
  const file = runBackup();
  const files = fs.readdirSync(process.env.BACKUP_DIR!).sort();
  assert.deepEqual(files, ["tesla-20200102-0000.db", path.basename(file), "unrelated.txt"].sort());
  const copy = new DatabaseSync(file, { readOnly: true });
  assert.deepEqual({ ...copy.prepare("SELECT odometer_km FROM snapshots").get() }, { odometer_km: 100 });
});

test("metrics expose state in Prometheus format", async () => {
  const { metricsText } = await import("../src/lib/ops");
  const text = metricsText();
  assert.match(text, /^tesla_stats_up 1$/m);
  assert.match(text, /^tesla_stats_odometer_km 100$/m);
  assert.match(text, /^tesla_stats_backup_last_timestamp_seconds \d+$/m);
  assert.doesNotMatch(text, /battery_level_percent/);
});
