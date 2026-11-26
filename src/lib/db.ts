import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "tesla.db");

const globalForDb = globalThis as unknown as { __teslaDb?: DatabaseSync };

function open(): DatabaseSync {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      odometer_km REAL NOT NULL,
      battery_level INTEGER,
      range_km REAL,
      charging_state TEXT,
      charge_energy_added REAL,
      charger_power REAL,
      shift_state TEXT,
      source TEXT NOT NULL DEFAULT 'api'
    );
    CREATE INDEX IF NOT EXISTS idx_snapshots_ts ON snapshots(ts);

    CREATE TABLE IF NOT EXISTS charges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      energy_kwh REAL NOT NULL DEFAULT 0,
      start_soc INTEGER,
      end_soc INTEGER,
      charger_type TEXT NOT NULL DEFAULT 'ac',
      cost REAL,
      note TEXT,
      source TEXT NOT NULL DEFAULT 'api',
      energy_base REAL NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_charges_started ON charges(started_at);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  const chargeCols = db.prepare("PRAGMA table_info(charges)").all() as { name: string }[];
  if (!chargeCols.some((c) => c.name === "energy_base")) {
    db.exec("ALTER TABLE charges ADD COLUMN energy_base REAL NOT NULL DEFAULT 0");
  }
  return db;
}

export function getDb(): DatabaseSync {
  if (!globalForDb.__teslaDb) globalForDb.__teslaDb = open();
  return globalForDb.__teslaDb;
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string | null }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string | null): void {
  getDb()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
}
