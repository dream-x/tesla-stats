import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/AutoRefresh";
import { chargingStateLabel, fmtAgo, fmtMoney, fmtNum } from "@/lib/format";
import { t } from "@/lib/i18n";
import { PERIOD_OPTIONS } from "@/lib/periods";
import { buildSummaryPayload } from "@/lib/summary";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function WidgetPage(props: PageProps<"/widget">) {
  return (
    <div className="flex min-h-full flex-1 items-start justify-center p-3 sm:items-center">
      <Suspense fallback={<div className="text-neutral-500">…</div>}>
        <Widget searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Widget({ searchParams }: { searchParams: PageProps<"/widget">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const token = one(sp.token);
  const d = buildSummaryPayload({ period: one(sp.period) ?? "month" });
  const maxKm = Math.max(1, ...d.series.map((s) => s.km));
  const maxKwh = Math.max(1, ...d.series.map((s) => s.kwh));
  const tokenQs = token ? `&token=${encodeURIComponent(token)}` : "";

  return (
    <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-gradient-to-b from-neutral-900 to-black p-5 shadow-2xl">
      <AutoRefresh />
      <div className="flex items-center justify-between text-xs text-neutral-400">
        <span className="font-medium text-neutral-200">⚡ {d.vehicleName}</span>
        {d.latest?.batteryLevel != null && (
          <span>
            🔋 {d.latest.batteryLevel}%{d.latest.rangeKm != null && ` · ${d.latest.rangeKm} ${t.units.km}`}
          </span>
        )}
      </div>

      <div className="mt-1 text-[11px] uppercase tracking-wider text-neutral-500">{d.period.label}</div>

      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <div className="text-4xl font-semibold text-sky-400">{fmtNum(d.km, 0)}</div>
          <div className="text-xs text-neutral-400">{t.widget.kmDriven}</div>
        </div>
        <div>
          <div className="text-4xl font-semibold text-emerald-400">{fmtNum(d.kwh, 0)}</div>
          <div className="text-xs text-neutral-400">{t.widget.kwhCharged}</div>
        </div>
      </div>

      <div className="mt-3 flex h-12 items-end gap-[2px]">
        {d.series.map((s) => (
          <div key={s.key} className="flex h-full flex-1 items-end gap-[1px]">
            <div className="flex-1 rounded-t-sm bg-sky-400/80" style={{ height: `${(s.km / maxKm) * 100}%` }} />
            <div className="flex-1 rounded-t-sm bg-emerald-400/80" style={{ height: `${(s.kwh / maxKwh) * 100}%` }} />
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center text-xs">
        <div>
          <div className="text-base font-medium">{d.whPerKm ?? "—"}</div>
          <div className="text-neutral-500">{t.units.whPerKm}</div>
        </div>
        <div>
          <div className="text-base font-medium">{fmtNum(d.today.km, 0)}</div>
          <div className="text-neutral-500">{t.widget.kmToday}</div>
        </div>
        <div>
          <div className="text-base font-medium">{d.cost > 0 ? fmtMoney(d.cost, d.currency) : d.chargeCount}</div>
          <div className="text-neutral-500">{d.cost > 0 ? t.widget.cost : t.widget.charges}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {PERIOD_OPTIONS.filter((o) => ["today", "7d", "month", "year"].includes(o.key)).map((o) => (
          <Link
            key={o.key}
            href={`/widget?period=${o.key}${tokenQs}`}
            className={`rounded-full px-2 py-0.5 text-[11px] ${
              d.period.key === o.key ? "bg-white text-black" : "bg-white/5 text-neutral-400"
            }`}
          >
            {o.label}
          </Link>
        ))}
      </div>

      {d.latest && (
        <div className="mt-2 text-[10px] text-neutral-600">
          {d.latest.chargingState && `${chargingStateLabel(d.latest.chargingState)} · `}
          {t.widget.updated} {fmtAgo(d.latest.ts)} ·{" "}
          <Link href="/" className="underline">
            {t.widget.more}
          </Link>
        </div>
      )}
    </div>
  );
}
