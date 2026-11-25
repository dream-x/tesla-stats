export type PeriodKey = "today" | "7d" | "month" | "prev-month" | "30d" | "year" | "custom";

export interface Period {
  key: PeriodKey;
  label: string;
  from: number;
  to: number;
}

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Сегодня" },
  { key: "7d", label: "7 дней" },
  { key: "month", label: "Этот месяц" },
  { key: "prev-month", label: "Прошлый месяц" },
  { key: "30d", label: "30 дней" },
  { key: "year", label: "Этот год" },
];

function parseDate(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toDateInput(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Resolves a period in server-local time. `to` is exclusive. */
export function resolvePeriod(
  params: { period?: string; from?: string; to?: string },
  now: Date = new Date(),
): Period {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (params.period === "custom") {
    const f = parseDate(params.from);
    const t = parseDate(params.to);
    if (f && t && f <= t) {
      const end = new Date(t);
      end.setDate(end.getDate() + 1);
      return {
        key: "custom",
        label: `${f.toLocaleDateString("ru-RU")} — ${t.toLocaleDateString("ru-RU")}`,
        from: f.getTime(),
        to: end.getTime(),
      };
    }
  }

  const key = (PERIOD_OPTIONS.find((o) => o.key === params.period)?.key ?? "month") as PeriodKey;
  const label = PERIOD_OPTIONS.find((o) => o.key === key)!.label;
  let from: Date;
  let to = tomorrow;
  switch (key) {
    case "today":
      from = today;
      break;
    case "7d":
      from = new Date(today);
      from.setDate(today.getDate() - 6);
      break;
    case "30d":
      from = new Date(today);
      from.setDate(today.getDate() - 29);
      break;
    case "prev-month":
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      to = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case "year":
      from = new Date(today.getFullYear(), 0, 1);
      break;
    case "month":
    default:
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
  }
  return { key, label, from: from.getTime(), to: to.getTime() };
}
