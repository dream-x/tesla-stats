import { setSetting } from "./db";
import { fetchVehicleData, isTeslaConfigured, isTeslaConnected, VehicleAsleepError } from "./tesla";
import { recordAsleep, recordVehicleData } from "./recorder";
import { clearDemoData, hasDemoData } from "./demo";
import { countPoll } from "./ops";

const minutes = (v: string | undefined, def: number) => Math.max(1, Number(v) || def) * 60_000;
const IDLE_MS = minutes(process.env.POLL_INTERVAL_MINUTES, 10);
const ACTIVE_MS = minutes(process.env.POLL_ACTIVE_INTERVAL_MINUTES, 2);

export type PollResult = { status: "ok" | "asleep" | "skipped" | "error"; message?: string; active?: boolean };

// Next bundles instrumentation and routes separately, so share state via globalThis.
const pg = globalThis as unknown as { __teslaInFlight?: Promise<PollResult> | null };

export function pollOnce(): Promise<PollResult> {
  pg.__teslaInFlight ??= doPoll()
    .then((r) => {
      countPoll(r.status);
      return r;
    })
    .finally(() => {
      pg.__teslaInFlight = null;
    });
  return pg.__teslaInFlight;
}

async function doPoll(): Promise<PollResult> {
  if (!isTeslaConfigured() || !isTeslaConnected()) return { status: "skipped", message: "Tesla is not connected" };
  const now = Date.now();
  setSetting("tesla_last_poll", String(now));
  try {
    const data = await fetchVehicleData();
    if (data.display_name) setSetting("tesla_vehicle_name", data.display_name);
    // Demo odometer values would create a bogus jump against real readings.
    if (hasDemoData()) clearDemoData();
    const { active } = recordVehicleData(data, now);
    setSetting("tesla_last_status", "online");
    setSetting("tesla_last_error", null);
    return { status: "ok", active };
  } catch (e) {
    if (e instanceof VehicleAsleepError) {
      recordAsleep(now);
      setSetting("tesla_last_status", "asleep");
      setSetting("tesla_last_error", null);
      return { status: "asleep" };
    }
    const message = e instanceof Error ? e.message : String(e);
    setSetting("tesla_last_status", "error");
    setSetting("tesla_last_error", message);
    console.error("[tesla-poller]", message);
    return { status: "error", message };
  }
}

const g = globalThis as unknown as { __teslaPollerStarted?: boolean };

export function startPoller() {
  if (g.__teslaPollerStarted || process.env.DISABLE_POLLER === "1") return;
  g.__teslaPollerStarted = true;
  const tick = async () => {
    const r = await pollOnce().catch(() => ({ status: "error" }) as PollResult);
    setTimeout(tick, r.active ? ACTIVE_MS : IDLE_MS);
  };
  setTimeout(tick, 5_000);
  console.log(`[tesla-poller] started: every ${IDLE_MS / 60000} min (active: ${ACTIVE_MS / 60000} min)`);
}
