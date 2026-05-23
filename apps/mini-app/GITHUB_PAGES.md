# Deploy Mini App To GitHub Pages

Mini App можно держать на GitHub Pages без собственного сервера, пока она остаётся статичной.

## Настройка

1. Создать GitHub-репозиторий и запушить проект.
2. В репозитории открыть `Settings` -> `Pages`.
3. В `Build and deployment` выбрать `GitHub Actions`.
4. Запустить workflow `Deploy Mini App` или сделать push в ветку `main`.

После деплоя GitHub выдаст URL вида:

```text
https://username.github.io/repository-name/
```

Именно этот URL нужно поставить в корневой `.env`:

```env
MINI_APP_URL=https://username.github.io/repository-name/
```

После изменения `.env` перезапустить bot:

```powershell
$env:COREPACK_HOME="$PWD\.corepack"
corepack pnpm --filter @adbot/bot dev
```

## Важно

Workflow использует `NEXT_PUBLIC_BASE_PATH` равный имени репозитория. Это нужно, чтобы Next.js корректно грузил ассеты на GitHub Pages по адресу `/repository-name/`.

Если позже подключите custom domain, base path можно будет убрать.
