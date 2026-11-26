import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BarChart } from "@/components/BarChart";
import { PeriodPicker } from "@/components/PeriodPicker";
import { StatCard } from "@/components/StatCard";
import { deleteChargeAction, loadDemoAction } from "@/lib/actions";
import { getSetting } from "@/lib/db";
import { chargingStateLabel, fmtAgo, fmtDateTime, fmtMoney, fmtNum, isWithinDays } from "@/lib/format";
import { t } from "@/lib/i18n";
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
    <Suspense fallback={<div className="text-neutral-500">{t.loading}</div>}>
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
        <h1 className="text-2xl font-semibold">{getSetting("tesla_vehicle_name") || t.dashboard.myTesla}</h1>
        {latest && (
          <p className="mt-1 text-sm text-neutral-400">
            {latest.battery_level != null && <>🔋 {latest.battery_level}% · </>}
            {latest.range_km != null && <>{fmtNum(latest.range_km, 0)} {t.dashboard.rangeLeft} · </>}
            {latest.charging_state && <>{chargingStateLabel(latest.charging_state)} · </>}
            {t.dashboard.odometer} {fmtNum(latest.odometer_km, 0)} {t.units.km} · {t.dashboard.updated} {fmtAgo(latest.ts)}
          </p>
        )}
      </section>

      {trackingStart != null && isWithinDays(trackingStart, 3) && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-sky-200">
          {t.dashboard.trackingStarted(fmtDateTime(trackingStart))}
        </div>
      )}

      <PeriodPicker period={period} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t.dashboard.distance} value={fmtNum(s.km, 0)} unit={t.units.km} hint={period.label} accent="#60a5fa" />
        <StatCard
          label={t.dashboard.charged}
          value={fmtNum(s.kwh, 1)}
          unit={t.units.kwh}
          hint={`AC ${fmtNum(s.kwhAc, 0)} · DC ${fmtNum(s.kwhDc, 0)} · ${t.dashboard.chargesShort(s.chargeCount)}`}
          accent="#34d399"
        />
        <StatCard
          label={t.dashboard.consumption}
          value={s.whPerKm != null ? fmtNum(s.whPerKm, 0) : "—"}
          unit={t.units.whPerKm}
          hint={s.whPerKm != null ? t.dashboard.per100km(fmtNum(s.whPerKm / 10, 1)) : t.dashboard.notEnoughData}
        />
        <StatCard
          label={t.dashboard.cost}
          value={hasPrices ? fmtNum(s.cost, 0) : "—"}
          unit={hasPrices ? settings.currency : undefined}
          hint={
            hasPrices && s.km > 0
              ? `${fmtNum(s.cost / s.km, 2)} ${t.dashboard.perKm(settings.currency)}`
              : hasPrices
                ? undefined
                : t.dashboard.setPrices
          }
        />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <BarChart
          title={s.granularity === "month" ? t.dashboard.distanceByMonth : t.dashboard.distanceByDay}
          unit={t.units.km}
          color="#60a5fa"
          data={s.buckets.map((b) => ({ key: b.key, label: b.label, value: b.km }))}
        />
        <BarChart
          title={s.granularity === "month" ? t.dashboard.chargingByMonth : t.dashboard.chargingByDay}
          unit={t.units.kwh}
          color="#34d399"
          data={s.buckets.map((b) => ({ key: b.key, label: b.label, value: b.kwh }))}
        />
      </section>

      <section className="card overflow-x-auto">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">{t.dashboard.chargesInPeriod}</h2>
          <Link href="/data" className="text-sm text-red-400 hover:text-red-300">
            {t.dashboard.addManually}
          </Link>
        </div>
        {charges.length === 0 ? (
          <p className="text-sm text-neutral-500">{t.dashboard.noCharges}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-neutral-500">
              <tr>
                <th className="py-1 pr-3 font-normal">{t.dashboard.colStart}</th>
                <th className="py-1 pr-3 font-normal">{t.dashboard.colType}</th>
                <th className="py-1 pr-3 text-right font-normal">{t.units.kwh}</th>
                <th className="py-1 pr-3 text-right font-normal">{t.dashboard.colSoc}</th>
                {hasPrices && <th className="py-1 pr-3 text-right font-normal">{t.dashboard.colCost}</th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {charges.map((c) => (
                <tr key={c.id} className="border-t border-white/5">
                  <td className="py-1.5 pr-3">
                    {fmtDateTime(c.started_at)}
                    {c.ended_at == null && <span className="ml-2 text-emerald-400">{t.dashboard.inProgress}</span>}
                  </td>
                  <td className="py-1.5 pr-3">{c.charger_type === "dc" ? "⚡ DC / Supercharger" : "🏠 AC"}</td>
                  <td className="py-1.5 pr-3 text-right">{fmtNum(c.energy_kwh, 1)}</td>
                  <td className="py-1.5 pr-3 text-right text-neutral-400">
                    {c.start_soc != null && c.end_soc != null ? `${c.start_soc}→${c.end_soc}%` : "—"}
                  </td>
                  {hasPrices && (
                    <td className="py-1.5 pr-3 text-right">
                      {fmtMoney(chargeCost(c, prices), settings.currency)}
                    </td>
                  )}
                  <td className="py-1.5 text-right">
                    <form action={deleteChargeAction}>
                      <input type="hidden" name="id" value={c.id} />
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

      <p className="text-xs text-neutral-500">
        {t.dashboard.footnote}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card mx-auto max-w-xl space-y-4 text-center">
      <h1 className="text-xl font-semibold">{t.dashboard.emptyTitle}</h1>
      <p className="text-sm text-neutral-400">
        {t.dashboard.emptyText}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/settings" className="btn">
          {t.dashboard.connectTesla}
        </Link>
        <Link href="/data" className="btn-ghost">
          {t.dashboard.enterManually}
        </Link>
        <form action={loadDemoAction}>
          <button className="btn-ghost">{t.dashboard.loadDemo}</button>
        </form>
      </div>
    </div>
  );
}
