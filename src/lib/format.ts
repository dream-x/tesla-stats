const nf = (digits: number) =>
  new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: digits });

export const fmtNum = (n: number, digits = 1) => nf(digits).format(n);

export function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtAgo(ts: number, now = Date.now()): string {
  const min = Math.round((now - ts) / 60_000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.round(h / 24)} дн назад`;
}

export const CHARGING_STATE_RU: Record<string, string> = {
  Charging: "Заряжается",
  Starting: "Начинает зарядку",
  Complete: "Зарядка завершена",
  Stopped: "Зарядка остановлена",
  Disconnected: "Кабель не подключён",
  NoPower: "Нет питания",
};

export const isWithinDays = (ts: number, days: number, now = Date.now()) => now - ts < days * 86_400_000;
