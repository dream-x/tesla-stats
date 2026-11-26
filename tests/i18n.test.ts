import assert from "node:assert/strict";
import { test } from "node:test";

process.env.APP_LOCALE = "ru";

test("APP_LOCALE=ru localizes period and bucket labels", async () => {
  const { resolvePeriod } = await import("../src/lib/periods");
  const { makeBuckets } = await import("../src/lib/stats-core");
  assert.equal(resolvePeriod({ period: "month" }).label, "Этот месяц");
  const { buckets } = makeBuckets(new Date(2026, 10, 2).getTime(), new Date(2026, 10, 3).getTime());
  assert.equal(buckets[0].label, "2 ноя");
});
