---
archived: 2026-06-24
---

# Implementation Plan: Упрощение табличного интерфейса

Branch: codex/simplify-table-interface
Created: 2026-06-23

## Settings
- Testing: yes
- Logging: standard
- Docs: yes

## Roadmap Linkage
Milestone: "Упрощение табличного интерфейса"
Rationale: План закрывает roadmap item через декомпозицию общего `DataTable`, вынос общей механики таблиц и сохранение текущего поведения поиска, сортировки, выбора строк и редактирования.

## Research Context
Source: текущий `$aif-explore ROADMAP "Упрощение табличного интерфейса"` и code reconnaissance; `.ai-factory/RESEARCH.md` сейчас содержит нерелевантный ATDB-schema summary и не используется как requirements source.

Goal:
- Разделить перегруженный `components/DataTable.tsx` на небольшой routing-wrapper и специализированные таблицы для персон, родов, событий и мест.
- Убрать дублирование table chrome: sortable headers, selection cells, empty state, sticky ID column и базовые cell class names.
- Сильнее опереться на `lib/atdbTableView.ts` как источник metadata колонок, сортировки, фильтрации и visible IDs.

Constraints:
- Не расширять write-safe scope: события остаются read-only, writable сущности остаются `person`, `family`, `place`.
- Не менять semantics `AtdbEditDraftState`, `AtdbChangeSet`, batch edit preview/apply и `queryAtdbTableRows`.
- UI-компоненты не должны выполнять SQL и не должны импортировать `lib/atdb/readers/*`, `lib/atdb/writers/*` или rebuild internals.
- Не добавлять runtime debug logs с пользовательскими ATDB-значениями, именами, местами, заметками, GUID или raw `Values*`.
- Не включать виртуализацию таблиц в этот milestone; это отдельный roadmap item "Производительность больших баз".

Decisions:
- Оставить `components/DataTable.tsx` как совместимый публичный wrapper/router на время refactor.
- Новые специализированные таблицы разместить в отдельной подпапке `components/atdb-table/`, чтобы не раздувать корень `components/`.
- Generic metadata-driven renderer использовать только для общей механики заголовков и chrome; entity-specific cells оставить явными там, где есть editable controls и place-link behavior.
- Сортировка остается controlled state из `app/page.tsx` через `ScrollableDataTable` и `atdbTableView`; таблицы только вызывают `onSortChange`.
- Для `rows`/`tableQueryResult` ввести явный typed render contract, чтобы `ScrollableDataTable` не собирал четыре локальных массива через casts после split.
- Строгий parsing целых чисел должен быть единым для batch edit и table editors; refactor не должен переносить `Number.parseInt` в новые editor helpers.

Open questions:
- Нужно ли после декомпозиции отдельным планом скрывать/переставлять колонки для лучшей читаемости, или текущий milestone ограничить только безопасным refactor без UX-перестановок.

Success signals:
- `DataTable.tsx` больше не содержит четыре больших render-функции и большую часть общей table mechanics.
- `PersonTable`, `FamilyTable`, `EventTable`, `PlaceTable` имеют понятные props и используют общий table chrome.
- Текущие user-visible behaviors сохранены: sort headers, `aria-sort`, empty states, select all visible rows, draft dirty state, reset controls, read-only events.
- Table number/place-link editors и batch edit используют один strict integer parser; partial/exponential/decimal input не превращается в другое число.
- `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run test:atdb:table-view`, `npm run test:atdb:edit-draft`, `npm run test:atdb:batch-edit`, `npm run test:atdb:table-components` и `git diff --check` проходят.

## Commit Plan
- **Commit 1** (after tasks 1-2): `refactor(ui): add shared atdb table primitives`
- **Commit 2** (after tasks 3-7): `refactor(ui): split atdb entity tables`
- **Commit 3** (after task 8): `docs(ui): document atdb table split`

## Tasks

### Phase 1: Зафиксировать общий table contract
- [x] Task 1: Создать shared primitives для таблиц ATDB.

  Deliverable:
  - Добавить `components/atdb-table/AtdbTablePrimitives.tsx` с общими компонентами и helper'ами:
    - `AtdbTableFrame` или близкий wrapper для общего `<table>` className.
    - `SortableHeaderCell` с текущей semantics `button type="button"`, `aria-sort`, `aria-label` и indicator.
    - `SelectionHeaderCell` и `SelectionCell` для select-all-visible и select-one.
    - `EmptyTableState` для различения "нет данных" и "нет строк по текущему поиску/фильтру".
    - constants/helpers для sticky ID classes и базовых cell classes.
    - typed `AtdbTableRenderContext` / близкий contract для `columns`, `visibleIds`, selection, sorting и query state без entity-specific casts в owner-компоненте.
  - Использовать существующие visual constraints: sticky header, sticky ID column, compact cells, без layout shift.
  - Не менять поведение сортировки или selection; только вынести повторяемую разметку.

  Files:
  - `components/atdb-table/AtdbTablePrimitives.tsx` (new)
  - `components/DataTable.tsx`
  - `lib/atdbTableView.ts` только если нужен узкий type export для typed render contract; не менять query/filter/sort behavior

  LOGGING REQUIREMENTS:
  - Не добавлять runtime logs в UI primitives.
  - При диагностике в проверках выводить только component/helper names и безопасные статусы.
  - Не логировать пользовательские значения строк, имена, места, заметки, GUID или raw ATDB payload.

- [x] Task 2: Вынести draft-aware редакторы ячеек из `DataTable`.

  Deliverable:
  - Добавить `components/atdb-table/useAtdbTableEditors.tsx` или близкий модуль с текущими helpers:
    - `createDraftKey`
    - text/number/gender editor renderers
    - person place-link editor
    - draft-aware place labels/options
    - fallback formatting for read-only values
  - Переиспользовать существующие `EditableTextCell`, `EditableNumberCell`, `EditableSelectCell` из `components/EditableCell.tsx`.
  - Вынести strict integer input parser из batch-specific API в переиспользуемый helper, например `lib/atdbIntegerInput.ts`, и переиспользовать его в:
    - `EditableNumberCell`;
    - person place-link editor;
    - `BulkEditDialog` / `parseAtdbBatchIntegerInput` compatibility path.
  - Оставить `parseAtdbBatchIntegerInput` как совместимый wrapper поверх shared helper, чтобы текущий batch edit public API не менялся.
  - Запретить `Number.parseInt` в table editor path: строки вида `12abc`, `1e2`, `12.9` и unsafe integers должны отклоняться так же, как в batch edit.
  - Расширить regression coverage для strict parser: один набор synthetic cases должен подтверждать shared helper, compatibility wrapper и отсутствие prefix-parsing regressions в table editor path.
  - Сохранить exact behavior:
    - read-only поля остаются обычным текстом, не disabled inputs;
    - `gender` clear продолжает идти как `null` с downstream normalization;
    - place-link editor доступен только когда исходный place ID числовой;
    - empty number/place-link input продолжает означать `null`, а invalid number input не должен записывать частично распарсенное значение в draft;
    - dirty state и reset action не меняют semantics.
  - Не переносить draft helpers в `lib/`, потому что это presentation rendering, а не domain contract.

  Files:
  - `components/atdb-table/useAtdbTableEditors.tsx` (new)
  - `components/DataTable.tsx`
  - `components/EditableCell.tsx` только если нужен узкий prop/type export без изменения поведения
  - `lib/atdbIntegerInput.ts` или близкий shared helper (new)
  - `lib/atdbBatchEdit.ts` для compatibility re-export/wrapper strict integer parser без изменения batch operation semantics
  - `components/BulkEditDialog.tsx` только если меняется import path parser helper
  - `scripts/check-atdb-batch-edit.mjs` для shared parser regression coverage

  LOGGING REQUIREMENTS:
  - Не добавлять logs при вводе пользователя или изменении draft.
  - Existing safe `console.error` paths в `app/page.tsx` не трогать.
  - Если нужен временный debug во время разработки, удалить его до завершения task.

<!-- Commit checkpoint: tasks 1-2 -->

### Phase 2: Разделить entity-specific таблицы
- [x] Task 3: Извлечь таблицы персон и родов.

  Deliverable:
  - Добавить `components/atdb-table/PersonTable.tsx` и `components/atdb-table/FamilyTable.tsx`.
  - Перенести текущую разметку строк из `renderPersonsTable` и `renderFamiliesTable` без изменения колонок, подписей и editable controls.
  - Заголовки строить через metadata из `AtdbTableQueryResult.columns` / `getAtdbTableColumns`, чтобы не дублировать labels сортируемых колонок вручную.
  - Использовать shared primitives из Task 1 и editor helpers из Task 2.
  - Сохранить checkbox column только для writable entities, `visibleIds` для select-all-visible и sticky ID offset при selection.
  - Props специализированных таблиц должны получать typed rows (`Person[]`, `Family[]`) и общий render context; не переносить `as ParsedAtdb[...]` casts внутрь каждой таблицы.

  Files:
  - `components/atdb-table/PersonTable.tsx` (new)
  - `components/atdb-table/FamilyTable.tsx` (new)
  - `components/DataTable.tsx`
  - `lib/atdbTableView.ts` только если нужен безопасный read-only export для column lookup; не менять query semantics

  LOGGING REQUIREMENTS:
  - Не добавлять logs при render, hover, selection или sort click.
  - Проверочные сообщения должны содержать только synthetic labels/statuses, если расширяются scripts.
  - Не выводить реальные значения ячеек из пользовательских `.atdb`.

- [x] Task 4: Извлечь таблицы событий и мест.

  Deliverable:
  - Добавить `components/atdb-table/EventTable.tsx` и `components/atdb-table/PlaceTable.tsx`.
  - `EventTable` остается read-only: без selection column, без editable cells, с текущим отображением `personIds`, `getEventTypeName`, даты, места и описания.
  - `PlaceTable` сохраняет writable text fields `name`, `shortName`, `comment`, dirty state и reset controls.
  - Сохранить текущие empty states для `events` и `places`.
  - Использовать общий sortable header contract и metadata labels.
  - Props специализированных таблиц должны получать typed rows (`Event[]`, `Place[]`) и общий render context; `EventTable` не должен зависеть от writable selection/editor helpers.

  Files:
  - `components/atdb-table/EventTable.tsx` (new)
  - `components/atdb-table/PlaceTable.tsx` (new)
  - `components/DataTable.tsx`
  - `components/atdb-table/AtdbTablePrimitives.tsx`
  - `components/atdb-table/useAtdbTableEditors.tsx`

  LOGGING REQUIREMENTS:
  - Не логировать event descriptions, place names/comments или linked place labels.
  - Не добавлять logs для read-only events render path.
  - Ошибки TypeScript/ESLint устранять без добавления diagnostic output в production UI.

### Phase 3: Упростить owner-компоненты и документацию
- [x] Task 5: Сузить `DataTable` и `ScrollableDataTable` до orchestration role.

  Deliverable:
  - Оставить `DataTable` тонким router-wrapper, который выбирает специализированную таблицу по `activeEntity`.
  - Упростить props contract: передавать `tableQueryResult`/typed rows через общий contract вместо отдельных `visiblePersons`, `visibleFamilies`, `visibleEvents`, `visiblePlaces`.
  - Убрать из `ScrollableDataTable` локальные derived arrays для каждой сущности и оставить type narrowing в `DataTable` router или маленьком typed adapter.
  - Удалить неиспользуемый props chain `onDraftEntityReset` из `DataTable`/`ScrollableDataTable`/`app/page.tsx`, если refactor не добавляет явный row-level reset control.
  - Сохранить toolbar, tabs, selection summary, read-only notice for events и `maxHeight`/scroll behavior без визуального regressions.

  Files:
  - `components/DataTable.tsx`
  - `components/ScrollableDataTable.tsx`
  - `components/atdb-table/*`

  LOGGING REQUIREMENTS:
  - Не добавлять logs при переключении вкладок, пересчете visible rows или selection summary.
  - Ошибки TypeScript/ESLint устранять без добавления diagnostic output в production UI.

- [x] Task 6: Добавить component-level regression gate для table UI contract.

  Deliverable:
  - Добавить lightweight проверку `scripts/check-atdb-table-components.mjs` или близкий script без пользовательских fixtures:
    - использовать только synthetic rows/props и безопасные labels/statuses;
    - проверить, что headers строятся из metadata columns и сохраняют `aria-sort` / sort button contract;
    - проверить selection column только для writable entities (`person`, `family`, `place`) и отсутствие selection/editor controls у `events`;
    - проверить empty states для "нет данных" и "нет строк по текущему поиску/фильтру";
    - проверить наличие reset controls/dirty state для editable cells без вывода реальных cell values;
    - проверить, что table editor path не использует `Number.parseInt` и работает через shared strict integer parser.
  - Добавить npm-script `test:atdb:table-components`.
  - Gate должен оставаться fixture-free и не требовать browser/dev server.

  Files:
  - `scripts/check-atdb-table-components.mjs` (new)
  - `package.json`
  - `components/atdb-table/*`
  - `components/DataTable.tsx`
  - `components/EditableCell.tsx`
  - `lib/atdbIntegerInput.ts`

  LOGGING REQUIREMENTS:
  - Выводить только безопасные component/helper names, synthetic labels и статусы.
  - Не логировать пользовательские значения ячеек, имена, места, заметки, GUID или raw ATDB payload.
  - Не добавлять runtime logs ради прохождения gate.

- [x] Task 7: Выполнить focused verification для table UI refactor.

  Deliverable:
  - Запустить `npm run lint`.
  - Запустить `npx tsc --noEmit`.
  - Запустить `npm run build`.
  - Запустить `npm run test:atdb:table-view`.
  - Запустить `npm run test:atdb:edit-draft`.
  - Запустить `npm run test:atdb:batch-edit`, потому что strict integer parser становится shared dependency для batch edit и table editors.
  - Запустить `npm run test:atdb:table-components`, потому что React table split переносит поведение из одного `DataTable` в entity-specific components.
  - Запустить `git diff --check`.
  - Провести ручной browser smoke, если dev server доступен: загрузка fixture, переключение вкладок, сортировка, фильтр/поиск, select all visible после filter/sort, выбор отдельных строк, selected count, batch edit dialog для выбранных строк, изменение editable ячейки, reset field, invalid integer input в number editor, read-only events view, empty state с очисткой query.
  - Если browser/manual smoke не выполнен, явно зафиксировать это как непокрытый runtime риск при `$aif-verify`.

  Files:
  - Исправления только в файлах из Tasks 1-6, если проверки выявят regression.

  LOGGING REQUIREMENTS:
  - Командный вывод проверок должен оставаться safe: статусы, synthetic labels, counts, без пользовательских строк из `.atdb`.
  - Не добавлять debug logs в `app/`, `components/` или runtime `lib/` ради прохождения checks.
  - При падении проверки фиксировать конкретный файл/команду и безопасный error summary без дампа пользовательских данных.

- [x] Task 8: Синхронизировать документацию и roadmap после split.

  Deliverable:
  - Обновить `docs/architecture.md`, `docs/codebase-analysis.md`, `docs/refactoring-plan.md`, `.ai-factory/ROADMAP.md` и `AGENTS.md`, если новая подпапка `components/atdb-table/` становится устойчивой частью структуры проекта или milestone закрывается.
  - Убрать устаревшие утверждения о том, что `DataTable` всё ещё содержит несколько больших render-функций, если refactor это исправил.
  - Зафиксировать новый component-level gate в документации проверок, если добавлен `npm run test:atdb:table-components`.
  - Не описывать UX-перестановки колонок или виртуализацию как выполненные, если этот milestone сделал только безопасную декомпозицию.

  Files:
  - `docs/architecture.md`
  - `docs/codebase-analysis.md`
  - `docs/refactoring-plan.md`
  - `.ai-factory/ROADMAP.md`
  - `AGENTS.md`

  LOGGING REQUIREMENTS:
  - Документация не должна включать пользовательские raw values, GUID, места, заметки или локальные пути к private fixtures.
  - Если docs меняют workflow/проверки, описывать только команды и safe contract, без данных из `.atdb`.

<!-- Commit checkpoint: tasks 3-7 -->
<!-- Commit checkpoint: task 8 -->
