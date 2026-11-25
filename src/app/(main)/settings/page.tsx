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
import { getAppSettings } from "@/lib/stats";
import { isTeslaConfigured, isTeslaConnected, teslaConfig } from "@/lib/tesla";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function SettingsPage(props: PageProps<"/settings">) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Настройки</h1>
      <Suspense fallback={<div className="text-neutral-500">Загрузка…</div>}>
        <SettingsContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

const STATUS_RU: Record<string, string> = { online: "🟢 онлайн", asleep: "😴 спит", error: "🔴 ошибка" };

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
          Ошибка: {error === "not_configured" ? "не заданы TESLA_CLIENT_ID / TESLA_CLIENT_SECRET" : error}
        </div>
      )}
      {one(sp.connected) && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          Tesla подключена! Данные будут собираться автоматически.
        </div>
      )}

      <section className="card space-y-3">
        <h2 className="font-medium">Tesla Fleet API</h2>
        {!configured ? (
          <div className="space-y-2 text-sm text-neutral-400">
            <p>Приложение Tesla ещё не настроено. Кратко:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Зарегистрируйте приложение на{" "}
                <a className="text-red-400 underline" href="https://developer.tesla.com" target="_blank" rel="noreferrer">
                  developer.tesla.com
                </a>{" "}
                (scope: Vehicle Information).
              </li>
              <li>
                Allowed Redirect URI: <code className="text-neutral-200">{teslaConfig().redirectUri}</code>
              </li>
              <li>
                Пропишите <code>TESLA_CLIENT_ID</code> и <code>TESLA_CLIENT_SECRET</code> в <code>.env.local</code> и
                перезапустите приложение.
              </li>
              <li>Зарегистрируйте домен (partner account) — подробно в README.</li>
            </ol>
          </div>
        ) : !connected ? (
          <div className="space-y-3 text-sm">
            <p className="text-neutral-400">Приложение настроено. Войдите в аккаунт Tesla, чтобы выдать доступ к данным машины.</p>
            <a href="/api/auth/login" className="btn">
              Войти через Tesla
            </a>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-neutral-500">Машина</dt>
              <dd>
                {getSetting("tesla_vehicle_name") || "—"}{" "}
                <span className="text-neutral-500">{process.env.TESLA_VIN || getSetting("tesla_vin") || ""}</span>
              </dd>
              <dt className="text-neutral-500">Статус</dt>
              <dd>{lastStatus ? (STATUS_RU[lastStatus] ?? lastStatus) : "—"}</dd>
              <dt className="text-neutral-500">Последний опрос</dt>
              <dd>{lastPoll ? fmtAgo(lastPoll) : "ещё не было"}</dd>
            </dl>
            {lastError && <p className="text-red-300">{lastError}</p>}
            <div className="flex flex-wrap gap-2">
              <form action={pollNowAction}>
                <button className="btn">Обновить сейчас</button>
              </form>
              <form action={disconnectTeslaAction}>
                <button className="btn-ghost">Отключить</button>
              </form>
            </div>
            <p className="text-xs text-neutral-500">
              Машина опрашивается раз в {process.env.POLL_INTERVAL_MINUTES || 10} мин (во время поездки/зарядки — раз в{" "}
              {process.env.POLL_ACTIVE_INTERVAL_MINUTES || 2} мин). Спящая машина не будится, чтобы не тратить батарею.
            </p>
          </div>
        )}
      </section>

      <form action={saveSettingsAction} className="card space-y-3">
        <h2 className="font-medium">Тарифы на электричество</h2>
        <p className="text-sm text-neutral-400">Нужны для расчёта стоимости. Можно оставить 0.</p>
        <div className="grid grid-cols-3 gap-3">
          <label className="block text-sm">
            <span className="text-neutral-400">AC / дом, за кВт·ч</span>
            <input name="price_ac" defaultValue={s.priceAc} inputMode="decimal" className="input mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-400">DC / Supercharger, за кВт·ч</span>
            <input name="price_dc" defaultValue={s.priceDc} inputMode="decimal" className="input mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-400">Валюта</span>
            <input name="currency" defaultValue={s.currency} className="input mt-1" />
          </label>
        </div>
        <label className="flex items-center gap-2 pt-2 text-sm">
          <input type="checkbox" name="tou_enabled" defaultChecked={s.touEnabled} className="h-4 w-4 accent-red-600" />
          <span>Домашний тариф по зонам суток (тогда цена AC выше не используется)</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block text-sm">
            <span className="text-neutral-400">Пик (7–10, 17–21)</span>
            <input name="price_peak" defaultValue={s.pricePeak} inputMode="decimal" className="input mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-400">Полупик (10–17, 21–23)</span>
            <input name="price_semi" defaultValue={s.priceSemi} inputMode="decimal" className="input mt-1" />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-400">Ночь (23–7)</span>
            <input name="price_night" defaultValue={s.priceNight} inputMode="decimal" className="input mt-1" />
          </label>
        </div>
        <p className="text-xs text-neutral-500">
          Стоимость зарядки делится по зонам пропорционально времени зарядки. Считается по энергии, попавшей в батарею;
          по счётчику выйдет примерно на 10% больше.
        </p>
        <button className="btn">Сохранить</button>
      </form>

      <section className="card space-y-3">
        <h2 className="font-medium">Демо-данные</h2>
        <p className="text-sm text-neutral-400">
          ~4 месяца сгенерированной истории, чтобы посмотреть интерфейс. Удаляются автоматически при первом успешном
          опросе Tesla.
        </p>
        <div className="flex gap-2">
          <form action={loadDemoAction}>
            <button className="btn-ghost">{demo ? "Пересоздать демо" : "Загрузить демо"}</button>
          </form>
          {demo && (
            <form action={clearDemoAction}>
              <button className="btn-ghost">Удалить демо</button>
            </form>
          )}
        </div>
      </section>

      <section className="card space-y-2 text-sm">
        <h2 className="font-medium">Виджет и API</h2>
        <p className="text-neutral-400">
          JSON для виджетов: <code className="text-neutral-200">/api/summary?period=month</code>
          {process.env.WIDGET_TOKEN ? (
            <> (добавьте <code>&amp;token=…</code> из WIDGET_TOKEN)</>
          ) : (
            <> — задайте WIDGET_TOKEN, если открываете приложение в интернет.</>
          )}
        </p>
        <p className="text-neutral-400">
          Компактная страница для экрана «Домой»: <a href="/widget" className="text-red-400 underline">/widget</a>. Скрипт
          для iOS-виджета (Scriptable) — в <code>widgets/scriptable-tesla-stats.js</code>.
        </p>
      </section>
    </>
  );
}
