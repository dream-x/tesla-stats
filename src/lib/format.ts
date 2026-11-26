import { t } from "./i18n";

const nf = (digits: number) =>
  new Intl.NumberFormat(t.intlLocale, { minimumFractionDigits: 0, maximumFractionDigits: digits });

export const fmtNum = (n: number, digits = 1) => nf(digits).format(n);

/** English puts short currency symbols first ("$28"); otherwise the symbol follows ("28 ₽"). */
export function fmtMoney(n: number, currency: string, digits = 0): string {
  const v = fmtNum(n, digits);
  return t.intlLocale.startsWith("en") && currency.length === 1 ? `${currency}${v}` : `${v} ${currency}`;
}

export function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString(t.intlLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtAgo(ts: number, now = Date.now()): string {
  const min = Math.round((now - ts) / 60_000);
  if (min < 1) return t.ago.justNow;
  if (min < 60) return t.ago.minutes(min);
  const h = Math.round(min / 60);
  if (h < 24) return t.ago.hours(h);
  return t.ago.days(Math.round(h / 24));
}

export const chargingStateLabel = (state: string) => t.chargingState[state] ?? state;

export const isWithinDays = (ts: number, days: number, now = Date.now()) => now - ts < days * 86_400_000;
