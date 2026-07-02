# Implementation Plan: Расширение мест, дат и связанных ATDB-полей

Branch: codex/atdb-place-date-hierarchy-editing
Created: 2026-06-25

## Settings
- Testing: yes
- Logging: verbose
- Docs: yes

## Roadmap Linkage
Milestone: "Редактирование данных в UI"
Rationale: План расширяет уже введённый write-safe UI editing новыми полями персон, событий и мест без изменения базового пользовательского сценария загрузки/экспорта.

## Research Context
Source: текущий `$aif-explore`, `.ai-factory/ARCHITECTURE.md`, `docs/atdb_schema_yaman.snapshot.json`

Goal:
- Показывать места в связанных полях как полную иерархическую подпись: название, дата именования, путь родительских мест.
- Добавить в таблицу персон `Фамилия при рождении`, русские подписи пола и inline-редактирование дат/мест рождения и смерти.
- Сделать место события редактируемым.
- В таблице мест показать дату именования, редактируемую привязку к родительскому месту и информационный путь родителей.

Constraints:
- SQL остаётся в `lib/atdb/*`; UI не должен выполнять SQLite-запросы напрямую.
- Public docs и diagnostics не должны выводить raw `ValuesStr`, имена, места, GUID, заметки или локальные fixture paths.
- Формат пользовательского ввода дат остаётся текущим: `YYYY-MM-DD`, `YYYY-MM-00`, `YYYY-00-00`.
- При чтении дат нужно учитывать дополнительные колонки `ValuesDates`: `d2`, `m2`, `y2`, `calendar`, `calendar2`, `type`, `sort*`, `lconf`, `ltrust`, чтобы не потерять сведения о неточных датах: "до", "после", "около", "между", "с ... по ..." и другие.
- `Place.parentId` редактируется через селект существующих мест; нужно запретить self-parent и циклы.

Decisions:
- `Place.parentId` пишется через `Places.parent_id`, а не через `ValuesLinks`.
- `placeNamingDate` читается из `ValuesDates(rec_table=14, f_id=95)` и в этом плане отображается read-only.
- Для вкладки `События` добавляется inline-редактирование только места события; selection и bulk edit для событий не включаются без отдельного требования.
- Селекты мест используют draft-aware label с полным путём: `место (дата), родитель, ...`.
- Если дата или ссылка места рождения/смерти привязана к существующему primary life-event, поле можно редактировать даже когда исходного `ValuesDates` или `ValuesLinks` row ещё нет. Если primary life-event не найден, поле остаётся read-only.

Open questions:
- Нужна ли отдельная UI-поддержка выбора типа неточной даты в следующем milestone; в этом плане сохраняется текущий текстовый формат ввода и безопасное отображение существующей неточности.

## Commit Plan
- **Commit 1** (after tasks 1-3): `feat(atdb): read place hierarchy and date metadata`
- **Commit 2** (after tasks 4-6): `feat(atdb): extend write-safe date and place links`
- **Commit 3** (after tasks 7-8): `feat(ui): edit person dates and place hierarchy links`
- **Commit 4** (after tasks 9-10): `docs(atdb): document expanded edit contract`

## Tasks

### Phase 1: Расширить модель чтения и date helpers
- [x] Task 1: Добавить lossless-модель ATDB-даты и mapping новых read-side полей.

  Deliverable:
  - В `lib/types.ts` добавить компактный тип для даты ATDB, который хранит видимую строку текущего формата и raw metadata из `ValuesDates`.
  - В `lib/atdb/dates.ts` оставить существующие `formatAtdbDate` / `splitAtdbDate`, но добавить helpers для чтения `ValuesDates` row с `d2/m2/y2`, `calendar*`, `type`, `sort*`, `lconf`, `ltrust`.
  - Добавить форматирование неточных дат для read-only отображения без смены формата ввода: точная дата, диапазон, "до", "после", "около", "между", "с ... по ..." при подтверждённом `type`; неизвестные `type` отображать безопасно через текущую основную дату и diagnostic code без raw values.
  - В `lib/atdb/mapping.json` добавить `personBirthLastName` (`f_id=65`, `ValuesStr`, persons, read/write при подтверждении invariant) и `placeNamingDate` (`f_id=95`, `ValuesDates`, places, read-only).
  - Обновить `lib/atdb/mappingTypes.ts`, `lib/atdb/mapping.ts` и `scripts/check-atdb-mapping.mjs`, если registry schema требует новых metadata flags.
  - Расширить `scripts/check-atdb-dates.mjs` сценариями для primary date, range date, unknown date type и обратной совместимости текущего парсера строк.

  Files:
  - `lib/types.ts`
  - `lib/atdb/dates.ts`
  - `lib/atdb/mapping.json`
  - `lib/atdb/mappingTypes.ts`
  - `lib/atdb/mapping.ts`
  - `scripts/check-atdb-dates.mjs`
  - `scripts/check-atdb-mapping.mjs`

  LOGGING REQUIREMENTS:
  - Runtime parser logs: только safe diagnostic codes, field id, rec_table и counts; не логировать строковые значения дат, имена мест или raw rows.
  - Для неизвестного `ValuesDates.type` логировать `date.type.unknown` на `WARN` с numeric type и field id.
  - В test scripts выводить только scenario labels и статусы.

- [x] Task 2: Зафиксировать безопасную семантику `ValuesDates` для чтения и записи.

  Deliverable:
  - Добавить dedicated helper для `ValuesDates` row, который schema-aware читает optional columns `d2/m2/y2`, `calendar*`, `type`, `sort*`, `lconf`, `ltrust` и работает с минимальной схемой `y/m/d`.
  - Добавить специализированный date writer или расширение `valueWriter`, которое сохраняет metadata на no-op и не перезаписывает неизменённые owned rows.
  - При inline-редактировании разрешить запись только simple date state текущего формата; non-simple date types (`до`, `после`, `около`, `между`, `с ... по ...`) до отдельного UI выбора типа даты блокировать safe issue code, если изменение может потерять metadata.
  - Для insert/update/delete life-event date rows явно описать, какие metadata defaults допустимы для новой простой даты, а какие metadata должны сохраняться при no-op.
  - Покрыть сценарии minimal `ValuesDates` schema, range date, unknown type, no-op metadata preservation и safe block non-simple edit в `scripts/check-atdb-dates.mjs` и rebuild/write-safety gates.

  Files:
  - `lib/atdb/dates.ts`
  - `lib/atdb/writers/valueWriter.ts` или новый date writer
  - `lib/atdb/rebuildValidation.ts`
  - `scripts/check-atdb-dates.mjs`
  - `scripts/check-atdb-write-safety.mjs`
  - `scripts/check-atdb-rebuild-contract.mjs`

  LOGGING REQUIREMENTS:
  - Unknown/non-simple date edit diagnostics: только reasonCode, field id, rec_table и entityType.
  - No-op date writer logs: DEBUG counts без raw date values и raw metadata.
  - Regression scripts выводят только scenario labels и counts.

- [x] Task 3: Расширить readers и derived place label/path слой.

  Deliverable:
  - `lib/atdb/readers/personsReader.ts` читает `birthLastName` из `personBirthLastName` и сохраняет `birthEventId` / `deathEventId` для primary life events.
  - `lib/atdb/readers/eventsReader.ts` читает `placeId` вместе с текущим `place`.
  - `lib/atdb/readers/placesReader.ts` читает `Places.parent_id`, `placeNamingDate`, `name`, `shortName`, `comment`.
  - Добавить pure helper для draft-aware полного label места: `Название (дата именования), родитель, ...`; helper должен работать без SQL и принимать `ParsedAtdb + draft`.
  - Helper должен защищаться от циклов и слишком длинных цепочек, возвращая безопасный fallback `ID <id>` или усечённый путь без падения UI.
  - `populatePersonPlaceNames` или новый relationship helper должен использовать полный label для `birthPlace` / `deathPlace`, сохраняя id-поля как источник записи.
  - Обновить synthetic parser contract, чтобы он покрывал `Event.placeId`, `Place.parentId`, `placeNamingDate` и `birthLastName`.

  Files:
  - `lib/types.ts`
  - `lib/atdb/readers/personsReader.ts`
  - `lib/atdb/readers/eventsReader.ts`
  - `lib/atdb/readers/placesReader.ts`
  - `lib/atdb/readers/relationships.ts`
  - `lib/atdbPlaceLabels.ts` или близкий helper в `lib/`
  - `scripts/check-atdb-parser-contract.mjs`

  LOGGING REQUIREMENTS:
  - Reader diagnostics: DEBUG counts per entity and mapping resolution only.
  - Cycle detection in place path: WARN with count/depth and no place names.
  - Synthetic tests must use synthetic labels only.

<!-- Commit checkpoint: tasks 1-3 -->

### Phase 2: Расширить write-safe contract
- [x] Task 4: Развести draft/editable/bulk contracts и добавить новые field keys.

  Deliverable:
  - В `lib/atdb/rebuildContract.ts` добавить write-safe поля:
    - `Person.birthLastName`
    - `Person.birthDate`
    - `Person.deathDate`
    - `Event.placeId`
    - `Place.parentId`
  - Заменить legacy `motherLastName` в `lib/types.ts` на `birthLastName` во всех readers, table columns, compatibility diff unsupported lists и документации; regression должен подтверждать, что `personBirthLastName` не мапится в старое имя.
  - Ввести явный split: inline writable entity set включает `event`, selectable/bulk entity set остаётся `person | family | place`.
  - Обновить `AtdbDraftFieldKey`, `ATDB_EDITABLE_FIELDS`, `buildAtdbChangeSet`, `getOriginalField`, `SelectionState`, `getWritableEntityForAtdbTableEntity` и `ATDB_BATCH_EDITABLE_FIELDS` так, чтобы `event.placeId` был inline-only и не включал selection/bulk UI.
  - В `lib/atdbEditDraft.ts` добавить поддержку новых полей, нормализацию date text через текущий формат и integer parsing для `parentId` / `placeId`.
  - Сохранить `ATDB_BATCH_EDITABLE_FIELDS` как отдельный allowlist: новые поля дат, `event.placeId` и `place.parentId` не должны попадать в bulk edit без явного metadata entry.
  - Обновить `scripts/check-atdb-edit-draft.mjs` и `scripts/check-atdb-batch-edit.mjs`, чтобы зафиксировать split между inline-edit и bulk-edit контрактами.

  Files:
  - `lib/atdb/rebuildContract.ts`
  - `lib/atdbEditDraft.ts`
  - `lib/atdbBatchEdit.ts`
  - `scripts/check-atdb-edit-draft.mjs`
  - `scripts/check-atdb-batch-edit.mjs`

  LOGGING REQUIREMENTS:
  - Draft helpers остаются pure и не логируют.
  - Regression scripts логируют только counts/statuses и synthetic field names.
  - Никаких raw пользовательских значений в ошибках validation.

- [x] Task 5: Реализовать preflight validation и writers для дат, event place и `Place.parentId`.

  Deliverable:
  - Dependencies: Task 3 и Task 4 должны быть завершены, потому что writers/preflight используют `birthEventId` / `deathEventId`, `Event.placeId`, `Place.parentId` и финальный inline writable contract.
  - Добавить writer для life-event dates, который пишет `ValuesDates` по `eventDate` и `Events.id`; insert/update/delete должны быть в той же transaction, что и остальные изменения.
  - Добавить writer для `event.placeId`, который пишет `ValuesLinks(rec_table=events, f_id=eventPlaceLink, rec_id=Event.id, vlink_table=places)`.
  - Добавить writer для `Place.parentId`, который обновляет `Places.parent_id`.
  - Для редактирования life-event даты через персону использовать `birthEventId` / `deathEventId`; если event отсутствует, preflight должен блокировать change с safe issue code.
  - Preflight должен проверять существование target place, existing event, валидность date text, self-parent и циклы в иерархии мест.
  - Расширить strict routing в `validateAtdbChangeSetPreflight`, `entityMap`, `tableForEntity`, `allowedFieldsForEntity`, `collectTouchedOwnedValueKeys` и write phase в `lib/sqlProcessor.ts`; `event.placeId` должен проходить strict preflight/post-build и применяться отдельным writer до reparse.
  - Post-build validation должен подтверждать, что изменения видимы после reparse, включая `birthDate`, `deathDate`, `event.placeId`, `place.parentId`.
  - Protected fingerprints должны считать touched rows для `ValuesDates`, `ValuesLinks` и `Places.parent_id`, чтобы изменение поддержанных полей не выглядело как повреждение защищённой части базы.

  Files:
  - `lib/atdb/rebuildValidation.ts`
  - `lib/atdb/writers/lifeEventWriter.ts`
  - `lib/atdb/writers/eventsWriter.ts`
  - `lib/atdb/writers/placesWriter.ts`
  - `lib/atdb/writers/valueWriter.ts` или новый специализированный date writer
  - `lib/sqlProcessor.ts`
  - `scripts/check-atdb-write-safety.mjs`
  - `scripts/check-atdb-rebuild-contract.mjs`

  LOGGING REQUIREMENTS:
  - Writers логируют DEBUG summary counts per writer: requested/applied/skipped.
  - Preflight issues логировать кодом причины, entityType и field; без даты, названий мест, raw rows.
  - Циклы parent hierarchy логировать WARN с depth/count, не с path names.

- [x] Task 6: Обновить compatibility diff и parser/build round-trip contract.

  Deliverable:
  - `lib/atdb/rebuildDiff.ts` должен считать новые supported fields поддержанными, а не unsupported drift.
  - Для date metadata сравнивать user-visible editable value отдельно от raw metadata, чтобы неизменённые неточные даты не создавали ложный diff.
  - `buildAtdb(parsedData, originalBuffer)` должен корректно формировать `AtdbChangeSet` для новых полей при изменении `ParsedAtdb`.
  - `smoke:atdb:matrix` и `schema:atdb:fixtures:check` должны оставаться zero-drift для неизменённых fixtures.

  Files:
  - `lib/atdb/rebuildDiff.ts`
  - `scripts/smoke-atdb.mjs` при необходимости новых aggregate counters
  - `scripts/atdb-roundtrip-invariants.mjs`
  - `scripts/check-atdb-rebuild-contract.mjs`

  LOGGING REQUIREMENTS:
  - Diff diagnostics логируют только reasonCode/entity/field.
  - Smoke output остаётся агрегированным: counts, deltas, labels.
  - Не выводить values или place paths в regression output.

<!-- Commit checkpoint: tasks 4-6 -->

### Phase 3: Обновить UI таблиц и query layer
- [x] Task 7: Обновить редакторы ячеек и селекты мест.

  Deliverable:
  - В `components/EditableCell.tsx` добавить `EditableDateCell` поверх текущего формата `YYYY-MM-DD`, `YYYY-MM-00`, `YYYY-00-00`.
  - Date editor должен держать invalid partial input в локальном raw state, выставлять `aria-invalid` и обновлять draft только валидным `YYYY-MM-DD` / `YYYY-MM-00` / `YYYY-00-00` / `null` по выбранной commit-policy (`onChange` для валидного значения или `onBlur`); invalid partial input не должен попадать в draft/export и не должен сбрасываться при наборе.
  - В `components/atdb-table/useAtdbTableEditors.tsx` заменить labels пола на `М`, `Ж`, `Неизвестно`, сохранив значения `M`, `F`, `Unknown`.
  - Обобщить place link editor, чтобы он работал для `person.birthPlaceId`, `person.deathPlaceId`, `event.placeId`, `place.parentId`.
  - Селект места должен показывать draft-aware полный label с датой именования и родительским путём.
  - Для `Place.parentId` селект должен исключать текущую запись и её descendants; опция очистки разрешена для корневых мест.
  - Для life-event place/date fields редактор должен быть активен при наличии `birthEventId` / `deathEventId`, даже если исходной value row ещё нет.

  Files:
  - `components/EditableCell.tsx`
  - `components/atdb-table/useAtdbTableEditors.tsx`
  - `lib/atdbPlaceLabels.ts`
  - `lib/atdbIntegerInput.ts` при необходимости общего select parsing

  LOGGING REQUIREMENTS:
  - UI editors не логируют пользовательский ввод.
  - При невозможности редактирования показывать UI fallback/status без console output.
  - Любые dev diagnostics держать за feature-neutral DEBUG code без raw values.

- [x] Task 8: Обновить entity-specific таблицы, table query и page orchestration.

  Deliverable:
  - Dependencies: Task 7 должен быть завершён, потому что таблицы должны использовать финальные date/place editor APIs, а не table-local controls.
  - `components/atdb-table/PersonTable.tsx` добавить колонку `Фамилия при рождении`; `Дата рождения`, `Дата смерти`, `Место рождения`, `Место смерти` рендерить через inline editors.
  - `components/atdb-table/EventTable.tsx` сделать колонку `Место` редактируемой через селект; убрать или изменить status "События доступны только для просмотра" на точную формулировку про редактируемую привязку места.
  - `components/atdb-table/PlaceTable.tsx` добавить `Дата именования`, `Родительское место` и `Путь родительских мест`; `Родительское место` редактировать через селект.
  - `components/DataTable.tsx` передавать editors в `EventTable`, но не включать selection для events.
  - `components/ScrollableDataTable.tsx` и `app/page.tsx` должны использовать отдельную selectable/bulk entity model, чтобы event inline edits не ломали selection counts.
  - `lib/atdbTableView.ts` добавить новые columns и draft-aware cell values для поиска, фильтрации и сортировки по новым полям.
  - Обновить source-level assertions в `scripts/check-atdb-table-components.mjs`: заменить контракт "EventTable read-only without editable controls" на inline-only `event.placeId` editor без `SelectionHeaderCell`/`SelectionCell`, и зафиксировать новый status text вместо "События доступны только для просмотра".
  - Обновить `scripts/check-atdb-table-view.mjs` и `scripts/check-atdb-table-components.mjs` под новые колонки, русские labels пола, event place editor и отсутствие event selection.

  Files:
  - `app/page.tsx`
  - `components/DataTable.tsx`
  - `components/ScrollableDataTable.tsx`
  - `components/atdb-table/PersonTable.tsx`
  - `components/atdb-table/EventTable.tsx`
  - `components/atdb-table/PlaceTable.tsx`
  - `lib/atdbTableView.ts`
  - `scripts/check-atdb-table-view.mjs`
  - `scripts/check-atdb-table-components.mjs`

  LOGGING REQUIREMENTS:
  - UI orchestration не логирует значения ячеек.
  - Regression scripts используют synthetic labels only.
  - Table query helper остаётся pure и без runtime logs.

<!-- Commit checkpoint: tasks 7-8 -->

### Phase 4: Документация и проверка
- [x] Task 9: Обновить публичную и AI Factory документацию под новый контракт.

  Deliverable:
  - `docs/atdb_format.md` описывает новые write-safe поля: `birthLastName`, life-event dates, `event.placeId`, `place.parentId`; `placeNamingDate` описана как read-only отображение.
  - `docs/architecture.md`, `docs/codebase-analysis.md`, `docs/refactoring-plan.md`, `README.md` и `AGENTS.md` синхронизированы с новыми таблицами/файлами/проверками, без локальных fixture names и без Yaman-specific деталей в публичных docs.
  - `.ai-factory/ARCHITECTURE.md` при необходимости уточняет split между inline writable fields и bulk-edit allowlist.
  - Документация объясняет, что UI сохраняет текущий формат ввода дат, но parser учитывает metadata неточных дат.

  Files:
  - `README.md`
  - `docs/atdb_format.md`
  - `docs/architecture.md`
  - `docs/codebase-analysis.md`
  - `docs/refactoring-plan.md`
  - `AGENTS.md`
  - `.ai-factory/ARCHITECTURE.md`

  LOGGING REQUIREMENTS:
  - Docs не должны содержать raw `ValuesStr`, имена, места, заметки, GUID, source text или локальные paths.
  - Примеры держать synthetic или structural.
  - Не включать private fixture-specific выводы в публичные docs.

- [x] Task 10: Выполнить полный релевантный verification gate.

  Deliverable:
  - Запустить:
    - `npm run lint`
    - `npx tsc --noEmit --pretty false`
    - `npm run build`
    - `npm run mapping:atdb:check`
    - `npm run test:atdb:dates`
    - `npm run test:atdb:parser-contract`
    - `npm run test:atdb:edit-draft`
    - `npm run test:atdb:batch-edit`
    - `npm run test:atdb:table-view`
    - `npm run test:atdb:table-components`
    - `npm run test:atdb:write-safety`
    - `npm run test:atdb:rebuild-contract`
    - `npm run smoke:atdb:matrix`
    - `npm run schema:atdb:fixtures:check`
    - `git diff --check`
  - Если `schema:atdb:fixtures:check` падает после пачки команд, перепроверить standalone before diagnosing code failure.
  - Провести browser smoke при доступном dev server: загрузка `.atdb`, проверка новых колонок, редактирование даты рождения, места события и `Place.parentId`, экспорт без console errors.

  Files:
  - Только исправления в файлах из задач 1-9, если gate выявит дефект.

  LOGGING REQUIREMENTS:
  - Verification output фиксировать по статусам команд и safe counts.
  - Не публиковать fixture paths, raw row values, имена мест или персональные строки.
  - При browser smoke сообщать только сценарии и результат, без содержимого базы.

<!-- Commit checkpoint: tasks 9-10 -->
