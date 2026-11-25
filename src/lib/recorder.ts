import { getDb } from "./db";
import { MILES_TO_KM, type VehicleData } from "./tesla";
import type { ChargeRow } from "./stats-core";

const SNAPSHOT_HEARTBEAT_MS = 6 * 3600_000;

export function isChargingState(s: string | undefined | null): boolean {
  return s === "Charging" || s === "Starting";
}

function openSession(): ChargeRow | undefined {
  return getDb()
    .prepare("SELECT * FROM charges WHERE ended_at IS NULL AND source = 'api' ORDER BY id DESC LIMIT 1")
    .get() as ChargeRow | undefined;
}

function closeSession(s: ChargeRow, endedAt: number, energy: number, endSoc: number | null) {
  const db = getDb();
  if (energy < 0.05) {
    db.prepare("DELETE FROM charges WHERE id = ?").run(s.id);
    return;
  }
  db.prepare("UPDATE charges SET ended_at = ?, energy_kwh = ?, end_soc = COALESCE(?, end_soc) WHERE id = ?").run(
    endedAt,
    energy,
    endSoc,
    s.id,
  );
}

/** Persists one vehicle_data reading and opens/updates/closes the current charge session. */
export function recordVehicleData(data: VehicleData, now = Date.now()): { active: boolean } {
  const db = getDb();
  const cs = data.charge_state ?? {};
  const odoMiles = data.vehicle_state?.odometer;
  const shift = data.drive_state?.shift_state ?? null;
  const energy = cs.charge_energy_added ?? 0;
  const charging = isChargingState(cs.charging_state);
  const soc = cs.battery_level ?? null;

  if (odoMiles != null) {
    const odometerKm = odoMiles * MILES_TO_KM;
    const last = db
      .prepare("SELECT ts, odometer_km, battery_level, charging_state FROM snapshots ORDER BY ts DESC LIMIT 1")
      .get() as { ts: number; odometer_km: number; battery_level: number | null; charging_state: string | null } | undefined;
    const changed =
      !last ||
      Math.abs(last.odometer_km - odometerKm) > 0.05 ||
      last.battery_level !== soc ||
      last.charging_state !== (cs.charging_state ?? null) ||
      now - last.ts > SNAPSHOT_HEARTBEAT_MS;
    if (changed) {
      db.prepare(
        `INSERT INTO snapshots (ts, odometer_km, battery_level, range_km, charging_state, charge_energy_added, charger_power, shift_state, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'api')`,
      ).run(
        now,
        odometerKm,
        soc,
        cs.battery_range != null ? cs.battery_range * MILES_TO_KM : null,
        cs.charging_state ?? null,
        cs.charge_energy_added ?? null,
        cs.charger_power ?? null,
        shift,
      );
    }
  }

  let session = openSession();
  if (charging) {
    // charge_energy_added resets when a new session starts; a drop means we missed the boundary.
    if (session && energy < session.energy_kwh - 0.5) {
      closeSession(session, now, session.energy_kwh, null);
      session = undefined;
    }
    const type = cs.fast_charger_present ? "dc" : "ac";
    if (!session) {
      db.prepare(
        "INSERT INTO charges (started_at, energy_kwh, start_soc, end_soc, charger_type, source) VALUES (?, ?, ?, ?, ?, 'api')",
      ).run(now, energy, soc, soc, type);
    } else {
      db.prepare("UPDATE charges SET energy_kwh = ?, end_soc = ?, charger_type = ? WHERE id = ?").run(
        Math.max(energy, session.energy_kwh),
        soc,
        type,
        session.id,
      );
    }
  } else if (session) {
    closeSession(session, now, Math.max(energy, session.energy_kwh), soc);
  }

  return { active: charging || (shift != null && shift !== "P") };
}

/** The car cannot sleep while charging, so a sleeping car closes any open session. */
export function recordAsleep(now = Date.now()) {
  const session = openSession();
  if (session) closeSession(session, now, session.energy_kwh, null);
}
