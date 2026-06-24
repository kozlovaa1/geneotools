# Implementation Plan: Тестовый контур для парсинга и сборки

Branch: codex/atdb-parse-build-test-harness
Created: 2026-06-24

## Settings
- Testing: yes
- Logging: standard
- Docs: yes

## Roadmap Linkage
Milestone: "Тестовый контур для парсинга и сборки"
Rationale: План закрывает открытый roadmap milestone через unit/smoke-покрытие ключевых mapping-правил, родительских связей, дат и parse-build сценария.

## Research Context
Source: `.ai-factory/RESEARCH.md` (Active Summary), `.ai-factory/ROADMAP.md`, текущий `$aif-explore ROADMAP "Тестовый контур для парсинга и сборки"`.

Goal:
- Зафиксировать тестовый контур, который ловит регрессии в parse/build логике до расширения поддержки вариативных схем ATDB.

Constraints:
- `.atdb` fixtures и публичные artifacts не должны раскрывать персональные строки, GUID, места, заметки, raw `ValuesStr`, document paths или source text.
- SQL-логика остается в `lib/`; UI не должен напрямую работать со схемой SQLite.
- Текущий hard-fail drift gate уже существует; план должен расширять покрытие, а не заново решать исторический drift.
- User/worktree state уже содержит незакоммиченные изменения в `.ai-factory`; implementation не должен их откатывать.

Decisions:
- Использовать существующий branch-scoped test style в `scripts/check-atdb-*.mjs`.
- Держать synthetic fixtures полностью обезличенными и in-memory, без новых персональных `.atdb`.
- Считать текущий `parse -> build -> reparse` count drift gate базовым слоем, а новые проверки строить вокруг дат, родительских ролей, place links и безопасных агрегированных инвариантов.
- Выделить общий helper для временной компиляции `lib/**/*.ts` в ATDB test scripts, чтобы новые gates не копировали loader/bootstrap логику.

Open questions:
- `docs/atdb_schema_yaman.snapshot.json` сейчас отсутствует, хотя `scripts/atdb-fixtures.mjs` считает `yaman` tracked fixture. Нужно восстановить tracked snapshot или явно изменить контракт registry/regression.

Current evidence:
- `npm run smoke:atdb:matrix` проходит на `yaman`, `yaman-full`, `family` с нулевыми deltas.
- `npm run mapping:atdb:check` проходит, но пропускает `yaman` snapshot как missing.
- `npm run test:atdb:write-safety` и `npm run test:atdb:rebuild-contract` проходят.
- `npm run test:atdb:fixtures:missing-local` сейчас падает до сценария проверки из-за отсутствующего `docs/atdb_schema_yaman.snapshot.json`.

## Commit Plan
- **Commit 1** (after tasks 1-4): `test(atdb): add parser contract coverage`
- **Commit 2** (after tasks 5-7): `test(atdb): harden parse-build gates`

## Tasks

### Phase 1: Восстановить fixture baseline и unit coverage
- [x] Task 1: Восстановить tracked snapshot contract для `yaman`.

  Deliverable:
  - Выяснить, должен ли `yaman` оставаться tracked fixture по `scripts/atdb-fixtures.mjs`.
  - Если да, восстановить или заново сгенерировать redacted `docs/atdb_schema_yaman.snapshot.json` штатным schema tooling.
  - Если нет, изменить registry/regression contract так, чтобы отсутствие tracked snapshot было явным и проверяемым решением, а не случайным `ENOENT`.
  - Обновить hardcoded consumers snapshot path: `scripts/check-atdb-fixtures-regression.mjs` не должен безусловно копировать отсутствующий snapshot, а `scripts/check-atdb-fixtures.mjs` должен брать tracked redaction artifact через fixture registry или через восстановленный baseline.
  - Если `yaman` больше не tracked, redaction-check и default diff path должны иметь controlled skip/failure с safe-сообщением, а не прямой `fs.readFileSync`/`copyFileSync` по отсутствующему файлу.
  - После правки `npm run test:atdb:fixtures:missing-local` не должен падать на копировании отсутствующего snapshot.

  Files:
  - `scripts/atdb-fixtures.mjs`
  - `scripts/check-atdb-fixtures.mjs`
  - `scripts/check-atdb-fixtures-regression.mjs`
  - `scripts/diff-atdb-schema.mjs`
  - `scripts/inspect-atdb-schema.mjs`
  - `docs/atdb_schema_yaman.snapshot.json`

  LOGGING REQUIREMENTS:
  - Выводить только fixture labels, snapshot status, section counts и safe error codes.
  - Не печатать absolute local paths, raw rows, GUID, `ValuesStr.vstr`, имена, места, заметки, document paths или source text.
  - При missing tracked snapshot печатать понятное safe-сообщение с label fixture и ожидаемым relative path.

- [x] Task 2: Выделить общий ATDB script test harness.

  Deliverable:
  - Создать общий helper для временной компиляции TypeScript-модулей из `lib/` в CommonJS temp workspace и safe cleanup после проверки.
  - Перевести новые ATDB test scripts на этот helper; существующие дублирующие helpers трогать только если это нужно для нового parser/date/smoke coverage без расширения scope.
  - Helper должен поддерживать копирование `.json`, symlink/copy `node_modules` и загрузку compiled `lib/sqlProcessor.js`/точечных модулей через `createRequire`.
  - Ошибки helper должны быть safe: без absolute temp paths и без user fixture paths в обычном выводе.

  Files:
  - `scripts/atdb-test-harness.mjs`
  - `scripts/check-atdb-dates.mjs`
  - `scripts/check-atdb-parser-contract.mjs`
  - `scripts/smoke-atdb.mjs`

  LOGGING REQUIREMENTS:
  - Helper сам не должен печатать подробный debug output по умолчанию.
  - Consumers печатают только свои safe prefixes, scenario labels, counts, aggregate keys и pass/fail.
  - Не логировать temp absolute paths, raw fixture values, SQL rows, GUID, имена, места, заметки, document paths или source text.

- [x] Task 3: Добавить focused unit gate для ATDB date helpers.

  Deliverable:
  - Создать `scripts/check-atdb-dates.mjs` с проверками `formatAtdbDate`, `splitAtdbDate` и граничных partial-date случаев.
  - Проверить полные даты, `YYYY-MM-00`, `YYYY-00-00`, отсутствующий год, некорректные сегменты и round-trip для поддержанных форматов.
  - Добавить npm-script `test:atdb:dates`.
  - Не менять публичную семантику дат без отдельного явного failing assertion и follow-up решения.

  Files:
  - `scripts/check-atdb-dates.mjs`
  - `lib/atdb/dates.ts`
  - `package.json`

  LOGGING REQUIREMENTS:
  - Печатать safe prefix вроде `[safe-atdb-dates]`.
  - Логировать только названия сценариев и `status: success/failure`.
  - Не логировать значения из пользовательских fixtures; тестовые даты должны быть synthetic constants.

- [x] Task 4: Добавить synthetic parser contract test для родителей, дат и primary life-event ролей.

  Deliverable:
  - Создать `scripts/check-atdb-parser-contract.mjs` или близкий по стилю скрипт.
  - Использовать общий ATDB script test harness из Task 2 для загрузки compiled `parseAtdb`/`sqlProcessor`.
  - Построить in-memory SQLite fixture через `sql.js` с минимальным набором таблиц, нужных `parseAtdb`: `Persons`, `Events`, `EventDetails`, `EventTypes`, `EventRoles`, `Fields`, `ValuesDates`, `ValuesLinks`, `Places`, `ValuesStr` и optional metadata tables по необходимости.
  - Заполнить `Fields(id, tablecode, datatype, area)` для всех field rules, которые должны участвовать в assertions: `eventDate`, `eventPlaceLink`, при необходимости `eventPlaceLinkAlternate`, `placeName` и используемые person string fields. Fixture должен падать, если `schemaContext.resolveFieldRule()` отключил нужный field rule.
  - Проверить, что parser:
    - читает `fatherId` / `motherId` через `EventRoles`, а не через универсальные numeric assumptions;
    - читает `birthDate` / `deathDate` из event-level `ValuesDates`;
    - назначает `birthPlaceId` / `deathPlaceId` только primary participant роли;
    - не присваивает child life-event place вторичному участнику события;
    - корректно переживает remapped role IDs при сохранении `roletype` / `ord`.
  - Добавить npm-script `test:atdb:parser-contract`.

  Files:
  - `scripts/check-atdb-parser-contract.mjs`
  - `lib/sqlProcessor.ts`
  - `lib/atdb/readers/personsReader.ts`
  - `lib/atdb/readers/eventsReader.ts`
  - `lib/atdb/schemaContext.ts`
  - `package.json`

  LOGGING REQUIREMENTS:
  - Печатать safe prefix вроде `[safe-atdb-parser-contract]`.
  - Логировать только synthetic scenario names, counts и pass/fail.
  - Не добавлять raw SQL row dumps; все assertion errors должны ссылаться на scenario labels, а не на персональные значения.

<!-- Commit checkpoint: tasks 1-4 -->

### Phase 2: Усилить parse-build smoke и regression gates
- [x] Task 5: Расширить `parse -> build -> reparse` smoke инварианты поверх существующих count deltas.

  Deliverable:
  - Оставить текущий hard-fail behavior по `deltaPersons`, `deltaFamilies`, `deltaEvents`, `deltaPlaces`.
  - Добавить безопасные агрегированные инварианты round-trip для parsed данных: количество персон с `fatherId`, `motherId`, `birthDate`, `deathDate`, `birthPlaceId`, `deathPlaceId`, количество событий с `date`, количество событий с участниками.
  - Сравнивать агрегаты до и после rebuild; любой drift должен hard-fail smoke/matrix gate.
  - Зафиксировать stable safe log keys для aggregate deltas в `scripts/smoke-atdb.mjs`, например `drift-aggregate-<key>`, и использовать только эти keys в matrix output.
  - `scripts/check-atdb-fixtures.mjs` должен hard-fail, если expected aggregate key отсутствует в smoke output, чтобы matrix не проходил при неполной проверке.
  - Вывод matrix должен показывать новые aggregate deltas без raw data.

  Files:
  - `scripts/smoke-atdb.mjs`
  - `scripts/check-atdb-fixtures.mjs`
  - возможно новый helper `scripts/atdb-roundtrip-invariants.mjs`

  LOGGING REQUIREMENTS:
  - Выводить только fixture label, phase status, entity deltas и aggregate invariant deltas.
  - Не печатать ID персон/мест/событий, имена, места, даты из пользовательских fixtures, GUID, raw rows или локальные пути.
  - Failure message должен быть safe: `roundtrip invariant gate failed` плюс названия drifted aggregate keys.

- [x] Task 6: Расширить regression coverage для missing fixtures и synthetic drift paths.

  Deliverable:
  - Обновить `scripts/check-atdb-fixtures-regression.mjs`, чтобы он проверял:
    - missing local-only fixtures остаются skip/success;
    - missing tracked snapshot даёт понятный controlled failure или отсутствует после Task 1;
    - synthetic count drift всё ещё hard-fail;
    - synthetic aggregate invariant drift из Task 5 тоже hard-fail;
    - temp paths не протекают в вывод.
  - Проверка должна использовать synthetic scripts/temp workspace и не читать пользовательские `.atdb` для failure paths.

  Files:
  - `scripts/check-atdb-fixtures-regression.mjs`
  - `scripts/check-atdb-fixtures.mjs`
  - `scripts/smoke-atdb.mjs`

  LOGGING REQUIREMENTS:
  - Regression output содержит только synthetic labels, statuses, aggregate keys и deltas.
  - Не выводить temp absolute paths, если только assertion не упал; даже при падении проверять redaction.
  - Safe prefix: `[safe-atdb-fixtures-regression]`.

- [x] Task 7: Синхронизировать документацию и выполнить итоговый gate bundle.

  Deliverable:
  - Обновить документацию по новым ATDB test scripts и semantics:
    - `README.md` или `docs/getting-started.md` для команд;
    - `docs/atdb_format.md` для parser/build test contour;
    - `AGENTS.md` при изменении карты scripts или обязательных gate-команд.
  - Запустить финальные проверки:
    - `npm run lint`
    - `npx tsc --noEmit --pretty false`
    - `npm run test:atdb:dates`
    - `npm run test:atdb:parser-contract`
    - `npm run mapping:atdb:check`
    - `npm run test:atdb:write-safety`
    - `npm run test:atdb:rebuild-contract`
    - `npm run smoke:atdb:matrix`
    - `npm run schema:atdb:fixtures:check`
    - `npm run test:atdb:fixtures:missing-local`
    - `git diff --check`
  - Если `schema:atdb:fixtures:check` генерирует/обновляет snapshot artifacts, явно проверить, что они redacted и не содержат запрещённых публичных данных.

  Files:
  - `README.md`
  - `docs/getting-started.md`
  - `docs/atdb_format.md`
  - `AGENTS.md`
  - `package.json`

  LOGGING REQUIREMENTS:
  - Документация и examples должны показывать только команды, safe labels, statuses и aggregate deltas.
  - Не добавлять в docs raw fixture content, names, places, GUID, `ValuesStr.vstr`, document paths, source text или локальные user paths.
  - Итоговая проверка должна фиксировать skip behavior local-only fixtures как допустимый только для отсутствующих local-only artifacts, не для tracked baseline.

<!-- Commit checkpoint: tasks 5-7 -->
