import { getSetting } from "./db";
import { resolvePeriod } from "./periods";
import { getAppSettings, getLatestState, getSummary } from "./stats";

export function widgetTokenValid(request: Request): boolean {
  const expected = process.env.WIDGET_TOKEN;
  if (!expected) return true;
  const url = new URL(request.url);
  const auth = request.headers.get("authorization");
  const given = url.searchParams.get("token") ?? (auth?.startsWith("Bearer ") ? auth.slice(7) : null);
  return given === expected;
}

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export function buildSummaryPayload(params: { period?: string; from?: string; to?: string }) {
  const period = resolvePeriod(params);
  const s = getSummary(period.from, period.to);
  const todayPeriod = resolvePeriod({ period: "today" });
  const today = getSummary(todayPeriod.from, todayPeriod.to);
  const settings = getAppSettings();
  const latest = getLatestState();
  return {
    vehicleName: getSetting("tesla_vehicle_name") || "Tesla",
    period: { key: period.key, label: period.label, from: period.from, to: period.to },
    km: round(s.km),
    kwh: round(s.kwh),
    kwhAc: round(s.kwhAc),
    kwhDc: round(s.kwhDc),
    whPerKm: s.whPerKm != null ? Math.round(s.whPerKm) : null,
    cost: round(s.cost, 0),
    currency: settings.currency,
    chargeCount: s.chargeCount,
    today: { km: round(today.km), kwh: round(today.kwh) },
    latest: latest && {
      ts: latest.ts,
      odometerKm: Math.round(latest.odometer_km),
      batteryLevel: latest.battery_level,
      rangeKm: latest.range_km != null ? Math.round(latest.range_km) : null,
      chargingState: latest.charging_state,
    },
    granularity: s.granularity,
    series: s.buckets.map((b) => ({ key: b.key, label: b.label, km: round(b.km), kwh: round(b.kwh) })),
  };
}

export type SummaryPayload = ReturnType<typeof buildSummaryPayload>;
