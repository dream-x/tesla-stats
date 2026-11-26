// Tesla Stats — iOS widget for the Scriptable app (https://scriptable.app).
// 1. Install Scriptable, create a new script and paste this file.
// 2. Set BASE_URL (and TOKEN if WIDGET_TOKEN is configured on the server).
// 3. Add a Scriptable widget to the home screen and pick this script.
//    Widget parameter (optional): today | 7d | month | prev-month | 30d | year
// 4. Set LANG to "ru" for Russian labels (period names come from the server's APP_LOCALE).

const BASE_URL = "http://192.168.1.10:3000";
const TOKEN = "";
const LANG = "en"; // "en" | "ru"

const STRINGS = {
  en: { locale: "en-US", km: "km", kwh: "kWh", whPerKm: "Wh/km", today: "today" },
  ru: { locale: "ru-RU", km: "км", kwh: "кВт·ч", whPerKm: "Вт·ч/км", today: "сегодня" },
};
const L = STRINGS[LANG] || STRINGS.en;

const period = (args.widgetParameter || "month").trim();
const url = `${BASE_URL}/api/summary?period=${encodeURIComponent(period)}${TOKEN ? `&token=${encodeURIComponent(TOKEN)}` : ""}`;

const fmt = (n, d = 0) => Number(n ?? 0).toLocaleString(L.locale, { maximumFractionDigits: d });

async function load() {
  const req = new Request(url);
  req.timeoutInterval = 15;
  return await req.loadJSON();
}

function addStat(stack, value, label, color) {
  const s = stack.addStack();
  s.layoutVertically();
  const v = s.addText(value);
  v.font = Font.boldSystemFont(26);
  v.textColor = color;
  v.minimumScaleFactor = 0.6;
  const l = s.addText(label);
  l.font = Font.systemFont(10);
  l.textColor = Color.gray();
}

function buildWidget(d) {
  const w = new ListWidget();
  w.backgroundColor = new Color("#0b0b0c");
  w.url = `${BASE_URL}/widget${TOKEN ? `?token=${encodeURIComponent(TOKEN)}` : ""}`;
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);

  const head = w.addStack();
  const title = head.addText(`⚡ ${d.vehicleName}`);
  title.font = Font.semiboldSystemFont(12);
  title.textColor = Color.white();
  head.addSpacer();
  if (d.latest && d.latest.batteryLevel != null) {
    const b = head.addText(`${d.latest.batteryLevel}%`);
    b.font = Font.systemFont(12);
    b.textColor = Color.gray();
  }

  const p = w.addText(d.period.label.toUpperCase());
  p.font = Font.systemFont(9);
  p.textColor = Color.gray();
  w.addSpacer(6);

  const row = w.addStack();
  addStat(row, fmt(d.km), L.km, new Color("#38bdf8"));
  row.addSpacer();
  addStat(row, fmt(d.kwh), L.kwh, new Color("#34d399"));

  if (config.widgetFamily !== "small") {
    row.addSpacer();
    addStat(row, d.whPerKm != null ? String(d.whPerKm) : "—", L.whPerKm, Color.white());
    if (d.cost > 0) {
      row.addSpacer();
      addStat(row, fmt(d.cost), d.currency, Color.white());
    }
  }

  w.addSpacer();
  const foot = w.addText(`${L.today} ${fmt(d.today.km)} ${L.km} · ${fmt(d.today.kwh, 1)} ${L.kwh}`);
  foot.font = Font.systemFont(9);
  foot.textColor = Color.gray();
  return w;
}

function errorWidget(e) {
  const w = new ListWidget();
  w.backgroundColor = new Color("#0b0b0c");
  const t = w.addText(`Tesla Stats: ${e.message || e}`);
  t.font = Font.systemFont(11);
  t.textColor = Color.red();
  return w;
}

let widget;
try {
  widget = buildWidget(await load());
} catch (e) {
  widget = errorWidget(e);
}
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentMedium();
Script.complete();
