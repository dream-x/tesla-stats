import { getDb, getSetting } from "./db";
import { summarize, type ChargeRow, type OdometerDelta, type Prices, type Summary } from "./stats-core";

export interface AppSettings {
  priceAc: number;
  priceDc: number;
  currency: string;
  touEnabled: boolean;
  pricePeak: number;
  priceSemi: number;
  priceNight: number;
}

const n = (key: string) => Number(getSetting(key) ?? 0) || 0;

export function getAppSettings(): AppSettings {
  return {
    priceAc: n("price_ac"),
    priceDc: n("price_dc"),
    currency: getSetting("currency") || "₽",
    touEnabled: getSetting("tou_enabled") === "1",
    pricePeak: n("price_peak"),
    priceSemi: n("price_semi"),
    priceNight: n("price_night"),
  };
}

export function getPrices(): Prices {
  const s = getAppSettings();
  return {
    ac: s.priceAc,
    dc: s.priceDc,
    tou: s.touEnabled ? { peak: s.pricePeak, semi: s.priceSemi, night: s.priceNight } : null,
  };
}

export function getOdometerDeltas(from: number, to: number): OdometerDelta[] {
  return getDb()
    .prepare(
      `WITH s AS (
         SELECT ts, odometer_km, LAG(odometer_km) OVER (ORDER BY ts) AS prev
         FROM snapshots WHERE ts < ?
       )
       SELECT ts, odometer_km - prev AS deltaKm FROM s
       WHERE ts >= ? AND prev IS NOT NULL`,
    )
    .all(to, from) as unknown as OdometerDelta[];
}

export function getCharges(from: number, to: number): ChargeRow[] {
  return getDb()
    .prepare("SELECT * FROM charges WHERE started_at >= ? AND started_at < ? ORDER BY started_at DESC")
    .all(from, to) as unknown as ChargeRow[];
}

export function getSummary(from: number, to: number): Summary {
  return summarize(from, to, getOdometerDeltas(from, to), getCharges(from, to), getPrices());
}

export interface LatestState {
  ts: number;
  odometer_km: number;
  battery_level: number | null;
  range_km: number | null;
  charging_state: string | null;
  charger_power: number | null;
}

export function getLatestState(): LatestState | null {
  return (
    (getDb()
      .prepare(
        "SELECT ts, odometer_km, battery_level, range_km, charging_state, charger_power FROM snapshots ORDER BY ts DESC LIMIT 1",
      )
      .get() as LatestState | undefined) ?? null
  );
}

export function hasAnyData(): boolean {
  const db = getDb();
  return !!(db.prepare("SELECT 1 FROM snapshots LIMIT 1").get() || db.prepare("SELECT 1 FROM charges LIMIT 1").get());
}

export function getTrackingStart(): number | null {
  const row = getDb().prepare("SELECT MIN(ts) AS ts FROM snapshots WHERE source = 'api'").get() as { ts: number | null };
  return row.ts;
}
