import { connection } from "next/server";
import { Suspense } from "react";
import { addChargeAction, addOdometerAction, deleteSnapshotAction } from "@/lib/actions";
import { getDb } from "@/lib/db";
import { fmtDateTime, fmtNum } from "@/lib/format";
import { t } from "@/lib/i18n";
import { toDateInput } from "@/lib/periods";

export default function DataPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t.data.title}</h1>
      <p className="text-sm text-neutral-400">
        {t.data.intro}
      </p>
      <Suspense fallback={<div className="text-neutral-500">{t.loading}</div>}>
        <DataContent />
      </Suspense>
    </div>
  );
}

function nowLocal(): string {
  const d = new Date();
  return `${toDateInput(d.getTime())}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function DataContent() {
  await connection();
  const now = nowLocal();
  const snapshots = getDb()
    .prepare("SELECT id, ts, odometer_km, battery_level, source FROM snapshots ORDER BY ts DESC LIMIT 30")
    .all() as { id: number; ts: number; odometer_km: number; battery_level: number | null; source: string }[];

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <form action={addOdometerAction} className="card space-y-3">
          <h2 className="font-medium">{t.data.odometerReading}</h2>
          <label className="block text-sm">
            <span className="text-neutral-400">{t.data.dateTime}</span>
            <input type="datetime-local" name="ts" defaultValue={now} className="input mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-400">{t.data.odometerKm}</span>
            <input name="odometer_km" inputMode="decimal" required placeholder={t.data.odometerPlaceholder} className="input mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-400">{t.data.batteryOptional}</span>
            <input name="battery_level" inputMode="numeric" className="input mt-1" />
          </label>
          <button className="btn">{t.save}</button>
        </form>

        <form action={addChargeAction} className="card space-y-3">
          <h2 className="font-medium">{t.data.charge}</h2>
          <label className="block text-sm">
            <span className="text-neutral-400">{t.data.dateTime}</span>
            <input type="datetime-local" name="started_at" defaultValue={now} className="input mt-1" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-neutral-400">{t.data.addedKwh}</span>
              <input name="energy_kwh" inputMode="decimal" required className="input mt-1" />
            </label>
            <label className="block text-sm">
              <span className="text-neutral-400">{t.data.type}</span>
              <select name="charger_type" className="input mt-1">
                <option value="ac">{t.data.acOption}</option>
                <option value="dc">{t.data.dcOption}</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-neutral-400">{t.data.socBefore}</span>
              <input name="start_soc" inputMode="numeric" className="input mt-1" />
            </label>
            <label className="block text-sm">
              <span className="text-neutral-400">{t.data.socAfter}</span>
              <input name="end_soc" inputMode="numeric" className="input mt-1" />
            </label>
            <label className="block text-sm">
              <span className="text-neutral-400">{t.data.costIfKnown}</span>
              <input name="cost" inputMode="decimal" className="input mt-1" />
            </label>
            <label className="block text-sm">
              <span className="text-neutral-400">{t.data.note}</span>
              <input name="note" className="input mt-1" />
            </label>
          </div>
          <button className="btn">{t.save}</button>
        </form>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 font-medium">{t.data.recentReadings}</h2>
        {snapshots.length === 0 ? (
          <p className="text-sm text-neutral-500">{t.data.empty}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-neutral-500">
              <tr>
                <th className="py-1 pr-3 font-normal">{t.data.colTime}</th>
                <th className="py-1 pr-3 text-right font-normal">{t.data.odometerKm}</th>
                <th className="py-1 pr-3 text-right font-normal">{t.data.colBattery}</th>
                <th className="py-1 pr-3 font-normal">{t.data.colSource}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr key={s.id} className="border-t border-white/5">
                  <td className="py-1.5 pr-3">{fmtDateTime(s.ts)}</td>
                  <td className="py-1.5 pr-3 text-right">{fmtNum(s.odometer_km, 1)}</td>
                  <td className="py-1.5 pr-3 text-right">{s.battery_level != null ? `${s.battery_level}%` : "—"}</td>
                  <td className="py-1.5 pr-3 text-neutral-400">
                    {t.data.sources[s.source] ?? s.source}
                  </td>
                  <td className="py-1.5 text-right">
                    <form action={deleteSnapshotAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="text-neutral-600 hover:text-red-400" title={t.delete}>
                        ✕
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
