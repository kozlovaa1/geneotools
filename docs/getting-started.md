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
npm run smoke:atdb
npm run smoke:atdb:matrix
npm run schema:atdb:check
npm run schema:atdb:diff:check
npm run schema:atdb:fixtures
npm run schema:atdb:fixtures:diff
npm run schema:atdb:fixtures:check
npm run mapping:atdb:check
npm run test:atdb:fixtures:missing-local
npm run test:atdb:write-safety
```

`schema:atdb:diff:check` проверяет tracked redacted snapshot и diff harness без доступа к локальной `.atdb` базе. Для локального сравнения двух экспериментальных баз или snapshot-файлов используйте:

```bash
npm run schema:atdb:diff -- <baseline.snapshot.json> <after.snapshot.json>
```

`schema:atdb:fixtures` строит redacted snapshot matrix для allow-list fixtures: tracked `yaman` и local-only `yaman-full` / `family`. `schema:atdb:fixtures:diff` показывает structural deltas baseline-vs-fixture в warn-only режиме, а `schema:atdb:fixtures:check` объединяет schema, diff, smoke matrix и redaction checks.

`smoke:atdb:matrix` и `schema:atdb:fixtures:check` падают при любом ненулевом parse/build/reparse delta по `persons`, `families`, `events` или `places`. Отсутствующие local-only fixtures остаются safe skip и не считаются ошибкой. `test:atdb:fixtures:missing-local` проверяет этот skip path и synthetic drift failure без чтения пользовательских `.atdb`.

`mapping:atdb:check` валидирует единый реестр правил `lib/atdb/mapping.json`, baseline трёх fixtures и отсутствие конфликтующих кодов в readers/writers. `test:atdb:write-safety` проверяет, что сборка не изменяет неизвестные `Values*` и не создаёт новые `EventRoles`.

Локальные `.atdb`, before/after snapshots, verbose/debug logs и private summaries не коммитьте. Публичные artifacts должны содержать только redacted counts, `rec_table`, `f_id`, `datatype`, link targets и confidence labels. `yaman-test.atdb` остается tracked research fixture; любые дополнительные `.atdb` с реальными данными держите только как local-only файлы.

## Что проверить после изменений

- Парсинг реального `.atdb` файла не падает
- Таблицы переключаются между вкладками
- Экспорт формирует скачиваемый `.atdb`
- `npm run lint` остаётся зелёным
- `npm run schema:atdb:diff:check` проходит без локальной fixture
- `npm run schema:atdb:fixtures:check` проходит на разрешенных fixtures без raw values в artifacts и падает при ненулевом parse/build drift

## Известные ограничения

- Основной parser/build flow пока сосредоточен в одном файле `lib/sqlProcessor.ts`
- Табличный UI пока не разделён на entity-specific компоненты
- Автотестовый контур для критичных ветвей парсинга ещё не настроен

## See Also

- [Architecture](architecture.md) — текущая структура проекта и ограничения
- [Codebase Analysis](codebase-analysis.md) — что именно сейчас считается техдолгом
- [Refactoring Plan](refactoring-plan.md) — куда должен прийти проект
