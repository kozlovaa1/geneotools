---
archived: 2026-06-24
---

# Implementation Plan: Массовое редактирование полей

Branch: codex/bulk-field-editing
Created: 2026-06-23

## Settings
- Testing: yes
- Logging: standard
- Docs: yes

## Roadmap Linkage
Milestone: "Массовое редактирование полей"
Rationale: План реализует следующий unchecked roadmap milestone после безопасного UI-редактирования и reliable rebuild.

## Research Context
Source: текущий `$aif-explore ROADMAP "Массовое редактирование полей"`, `.ai-factory/ROADMAP.md`, `.ai-factory/ARCHITECTURE.md`, `.ai-factory/plans/codex-ui-data-editing.md`, текущий код.

Goal:
- Добавить массовое заполнение выбранных write-safe полей и массовую замену строк по явной выборке/условию с предпросмотром перед применением в локальный draft.

Constraints:
- SQL-логика остается в `lib/`; UI не должен напрямую работать со схемой SQLite или `lib/atdb/*`.
- Массовое редактирование работает только поверх локального `AtdbEditDraftState` и существующего `AtdbChangeSet`; `applyAtdbChanges` и strict rebuild contract не расширяются в этом плане.
- Пользовательские `.atdb` и персональные значения не должны попадать в логи, документацию или тестовые артефакты.
- Первый bulk scope ограничен write-safe сущностями и полями: `person`, `family`, `place`; события, даты, участники событий, родственные связи, metadata, `notes` и `occupation` остаются read-only.
- `Families` трактуются как "Роды", а не как нуклеарные семьи; не добавлять роли мужа/жены/детей из таблицы `Families`.

Decisions:
- Добавить чистый batch-helper рядом с draft layer (`lib/atdbBatchEdit.ts` или близкий модуль), чтобы рассчитывать кандидатов, no-op, skipped rows и preview без React и без SQL.
- Batch apply должен записывать результат в существующий `editDraft`, после чего экспорт остается прежним: `buildAtdbChangeSet(parsedData, editDraft)` -> `applyAtdbChanges(originalBuffer, changeSet)`.
- Scope операции: выбранные строки текущей editable вкладки, все записи текущей editable вкладки, либо записи текущей вкладки, подходящие под простое field-level условие в bulk dialog. Глобальный поиск и полноценные table filters остаются отдельным roadmap milestone.
- Операции: "заполнить/очистить поле" для всех supported field kinds и "заменить строку" только для string-полей.
- Preview перед применением обязателен: пользователь должен видеть количество affected/skipped/no-op строк и список изменений; применение без preview не допускается.
- Existing draft values считаются текущим baseline для preview: batch может заменить локально измененное значение, но preview должен явно считать такую строку affected.

Open questions:
- Нужен ли позже полноценный browser/UI test runner для batch flow; в этом плане основной automated gate остается script-level regression плюс build/lint/typecheck.
- Нужно ли в следующем milestone "Фильтрация и поиск по данным" переиспользовать operation-local predicate из bulk dialog как основу для постоянных table filters.

Success signals:
- Пользователь может выбрать строки или условие, выбрать write-safe поле, задать массовое заполнение/очистку или строковую замену, увидеть preview и применить результат в draft без скачивания файла.
- Счетчик изменений, field-level dirty state, reset и existing export продолжают работать после batch apply.
- Batch helper покрыт fixture-free regression tests и не читает `.atdb`.
- `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run test:atdb:edit-draft`, новый batch regression script, `npm run test:atdb:rebuild-contract`, `npm run test:atdb:write-safety`, `npm run smoke:atdb:matrix` и `npm run schema:atdb:fixtures:check` проходят или корректно skip'ают отсутствующие local-only fixtures.

## Commit Plan
- **Commit 1** (after tasks 1-3): `feat(ui): add batch edit draft helpers`
- **Commit 2** (after tasks 4-6): `feat(ui): add bulk edit selection and preview`
- **Commit 3** (after tasks 7-8): `test(ui): cover bulk edit draft flow`
- **Commit 4** (after tasks 9-10): `docs(ui): document bulk field editing`

## Tasks

### Phase 1: Batch Contract And Pure Logic
- [x] Task 1: Ввести batch edit contract и metadata write-safe полей.

  Deliverable:
  - Создать `lib/atdbBatchEdit.ts` или близкий модуль с типами `AtdbBatchEditOperation`, `AtdbBatchEditScope`, `AtdbBatchEditPreview`, `AtdbBatchEditPreviewRow`, `AtdbBatchEditableField`.
  - Переиспользовать allowlist из `lib/atdbEditDraft.ts`: `ATDB_EDITABLE_PERSON_FIELDS`, `ATDB_EDITABLE_FAMILY_FIELDS`, `ATDB_EDITABLE_PLACE_FIELDS`.
  - Добавить field metadata для UI: entity type, field name, label, value kind (`text`, `number`, `gender`, `place-link`), support for fill/clear, support for string replace.
  - Не импортировать `lib/atdb/*`; использовать только публичные типы из `lib/sqlProcessor.ts` и доменные типы из `lib/types.ts`.
  - Явно исключить `events` и read-only поля из batch contract.

  Files:
  - `lib/atdbBatchEdit.ts` (new)
  - `lib/atdbEditDraft.ts` при необходимости small export/refactor для metadata reuse

  LOGGING REQUIREMENTS:
  - Pure helper не должен логировать вообще.
  - Ошибочные runtime-входы должны возвращать safe validation/preview result с reason code, без raw values и без record dump.
  - Не добавлять console output в `lib/`.

- [x] Task 2: Реализовать preview и применение batch operation к draft.

  Deliverable:
  - Реализовать `previewAtdbBatchEdit(data, draft, operation)`:
    - принимает `ParsedAtdb`, текущий `AtdbEditDraftState` и operation/scope;
    - рассчитывает affected rows, skipped rows, no-op rows и stable ordered preview rows;
    - использует draft-aware current value как baseline;
    - применяет operation-local predicate к тому же draft-aware current value, а не к сырому `ParsedAtdb`, чтобы ручные правки перед batch учитывались при выборе строк;
    - для `fill` поддерживает value/clear semantics текущего draft layer;
    - для `replace` поддерживает string-поля, search text, replacement text и case sensitivity option;
    - для `birthPlaceId`/`deathPlaceId` учитывает текущий UI-safe scope: менять только строки, где соответствующая ссылка уже доступна для редактирования;
    - для place-link fields заранее проверяет, что target `Place.id` существует в `data.places`, и возвращает safe skipped reason (`place-not-found` / `not-editable-link`) вместо подготовки изменения, которое strict rebuild затем заблокирует.
  - Реализовать `applyAtdbBatchEdit(data, draft, preview)` или эквивалент, который применяет только affected preview rows через `setDraftField`.
  - Preview result должен содержать frozen operation/scope fingerprint или эквивалентный snapshot, чтобы UI мог отличить актуальный preview от устаревшего.
  - Сохранять no-op поведение: если batch возвращает значение к исходному, поле должно исчезать из draft.
  - Сохранять стабильный порядок изменений, совместимый с `buildAtdbChangeSet`.

  Files:
  - `lib/atdbBatchEdit.ts`
  - `lib/atdbEditDraft.ts` только если нужен небольшой публичный helper

  Dependencies:
  - Depends on Task 1.

  LOGGING REQUIREMENTS:
  - Pure helper не должен логировать значения или счетчики.
  - Validation result должен быть структурированным и safe: code, entity type, field, counts.
  - Не печатать имена, места, заметки, GUID, `ValuesStr` или пути к файлам.

- [x] Task 3: Добавить fixture-free regression coverage для batch helper.

  Deliverable:
  - Расширить `scripts/check-atdb-edit-draft.mjs` или добавить `scripts/check-atdb-batch-edit.mjs` по существующему паттерну temp compile через TypeScript.
  - Покрыть synthetic scenarios:
    - fill text field по selected person IDs;
    - clear string field отличает `null` от пустой строки;
    - fill `gender`, `color`, `birthPlaceId`/`deathPlaceId`;
    - string replace меняет только string fields и корректно считает no-op/skipped rows;
    - operation-local predicate выбирает строки по contains/exact/empty/not-empty;
    - operation-local predicate использует dirty draft value как current baseline;
    - existing draft value используется как current baseline;
    - invalid entity/field/value не попадает в change-set;
    - invalid place-link target и не редактируемая life-event link строка попадают в skipped с safe reason code;
    - duplicate selected IDs дедуплицируются без изменения порядка preview;
    - apply устаревшего preview блокируется или не применяется, если operation/scope fingerprint больше не совпадает;
    - stable preview/apply ordering.
  - Если добавляется новый script, добавить `test:atdb:batch-edit` в `package.json`.
  - Не читать `.atdb` fixtures, `sql.js` или реальные пользовательские данные.

  Files:
  - `scripts/check-atdb-batch-edit.mjs` (new) или `scripts/check-atdb-edit-draft.mjs`
  - `package.json` при добавлении нового npm script
  - `lib/atdbBatchEdit.ts`

  Dependencies:
  - Depends on Tasks 1-2.

  LOGGING REQUIREMENTS:
  - Regression output только с synthetic labels/statuses/counts.
  - Failure output должен содержать safe assertion message без дампа всего draft/preview, если там есть values.
  - Не печатать temp absolute paths, реальные имена, места, заметки, GUID, filenames или `.atdb` contents.

<!-- Commit checkpoint: tasks 1-3 -->

### Phase 2: Selection, Dialog, And Preview UI
- [x] Task 4: Добавить row selection state для editable вкладок.

  Deliverable:
  - Поднять active editable entity/current tab state на уровень `app/page.tsx` или сделать `ScrollableDataTable` controlled через props/callback, чтобы bulk toolbar и таблица использовали один источник истины.
  - Добавить selection state на уровне owner-компонента с разделением по entity type: `person`, `family`, `place`.
  - В `components/DataTable.tsx` добавить checkbox column для `persons`, `families`, `places`; вкладка `events` остается без выбора и только для просмотра.
  - Передавать в `DataTable` выбранные IDs и toggle callbacks; таблица не должна владеть canonical selection state.
  - Поддержать select-one, clear selection, select all rendered rows текущей вкладки после текущей сортировки.
  - Хранить selected IDs дедуплицированно и в stable order, чтобы selected scope давал предсказуемый preview.
  - Сбрасывать selection при загрузке нового файла в том же reset path, где очищаются `parsedData`, `originalBuffer`, `originalFilename` и `editDraft`; при смене вкладки сохранять selection соответствующей editable сущности.
  - Не менять сортировку и dirty rendering; selection не должна мутировать `ParsedAtdb`.

  Files:
  - `app/page.tsx`
  - `components/ScrollableDataTable.tsx`
  - `components/DataTable.tsx`

  Dependencies:
  - Depends on Task 1 for entity/field typing.

  LOGGING REQUIREMENTS:
  - Selection actions не логировать в console.
  - UI state должен хранить только IDs и не писать пользовательские values в логи.
  - Ошибки rendering показывать через safe UI message/counts без record dump.

- [x] Task 5: Создать bulk edit dialog/panel с operation-local scope.

  Deliverable:
  - Создать `components/BulkEditDialog.tsx` или `components/BulkEditPanel.tsx`.
  - Controls:
    - active entity selector/readout по текущей вкладке;
    - field selector только для write-safe fields выбранной сущности;
    - scope selector: selected rows, all rows in entity, rows matching simple predicate;
    - predicate controls: field, operator (`contains`, `equals`, `empty`, `not empty`) для текущей сущности;
    - operation selector: fill/clear, replace string;
    - value input по field kind: text input, numeric input, gender select, place select.
  - Predicate controls должны вычисляться через `previewAtdbBatchEdit`/batch helper и использовать draft-aware current value; UI не должен дублировать логику сравнения строк.
  - Для `replace string` разрешать только string fields и требовать search text.
  - Для place-link fields использовать существующий `places` list и clear option; выбранный target id должен быть из `parsedData.places`, иначе preview показывает safe validation error без применения.
  - Если active entity — `events`, bulk action disabled/hidden с read-only статусом; dialog не должен открываться для событий.
  - Кнопка preview должна быть disabled до валидной operation.

  Files:
  - `components/BulkEditDialog.tsx` или `components/BulkEditPanel.tsx` (new)
  - `components/EditableCell.tsx` при необходимости reuse primitive controls
  - `components/ScrollableDataTable.tsx`
  - `app/page.tsx`

  Dependencies:
  - Depends on Tasks 1-2 and Task 4.

  LOGGING REQUIREMENTS:
  - Dialog не логирует ввод пользователя.
  - Validation показывать в UI без console output.
  - Не выводить raw row objects, имена, места, заметки, GUID или filename.

- [x] Task 6: Подключить preview/apply flow к `app/page.tsx`.

  Deliverable:
  - Добавить state для active bulk operation, preview result, dialog open/closed, safe validation error.
  - Preview строить через `previewAtdbBatchEdit(parsedData, editDraft, operation)`.
  - Apply разрешать только после актуального preview; если operation, scope, selected IDs, active entity, predicate, `editDraft` или `parsedData` изменились после preview, требовать пересчитать preview.
  - Хранить и сравнивать preview fingerprint/snapshot из batch helper перед apply, чтобы stale preview не мог примениться после ручной правки или смены выбора.
  - Apply обновляет `editDraft` через `applyAtdbBatchEdit`, очищает preview, показывает safe success message с counts affected/skipped/no-op.
  - Existing export/download path не менять: скачивание по-прежнему использует текущий `editDraft`.
  - Блокировать apply во время `isDownloading`.

  Files:
  - `app/page.tsx`
  - `components/BulkEditDialog.tsx` или `components/BulkEditPanel.tsx`
  - `lib/atdbBatchEdit.ts`

  Dependencies:
  - Depends on Tasks 2 and 5.

  LOGGING REQUIREMENTS:
  - Console logs не добавлять для успешного preview/apply.
  - При неожиданных ошибках логировать только safe code/counts/phase.
  - Не логировать preview rows целиком, operation values, filenames или пользовательские строки.

<!-- Commit checkpoint: tasks 4-6 -->

### Phase 3: UX Hardening And Safety
- [x] Task 7: Реализовать предпросмотр изменений и skipped/no-op объяснения.

  Deliverable:
  - Preview UI должен показывать:
    - affected/skipped/no-op counts;
    - список affected rows с ID, названием поля, current value и next value;
    - skipped summary по reason codes (`unsupported-field`, `not-editable-link`, `place-not-found`, `predicate-miss`, `invalid-value`, `no-change`, `stale-preview`);
    - явное предупреждение, если batch перезаписывает уже dirty draft value.
  - UI может показывать пользовательские значения только в браузере пользователя; эти значения не должны попадать в логи, тестовые outputs или документацию.
  - Добавить confirm action "Применить в черновик" и cancel/close без изменения draft.
  - Если affected count равен 0, apply disabled и показана причина.

  Files:
  - `components/BulkEditDialog.tsx` или `components/BulkEditPanel.tsx`
  - `app/page.tsx`
  - `lib/atdbBatchEdit.ts` при необходимости reason-code labels

  Dependencies:
  - Depends on Task 6.

  LOGGING REQUIREMENTS:
  - Preview render не пишет в console.
  - UI text может показывать values пользователю, но console/documentation/tests не должны их дублировать.
  - Error states показывать через safe phase/code/counts.

- [x] Task 8: Доработать ergonomics массового редактирования в таблицах.

  Deliverable:
  - Показать рядом с export controls aggregate status: selected rows count и bulk edit entry action.
  - Добавить per-entity "Сбросить выбор" и сохранить существующую "Сбросить все изменения".
  - Убедиться, что checkboxes, sticky columns, editable controls и horizontal scroll не перекрывают друг друга на desktop/mobile viewport.
  - Для строк с dirty fields сохранить текущую подсветку и reset controls.
  - Не добавлять nested cards; bulk dialog может быть модальным окном или unframed toolbar/panel.

  Files:
  - `app/page.tsx`
  - `components/ScrollableDataTable.tsx`
  - `components/DataTable.tsx`
  - `components/BulkEditDialog.tsx` или `components/BulkEditPanel.tsx`
  - `components/EditableCell.tsx` при необходимости layout tweaks

  Dependencies:
  - Depends on Tasks 4-7.

  LOGGING REQUIREMENTS:
  - Layout/interaction state не логировать.
  - Не добавлять debug logs ради UI tuning.
  - Ошибки взаимодействия показывать в UI без raw data.

### Phase 4: Documentation And Verification
- [x] Task 9: Обновить пользовательскую и архитектурную документацию.

  Deliverable:
  - Обновить `README.md`: кратко добавить массовое редактирование как локальную draft operation поверх write-safe полей.
  - Обновить `docs/getting-started.md`: описать batch flow, preview-before-apply, отличие применения в draft от скачивания `.atdb`, supported scopes/operations и ограничения по событиям/датам.
  - Обновить `docs/architecture.md`: добавить поток `bulk dialog -> atdbBatchEdit preview -> editDraft -> AtdbChangeSet`.
  - При необходимости обновить `.ai-factory/ROADMAP.md` только через follow-up owner workflow; implementation plan не должен сам закрывать milestone.

  Files:
  - `README.md`
  - `docs/getting-started.md`
  - `docs/architecture.md`

  Dependencies:
  - Depends on Tasks 5-8.

  LOGGING REQUIREMENTS:
  - Документация не должна содержать реальные значения из `.atdb`, имена, места, заметки, GUID, document paths, source text или raw `ValuesStr`.
  - Примеры держать synthetic и на уровне field names/counts/statuses.
  - Не добавлять скриншоты или дампы пользовательской базы.

- [x] Task 10: Выполнить финальный gate для batch editing flow.

  Deliverable:
  - Запустить `npm run lint`.
  - Запустить `npx tsc --noEmit`.
  - Запустить `npm run build`.
  - Запустить `npm run test:atdb:edit-draft`.
  - Запустить новый `npm run test:atdb:batch-edit`, если он добавлен.
  - Запустить `npm run test:atdb:rebuild-contract`.
  - Запустить `npm run test:atdb:write-safety`.
  - Запустить `npm run smoke:atdb:matrix`.
  - Запустить `npm run schema:atdb:fixtures:check`.
  - Manual UI smoke: загрузить разрешенную fixture, выбрать несколько персон/родов/мест, preview fill, preview string replace, apply в draft, проверить счетчики/dirty states/reset, скачать `.atdb`.
  - Manual responsive smoke: проверить desktop и mobile viewport, что checkbox column, sticky ID column, editable controls, bulk dialog/panel и horizontal scroll не перекрывают друг друга.
  - Manual stale-preview smoke: построить preview, изменить выбор или одно поле вручную, убедиться, что apply требует пересчета preview.
  - Если local-only fixtures отсутствуют, явно зафиксировать skip behavior и не считать это ошибкой.

  Files:
  - Исправления только в файлах из Tasks 1-9, если проверки выявят проблему.

  Dependencies:
  - Depends on Tasks 1-9.

  LOGGING REQUIREMENTS:
  - Итог проверок фиксировать как команды/statuses, fixture labels, counts и deltas.
  - Не добавлять debug logs в runtime UI ради прохождения проверки.
  - Не печатать raw `.atdb` contents, `ValuesStr.vstr`, GUID, document/source text, имена, места, заметки или локальные private fixture paths.

<!-- Commit checkpoint: tasks 7-10 -->
