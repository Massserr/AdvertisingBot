# Deploy Mini App To Vercel

Эта Mini App сейчас может быть опубликована отдельно от backend и bot, чтобы быстро показать MVP по постоянной HTTPS-ссылке.

## Деплой через VS Code Terminal

Из корня проекта:

```powershell
Set-Location .\apps\mini-app
npx.cmd vercel@latest login
npx.cmd vercel@latest --prod
```

При первом запуске Vercel спросит:

- `Set up and deploy?` - `Y`;
- `Which scope?` - выбрать свой аккаунт;
- `Link to existing project?` - `N`, если проекта ещё нет;
- `Project name` - например `adbot-mini-app`;
- `In which directory is your code located?` - `./`;
- `Want to modify these settings?` - обычно `N`.

После деплоя Vercel выдаст URL вида:

```text
https://adbot-mini-app.vercel.app
```

## Подключение к боту

В корневом `.env` заменить:

```env
MINI_APP_URL=https://adbot-mini-app.vercel.app
```

Затем перезапустить bot из корня проекта:

```powershell
Set-Location ..\..
$env:COREPACK_HOME="$PWD\.corepack"
corepack pnpm --filter @adbot/bot dev
```

После этого отправить `/start` боту в Telegram.

## Важно

Backend можно не деплоить для демо текущего MVP-экрана. Когда Mini App начнёт делать реальные запросы к API, нужно будет дополнительно вынести `apps/api` на VPS/cloud и заменить API URL в переменных окружения.
