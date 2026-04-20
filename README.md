# GeneoTools

> Локальный браузерный инструмент для чтения и пересборки `.atdb` баз из «Древо Жизни 6».

GeneoTools открывает `.atdb` файл прямо в браузере, разбирает SQLite-данные через `sql.js`, показывает извлечённые сущности в таблицах и позволяет скачать обновлённый `.atdb`. Приложение не требует внешнего backend для основной работы с файлами.

## Quick Start

```bash
npm install
npm run dev
```

Открой `http://localhost:3000`, загрузите локальный `.atdb` файл и дождитесь завершения парсинга.

## Key Features

- **Локальная обработка** — файл разбирается в браузере без внешней БД
- **Typed domain model** — сущности приложения описаны в `lib/types.ts`
- **Табличный просмотр** — персоны, роды, события и места отображаются по вкладкам
- **Экспорт обратно в `.atdb`** — текущее in-memory состояние можно пересобрать в файл
- **Прозрачный refactoring path** — текущее состояние и целевая декомпозиция зафиксированы в `docs/`

## Example

```text
1. Загрузить файл .atdb
2. Дождаться парсинга SQLite базы
3. Переключаться между вкладками Persons / Families / Events / Places
4. Скачать пересобранный .atdb
```

## Current Status

- MVP в активном рефакторинге
- `npm run lint` проходит
- `npx tsc --noEmit` проходит
- Парсер и табличный UI ещё не декомпозированы до целевой архитектуры

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](docs/getting-started.md) | Установка, запуск и пользовательский сценарий |
| [Architecture](docs/architecture.md) | Актуальная структура и архитектурные ограничения |
| [ATDB Format](docs/atdb_format.md) | Наблюдения по структуре `.atdb` |
| [Codebase Analysis](docs/codebase-analysis.md) | Технический долг и найденные проблемы |
| [Refactoring Plan](docs/refactoring-plan.md) | Этапы и критерии рефакторинга |

## Development

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Notes

- Основная логика парсинга и сборки сейчас сосредоточена в `lib/sqlProcessor.ts`
- Табличный UI сейчас сосредоточен в `components/DataTable.tsx`
- Автотесты для parsing-flow ещё не настроены

## License

MIT
