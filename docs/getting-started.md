[Back to README](../README.md) · [Architecture →](architecture.md)

# Getting Started

## Что это

GeneoTools — клиентское Next.js приложение для работы с `.atdb` файлами. База открывается локально, читается через `sql.js`, затем данные отображаются в табличном интерфейсе.

## Требования

- Node.js 20+
- npm
- Современный браузер с поддержкой `ArrayBuffer`, `Blob` и `FileReader`

## Установка

```bash
npm install
```

## Запуск в разработке

```bash
npm run dev
```

После запуска откройте `http://localhost:3000`.

## Основной сценарий

1. Загрузите локальный `.atdb` файл через drag-and-drop или file picker.
2. Приложение проверит SQLite header и откроет базу через `sql.js`.
3. После парсинга будут доступны вкладки:
   - Persons
   - Families
   - Events
   - Places
4. При необходимости скачайте пересобранный `.atdb` через кнопку экспорта.

## Полезные команды

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Что проверить после изменений

- Парсинг реального `.atdb` файла не падает
- Таблицы переключаются между вкладками
- Экспорт формирует скачиваемый `.atdb`
- `npm run lint` остаётся зелёным

## Известные ограничения

- Основной parser/build flow пока сосредоточен в одном файле `lib/sqlProcessor.ts`
- Табличный UI пока не разделён на entity-specific компоненты
- Автотестовый контур для критичных ветвей парсинга ещё не настроен

## See Also

- [Architecture](architecture.md) — текущая структура проекта и ограничения
- [Codebase Analysis](codebase-analysis.md) — что именно сейчас считается техдолгом
- [Refactoring Plan](refactoring-plan.md) — куда должен прийти проект

