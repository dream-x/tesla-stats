import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BarChart } from "@/components/BarChart";
import { PeriodPicker } from "@/components/PeriodPicker";
import { StatCard } from "@/components/StatCard";
import { deleteChargeAction, loadDemoAction } from "@/lib/actions";
import { getSetting } from "@/lib/db";
import { CHARGING_STATE_RU, fmtAgo, fmtDateTime, fmtNum, isWithinDays } from "@/lib/format";
import { resolvePeriod } from "@/lib/periods";
import { chargeCost } from "@/lib/stats-core";
import {
  getAppSettings,
  getCharges,
  getLatestState,
  getPrices,
  getSummary,
  getTrackingStart,
  hasAnyData,
} from "@/lib/stats";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function Page(props: PageProps<"/">) {
  return (
    <Suspense fallback={<div className="text-neutral-500">Загрузка…</div>}>
      <Dashboard searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  if (!hasAnyData()) return <EmptyState />;

  const period = resolvePeriod({ period: one(sp.period), from: one(sp.from), to: one(sp.to) });
  const s = getSummary(period.from, period.to);
  const settings = getAppSettings();
  const prices = getPrices();
  const charges = getCharges(period.from, period.to);
  const latest = getLatestState();
  const trackingStart = getTrackingStart();
  const hasPrices = prices.ac > 0 || prices.dc > 0 || !!prices.tou || charges.some((c) => c.cost != null);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">{getSetting("tesla_vehicle_name") || "Моя Tesla"}</h1>
        {latest && (
          <p className="mt-1 text-sm text-neutral-400">
            {latest.battery_level != null && <>🔋 {latest.battery_level}% · </>}
            {latest.range_km != null && <>{fmtNum(latest.range_km, 0)} км запаса · </>}
            {latest.charging_state && <>{CHARGING_STATE_RU[latest.charging_state] ?? latest.charging_state} · </>}
            одометр {fmtNum(latest.odometer_km, 0)} км · обновлено {fmtAgo(latest.ts)}
          </p>
        )}
      </section>

      {trackingStart != null && isWithinDays(trackingStart, 3) && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-sky-200">
          Сбор данных начался {fmtDateTime(trackingStart)}. Tesla API не отдаёт историю, поэтому статистика копится
          с этого момента: пробег появится после первой поездки, зарядки — после первой зарядки.
        </div>
      )}

      <PeriodPicker period={period} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Пробег" value={fmtNum(s.km, 0)} unit="км" hint={period.label} accent="#60a5fa" />
        <StatCard
          label="Заряжено"
          value={fmtNum(s.kwh, 1)}
          unit="кВт·ч"
          hint={`AC ${fmtNum(s.kwhAc, 0)} · DC ${fmtNum(s.kwhDc, 0)} · ${s.chargeCount} зар.`}
          accent="#34d399"
        />
        <StatCard
          label="Расход"
          value={s.whPerKm != null ? fmtNum(s.whPerKm, 0) : "—"}
          unit="Вт·ч/км"
          hint={s.whPerKm != null ? `≈ ${fmtNum(s.whPerKm / 10, 1)} кВт·ч / 100 км` : "мало данных"}
        />
        <StatCard
          label="Стоимость"
          value={hasPrices ? fmtNum(s.cost, 0) : "—"}
          unit={hasPrices ? settings.currency : undefined}
          hint={
            hasPrices && s.km > 0
              ? `${fmtNum(s.cost / s.km, 2)} ${settings.currency}/км`
              : hasPrices
                ? undefined
                : "укажите тарифы в настройках"
          }
        />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <BarChart
          title={s.granularity === "month" ? "Пробег по месяцам, км" : "Пробег по дням, км"}
          unit="км"
          color="#60a5fa"
          data={s.buckets.map((b) => ({ key: b.key, label: b.label, value: b.km }))}
        />
        <BarChart
          title={s.granularity === "month" ? "Зарядка по месяцам, кВт·ч" : "Зарядка по дням, кВт·ч"}
          unit="кВт·ч"
          color="#34d399"
          data={s.buckets.map((b) => ({ key: b.key, label: b.label, value: b.kwh }))}
        />
      </section>

      <section className="card overflow-x-auto">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Зарядки за период</h2>
          <Link href="/data" className="text-sm text-red-400 hover:text-red-300">
            + добавить вручную
          </Link>
        </div>
        {charges.length === 0 ? (
          <p className="text-sm text-neutral-500">Зарядок за этот период нет.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-neutral-500">
              <tr>
                <th className="py-1 pr-3 font-normal">Начало</th>
                <th className="py-1 pr-3 font-normal">Тип</th>
                <th className="py-1 pr-3 text-right font-normal">кВт·ч</th>
                <th className="py-1 pr-3 text-right font-normal">Заряд</th>
                {hasPrices && <th className="py-1 pr-3 text-right font-normal">Стоимость</th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {charges.map((c) => (
                <tr key={c.id} className="border-t border-white/5">
                  <td className="py-1.5 pr-3">
                    {fmtDateTime(c.started_at)}
                    {c.ended_at == null && <span className="ml-2 text-emerald-400">● идёт</span>}
                  </td>
                  <td className="py-1.5 pr-3">{c.charger_type === "dc" ? "⚡ DC / Supercharger" : "🏠 AC"}</td>
                  <td className="py-1.5 pr-3 text-right">{fmtNum(c.energy_kwh, 1)}</td>
                  <td className="py-1.5 pr-3 text-right text-neutral-400">
                    {c.start_soc != null && c.end_soc != null ? `${c.start_soc}→${c.end_soc}%` : "—"}
                  </td>
                  {hasPrices && (
                    <td className="py-1.5 pr-3 text-right">
                      {fmtNum(chargeCost(c, prices), 0)} {settings.currency}
                    </td>
                  )}
                  <td className="py-1.5 text-right">
                    <form action={deleteChargeAction}>
                      <input type="hidden" name="id" value={c.id} />
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

      <p className="text-xs text-neutral-500">
        «Заряжено» — энергия, добавленная в батарею (charge_energy_added). Из розетки уходит примерно на 5–15% больше
        из-за потерь при зарядке.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card mx-auto max-w-xl space-y-4 text-center">
      <h1 className="text-xl font-semibold">Данных пока нет</h1>
      <p className="text-sm text-neutral-400">
        Подключите машину через Tesla Fleet API в настройках — приложение начнёт собирать пробег и зарядки
        автоматически. Также можно вносить данные вручную или посмотреть на демо-данные.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/settings" className="btn">
          Подключить Tesla
        </Link>
        <Link href="/data" className="btn-ghost">
          Ввести вручную
        </Link>
        <form action={loadDemoAction}>
          <button className="btn-ghost">Загрузить демо</button>
        </form>
      </div>
    </div>
  );
}
