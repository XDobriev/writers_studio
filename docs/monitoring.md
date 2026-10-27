# Мониторинг прода

Состояние на 25.10.2026. Внешний мониторинг — UptimeRobot (бесплатный план). Он проверяет, что сайт и Supabase отвечают, и заодно не даёт бесплатному проекту Supabase уснуть.

## Что настроено

| Монитор | URL | Что проверяет | Интервал |
|---|---|---|---|
| `avtorstudio.com/` | `https://avtorstudio.com/` | nginx и сайт на VPS отдают 200 | 5 минут |
| «Supabase API (avtorstudio.com/sb)» (id 804420119) | `https://avtorstudio.com/sb-health` | цепочка nginx-прокси → Supabase REST → БД, запрос к `app_settings` | 5 минут |

В том же аккаунте есть чужой монитор `gym95.onrender.com` (другой проект владельца) — его не трогать.

Аккаунт UptimeRobot принадлежит владельцу (вход через dashboard.uptimerobot.com). Пароли и ключи сюда не пишем.

### Как устроен `/sb-health`

В `deploy/nginx.conf` есть `location = /sb-health`. Он проксирует `GET /rest/v1/app_settings?select=key&limit=1` на Supabase и сам подставляет заголовок `apikey` с публичным anon-ключом (он и так открыт в клиентском бандле).

- **200 и JSON** — всё живо: прокси работает, проект не спит, БД отвечает.
- **401** — anon-ключ в `nginx.conf` не совпадает с текущим ключом проекта (ротация). Обновить ключ в `deploy/nginx.conf` и в `VITE_SUPABASE_ANON_KEY`, задеплоить.
- **5xx или таймаут** — проблема на стороне Supabase или сети VPS → Supabase.

Зачем отдельный адрес, а не `/sb/auth/v1/health`: тот без ключа отвечает 401, а UptimeRobot принимает URL не длиннее ~255 символов, так что anon-ключ (208 символов) в query не помещается. Кастомные заголовки запросов в UptimeRobot платные.

## Алерты

- Сейчас уведомления приходят **на email** владельца (включено по умолчанию для обоих мониторов).
- Telegram, Slack и Webhook-интеграции в UptimeRobot платные («Upgrade to access»). Чтобы не пропустить письмо, на телефоне должны быть включены пуши почтового приложения, а письма UptimeRobot не должны попадать в спам.
- Проверить доставку: на странице монитора кнопка **Test Notification**.

## Что делать при алерте

1. **`avtorstudio.com/` недоступен.** Открыть сайт и `https://avtorskaya-studiya.vercel.app` (резерв на Vercel). Если Vercel жив, а VPS нет: Timeweb Cloud → сервер, состояние; `gh run list --workflow deploy-timeweb.yml --limit 3` (не упал ли последний деплой); на VPS `systemctl status nginx`, `nginx -t`. Откат nginx-конфига — `.bak`, его делает обёртка `deploy-nginx-conf.sh`.
2. **`/sb-health` недоступен, сайт жив.** `curl -i https://avtorstudio.com/sb-health` и по коду ответа — таблица выше. Если 5xx/таймаут: Supabase Dashboard → проект, не на паузе ли он (Free засыпает после недели без активности — нажать Restore). Статус платформы — status.supabase.com.
3. После починки монитор сам вернётся в Up; ручных действий в UptimeRobot не нужно.

## Как менять мониторы

1. dashboard.uptimerobot.com → Monitoring → нужный монитор → **Edit**.
2. URL меняется в поле «URL to monitor» (до ~255 символов; длиннее форма молча не сохраняет и не показывает ошибку).
3. Имя меняется кнопкой **Rename** рядом с «Friendly name». По умолчанию имя копирует URL; с очень длинным URL страница формы растягивается и кнопка «Create monitor» перестаёт работать.
4. **Pause / Resume** — временно отключить проверки (например, перед работами на VPS, чтобы не слать ложные алерты).

## Что не покрыто

- **Cron на стороне Supabase** (`billing-scheduler`, `retention-email`): внешнего алерта нет. Проверка вручную в SQL: `select j.jobname, d.status, d.start_time from cron.job j left join lateral (select * from cron.job_run_details where jobid=j.jobid order by start_time desc limit 3) d on true;`. Статус `succeeded` значит только то, что запрос поставлен в очередь; HTTP-ответ функции — в `net._http_response`.
- **Edge Functions**: отдельных проверок нет.
- **Сертификат**: Let's Encrypt, продление по таймеру certbot на VPS (текущий до 2026-11-24). Мониторинг срока SSL в UptimeRobot доступен только на платном плане.
- **Резервный пинг** `.github/workflows/keep-alive.yml` остаётся, но GitHub отключает расписания в публичном репо через 60 дней без коммитов; после стабильной работы UptimeRobot его можно удалить (см. T-3 в роадмапе).
