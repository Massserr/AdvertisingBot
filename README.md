# Advertising Bot MVP

MVP-платформа для покупки и продажи рекламы в Telegram-каналах через Telegram Bot, Telegram Mini App, backend, базу данных и админ-панель.

## Архитектура

- `apps/api` - NestJS backend, Prisma, бизнес-логика, webhook ЮKassa, очереди.
- `apps/bot` - Telegram Bot на grammY.
- `apps/mini-app` - Telegram Mini App на Next.js.
- `apps/admin` - отдельная админ-панель на Next.js.
- `packages/shared` - общие типы и константы.

Финансовое ядро строится вокруг журнала операций `FinancialTransaction`. Балансы профилей хранят агрегаты для быстрого чтения, но каждое изменение должно иметь запись в журнале. Ручные выплаты MVP и будущие выплаты через ЮKassa используют одну сущность `PayoutRequest`.

## Локальный запуск

1. Включить pnpm через Corepack: `corepack enable`.
2. Установить зависимости: `pnpm install`.
3. Скопировать `.env.example` в `.env` и заполнить значения.
4. Поднять инфраструктуру: `docker compose up -d`.
5. Сгенерировать Prisma Client: `pnpm prisma:generate`.
6. Применить миграции: `pnpm prisma:migrate`.
7. Заполнить справочники: `pnpm db:seed`.
8. Запустить сервисы: `pnpm dev`.

Порты по умолчанию:

- API: `http://localhost:4000/api`;
- Mini App: `http://localhost:3000`;
- Admin: `http://localhost:3001`.

## Этапы

Скелет подготовлен под этапы из ТЗ: авторизация, профили, каталог, заявки, платежи, публикации, споры, выплаты, рассылки и настройки.
