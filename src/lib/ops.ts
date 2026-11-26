import fs from "node:fs";
import path from "node:path";
import { getDb, getSetting, setSetting } from "./db";
import { isTeslaConfigured, isTeslaConnected } from "./tesla";

type PollStatus = "ok" | "asleep" | "skipped" | "error";

const g = globalThis as unknown as {
  __teslaPollCounters?: Record<PollStatus, number>;
  __teslaBackupStarted?: boolean;
};
const counters = (g.__teslaPollCounters ??= { ok: 0, asleep: 0, skipped: 0, error: 0 });

export function countPoll(status: PollStatus) {
  counters[status]++;
}

const ageSec = (ts: number | null) => (ts ? Math.round((Date.now() - ts) / 1000) : null);
const numSetting = (k: string) => {
  const v = Number(getSetting(k));
  return Number.isFinite(v) && v > 0 ? v : null;
};

// --- backups -------------------------------------------------------------

const BACKUP_DIR = process.env.BACKUP_DIR || "";
const BACKUP_KEEP = Math.max(1, Number(process.env.BACKUP_KEEP) || 14);
const BACKUP_EVERY_MS = 24 * 3600_000;
const BACKUP_RE = /^tesla-\d{8}-\d{4}\.db$/;

function stamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Consistent online copy via VACUUM INTO, then keeps the newest BACKUP_KEEP files. */
export function runBackup(): string {
  if (!BACKUP_DIR) throw new Error("BACKUP_DIR is not set");
  fs.mkdirSync(/*turbopackIgnore: true*/ BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `tesla-${stamp()}.db`);
  const tmp = `${file}.tmp`;
  fs.rmSync(/*turbopackIgnore: true*/ tmp, { force: true });
  try {
    getDb().prepare("VACUUM INTO ?").run(tmp);
    fs.chmodSync(/*turbopackIgnore: true*/ tmp, 0o600);
    fs.renameSync(/*turbopackIgnore: true*/ tmp, file);
  } catch (e) {
    fs.rmSync(/*turbopackIgnore: true*/ tmp, { force: true });
    throw e;
  }
  for (const f of fs.readdirSync(/*turbopackIgnore: true*/ BACKUP_DIR)) {
    if (f.endsWith(".db.tmp") && f !== path.basename(tmp)) {
      fs.rmSync(/*turbopackIgnore: true*/ path.join(BACKUP_DIR, f), { force: true });
    }
  }
  const old = fs
    .readdirSync(/*turbopackIgnore: true*/ BACKUP_DIR)
    .filter((f) => BACKUP_RE.test(f))
    .sort()
    .reverse()
    .slice(BACKUP_KEEP);
  for (const f of old) fs.rmSync(/*turbopackIgnore: true*/ path.join(BACKUP_DIR, f), { force: true });
  setSetting("backup_last_ts", String(Date.now()));
  setSetting("backup_last_error", null);
  return file;
}

export function startBackups() {
  if (!BACKUP_DIR || g.__teslaBackupStarted) return;
  g.__teslaBackupStarted = true;
  const tick = () => {
    const last = numSetting("backup_last_ts");
    if (!last || Date.now() - last >= BACKUP_EVERY_MS) {
      try {
        console.log("[backup] written", runBackup());
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setSetting("backup_last_error", msg);
        console.error("[backup]", msg);
      }
    }
  };
  setTimeout(tick, 60_000);
  setInterval(tick, 3600_000);
  console.log(`[backup] enabled: ${BACKUP_DIR}, keep ${BACKUP_KEEP}`);
}

// --- health & metrics ----------------------------------------------------

export function healthPayload() {
  getDb().prepare("SELECT 1").get();
  const lastPoll = numSetting("tesla_last_poll");
  const lastBackup = numSetting("backup_last_ts");
  return {
    status: "ok",
    tesla: {
      configured: isTeslaConfigured(),
      connected: isTeslaConnected(),
      lastStatus: getSetting("tesla_last_status"),
      lastPollAgeSec: ageSec(lastPoll),
      lastError: getSetting("tesla_last_error")?.slice(0, 200) ?? null,
    },
    backup: {
      enabled: !!BACKUP_DIR,
      lastAgeSec: ageSec(lastBackup),
      lastError: getSetting("backup_last_error")?.slice(0, 200) ?? null,
    },
  };
}

function dbSize(): number {
  const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "tesla.db");
  try {
    return fs.statSync(/*turbopackIgnore: true*/ file).size;
  } catch {
    return 0;
  }
}

export function metricsText(): string {
  const db = getDb();
  const latest = db
    .prepare(
      "SELECT ts, odometer_km, battery_level, range_km, charging_state, charger_power FROM snapshots ORDER BY ts DESC LIMIT 1",
    )
    .get() as
    | {
        ts: number;
        odometer_km: number;
        battery_level: number | null;
        range_km: number | null;
        charging_state: string | null;
        charger_power: number | null;
      }
    | undefined;
  const charges = db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(energy_kwh), 0) AS kwh FROM charges").get() as {
    n: number;
    kwh: number;
  };
  const lastPoll = numSetting("tesla_last_poll");
  const lastBackup = numSetting("backup_last_ts");
  const status = getSetting("tesla_last_status");

  const lines: string[] = [];
  const metric = (name: string, help: string, type: "gauge" | "counter", samples: [string, number | null][]) => {
    const present = samples.filter(([, v]) => v != null);
    if (!present.length) return;
    lines.push(`# HELP tesla_stats_${name} ${help}`, `# TYPE tesla_stats_${name} ${type}`);
    for (const [labels, v] of present) lines.push(`tesla_stats_${name}${labels} ${v}`);
  };

  metric("up", "App is responding and the database is reachable.", "gauge", [["", 1]]);
  metric("tesla_connected", "A Tesla token is present.", "gauge", [["", isTeslaConnected() ? 1 : 0]]);
  metric("poll_last_timestamp_seconds", "Time of the last vehicle poll.", "gauge", [
    ["", lastPoll ? Math.round(lastPoll / 1000) : null],
  ]);
  metric(
    "poll_last_status",
    "Result of the last poll (1 for the current status).",
    "gauge",
    (["online", "asleep", "error"] as const).map((s) => [`{status="${s}"}`, status === s ? 1 : 0]),
  );
  metric(
    "polls_total",
    "Polls since process start.",
    "counter",
    (Object.keys(counters) as PollStatus[]).map((s) => [`{status="${s}"}`, counters[s]]),
  );
  metric("odometer_km", "Latest odometer reading, km.", "gauge", [["", latest?.odometer_km ?? null]]);
  metric("battery_level_percent", "Battery level, %.", "gauge", [["", latest?.battery_level ?? null]]);
  metric("range_km", "Estimated range, km.", "gauge", [["", latest?.range_km ?? null]]);
  metric("charging", "Charging in progress.", "gauge", [
    ["", latest ? (latest.charging_state === "Charging" || latest.charging_state === "Starting" ? 1 : 0) : null],
  ]);
  metric("charger_power_kw", "Charging power, kW.", "gauge", [["", latest?.charger_power ?? null]]);
  metric("snapshot_last_timestamp_seconds", "Time of the last state snapshot.", "gauge", [
    ["", latest ? Math.round(latest.ts / 1000) : null],
  ]);
  metric("charges", "Number of recorded charges.", "gauge", [["", charges.n]]);
  metric("charged_kwh", "Total energy charged, kWh.", "gauge", [["", Math.round(charges.kwh * 100) / 100]]);
  metric("backup_last_timestamp_seconds", "Time of the last database backup.", "gauge", [
    ["", lastBackup ? Math.round(lastBackup / 1000) : null],
  ]);
  metric("db_size_bytes", "Database file size.", "gauge", [["", dbSize()]]);
  return lines.join("\n") + "\n";
}
