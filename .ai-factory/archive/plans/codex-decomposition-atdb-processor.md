---
archived: 2026-06-24
---

# Implementation Plan: Декомпозиция .atdb-процессора

Branch: codex/decomposition-atdb-processor
Created: 2026-05-27

## Settings
- Testing: yes
- Logging: standard
- Docs: yes

## Roadmap Linkage
Milestone: "Декомпозиция `.atdb`-процессора"
Rationale: План разбивает монолитный `lib/sqlProcessor.ts` на внутренние модули чтения, записи и SQL-хелперов без изменения публичного parse/build API.

## Scope

Цель этого плана — структурный refactor, а не изменение интерпретации формата `.atdb`.

Публичные точки входа должны остаться совместимыми:
- `parseAtdb` и `buildAtdb` экспортируются из `lib/sqlProcessor.ts`.
- `lib/parseAtdb.ts` продолжает работать как compatibility re-export.
- `app/page.tsx` и `scripts/smoke-atdb.mjs` не должны требовать изменения импортов.

Ожидаемая целевая структура:

```text
lib/atdb/
  constants.ts
  dbTypes.ts
  sqlHelpers.ts
  dates.ts
  fieldDefinitions.ts
  readers/
    metadataReader.ts
    personsReader.ts
    familiesReader.ts
    eventsReader.ts
    placesReader.ts
    relationships.ts
  writers/
    metadataWriter.ts
    personsWriter.ts
    familiesWriter.ts
    eventsWriter.ts
    placesWriter.ts
    lifeEventWriter.ts
```

## Tasks

### Phase 1: Подготовить безопасный каркас декомпозиции

- [x] Task 1: Зафиксировать текущие public contracts и baseline-проверки.

  Проверить, что `app/page.tsx`, `scripts/smoke-atdb.mjs`, `lib/parseAtdb.ts` и документация используют `lib/sqlProcessor.ts` как фасад. Запустить `npm run lint` и `npm run smoke:atdb` до рефакторинга, чтобы иметь исходный quality gate.

  LOGGING REQUIREMENTS:
  - Не добавлять новые runtime-логи.
  - В отчете команд указывать только статусы и безопасные счетчики smoke-check.
  - Не печатать содержимое `.atdb`, имена персон, места, GUID или строки `ValuesStr`.

- [x] Task 2: Создать внутренний namespace `lib/atdb/` с константами и чистыми date/helpers.

  Вынести из `lib/sqlProcessor.ts` повторяемые и чистые части: SQLite header validation, форматирование дат ATDB, выбор более исторически корректной даты, table/field/event-role constants. Добавить минимальные локальные типы `SqlJsDatabase`/`SqlJsStatement` для внутренних reader/writer-модулей, чтобы не размазывать `any` и не завязывать UI на `sql.js` API. Подключить helpers обратно в `lib/sqlProcessor.ts` без изменения поведения.

  Files: `lib/atdb/constants.ts`, `lib/atdb/dbTypes.ts`, `lib/atdb/dates.ts`, `lib/atdb/sqlHelpers.ts`, `lib/sqlProcessor.ts`.

  LOGGING REQUIREMENTS:
  - Helper-функции не должны логировать персональные данные.
  - Ошибки валидации SQLite header должны оставаться обычными `Error` без дампа буфера.
  - Optional-table warnings должны остаться на прежних границах, без расширения verbose output.

- [x] Task 3: Обновить smoke harness под модульный `lib/atdb/`.

  Сейчас `scripts/smoke-atdb.mjs` вручную транспилирует только `lib/initSqlJs.ts` и `lib/sqlProcessor.ts`. После появления импортов `./atdb/...` smoke-check должен транспилировать зависимости `lib/atdb/**/*.ts` в тот же temp tree до `require(sqlProcessor.js)`, иначе проверка будет падать из-за `MODULE_NOT_FOUND`, а не из-за регрессии парсинга. Реализовать это до read/write extraction и не менять формат безопасного smoke output.

  Files: `scripts/smoke-atdb.mjs`.

  LOGGING REQUIREMENTS:
  - Сохранить prefix `[safe-atdb-smoke]` и текущие безопасные счетчики.
  - Не печатать пути к пользовательским `.atdb`, содержимое строк, GUID, имена персон или места.
  - При отсутствии fixture сохранить graceful skip.

### Phase 2: Вынести read-side по сущностям

- [x] Task 4: Вынести чтение metadata и field definitions.

  Создать `readFieldDefinitions(db)` и `readMetadata(db)`, заменить соответствующие блоки в `parseAtdb`. Сохранить fallback-поведение при отсутствии `Fields` и `Global`.

  Files: `lib/atdb/fieldDefinitions.ts`, `lib/atdb/readers/metadataReader.ts`, `lib/sqlProcessor.ts`.

  LOGGING REQUIREMENTS:
  - Для отсутствующих `Fields`/`Global` сохранить только безопасные `console.warn` без содержимого строк таблиц.
  - Не логировать `guid`, `srcguid`, `params` или другие metadata values.
  - Ошибки должны оставаться диагностируемыми по имени optional table.

- [x] Task 5: Вынести `readPersons` без изменения маппинга полей.

  Перенести чтение `Persons`, `ValuesStr`, `ValuesNum`, `ValuesDates`, `ValuesLinks`, а также восстановление birth/death data через `EventDetails` и `EventRoles` в `lib/atdb/readers/personsReader.ts`. Сохранить текущие fallback ID и спорные `rec_id`-wide запросы как есть; потенциальные исправления вынести в будущий milestone mapping.

  Files: `lib/atdb/readers/personsReader.ts`, `lib/sqlProcessor.ts`.

  LOGGING REQUIREMENTS:
  - Не добавлять логи значений персон, ФИО, дат, мест, notes или occupation.
  - Optional `EventDetails`/`EventRoles` warnings должны сообщать только имя optional path и тип ошибки.
  - Не расширять `console.error` в цикле персон, чтобы не засорять UI/console на больших базах.

- [x] Task 6: Вынести `readFamilies`, сохранив текущую совместимость `rec_table`.

  Перенести чтение `Families`, family links, dates и string values в `lib/atdb/readers/familiesReader.ts`. Явно оставить текущее поведение, где links читаются через `rec_table = 13`, а часть string values через `rec_table = 9`, с техническим комментарием о совместимости.

  Files: `lib/atdb/readers/familiesReader.ts`, `lib/sqlProcessor.ts`.

  LOGGING REQUIREMENTS:
  - Не логировать названия родов, фамилии, комментарии или child/person IDs из пользовательской базы.
  - Ошибку чтения `Families` оставить на уровне table boundary.
  - Комментарий о `rec_table` должен объяснять compatibility constraint, а не печатать данные.

- [x] Task 7: Вынести `readEvents`, `readPlaces` и post-read enrichment.

  Перенести чтение `Events`, `EventDetails`, event date/place/description и чтение `Places` в отдельные reader-модули. Вынести заполнение `spouseIds` и замену `birthPlace/deathPlace` по `Place.id` в `relationships.ts`.

  Files: `lib/atdb/readers/eventsReader.ts`, `lib/atdb/readers/placesReader.ts`, `lib/atdb/readers/relationships.ts`, `lib/sqlProcessor.ts`.

  LOGGING REQUIREMENTS:
  - Не логировать event descriptions, place names, comments или person IDs.
  - Optional `Places` warning должен остаться безопасным.
  - Enrichment-функции должны быть чистыми или предсказуемо мутировать только переданные in-memory модели без логов.

### Phase 3: Вынести write-side, не меняя export semantics

- [x] Task 8: Вынести metadata/person writers.

  Создать writer-модули для `Global` и персон. Сохранить существующие операции `DELETE`/`INSERT`, обновление `Persons.sex`, запись `ValuesStr`, `ValuesDates`, `ValuesLinks`, а также текущую логику birth/death через `EventDetails` и `EventRoles`. Вынести повторяемый find-or-create birth/death event flow в `lifeEventWriter.ts`, потому что текущий `buildAtdb` использует этот паттерн для дат, родителей и place links.

  Files: `lib/atdb/writers/metadataWriter.ts`, `lib/atdb/writers/personsWriter.ts`, `lib/atdb/writers/lifeEventWriter.ts`, `lib/sqlProcessor.ts`.

  LOGGING REQUIREMENTS:
  - Не логировать значения записываемых полей.
  - Ошибки writer должны всплывать через исключение, без частичных дампов SQL rows.
  - Не добавлять debug-логи вокруг каждой персоны.

- [x] Task 9: Вынести family/place/event writers.

  Перенести запись families, places, events и birth/death place links в writer-модули. Сохранить текущую мутацию `data.families` при derivation spouse relationships, но локализовать ее в отдельной функции с явным названием. Переиспользовать `lifeEventWriter.ts` для birth/death place links, чтобы Task 8 и Task 9 не создали две расходящиеся реализации поиска/создания событий.

  Files: `lib/atdb/writers/familiesWriter.ts`, `lib/atdb/writers/placesWriter.ts`, `lib/atdb/writers/eventsWriter.ts`, `lib/atdb/writers/lifeEventWriter.ts`, `lib/sqlProcessor.ts`.

  LOGGING REQUIREMENTS:
  - Не логировать фамилии, названия родов, места, descriptions или comments.
  - Не добавлять per-row success logs.
  - При невозможности записи таблицы ошибка должна указывать на writer boundary, а не на данные пользователя.

### Phase 4: Сжать фасад и закрепить проверки

- [x] Task 10: Превратить `lib/sqlProcessor.ts` в тонкий фасад parse/build.

  Оставить в `lib/sqlProcessor.ts` только динамический import `createDbFromBuffer`, lifecycle `db.close()`, публичные экспорты типов и координацию readers/writers. Проверить, что `parseAtdb` возвращает тот же shape `ParsedAtdb`, а `buildAtdb` возвращает `Uint8Array`.

  Files: `lib/sqlProcessor.ts`, `lib/parseAtdb.ts`.

  LOGGING REQUIREMENTS:
  - Фасад не должен логировать содержимое базы.
  - Сохранить существующую модель ошибок: critical errors бросаются наружу, optional readers предупреждают внутри.
  - Не добавлять telemetry или внешние обращения.

- [x] Task 11: Обновить документацию архитектуры под новую структуру.

  Синхронизировать `docs/architecture.md`, `docs/refactoring-plan.md` и при необходимости `README.md`: описать `lib/atdb/` как внутренний модульный слой за фасадом `lib/sqlProcessor.ts`, а `scripts/smoke-atdb.mjs` — как проверку этого фасада вместе с внутренними модулями. Не расширять документацию mapping-правил сверх фактически выполненного refactor.

  Files: `docs/architecture.md`, `docs/refactoring-plan.md`, `README.md`.

  LOGGING REQUIREMENTS:
  - Документация не должна содержать примеры реальных пользовательских данных.
  - Не вставлять smoke output с персональными строками.
  - Указать, что `.atdb` остается локальным файлом браузерной сессии.

- [x] Task 12: Финально проверить декомпозицию и отсутствие поведенческого дрейфа.

  Запустить `npm run lint`, `npm run build` и `npm run smoke:atdb`. Если smoke fixture отсутствует, зафиксировать graceful skip. Проверить, что imports из `app/page.tsx`, `lib/parseAtdb.ts` и `scripts/smoke-atdb.mjs` остаются рабочими, а temp-компиляция smoke-check включает все новые `lib/atdb/**/*.ts`.

  LOGGING REQUIREMENTS:
  - Итоговый отчет должен включать только статусы проверок и безопасные счетчики.
  - Не печатать содержимое `.atdb`, персональные поля, GUID, notes или названия мест.
  - При ошибке указывать модульную boundary и следующий минимальный шаг.

## Commit Plan

- **Commit 1** (after tasks 1-4): "refactor: extract atdb shared helpers"
- **Commit 2** (after tasks 5-7): "refactor: split atdb readers"
- **Commit 3** (after tasks 8-10): "refactor: split atdb writers and facade"
- **Commit 4** (after tasks 11-12): "docs: document atdb processor modules"
