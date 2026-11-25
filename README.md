# ⚡ Tesla Stats

Веб‑приложение (PWA) + виджет, которое показывает, **сколько километров вы проехали и сколько кВт·ч зарядили** за любой период: сегодня, 7/30 дней, месяц, прошлый месяц, год или произвольные даты.

- Пробег — по разнице показаний одометра.
- Зарядки — сессии определяются автоматически (AC дома / DC Supercharger), с кВт·ч, % заряда и стоимостью.
- Расход Вт·ч/км, стоимость за период и за км (по вашим тарифам).
- Графики по дням (или по месяцам для длинных периодов).
- `/widget` — компактная карточка для экрана «Домой», `/api/summary` — JSON для любых виджетов, готовый iOS‑виджет для Scriptable.
- Ручной ввод одометра и зарядок, демо‑данные.

Стек: Next.js 16 (App Router) + встроенный SQLite из Node (`node:sqlite`), без внешних БД. Нужен Node.js ≥ 22.13.

## Быстрый старт

```bash
cp .env.example .env.local   # заполните позже, для демо не обязательно
npm install
npm run dev                  # http://localhost:3000
```

Откройте приложение и нажмите «Загрузить демо», чтобы посмотреть интерфейс. Демо‑данные удалятся сами при первом успешном опросе машины.

### Docker (домашний сервер)

```bash
docker compose up -d --build   # данные хранятся в ./data
```

Укажите `TZ` в `.env.local` — по нему считаются границы дней и месяцев.

## Подключение Tesla (Fleet API)

Данные берутся из официального [Tesla Fleet API](https://developer.tesla.com/docs/fleet-api). Приложение **не будит машину**: если она спит, опрос пропускается (пробег от этого не теряется — одометр не меняется, пока машина спит).

1. **Создайте приложение** на <https://developer.tesla.com> → *Create application*.
   - Scopes: *Vehicle Information* (и *Profile*).
   - Allowed Origin: ваш домен, например `https://tesla.example.com`.
   - Allowed Redirect URI: `http://localhost:3000/api/auth/callback` (Tesla разрешает localhost; публичный домен нужен только для ключа).
2. Пропишите в `.env.local` `TESLA_CLIENT_ID`, `TESLA_CLIENT_SECRET`, `TESLA_REDIRECT_URI` и регион `TESLA_FLEET_API_BASE` (Европа/РФ — `eu`, США — `na`).
3. **Публичный ключ.** Tesla требует, чтобы на вашем домене по адресу
   `/.well-known/appspecific/com.tesla.3p.public-key.pem` лежал публичный ключ. Сгенерируйте:
   ```bash
   openssl ecparam -name prime256v1 -genkey -noout -out data/private-key.pem
   openssl ec -in data/private-key.pem -pubout -out data/public-key.pem
   ```
   Приложение само отдаёт `data/public-key.pem` (или переменную `TESLA_PUBLIC_KEY`) по нужному пути. Приватный ключ для чтения данных не нужен — храните его в безопасности.
4. **Зарегистрируйте домен** (один раз, домен должен быть доступен из интернета по HTTPS):
   ```bash
   node --env-file=.env.local scripts/register-partner.mjs tesla.example.com
   ```
5. Откройте **Настройки → Войти через Tesla**, подтвердите доступ. Готово — машина начнёт опрашиваться автоматически.

> **Без своего домена:** Tesla не принимает `trycloudflare.com` и другие прокси‑домены, а также слово «tesla» в адресах. Проще всего разместить публичный ключ на GitHub Pages: репозиторий `<user>.github.io` с файлом `.well-known/appspecific/com.tesla.3p.public-key.pem` и пустым `.nojekyll`. В Tesla укажите Origin `https://<user>.github.io` и `http://localhost:3000`, Redirect `http://localhost:3000/api/auth/callback`, а партнёрский домен — `<user>.github.io`. Само приложение при этом работает локально.

### Стоимость запросов

Fleet API платный, но Tesla даёт бесплатный ежемесячный лимит (≈ $10). По умолчанию опрос раз в 10 минут (раз в 2 минуты во время поездки/зарядки) — это несколько тысяч запросов в месяц, что обычно укладывается в лимит. Интервалы меняются через `POLL_INTERVAL_MINUTES` и `POLL_ACTIVE_INTERVAL_MINUTES`.

## Виджеты

- **PWA / экран «Домой»**: откройте `/widget` в Safari/Chrome → «Поделиться» → «На экран Домой». Страница обновляется сама каждые 5 минут.
- **iOS‑виджет**: установите [Scriptable](https://scriptable.app), вставьте `widgets/scriptable-tesla-stats.js`, укажите `BASE_URL` (и `TOKEN`). Параметр виджета — период: `today`, `7d`, `month`, `prev-month`, `30d`, `year`.
- **Виджет macOS** (WidgetKit, рабочий стол и Центр уведомлений): `macos/build.sh` соберёт приложение EV Stats и установит его в `~/Applications`. Нужны Xcode и `brew install xcodegen`. Скрипт берёт `WIDGET_TOKEN` (и необязательный `WIDGET_BASE_URL`, по умолчанию `http://localhost:3000`) из `.env.local`. Затем: правый клик по рабочему столу → «Изменить виджеты» → EV Stats. Период выбирается через «Изменить виджет». Виджет обновляется каждые 15 минут.
- **JSON API**: `GET /api/summary?period=month` (или `period=custom&from=2026-11-01&to=2026-11-15`) → пробег, кВт·ч, Вт·ч/км, стоимость, ряд по дням. Можно использовать в Home Assistant, Android‑виджетах (KWGT) и т.п.
- `POST /api/poll` — принудительный опрос машины (для внешнего cron, если встроенный отключён через `DISABLE_POLLER=1`).

## Эксплуатация

- `GET /api/health` — JSON: база доступна, статус и возраст последнего опроса Tesla, состояние бэкапа. Без пароля, секретов не содержит.
- `GET /api/metrics` — метрики Prometheus (`tesla_stats_*`: одометр, заряд, запас хода, зарядка, опросы, бэкап). Без пароля; наружу не публикуйте.
- Бэкап: при заданном `BACKUP_DIR` раз в сутки `VACUUM INTO` в `tesla-YYYYMMDD-HHMM.db`, хранятся последние `BACKUP_KEEP` (14).
- Копировать живую базу только через `sqlite3 data/tesla.db ".backup copy.db"`: база в режиме WAL, простое `cp` теряет свежие данные.
- Одновременно опрашивать машину может только один экземпляр: Tesla ротирует refresh-токен, второй процесс с той же базой его потеряет.

## Безопасность

Если приложение доступно из интернета, задайте:
- `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` — пароль на весь интерфейс;
- `WIDGET_TOKEN` — токен для `/api/summary`, `/api/poll` и `/widget` (`?token=…` или `Authorization: Bearer …`), чтобы виджеты работали без пароля.

Токены Tesla хранятся в локальной SQLite‑базе `data/tesla.db`.

## Как считаются цифры

- **Пробег** = сумма приростов одометра между соседними показаниями внутри периода.
- **Заряжено** = `charge_energy_added` — энергия, попавшая в батарею. Из розетки уходит на ~5–15% больше (потери).
- **Расход** = заряжено ÷ пробег за тот же период (на коротких периодах может «скакать»).
- **Стоимость** = кВт·ч × тариф AC/DC из настроек (или стоимость, указанная вручную у зарядки).

## Разработка

```bash
npm run dev     # дев-сервер
npm test        # тесты расчётов и детекции зарядок
npm run lint
npm run build
```

Структура: `src/lib` — БД, клиент Tesla, опрос и запись данных, расчёт статистики; `src/app/(main)` — дашборд, данные, настройки; `src/app/widget` — виджет; `src/app/api` — OAuth, JSON API.
