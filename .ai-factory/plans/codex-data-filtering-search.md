# Implementation Plan: Фильтрация и поиск по данным

Branch: codex/data-filtering-search
Created: 2026-06-23

## Settings
- Testing: yes
- Logging: standard
- Docs: yes

## Roadmap Linkage
Milestone: "Фильтрация и поиск по данным"
Rationale: План реализует следующий незавершённый roadmap milestone после массового редактирования: быстрый поиск, постоянные фильтры и навигацию по большим наборам данных без расширения SQL/.atdb write paths.

## Research Context
Source: текущий `$aif-explore ROADMAP "Фильтрация и поиск по данным"`, `.ai-factory/ROADMAP.md`, `.ai-factory/ARCHITECTURE.md`, `.ai-factory/plans/codex-bulk-field-editing.md`, `.ai-factory/RESEARCH.md` (Active Summary: релевантны только safety/architecture constraints), текущий код.

Goal:
- Добавить быстрый поиск и постоянные фильтры по текущей вкладке для персон, родов, событий и мест.
- Сделать фильтрацию draft-aware: локальные правки в таблице должны сразу попадать в поиск, фильтры и сортировку.
- Связать видимую выборку с selection/bulk edit так, чтобы "выбрать все видимые строки" работало после фильтров.

Constraints:
- SQL-логика остается в `lib/`; UI не должен напрямую работать со схемой SQLite или `lib/atdb/*`.
- `.atdb` файлы и персональные данные остаются локально в браузере; runtime logs, tests и документация не должны выводить имена, места, заметки, GUID, `ValuesStr` или содержимое пользовательских записей.
- `Families` в UI и документации трактуются как "Роды", а не как нуклеарные семьи.
- События остаются read-only; фильтрация не должна расширять strict rebuild contract и не должна менять `AtdbChangeSet`.
- Этот milestone не должен превращаться в полный рефакторинг таблиц или виртуализацию: "Упрощение табличного интерфейса" и "Производительность больших баз" остаются отдельными roadmap milestones.

Decisions:
- Не переиспользовать `lib/atdbBatchEdit.ts` как table filter engine напрямую: его predicate scope ограничен write-safe сущностями и полями.
- Ввести отдельный чистый table-view/query слой поверх `ParsedAtdb + AtdbEditDraftState`, который возвращает отфильтрованные и отсортированные строки, visible IDs и counts.
- UI controls хранить как controlled state рядом с `activeEntity`/selection в `app/page.tsx` или в owner-компоненте, а `DataTable` постепенно переводить на precomputed visible rows.
- Первый релиз поддерживает один быстрый текстовый поиск и один field-level фильтр на текущей вкладке; сложный конструктор нескольких условий отложен.

Open questions:
- Нужен ли после этого отдельный plan на декомпозицию `DataTable` до entity-specific компонентов перед виртуализацией.
- Должен ли field-level фильтр поддерживать специализированные controls для всех типов сразу или стартовать с универсальных operators `contains`, `equals`, `empty`, `not-empty` плюс select для простых enum-полей.

Success signals:
- Пользователь может быстро найти строки на текущей вкладке, увидеть `visible/total` counts, очистить поиск/фильтр и сохранить текущую сортировку.
- Поиск и фильтры учитывают локальные draft-правки в write-safe полях.
- Select-all выбирает только текущие видимые строки после фильтрации; уже выбранные скрытые строки не теряются без явного сброса.
- Fixture-free regression test покрывает query/filter/sort semantics без чтения `.atdb`.
- `npm run lint`, `npx tsc --noEmit`, `npm run build`, новый table-view test, `npm run test:atdb:batch-edit`, `npm run test:atdb:edit-draft`, `npm run smoke:atdb:matrix` и `npm run schema:atdb:fixtures:check` проходят или корректно skip'ают отсутствующие local-only fixtures.

## Commit Plan
- **Commit 1** (after tasks 1-3): `feat(ui): add draft-aware table query helpers`
- **Commit 2** (after tasks 4-7): `feat(ui): add table search and filters`
- **Commit 3** (after tasks 8-10): `docs(ui): document table filtering workflow`

## Tasks

### Phase 1: Table Query Contract And Regression Coverage
- [x] Task 1: Ввести чистый table-view/query contract для сущностей `.atdb`.

  Deliverable:
  - Создать `lib/atdbTableView.ts` или близкий модуль с типами:
    - `AtdbTableEntity = 'persons' | 'families' | 'events' | 'places'`;
    - `AtdbTableColumn`, `AtdbTableSortConfig`, `AtdbTableFilter`, `AtdbTableQuery`, `AtdbTableQueryResult`;
    - операторы фильтра `contains`, `equals`, `empty`, `not-empty`.
  - Добавить общий helper `AtdbTableEntity -> AtdbWritableEntity | null`, чтобы `app/page.tsx`, `ScrollableDataTable` и `DataTable` не дублировали локальные `writableEntityFromActive`.
  - Описать metadata колонок для персон, родов, событий и мест на основе `lib/types.ts`, включая labels для UI и searchable/sortable/filterable flags.
  - Явно описать virtual/display колонки, которые не совпадают с write-safe field names:
    - `birthPlace`/`deathPlace` как display-представление draft-aware `birthPlaceId`/`deathPlaceId` через каталог мест;
    - event `personId` как первый элемент `personIds`;
    - event `eventType` как display label через текущую `getEventTypeName`-семантику;
    - place/family/person labels только из уже разобранного `ParsedAtdb`, без доступа к SQLite.
  - Для write-safe полей использовать draft-aware value через существующие helpers `getDraftValue`/`isFieldDirty`, не мутируя `ParsedAtdb`.
  - Для событий поддержать только read-only values: ID, участники, тип события, дата, место, описание.
  - Не импортировать `lib/atdb/*`, не выполнять SQL, не читать `.atdb`.

  Files:
  - `lib/atdbTableView.ts` (new)
  - `lib/types.ts` только если понадобится экспортировать уже существующий общий тип без изменения доменной модели

  Dependencies:
  - Нет.

  LOGGING REQUIREMENTS:
  - Pure helper не должен логировать вообще.
  - Ошибочные query-входы нормализовать в безопасное пустое/neutral состояние без console output.
  - Не включать raw values, имена, места, заметки, GUID или пути к файлам в ошибки, tests или docs.

- [x] Task 2: Реализовать draft-aware поиск, фильтрацию и сортировку в table-view слое.

  Deliverable:
  - Реализовать функцию вроде `queryAtdbTableRows(data, draft, query)`:
    - выбирает строки текущей сущности;
    - применяет быстрый текстовый поиск по searchable колонкам;
    - применяет один field-level фильтр с operators `contains`, `equals`, `empty`, `not-empty`;
    - применяет сортировку с текущей семантикой `localeCompare(..., { numeric: true })`;
    - возвращает visible rows, `visibleIds`, `totalCount`, `visibleCount`, `activeFilterCount`.
  - Для invalid/unknown filter field возвращать neutral no-op только для фильтра: valid quick search всё равно применяется, `activeFilterCount = 0`, данные не мутируются, diagnostic/status не содержит пользовательских значений.
  - Для invalid/unknown sort field сохранять порядок уже найденной/отфильтрованной выборки, а не сбрасывать весь query.
  - Перенести текущую сортировочную семантику из `components/DataTable.tsx` в helper без изменения поведения:
    - для персон учитывать draft values фамилии/имени/отчества/пола/place links;
    - для родов учитывать draft values названия, фамилий, комментария и цвета;
    - для мест учитывать draft values названия, краткого названия и комментария;
    - для событий сохранить особую сортировку `personId` по первому `personIds`.
  - Нормализовать текст сравнения безопасно: `null`/`undefined` как пусто, массивы как joined text, регистр по умолчанию не учитывать.
  - Draft-aware labels для `birthPlace`/`deathPlace` должны обновляться не только при смене `birthPlaceId`/`deathPlaceId`, но и при локальной правке `Place.name`/`Place.shortName` у выбранного места.
  - Добавить helpers для получения labels и filterable columns, чтобы UI не дублировал metadata.

  Files:
  - `lib/atdbTableView.ts`
  - `components/DataTable.tsx` только для подготовки к следующему task, если нужен временный импорт типов

  Dependencies:
  - Depends on Task 1.

  LOGGING REQUIREMENTS:
  - Helper не должен писать в console.
  - Не выбрасывать ошибки с пользовательскими значениями; если валидация нужна, возвращать safe status/code.
  - Не добавлять debug logs ради сравнения строк или сортировки.

- [x] Task 3: Добавить fixture-free regression test для table-view/query semantics.

  Deliverable:
  - Создать `scripts/check-atdb-table-view.mjs` по существующему паттерну temp compile из `scripts/check-atdb-batch-edit.mjs`.
  - Добавить npm-скрипт `test:atdb:table-view` в `package.json`.
  - Покрыть synthetic scenarios без чтения `.atdb`:
    - поиск по персонам, родам, событиям и местам;
    - поиск по нескольким searchable колонкам одной вкладки;
    - field-level filters `contains`, `equals`, `empty`, `not-empty`;
    - draft-aware поиск и сортировка после `setDraftField`;
    - stable sorting с numeric compare для ID/чисел;
    - фильтр по событиям не требует write-safe entity;
    - empty query сохраняет исходный порядок строк;
    - invalid/unknown sort field сохраняет порядок результата после valid search/filter;
    - invalid/unknown filter field не ломает valid quick search и не активирует field filter;
    - virtual/display колонки `birthPlace`, `deathPlace`, event `personId` и event `eventType` участвуют в search/filter/sort по ожидаемой display-семантике;
    - draft-aware place labels обновляются после изменения `birthPlaceId`/`deathPlaceId`;
    - draft-aware place labels обновляются после изменения `Place.name`/`Place.shortName` у места, на которое уже ссылается персона;
    - `visibleIds` соответствуют отфильтрованному и отсортированному порядку;
    - invalid/unknown filter field не мутирует данные и даёт safe neutral filter result;
    - исходный synthetic `ParsedAtdb` остается deep-equal после выполнения query helper.
  - Тестовый вывод оставить на уровне synthetic labels/statuses/counts.

  Files:
  - `scripts/check-atdb-table-view.mjs` (new)
  - `package.json`
  - `lib/atdbTableView.ts`

  Dependencies:
  - Depends on Tasks 1-2.

  LOGGING REQUIREMENTS:
  - Regression output только synthetic labels/statuses/counts.
  - Failure output не должен дампить весь row/query/result, если там есть пользовательские значения.
  - Не печатать temp absolute paths, реальные имена, места, заметки, GUID, filenames или `.atdb` contents.

<!-- Commit checkpoint: tasks 1-3 -->

### Phase 2: Search/Filter UI And Selection Integration
- [x] Task 4: Поднять controlled table query state рядом с активной вкладкой и selection.

  Deliverable:
  - Добавить в `app/page.tsx` state для table query по каждой вкладке:
    - quick search text;
    - выбранный field-level фильтр;
    - sort config.
  - Counts/result summary не хранить отдельным mutable state: выводить `visibleCount`, `totalCount`, `activeFilterCount` и `visibleIds` из `queryAtdbTableRows(...)` через `useMemo`, чтобы избежать stale counters.
  - Сбрасывать query state при загрузке нового файла вместе с `parsedData`, `editDraft`, `selectedRows` и `bulkPreview`.
  - При смене вкладки сохранять query state соответствующей вкладки, как сейчас сохраняется selection по entity.
  - Рассчитывать query result через `useMemo` поверх `parsedData`, `editDraft` и query state.
  - Использовать общий `AtdbTableEntity` и helper `AtdbTableEntity -> AtdbWritableEntity | null` из table-view слоя вместо локальных копий `ActiveEntity`/`writableEntityFromActive`.
  - Передавать в `ScrollableDataTable`/`DataTable` precomputed visible rows, `visibleIds`, counts, sort config и callbacks.

  Files:
  - `app/page.tsx`
  - `components/ScrollableDataTable.tsx`
  - `components/DataTable.tsx`
  - `lib/atdbTableView.ts`

  Dependencies:
  - Depends on Tasks 1-2.

  LOGGING REQUIREMENTS:
  - Не логировать search text, filter values, selected IDs или row values.
  - При неожиданных runtime errors показывать safe UI message без record dump.
  - Не добавлять console logs для обычных query state transitions.

- [x] Task 5: Перевести `DataTable` на отрисовку видимых строк и controlled sort.

  Deliverable:
  - Убрать локальные `personSortConfig`, `familySortConfig`, `eventSortConfig`, `placeSortConfig` из `DataTable` или оставить только compatibility wrapper на время миграции, но canonical sort state должен жить выше.
  - `DataTable` должен получать уже отфильтрованные/отсортированные массивы для active entity и использовать их в render-функциях.
  - Header click должен вызывать `onSortChange`, а не сортировать локальный полный массив.
  - Сортировку заголовков реализовать доступно: `button type="button"` внутри header cell, корректный `aria-sort`/`aria-label` для направления сортировки, без зависимости только от mouse click по `th`.
  - Empty state должен различать:
    - "нет данных" для пустой сущности;
    - "нет строк по текущему поиску/фильтру" для filtered-out результата.
  - `renderSelectionHeader` должен получать `visibleIds`, чтобы checkbox "выбрать все" работал только по текущей видимой выборке.
  - Удалить legacy пути `renderOnlyHeader`/`renderOnlyContent` либо перевести их на тот же precomputed visible-row contract; header/body не должны расходиться после фильтрации или сортировки.
  - Существующие editable cells, dirty state, reset controls и read-only events view сохранить без изменения write behavior.

  Files:
  - `components/DataTable.tsx`
  - `components/ScrollableDataTable.tsx`
  - `app/page.tsx`

  Dependencies:
  - Depends on Task 4.

  LOGGING REQUIREMENTS:
  - DataTable не должен логировать render/query/selection state.
  - Не добавлять debug logs при header clicks или empty states.
  - UI text может показывать значения в браузере пользователя, но console/tests/docs не должны их дублировать.

- [x] Task 6: Добавить toolbar поиска и field-level фильтра для текущей вкладки.

  Deliverable:
  - В `ScrollableDataTable` или новом компоненте `TableQueryToolbar` добавить:
    - быстрый поиск с иконкой `Search` из `lucide-react`;
    - счетчик `Показано X из Y`;
    - selector поля фильтра по metadata текущей вкладки;
    - selector operator `contains`, `equals`, `empty`, `not-empty`;
    - input значения для `contains`/`equals`;
    - кнопки очистки поиска и очистки всех фильтров.
  - Для `gender`, `eventType` или других простых option-like полей можно использовать select, если metadata уже позволяет сделать это без усложнения; иначе оставить текстовый input в первом релизе.
  - Если добавляются numeric/select controls для `id`, `color`, place links или enum-like полей, использовать строгую full-string валидацию ввода, без `parseInt`-style prefix parsing; значения вроде `12abc`, `1e2`, `12.9` и пустой required input должны давать neutral/inline validation, а не неявное число.
  - Toolbar должен быть компактным, не вложенным в карточку, не перекрывать sticky export controls и table header.
  - Фильтр применить только к текущей вкладке; глобальный поиск по всем вкладкам не входит в этот план.

  Files:
  - `components/ScrollableDataTable.tsx`
  - `components/TableQueryToolbar.tsx` (new, if cleaner than inline controls)
  - `app/page.tsx`
  - `lib/atdbTableView.ts`

  Dependencies:
  - Depends on Tasks 4-5.

  LOGGING REQUIREMENTS:
  - Не логировать search/filter input values.
  - Validation показывать inline в UI без console output.
  - Не выводить raw rows, имена, места, заметки, GUID или filename.

- [x] Task 7: Согласовать selection и bulk edit с отфильтрованной выборкой.

  Deliverable:
  - `onRenderedRowsSelectionChange` должен получать только `visibleIds` после query/sort.
  - Уже выбранные строки, скрытые текущим фильтром, остаются выбранными до явного "Сбросить выбор".
  - UI toolbar/status должен явно различать общий selected count и visible selected count для активной вкладки, чтобы bulk scope был понятен при скрытых фильтром выбранных строках.
  - Bulk dialog `selectedIds` должен получать canonical selection active entity, а не только видимые строки.
  - При изменении query state сбрасывать stale `bulkPreview`, как сейчас preview сбрасывается при смене selection/draft, но не очищать скрытые selected rows.
  - Убедиться, что "все строки вкладки" в bulk dialog остается всеми строками сущности, а не текущим table filter scope; если нужен scope "видимые строки", оставить это как явный future enhancement, не смешивать семантику.

  Files:
  - `app/page.tsx`
  - `components/ScrollableDataTable.tsx`
  - `components/DataTable.tsx`
  - `components/BulkEditDialog.tsx` только если нужен wording around selected/visible counts

  Dependencies:
  - Depends on Tasks 4-6.

  LOGGING REQUIREMENTS:
  - Selection/filter interactions не логировать.
  - Не писать selected IDs, filter values или preview rows в console.
  - Ошибки взаимодействия показывать как safe UI status без пользовательских значений.

<!-- Commit checkpoint: tasks 4-7 -->

### Phase 3: UX Hardening, Documentation, And Verification
- [x] Task 8: Довести UX поиска/фильтрации до рабочего состояния на desktop/mobile.

  Deliverable:
  - Проверить, что toolbar, sticky status/export controls, tab bar, table header, checkbox column и sticky ID column не перекрывают друг друга.
  - Добавить доступные labels/aria-labels для поиска, фильтра, очистки и sort buttons.
  - Проверить keyboard flow сортировки: фокус должен попадать на кнопки сортировки в заголовках, направление сортировки должно быть понятно screen reader через `aria-sort`/`aria-label`.
  - Сохранить горизонтальный scroll таблицы и не создавать layout shift при вводе текста или изменении counts.
  - При активном фильтре показывать явное empty state и кнопку очистки, но не добавлять обучающий текст о функциях приложения сверх нужного UI.
  - Не менять цветовую систему в сторону однотонной палитры; держаться текущего restrained table UI.

  Files:
  - `components/ScrollableDataTable.tsx`
  - `components/TableQueryToolbar.tsx` если создан
  - `components/DataTable.tsx`
  - `app/page.tsx`
  - `app/globals.css` только если без этого невозможно исправить layout

  Dependencies:
  - Depends on Tasks 5-7.

  LOGGING REQUIREMENTS:
  - Не добавлять debug logs ради layout tuning.
  - Runtime UI не должен логировать пользовательский ввод.
  - При невозможном состоянии показывать safe generic UI status без row dump.

- [x] Task 9: Обновить документацию по пользовательскому flow и архитектуре.

  Deliverable:
  - Обновить `README.md`: кратко добавить поиск/фильтрацию текущей вкладки и связь с selection.
  - Обновить `docs/getting-started.md`:
    - описать quick search, field-level filter и очистку фильтров;
    - объяснить, что "выбрать все" работает по видимым строкам;
    - оставить ограничение: глобальный поиск по всем вкладкам и виртуализация вне текущего этапа.
  - Обновить `docs/architecture.md`: добавить поток `ParsedAtdb + editDraft -> atdbTableView -> table UI -> selection/bulk edit`.
  - Если milestone закрывается после implementation/verify, обновление `.ai-factory/ROADMAP.md` выполнять только через owner workflow или отдельный docs/roadmap шаг, не смешивая с текущим plan artifact.

  Files:
  - `README.md`
  - `docs/getting-started.md`
  - `docs/architecture.md`
  - `.ai-factory/ROADMAP.md` только если последующий owner workflow явно закрывает milestone

  Dependencies:
  - Depends on Tasks 6-8.

  LOGGING REQUIREMENTS:
  - Документация не должна содержать реальные значения из `.atdb`, имена, места, заметки, GUID, document paths, source text или raw `ValuesStr`.
  - Примеры держать synthetic и на уровне field names/counts/statuses.
  - Не добавлять скриншоты или дампы пользовательской базы.

- [x] Task 10: Выполнить финальный gate для фильтрации и поиска.

  Deliverable:
  - Запустить `npm run lint`.
  - Запустить `npx tsc --noEmit`.
  - Запустить `npm run build`.
  - Запустить `npm run test:atdb:table-view`.
  - Запустить `npm run test:atdb:batch-edit`.
  - Запустить `npm run test:atdb:edit-draft`.
  - Запустить `npm run test:atdb:write-safety`.
  - Запустить `npm run test:atdb:rebuild-contract`.
  - Запустить `npm run smoke:atdb:matrix`.
  - Запустить `npm run schema:atdb:fixtures:check`.
  - Manual UI smoke:
    - загрузить разрешенную fixture;
    - проверить поиск и фильтр на вкладках персон, родов, событий и мест;
    - изменить editable поле и убедиться, что draft-aware поиск/сортировка обновились;
    - выбрать все видимые строки после фильтра и открыть bulk dialog;
    - очистить фильтр и убедиться, что скрытые selected rows не потерялись;
    - скачать `.atdb` после draft-изменения и убедиться, что export flow не изменён.
  - Manual responsive smoke: проверить desktop и mobile viewport, что toolbar, tabs, sticky columns и horizontal scroll не перекрываются.
  - Если local-only fixtures отсутствуют, явно зафиксировать skip behavior и не считать это ошибкой.

  Files:
  - Исправления только в файлах из Tasks 1-9, если проверки выявят проблему.

  Dependencies:
  - Depends on Tasks 1-9.

  LOGGING REQUIREMENTS:
  - Итог проверок фиксировать как команды/statuses, fixture labels, counts и deltas.
  - Не добавлять debug logs в runtime UI ради прохождения проверки.
  - Не печатать raw `.atdb` contents, `ValuesStr.vstr`, GUID, document/source text, имена, места, заметки или локальные private fixture paths.

<!-- Commit checkpoint: tasks 8-10 -->
