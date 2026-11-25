"use server";

import { revalidatePath } from "next/cache";
import { getDb, setSetting } from "./db";
import { clearDemoData, seedDemoData } from "./demo";
import { pollOnce } from "./poller";
import { disconnectTesla } from "./tesla";

function num(v: FormDataEntryValue | null): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function localTs(v: FormDataEntryValue | null): number {
  const t = v ? new Date(String(v)).getTime() : NaN;
  return Number.isFinite(t) ? t : Date.now();
}

function done() {
  revalidatePath("/", "layout");
}

export async function addChargeAction(formData: FormData) {
  const energy = num(formData.get("energy_kwh"));
  if (energy == null || energy <= 0) return;
  const startedAt = localTs(formData.get("started_at"));
  getDb()
    .prepare(
      `INSERT INTO charges (started_at, ended_at, energy_kwh, start_soc, end_soc, charger_type, cost, note, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual')`,
    )
    .run(
      startedAt,
      startedAt,
      energy,
      num(formData.get("start_soc")),
      num(formData.get("end_soc")),
      formData.get("charger_type") === "dc" ? "dc" : "ac",
      num(formData.get("cost")),
      String(formData.get("note") ?? "").trim() || null,
    );
  done();
}

export async function addOdometerAction(formData: FormData) {
  const odo = num(formData.get("odometer_km"));
  if (odo == null || odo < 0) return;
  getDb()
    .prepare("INSERT INTO snapshots (ts, odometer_km, battery_level, source) VALUES (?, ?, ?, 'manual')")
    .run(localTs(formData.get("ts")), odo, num(formData.get("battery_level")));
  done();
}

export async function deleteChargeAction(formData: FormData) {
  const id = num(formData.get("id"));
  if (id != null) getDb().prepare("DELETE FROM charges WHERE id = ?").run(id);
  done();
}

export async function deleteSnapshotAction(formData: FormData) {
  const id = num(formData.get("id"));
  if (id != null) getDb().prepare("DELETE FROM snapshots WHERE id = ?").run(id);
  done();
}

export async function saveSettingsAction(formData: FormData) {
  setSetting("price_ac", String(num(formData.get("price_ac")) ?? 0));
  setSetting("price_dc", String(num(formData.get("price_dc")) ?? 0));
  setSetting("tou_enabled", formData.get("tou_enabled") ? "1" : "0");
  setSetting("price_peak", String(num(formData.get("price_peak")) ?? 0));
  setSetting("price_semi", String(num(formData.get("price_semi")) ?? 0));
  setSetting("price_night", String(num(formData.get("price_night")) ?? 0));
  setSetting("currency", String(formData.get("currency") ?? "₽").trim().slice(0, 5) || "₽");
  done();
}

export async function loadDemoAction() {
  seedDemoData();
  done();
}

export async function clearDemoAction() {
  clearDemoData();
  done();
}

export async function pollNowAction() {
  await pollOnce();
  done();
}

export async function disconnectTeslaAction() {
  disconnectTesla();
  done();
}
