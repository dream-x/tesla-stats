import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ChargeRow } from "../src/lib/stats-core";

const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "tesla-test-")), "t.db");
process.env.DATABASE_PATH = dbPath;

let rec: typeof import("../src/lib/recorder");
let db: typeof import("../src/lib/db");
before(async () => {
  db = await import("../src/lib/db");
  rec = await import("../src/lib/recorder");
});

const reading = (state: string, energy: number, soc: number, odoMiles = 1000, fast = false) => ({
  charge_state: { charging_state: state, charge_energy_added: energy, battery_level: soc, fast_charger_present: fast },
  vehicle_state: { odometer: odoMiles },
  drive_state: { shift_state: null },
});
const charges = () => db.getDb().prepare("SELECT * FROM charges ORDER BY id").all() as unknown as ChargeRow[];

test("detects a charge session from start to completion", () => {
  let t = 1_000_000;
  rec.recordVehicleData(reading("Disconnected", 0, 40), (t += 60_000));
  assert.equal(rec.recordVehicleData(reading("Charging", 0.5, 41), (t += 60_000)).active, true);
  rec.recordVehicleData(reading("Charging", 10, 55), (t += 60_000));
  rec.recordVehicleData(reading("Complete", 12, 58), (t += 60_000));
  const [c] = charges();
  assert.equal(c.energy_kwh, 12);
  assert.equal(c.start_soc, 41);
  assert.equal(c.end_soc, 58);
  assert.equal(c.ended_at, t);
  assert.equal(c.charger_type, "ac");
});

test("splits back-to-back sessions and closes open session when the car sleeps", () => {
  db.getDb().exec("DELETE FROM charges");
  let t = 2_000_000;
  rec.recordVehicleData(reading("Charging", 20, 60, 1000, true), (t += 60_000));
  rec.recordVehicleData(reading("Charging", 3, 30, 1100, true), (t += 60_000));
  rec.recordAsleep((t += 60_000));
  const list = charges();
  assert.equal(list.length, 2);
  assert.equal(list[0].energy_kwh, 20);
  assert.equal(list[1].energy_kwh, 3);
  assert.equal(list[1].charger_type, "dc");
  assert.ok(list.every((c) => c.ended_at != null));
});

test("stores odometer in km and skips unchanged snapshots", () => {
  db.getDb().exec("DELETE FROM snapshots");
  rec.recordVehicleData(reading("Disconnected", 0, 50, 100), 5_000_000);
  rec.recordVehicleData(reading("Disconnected", 0, 50, 100), 5_060_000);
  const rows = db.getDb().prepare("SELECT odometer_km FROM snapshots").all() as unknown as { odometer_km: number }[];
  assert.equal(rows.length, 1);
  assert.ok(Math.abs(rows[0].odometer_km - 160.9344) < 1e-9);
});
