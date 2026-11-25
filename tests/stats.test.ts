import { test } from "node:test";
import assert from "node:assert/strict";
import { chargeCost, summarize, type ChargeRow } from "../src/lib/stats-core";
import { resolvePeriod } from "../src/lib/periods";

const day = (d: number, h = 12) => new Date(2026, 10, d, h).getTime();
const charge = (p: Partial<ChargeRow>): ChargeRow => ({
  id: 1, started_at: day(3), ended_at: null, energy_kwh: 10, start_soc: null, end_soc: null,
  charger_type: "ac", cost: null, note: null, source: "manual", ...p,
});

test("summarize sums distance and energy into daily buckets", () => {
  const from = new Date(2026, 10, 1).getTime();
  const to = new Date(2026, 10, 8).getTime();
  const s = summarize(
    from, to,
    [
      { ts: day(2), deltaKm: 30 },
      { ts: day(2, 18), deltaKm: 20 },
      { ts: day(3), deltaKm: -5 }, // bad manual entry is ignored
      { ts: day(10), deltaKm: 100 }, // outside period
    ],
    [
      charge({ started_at: day(2, 22), energy_kwh: 8 }),
      charge({ started_at: day(4), energy_kwh: 2, charger_type: "dc", cost: 100 }),
    ],
    { ac: 5, dc: 20 },
  );
  assert.equal(s.granularity, "day");
  assert.equal(s.buckets.length, 7);
  assert.equal(s.km, 50);
  assert.equal(s.kwh, 10);
  assert.equal(s.kwhAc, 8);
  assert.equal(s.kwhDc, 2);
  assert.equal(s.cost, 8 * 5 + 100);
  assert.equal(s.whPerKm, 200);
  assert.deepEqual(s.buckets.find((b) => b.key === "2026-11-02"), { key: "2026-11-02", label: "2 ноя", start: new Date(2026, 10, 2).getTime(), km: 50, kwh: 8 });
});

test("summarize uses monthly buckets for long periods", () => {
  const s = summarize(new Date(2026, 0, 1).getTime(), new Date(2026, 6, 1).getTime(), [{ ts: new Date(2026, 2, 15).getTime(), deltaKm: 10 }], [], { ac: 0, dc: 0 });
  assert.equal(s.granularity, "month");
  assert.equal(s.buckets.length, 6);
  assert.equal(s.buckets[2].km, 10);
  assert.equal(s.whPerKm, 0);
});

test("resolvePeriod computes calendar boundaries", () => {
  const now = new Date(2026, 10, 25, 17);
  const prev = resolvePeriod({ period: "prev-month" }, now);
  assert.equal(prev.from, new Date(2026, 9, 1).getTime());
  assert.equal(prev.to, new Date(2026, 10, 1).getTime());
  const month = resolvePeriod({}, now);
  assert.equal(month.key, "month");
  assert.equal(month.to, new Date(2026, 10, 26).getTime());
  const custom = resolvePeriod({ period: "custom", from: "2026-11-03", to: "2026-11-05" }, now);
  assert.equal(custom.to - custom.from, 3 * 86_400_000);
  assert.equal(resolvePeriod({ period: "custom", from: "bad" }, now).key, "month");
});

test("chargeCost splits AC energy across time-of-use zones", () => {
  const tou = { peak: 10, semi: 7, night: 4 };
  const prices = { ac: 99, dc: 20, tou };
  // 22:00–00:00: one hour semi-peak, one hour night -> average 5.5
  const evening = charge({ started_at: new Date(2026, 10, 3, 22).getTime(), ended_at: new Date(2026, 10, 4, 0).getTime(), energy_kwh: 10 });
  assert.equal(chargeCost(evening, prices), 55);
  // manual entry without duration uses the start zone
  assert.equal(chargeCost(charge({ started_at: new Date(2026, 10, 3, 8).getTime(), energy_kwh: 10 }), prices), 100);
  assert.equal(chargeCost(charge({ charger_type: "dc", energy_kwh: 10 }), prices), 200);
});
