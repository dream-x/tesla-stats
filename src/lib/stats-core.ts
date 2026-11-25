export type ChargerType = "ac" | "dc";

export interface OdometerDelta {
  ts: number;
  deltaKm: number;
}

export interface ChargeRow {
  id: number;
  started_at: number;
  ended_at: number | null;
  energy_kwh: number;
  start_soc: number | null;
  end_soc: number | null;
  charger_type: ChargerType;
  cost: number | null;
  note: string | null;
  source: string;
}

export interface Prices {
  ac: number;
  dc: number;
  /** Time-of-use AC prices; when set, `ac` is ignored. */
  tou?: { peak: number; semi: number; night: number } | null;
}

export interface Bucket {
  key: string;
  label: string;
  start: number;
  km: number;
  kwh: number;
}

export interface Summary {
  km: number;
  kwh: number;
  kwhAc: number;
  kwhDc: number;
  chargeCount: number;
  cost: number;
  whPerKm: number | null;
  buckets: Bucket[];
  granularity: "day" | "month";
}

const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export type TouZone = "peak" | "semi" | "night";

/** Standard Russian 3-zone schedule: peak 7–10 & 17–21, night 23–7, semi-peak otherwise. */
export function touZone(ts: number): TouZone {
  const h = new Date(ts).getHours();
  if (h >= 23 || h < 7) return "night";
  if ((h >= 7 && h < 10) || (h >= 17 && h < 21)) return "peak";
  return "semi";
}

const ZONE_STEP_MS = 15 * 60_000;

/** Average AC price over [start, end], assuming constant charging power. */
export function touAveragePrice(start: number, end: number | null, tou: Record<TouZone, number>): number {
  if (end == null || end <= start) return tou[touZone(start)];
  let sum = 0;
  let total = 0;
  for (let t = start; t < end; t += ZONE_STEP_MS) {
    const dt = Math.min(ZONE_STEP_MS, end - t);
    sum += tou[touZone(t + dt / 2)] * dt;
    total += dt;
  }
  return sum / total;
}

export function chargeCost(
  c: Pick<ChargeRow, "cost" | "energy_kwh" | "charger_type" | "started_at" | "ended_at">,
  prices: Prices,
): number {
  if (c.cost != null) return c.cost;
  if (c.charger_type === "dc") return c.energy_kwh * prices.dc;
  if (prices.tou) return c.energy_kwh * touAveragePrice(c.started_at, c.ended_at, prices.tou);
  return c.energy_kwh * prices.ac;
}

function startOfDay(ts: number): Date {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d;
}

function bucketKey(ts: number, granularity: "day" | "month"): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  if (granularity === "month") return `${y}-${m}`;
  return `${y}-${m}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Buckets covering [from, to) in local time. Uses months for long periods. */
export function makeBuckets(from: number, to: number): { buckets: Bucket[]; granularity: "day" | "month" } {
  const days = (to - from) / 86_400_000;
  const granularity = days > 62 ? "month" : "day";
  const buckets: Bucket[] = [];
  const cur = startOfDay(from);
  if (granularity === "month") cur.setDate(1);
  while (cur.getTime() < to) {
    const start = cur.getTime();
    buckets.push({
      key: bucketKey(start, granularity),
      label:
        granularity === "month"
          ? `${MONTHS_SHORT[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}`
          : `${cur.getDate()} ${MONTHS_SHORT[cur.getMonth()]}`,
      start,
      km: 0,
      kwh: 0,
    });
    if (granularity === "month") cur.setMonth(cur.getMonth() + 1);
    else cur.setDate(cur.getDate() + 1);
  }
  return { buckets, granularity };
}

export function summarize(
  from: number,
  to: number,
  deltas: OdometerDelta[],
  charges: ChargeRow[],
  prices: Prices,
): Summary {
  const { buckets, granularity } = makeBuckets(from, to);
  const byKey = new Map(buckets.map((b) => [b.key, b]));

  let km = 0;
  for (const d of deltas) {
    if (d.ts < from || d.ts >= to) continue;
    // Odometer never goes backwards; negative deltas mean a bad manual entry.
    const delta = Math.max(0, d.deltaKm);
    km += delta;
    const b = byKey.get(bucketKey(d.ts, granularity));
    if (b) b.km += delta;
  }

  let kwhAc = 0;
  let kwhDc = 0;
  let cost = 0;
  let chargeCount = 0;
  for (const c of charges) {
    if (c.started_at < from || c.started_at >= to) continue;
    chargeCount++;
    if (c.charger_type === "dc") kwhDc += c.energy_kwh;
    else kwhAc += c.energy_kwh;
    cost += chargeCost(c, prices);
    const b = byKey.get(bucketKey(c.started_at, granularity));
    if (b) b.kwh += c.energy_kwh;
  }

  const kwh = kwhAc + kwhDc;
  return {
    km,
    kwh,
    kwhAc,
    kwhDc,
    chargeCount,
    cost,
    whPerKm: km > 0.5 ? (kwh * 1000) / km : null,
    buckets,
    granularity,
  };
}
