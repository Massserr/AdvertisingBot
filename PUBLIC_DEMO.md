# Публичный показ Mini App без VPS

Этот режим нужен для демонстрации MVP, когда сервера еще нет.

Идея:

- локально работает `api` на `http://localhost:4000`;
- локально работает `mini-app` на `http://localhost:3000`;
- Cloudflare Tunnel открывает наружу только `mini-app`;
- `mini-app` обращается к backend через свой же публичный домен по пути `/api`;
- Next.js локально проксирует `/api/*` в `http://localhost:4000/api/*`.

Так людям снаружи и Telegram нужен один HTTPS-адрес.

## 1. Проверить `.env`

В корневом `.env` для локального публичного показа оставьте:

```env
API_PROXY_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_ENABLE_DEV_AUTH=false
TELEGRAM_DEV_AUTH_ENABLED=false
```

`MINI_APP_URL` нужно будет заменить на HTTPS-адрес tunnel после запуска `cloudflared`.

## 2. Поднять базу

```powershell
docker-compose up -d
```

Если база пустая:

```powershell
$env:COREPACK_HOME="$PWD\.corepack"
corepack pnpm --filter @adbot/api db:push
corepack pnpm --filter @adbot/api db:seed
```

## 3. Запустить backend

В первом терминале:

```powershell
$env:COREPACK_HOME="$PWD\.corepack"
corepack pnpm --filter @adbot/api dev
```

## 4. Запустить Mini App

Во втором терминале:

```powershell
$env:COREPACK_HOME="$PWD\.corepack"
corepack pnpm --filter @adbot/mini-app dev
```

## 5. Открыть Mini App наружу

В третьем терминале:

```powershell
cloudflared tunnel --url http://localhost:3000
```

Cloudflare выдаст адрес вида:

```text
https://example-name.trycloudflare.com
```

Если Cloudflare показывает `Error 1033` или в логе `cloudflared` есть ошибки подключения к edge, можно использовать запасной SSH tunnel:

```powershell
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R 80:localhost:3000 serveo.net
```

Serveo выдаст адрес вида:

```text
https://example.serveousercontent.com
```

## 6. Подставить tunnel URL в `.env`

```env
MINI_APP_URL=https://example-name.trycloudflare.com
CORS_ORIGINS=https://example-name.trycloudflare.com,http://localhost:3000,http://127.0.0.1:3000
```

После изменения `.env` перезапустите bot.

## 7. Запустить bot

В четвертом терминале:

```powershell
$env:COREPACK_HOME="$PWD\.corepack"
corepack pnpm --filter @adbot/bot dev
```

Теперь `/start` в Telegram должен открыть публичную Mini App по tunnel URL.

## Важно

- Пока нет VPS, доступ работает только когда ваш компьютер включен и запущены `api`, `mini-app`, `bot`, `cloudflared`.
- Бесплатный quick tunnel меняет URL при каждом запуске, поэтому после нового запуска `cloudflared` нужно обновить `MINI_APP_URL` и перезапустить bot.
- Для постоянной ссылки нужен VPS или именованный Cloudflare Tunnel на своем домене.
