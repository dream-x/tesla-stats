import { connection } from "next/server";
import { Suspense } from "react";
import { addChargeAction, addOdometerAction, deleteSnapshotAction } from "@/lib/actions";
import { getDb } from "@/lib/db";
import { fmtDateTime, fmtNum } from "@/lib/format";
import { toDateInput } from "@/lib/periods";

export default function DataPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Данные</h1>
      <p className="text-sm text-neutral-400">
        Если Tesla API не подключён (или хочется дополнить историю), вносите показания одометра и зарядки вручную.
        Пробег считается как разница между соседними показаниями одометра.
      </p>
      <Suspense fallback={<div className="text-neutral-500">Загрузка…</div>}>
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
          <h2 className="font-medium">Показание одометра</h2>
          <label className="block text-sm">
            <span className="text-neutral-400">Дата и время</span>
            <input type="datetime-local" name="ts" defaultValue={now} className="input mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-400">Одометр, км</span>
            <input name="odometer_km" inputMode="decimal" required placeholder="например, 24 518" className="input mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-400">Заряд батареи, % (необязательно)</span>
            <input name="battery_level" inputMode="numeric" className="input mt-1" />
          </label>
          <button className="btn">Сохранить</button>
        </form>

        <form action={addChargeAction} className="card space-y-3">
          <h2 className="font-medium">Зарядка</h2>
          <label className="block text-sm">
            <span className="text-neutral-400">Дата и время</span>
            <input type="datetime-local" name="started_at" defaultValue={now} className="input mt-1" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-neutral-400">Добавлено, кВт·ч</span>
              <input name="energy_kwh" inputMode="decimal" required className="input mt-1" />
            </label>
            <label className="block text-sm">
              <span className="text-neutral-400">Тип</span>
              <select name="charger_type" className="input mt-1">
                <option value="ac">AC (дом / Type 2)</option>
                <option value="dc">DC (Supercharger / быстрая)</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-neutral-400">Было, %</span>
              <input name="start_soc" inputMode="numeric" className="input mt-1" />
            </label>
            <label className="block text-sm">
              <span className="text-neutral-400">Стало, %</span>
              <input name="end_soc" inputMode="numeric" className="input mt-1" />
            </label>
            <label className="block text-sm">
              <span className="text-neutral-400">Стоимость (если знаете)</span>
              <input name="cost" inputMode="decimal" className="input mt-1" />
            </label>
            <label className="block text-sm">
              <span className="text-neutral-400">Заметка</span>
              <input name="note" className="input mt-1" />
            </label>
          </div>
          <button className="btn">Сохранить</button>
        </form>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="mb-3 font-medium">Последние показания одометра</h2>
        {snapshots.length === 0 ? (
          <p className="text-sm text-neutral-500">Пока пусто.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-neutral-500">
              <tr>
                <th className="py-1 pr-3 font-normal">Время</th>
                <th className="py-1 pr-3 text-right font-normal">Одометр, км</th>
                <th className="py-1 pr-3 text-right font-normal">Батарея</th>
                <th className="py-1 pr-3 font-normal">Источник</th>
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
                    {{ api: "Tesla API", manual: "вручную", demo: "демо" }[s.source] ?? s.source}
                  </td>
                  <td className="py-1.5 text-right">
                    <form action={deleteSnapshotAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="text-neutral-600 hover:text-red-400" title="Удалить">
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
