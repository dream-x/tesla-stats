import { getDb } from "./db";

/** Fills the DB with ~120 days of plausible driving/charging history (source = 'demo'). */
export function seedDemoData(days = 120) {
  const db = getDb();
  clearDemoData();
  let seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  const insertSnap = db.prepare(
    "INSERT INTO snapshots (ts, odometer_km, battery_level, charging_state, source) VALUES (?, ?, ?, ?, 'demo')",
  );
  const insertCharge = db.prepare(
    `INSERT INTO charges (started_at, ended_at, energy_kwh, start_soc, end_soc, charger_type, source)
     VALUES (?, ?, ?, ?, ?, ?, 'demo')`,
  );

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days);
  let odo = 18_000 + rnd() * 5000;
  let soc = 80;
  const capacity = 75;

  db.exec("BEGIN");
  try {
    for (let i = 0; i <= days; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const weekend = day.getDay() === 0 || day.getDay() === 6;
      const trips = weekend ? (rnd() < 0.4 ? 1 : 0) : 2;
      insertSnap.run(day.getTime() + 7 * 3600_000, odo, Math.round(soc), "Disconnected");
      for (let t = 0; t < trips; t++) {
        const km = weekend ? 40 + rnd() * 160 : 12 + rnd() * 30;
        const hour = weekend ? 12 : t === 0 ? 8.5 : 18.5;
        const tripTs = day.getTime() + hour * 3600_000 + rnd() * 1800_000;
        if (tripTs > Date.now()) break;
        odo += km;
        soc -= (km * (0.15 + rnd() * 0.05) * 100) / capacity;
        if (soc < 15) {
          insertCharge.run(Math.round(tripTs), Math.round(tripTs + 1800_000), ((70 - soc) / 100) * capacity, Math.round(soc), 70, "dc");
          soc = 70;
        }
        insertSnap.run(Math.round(tripTs + 3600_000), odo, Math.round(soc), "Disconnected");
      }
      const nightTs = day.getTime() + 22 * 3600_000;
      if (soc < 55 && nightTs < Date.now()) {
        const target = 80;
        const kwh = ((target - soc) / 100) * capacity;
        insertCharge.run(nightTs, Math.round(nightTs + (kwh / 11) * 3600_000), kwh, Math.round(soc), target, "ac");
        soc = target;
        insertSnap.run(nightTs + 6 * 3600_000, odo, target, "Complete");
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function clearDemoData() {
  const db = getDb();
  db.prepare("DELETE FROM snapshots WHERE source = 'demo'").run();
  db.prepare("DELETE FROM charges WHERE source = 'demo'").run();
}

export function hasDemoData(): boolean {
  return !!getDb().prepare("SELECT 1 FROM snapshots WHERE source = 'demo' LIMIT 1").get();
}
