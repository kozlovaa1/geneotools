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
- **Модульный ATDB-процессор** — публичный фасад `lib/sqlProcessor.ts` координирует внутренние `lib/atdb` readers/writers

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
- `.atdb` processor декомпозирован за фасадом `lib/sqlProcessor.ts`
- Табличный UI ещё не декомпозирован до целевой архитектуры

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](docs/getting-started.md) | Установка, запуск и пользовательский сценарий |
| [Architecture](docs/architecture.md) | Актуальная структура и архитектурные ограничения |
| [ATDB Format](docs/atdb_format.md) | Наблюдения по структуре `.atdb` |
| [Yaman ATDB Schema](docs/atdb_schema_yaman.md) | Полный безопасный schema artifact по `yaman-test.atdb` |
| [Multi-fixture ATDB Schema](docs/atdb_multi_fixture_schema.md) | Structural-only сравнение `yaman`, `yaman-full`, `family` |
| [Codebase Analysis](docs/codebase-analysis.md) | Технический долг и найденные проблемы |
| [Refactoring Plan](docs/refactoring-plan.md) | Этапы и критерии рефакторинга |

## Development

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run smoke:atdb
npm run smoke:atdb:matrix
npm run schema:atdb:fixtures
npm run schema:atdb:fixtures:diff
npm run schema:atdb:fixtures:check
```

`npm run smoke:atdb` по умолчанию ищет локальную fixture в `scripts/fixtures/local-smoke.atdb`.
Если файла нет, проверка завершается со статусом `skipped` без ошибки. Для разовой проверки можно передать путь через
`ATDB_SMOKE_FIXTURE=/path/to/local.atdb npm run smoke:atdb`.
Smoke harness компилирует `lib/sqlProcessor.ts` вместе с внутренними `lib/atdb/**/*.ts` модулями, чтобы проверять тот же фасад, который использует UI.

Не коммитьте пользовательские `.atdb` с реальными данными без осознанного решения и разрешения владельца данных.
Репозиторий игнорирует новые `*.atdb` файлы и локальные `scripts/fixtures/`, чтобы случайно не добавить приватные базы.
`yaman-test.atdb` является уже tracked research fixture для анализа схемы ATDB; для других локальных проверок используйте
`ATDB_SMOKE_FIXTURE` или `ATDB_SCHEMA_FIXTURE`.
Дополнительные fixtures `yaman-test-full.atdb` и `family-test.atdb` остаются local-only и не должны попадать в git без отдельного решения.
`npm run schema:atdb:check` выполняет generic structural check для выбранной fixture, а
`npm run schema:atdb:check:yaman` дополнительно проверяет golden counts и mapping для `yaman-test.atdb`.
Команда `npm run schema:atdb` пишет tracked Yaman snapshot только для `yaman-test.atdb`; для другой fixture явно задавайте
`ATDB_SCHEMA_OUTPUT` или `--output`, чтобы не перезаписать публичный snapshot локальными агрегатами.
Команда `npm run schema:atdb:fixtures` прогоняет allow-list `yaman`, `yaman-full`, `family` и пишет local-only snapshots только в ignored paths.
Команда `npm run schema:atdb:fixtures:diff` сравнивает baseline `yaman` с дополнительными fixtures в warn-only режиме: structural deltas видны в summary, но не считаются blocker сами по себе.
Команда `npm run smoke:atdb:matrix` фиксирует parse/build/reparse counts для всех разрешенных fixtures и показывает drift только как safe deltas.
Smoke-check должен выводить только размеры, счетчики сущностей и статусы parse/build/re-parse.

## Notes

- Основная логика парсинга и сборки находится во внутренних модулях `lib/atdb/`, а `lib/sqlProcessor.ts` остается совместимым фасадом
- Табличный UI сейчас сосредоточен в `components/DataTable.tsx`
- Автотесты для parsing-flow ещё не настроены

## License

MIT
