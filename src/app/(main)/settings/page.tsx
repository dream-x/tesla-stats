import { connection } from "next/server";
import { Suspense } from "react";
import {
  clearDemoAction,
  disconnectTeslaAction,
  loadDemoAction,
  pollNowAction,
  saveSettingsAction,
} from "@/lib/actions";
import { getSetting } from "@/lib/db";
import { hasDemoData } from "@/lib/demo";
import { fmtAgo } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getAppSettings } from "@/lib/stats";
import { isTeslaConfigured, isTeslaConnected, teslaConfig } from "@/lib/tesla";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function SettingsPage(props: PageProps<"/settings">) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t.settings.title}</h1>
      <Suspense fallback={<div className="text-neutral-500">{t.loading}</div>}>
        <SettingsContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function SettingsContent({ searchParams }: { searchParams: PageProps<"/settings">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const error = one(sp.error);
  const configured = isTeslaConfigured();
  const connected = isTeslaConnected();
  const s = getAppSettings();
  const lastPoll = Number(getSetting("tesla_last_poll") ?? 0);
  const lastStatus = getSetting("tesla_last_status");
  const lastError = getSetting("tesla_last_error");
  const demo = hasDemoData();

  return (
    <>
      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {t.settings.error}: {error === "not_configured" ? t.settings.notConfiguredError : error}
        </div>
      )}
      {one(sp.connected) && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          {t.settings.connectedBanner}
        </div>
      )}

      <section className="card space-y-3">
        <h2 className="font-medium">Tesla Fleet API</h2>
        {!configured ? (
          <div className="space-y-2 text-sm text-neutral-400">
            <p>{t.settings.notConfigured}</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                {t.settings.stepRegister}{" "}
                <a className="text-red-400 underline" href="https://developer.tesla.com" target="_blank" rel="noreferrer">
                  developer.tesla.com
                </a>{" "}
                (scope: Vehicle Information).
              </li>
              <li>
                Allowed Redirect URI: <code className="text-neutral-200">{teslaConfig().redirectUri}</code>
              </li>
              <li>
                {t.settings.stepEnvPre} <code>TESLA_CLIENT_ID</code> {t.settings.stepEnvAnd} <code>TESLA_CLIENT_SECRET</code>{" "}
                {t.settings.stepEnvIn} <code>.env.local</code> {t.settings.stepEnvPost}
              </li>
              <li>{t.settings.stepDomain}</li>
            </ol>
          </div>
        ) : !connected ? (
          <div className="space-y-3 text-sm">
            <p className="text-neutral-400">{t.settings.configuredSignIn}</p>
            <a href="/api/auth/login" className="btn">
              {t.settings.signIn}
            </a>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-neutral-500">{t.settings.vehicle}</dt>
              <dd>
                {getSetting("tesla_vehicle_name") || "—"}{" "}
                <span className="text-neutral-500">{process.env.TESLA_VIN || getSetting("tesla_vin") || ""}</span>
              </dd>
              <dt className="text-neutral-500">{t.settings.statusLabel}</dt>
              <dd>{lastStatus ? (t.settings.status[lastStatus] ?? lastStatus) : "—"}</dd>
              <dt className="text-neutral-500">{t.settings.lastPoll}</dt>
              <dd>{lastPoll ? fmtAgo(lastPoll) : t.settings.never}</dd>
            </dl>
            {lastError && <p className="text-red-300">{lastError}</p>}
            <div className="flex flex-wrap gap-2">
              <form action={pollNowAction}>
                <button className="btn">{t.settings.pollNow}</button>
              </form>
              <form action={disconnectTeslaAction}>
                <button className="btn-ghost">{t.settings.disconnect}</button>
              </form>
            </div>
            <p className="text-xs text-neutral-500">
              {t.settings.pollInfo(process.env.POLL_INTERVAL_MINUTES || 10, process.env.POLL_ACTIVE_INTERVAL_MINUTES || 2)}
            </p>
          </div>
        )}
      </section>

      <form action={saveSettingsAction} className="card space-y-3">
        <h2 className="font-medium">{t.settings.pricesTitle}</h2>
        <p className="text-sm text-neutral-400">{t.settings.pricesIntro}</p>
        <div className="grid grid-cols-3 gap-3">
          <label className="block text-sm">
            <span className="text-neutral-400">{t.settings.priceAc}</span>
            <input name="price_ac" defaultValue={s.priceAc} inputMode="decimal" className="input mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-400">{t.settings.priceDc}</span>
            <input name="price_dc" defaultValue={s.priceDc} inputMode="decimal" className="input mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-400">{t.settings.currency}</span>
            <input name="currency" defaultValue={s.currency} className="input mt-1" />
          </label>
        </div>
        <label className="flex items-center gap-2 pt-2 text-sm">
          <input type="checkbox" name="tou_enabled" defaultChecked={s.touEnabled} className="h-4 w-4 accent-red-600" />
          <span>{t.settings.touEnabled}</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block text-sm">
            <span className="text-neutral-400">{t.settings.pricePeak}</span>
            <input name="price_peak" defaultValue={s.pricePeak} inputMode="decimal" className="input mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-400">{t.settings.priceSemi}</span>
            <input name="price_semi" defaultValue={s.priceSemi} inputMode="decimal" className="input mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-400">{t.settings.priceNight}</span>
            <input name="price_night" defaultValue={s.priceNight} inputMode="decimal" className="input mt-1" />
          </label>
        </div>
        <p className="text-xs text-neutral-500">
          {t.settings.touNote}
        </p>
        <button className="btn">{t.save}</button>
      </form>

      <section className="card space-y-3">
        <h2 className="font-medium">{t.settings.demoTitle}</h2>
        <p className="text-sm text-neutral-400">
          {t.settings.demoText}
        </p>
        <div className="flex gap-2">
          <form action={loadDemoAction}>
            <button className="btn-ghost">{demo ? t.settings.recreateDemo : t.settings.loadDemo}</button>
          </form>
          {demo && (
            <form action={clearDemoAction}>
              <button className="btn-ghost">{t.settings.deleteDemo}</button>
            </form>
          )}
        </div>
      </section>

      <section className="card space-y-2 text-sm">
        <h2 className="font-medium">{t.settings.widgetTitle}</h2>
        <p className="text-neutral-400">
          {t.settings.widgetJson} <code className="text-neutral-200">/api/summary?period=month</code>
          {process.env.WIDGET_TOKEN ? (
            <>
              {" "}
              ({t.settings.widgetTokenAdd} <code>&amp;token=…</code> {t.settings.widgetTokenFrom})
            </>
          ) : (
            <> — {t.settings.widgetTokenSet}</>
          )}
        </p>
        <p className="text-neutral-400">
          {t.settings.widgetPage}{" "}
          <a href="/widget" className="text-red-400 underline">
            /widget
          </a>
          . {t.settings.widgetScript} <code>widgets/scriptable-tesla-stats.js</code>.
        </p>
      </section>
    </>
  );
}
