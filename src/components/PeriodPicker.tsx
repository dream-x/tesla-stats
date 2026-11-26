import Link from "next/link";
import { t } from "@/lib/i18n";
import { PERIOD_OPTIONS, toDateInput, type Period } from "@/lib/periods";

export function PeriodPicker({ period, basePath = "/" }: { period: Period; basePath?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PERIOD_OPTIONS.map((o) => (
        <Link
          key={o.key}
          href={`${basePath}?period=${o.key}`}
          className={`rounded-full px-3 py-1 text-sm ${
            period.key === o.key ? "bg-white text-black" : "bg-white/5 text-neutral-300 hover:bg-white/10"
          }`}
        >
          {o.label}
        </Link>
      ))}
      <form action={basePath} className="flex items-center gap-1 text-sm">
        <input type="hidden" name="period" value="custom" />
        <input
          type="date"
          name="from"
          defaultValue={toDateInput(period.from)}
          className="rounded-lg border border-white/15 bg-black/40 px-2 py-1"
        />
        <span className="text-neutral-500">—</span>
        <input
          type="date"
          name="to"
          defaultValue={toDateInput(period.to - 1)}
          className="rounded-lg border border-white/15 bg-black/40 px-2 py-1"
        />
        <button
          className={`rounded-full px-3 py-1 ${
            period.key === "custom" ? "bg-white text-black" : "bg-white/5 text-neutral-300 hover:bg-white/10"
          }`}
        >
          {t.periodShow}
        </button>
      </form>
    </div>
  );
}
