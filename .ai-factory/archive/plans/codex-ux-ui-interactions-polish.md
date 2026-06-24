---
archived: 2026-06-24
---

# Implementation Plan: Полировка UX/UI-интеракций

Branch: codex/ux-ui-interactions-polish
Created: 2026-06-24

## Settings
- Testing: yes
- Logging: standard
- Docs: yes

## Roadmap Linkage
Milestone: "Полировка UX/UI-интеракций"
Rationale: План закрывает следующий открытый roadmap milestone: индикаторы длительных действий, единые hover/focus-состояния и легкие переходы без ухудшения производительности больших таблиц.

## Research Context
Source: текущий `$aif-explore ROADMAP "Полировка UX/UI-интеракций"`, `.ai-factory/ROADMAP.md`, текущий code reconnaissance, `.ai-factory/RESEARCH.md` (Active Summary, исторический ATDB-контекст).

Goal:
- Улучшить обратную связь интерфейса при загрузке файла, переключении вкладок, поиске/фильтрации, массовом редактировании и экспорте `.atdb`.
- Унифицировать интерактивные состояния controls и сделать фокус/disabled/dirty/pending состояния предсказуемыми.
- Сохранить отзывчивость больших таблиц: анимировать только небольшие UI surfaces, не строки таблицы.

Constraints:
- SQL-логика остается в `lib/`; UI не должен напрямую работать со схемой SQLite.
- Write-safe scope не расширяется: `person`, `family`, `place` редактируются в существующих пределах, `event` остается read-only.
- Не выводить в logs, docs, тестовые snapshots или diagnostics raw rows, имена, места, заметки, GUID, `ValuesStr` и локальные пути пользовательских `.atdb`.
- Анимации должны уважать `prefers-reduced-motion` и не вызывать layout churn на тысячах строк.
- Если browser smoke с загрузкой/скачиванием fixture не удастся автоматизировать, verify должен явно остаться partial, а не green by assumption.

Decisions:
- Начать с performance-safe table state: активная таблица, memoized selection lookup и отсутствие per-row animation.
- Вынести повторяющиеся visual states в небольшие shared primitives/classes только там, где это снижает дублирование.
- Для длительных действий использовать React state / `useTransition` / `aria-live`, а не runtime logs.
- События и структурные изменения `.atdb` не входят в этот milestone.

Open questions:
- Достаточно ли existing component regression scripts, или стоит добавить отдельный `test:atdb:ui-interactions` script.
- Нужен ли полноценный Playwright smoke в рамках этого milestone, или достаточно ручного browser smoke после scripted gates.

Success signals:
- При чтении/парсинге файла, переключении вкладок, пересчете query, preview/apply массового редактирования и экспорте есть понятный pending/status feedback.
- Hover/focus/disabled states визуально согласованы в upload area, toolbar, table controls, editable cells, modal и bulk edit dialog.
- Table selection и query flow не добавляют очевидной лишней O(n*m) работы на больших visible sets.
- `npm run lint`, `npx tsc --noEmit`, профильные UI/table/batch scripts и browser smoke проходят либо browser smoke честно описан как partial.

## Commit Plan
- **Commit 1** (after tasks 1-3): `refactor(ui): stabilize interaction primitives`
- **Commit 2** (after tasks 4-6): `feat(ui): add pending states for atdb workflows`
- **Commit 3** (after tasks 7-8): `test(ui): cover interaction polish`

## Tasks

### Phase 1: Performance-safe foundation
- [x] Task 1: Снизить лишнюю работу table/query/selection перед добавлением визуальных переходов.

  Deliverable:
  - Пересмотреть `tableQueryResults` в `app/page.tsx`: если inactive entity results не нужны для render, считать только активный `activeTableQueryResult` или явно memoize expensive paths.
  - Пересмотреть draft-aware place-link labels в `lib/atdbTableView.ts`: не выполнять повторный линейный поиск места (`data.places.find`) в горячем query/sort path, если можно подготовить lookup один раз на query.
  - В `queryAtdbTableRows` подготовить query-level lookup/cache для повторно используемых cell values, чтобы quick search, field filter и sort не пересчитывали одни и те же draft-aware значения по несколько раз в рамках одного query pass.
  - В `ScrollableDataTable` и `DataTable` передавать selection lookup так, чтобы `selectedIds` не превращался в новый `Set` внутри каждой строки; `selectedIdSet`, `allVisibleSelected` и `visibleSelectedCount` считать один раз на render активной таблицы.
  - Убрать `includes`-проверки на больших массивах там, где нужен `Set`, включая снятие выбора с видимых строк.
  - Сохранить поведение selection: "выбрать все видимые", visible selected count, clear selection и read-only events notice.

  Files:
  - `app/page.tsx`
  - `lib/atdbTableView.ts`
  - `components/ScrollableDataTable.tsx`
  - `components/DataTable.tsx`
  - `components/atdb-table/AtdbTablePrimitives.tsx`
  - `scripts/check-atdb-table-components.mjs` или новый профильный script, если нужен regression gate
  - `scripts/check-atdb-table-view.mjs`, если меняется query/helper contract

  LOGGING REQUIREMENTS:
  - Runtime console logs не добавлять.
  - Если добавляется regression output, печатать только synthetic labels/counts/statuses.
  - Не выводить пользовательские значения строк таблицы, имена, места, заметки, GUID или локальные fixture paths.

- [x] Task 2: Ввести небольшие shared interaction styles/primitives для кнопок, inputs, badges и status surfaces.

  Deliverable:
  - Сократить повторяющиеся Tailwind class strings для primary/secondary/danger или icon buttons, inputs/selects, status badges и focus rings.
  - Использовать существующий `cn` из `lib/utils.ts` или локальные component-level constants без тяжёлой design system.
  - Унифицировать `hover`, `focus-visible`, `disabled`, `aria-disabled` и dirty states в `FileUploader`, верхнем action bar, `TableQueryToolbar`, `EditableCell`, `Modal`, `BulkEditDialog`.
  - Для `Modal` и `BulkEditDialog` сохранить доступный dialog contract: `role="dialog"`, `aria-modal`, `aria-labelledby`/стабильный heading id, закрытие по Escape там, где это не конфликтует с вводом, начальный фокус внутри dialog и возврат фокуса на вызывающий control после закрытия.
  - Close-control должен быть предсказуемым и одинаковым: `button` с `aria-label`/`title`; ручной SVG close заменить на `X` из `lucide-react`.
  - Не создавать вложенные cards и не менять layout приложения шире, чем нужно для controls.

  Files:
  - `components/FileUploader.tsx`
  - `components/TableQueryToolbar.tsx`
  - `components/EditableCell.tsx`
  - `components/Modal.tsx`
  - `components/BulkEditDialog.tsx`
  - `app/page.tsx`
  - Optional: `components/uiStyles.ts` или `components/ui/InteractionPrimitives.tsx`

  LOGGING REQUIREMENTS:
  - Runtime logs не добавлять.
  - Если helper exports тестируются script'ом, выводить только имена проверок и pass/fail.
  - Не включать в snapshots или messages пользовательские raw values.

- [x] Task 3: Добавить motion/accessibility основу для безопасных переходов.

  Deliverable:
  - Добавить минимальные utility classes или component patterns для opacity/transform transitions только на малых UI surfaces: toolbar, status strips, dialog, empty state.
  - Уважать `prefers-reduced-motion`; при reduced motion отключать декоративные transitions/spinners или сводить их к мгновенной смене состояния.
  - Добавить `aria-live`/`role="status"` для import/export/bulk feedback, где статус меняется без навигации; error surface оставить как alert/status с redacted text без raw row values.
  - Top-level success/error/status strips в `app/page.tsx` должны иметь единый status contract, чтобы reading/parsing/export/bulk apply были слышны screen reader без навигации.
  - Не анимировать строки таблицы, sticky cells или тысячи controls.

  Files:
  - `app/globals.css`
  - `app/page.tsx`
  - `components/ScrollableDataTable.tsx`
  - `components/BulkEditDialog.tsx`
  - `components/atdb-table/AtdbTablePrimitives.tsx`

  LOGGING REQUIREMENTS:
  - Runtime logs не добавлять.
  - Accessibility/status text должен быть redacted: только phase/status/counts, без raw row values.
  - Regression output, если будет, держать на уровне selectors/classes/status labels.

<!-- Commit checkpoint: tasks 1-3 -->

### Phase 2: Workflow pending states
- [x] Task 4: Улучшить upload/import feedback: reading, parsing, success/error и disabled states.

  Deliverable:
  - Разделить состояние чтения файла (`FileReader`) и парсинга `.atdb` через явные фазы `idle | reading | parsing | ready | error`, чтобы пользователь видел, что происходит до `parseAtdb`.
  - Во время чтения/парсинга отключить повторный drop/click или явно показать занятое состояние.
  - Передать в `FileUploader` явный busy/disabled state из `app/page.tsx`; заблокировать drop/click/input во время чтения или парсинга, сохранив keyboard-accessible upload control через `ref` или связанный `label/input`, без `document.getElementById`.
  - Показать compact status с безопасными counters после успешного parse.
  - Сохранить client-only модель: файл не отправляется наружу, ошибки остаются redacted через existing safe formatter.

  Files:
  - `components/FileUploader.tsx`
  - `app/page.tsx`

  LOGGING REQUIREMENTS:
  - В `console.error` оставлять только code/issueCount и безопасный контекст, как сейчас.
  - Не логировать file name, локальные пути, raw rows или содержимое `.atdb`.
  - UI status может показывать выбранное пользователем имя файла, но test/script output не должен его фиксировать.

- [x] Task 5: Добавить pending feedback для переключения вкладок, поиска, фильтра и сортировки.

  Deliverable:
  - Использовать `useTransition` или близкий React 19 pattern для смены активной сущности и query state там, где render может быть заметным.
  - Для quick search/filter рассмотреть `useDeferredValue` или transition-friendly state update, чтобы ввод в toolbar оставался отзывчивым при больших таблицах и не блокировался полным query/render pass.
  - Tabs должны получить явный accessibility contract (`tablist`/`tab` с selected state или эквивалентный `aria-current`), не ломая горизонтальный scroll и sticky table layout.
  - Показать компактный индикатор "обновляем таблицу" в table toolbar/container без перекрытия header/body.
  - При смене вкладки сбрасывать горизонтальный scroll как сейчас, но без layout jump и без потери selection/draft state.
  - Сохранить read-only notice для событий и видимые counts.

  Files:
  - `app/page.tsx`
  - `components/ScrollableDataTable.tsx`
  - `components/TableQueryToolbar.tsx`
  - `components/DataTable.tsx`

  LOGGING REQUIREMENTS:
  - Runtime logs не добавлять.
  - Status text содержит только entity label и phase, без данных строк.
  - Browser/debug output при проверке не должен печатать пользовательские значения.

- [x] Task 6: Добавить pending/current feedback для export и bulk edit preview/apply.

  Deliverable:
  - Разделить pending состояния для export, bulk preview и bulk apply; кнопки не должны позволять duplicate actions.
  - В `BulkEditDialog` явно показывать stale/current preview, affected/skipped/noop counts и pending state кнопок.
  - Не пересчитывать expensive fingerprint/current-preview state на каждый ввод, когда `preview` отсутствует; `createAtdbBatchEditFingerprint` считать только для существующего preview/current check или через явно memoized stable dependency path, чтобы full editable data hash не запускался на каждый keystroke.
  - В export flow показать фазу подготовки файла и оставить modal/download instructions согласованными с success state.
  - Сохранить existing `AtdbChangeSet` flow и не расширять writable fields.

  Files:
  - `app/page.tsx`
  - `components/BulkEditDialog.tsx`
  - `components/Modal.tsx`
  - `lib/atdbBatchEdit.ts` только если нужен чистый helper для UI state labels, без SQL

  LOGGING REQUIREMENTS:
  - `console.error` при export оставляет code/issueCount/changes, без raw data.
  - Bulk preview/apply не должен логировать row values. Локальный UI-предпросмотр может показывать текущие/будущие значения пользователю, но logs, docs, scripts, snapshots и browser notes фиксируют только counts/status labels.
  - Любой новый diagnostic helper должен возвращать безопасные codes/statuses, не пользовательские строки.

<!-- Commit checkpoint: tasks 4-6 -->

### Phase 3: Regression coverage, docs, and verification
- [x] Task 7: Добавить regression coverage для UX/UI interaction contracts.

  Deliverable:
  - Расширить `scripts/check-atdb-table-components.mjs` и/или добавить `scripts/check-atdb-ui-interactions.mjs` для проверки новых contracts: active-only query behavior, selection Set reuse contract, required aria-live/status surfaces, pending button disabled states, reduced-motion class presence.
  - Проверить не только наличие source tokens, но и контракты из Task 1, Task 2, Task 3, Task 4, Task 5 и Task 6: active-only query path, stable selection lookup, dialog semantics, aria-live/status surfaces, reduced-motion guard, disabled upload while busy, transition/status surfaces и current/stale bulk preview behavior.
  - При добавлении нового script добавить npm command в `package.json`.
  - Сохранить fixture-free подход: synthetic data/source checks, без чтения пользовательских `.atdb`.
  - Существующие проверки `test:atdb:table-components`, `test:atdb:table-view`, `test:atdb:batch-edit` не должны деградировать.

  Files:
  - `scripts/check-atdb-table-components.mjs`
  - Optional: `scripts/check-atdb-ui-interactions.mjs`
  - `package.json` при добавлении script

  LOGGING REQUIREMENTS:
  - Script output: только имена проверок, counts и pass/fail.
  - Не печатать local paths к fixtures, raw rows, имена, места, заметки, GUID или `ValuesStr`.
  - Failure messages должны указывать contract и файл, а не содержимое пользовательских данных.

- [x] Task 8: Обновить документацию и выполнить финальную проверку milestone.

  Deliverable:
  - Обновить пользовательскую документацию, если меняется видимый workflow загрузки, редактирования, bulk edit или экспорта.
  - При необходимости синхронизировать `README.md`, `docs/getting-started.md` или профильную docs page; не менять ATDB format docs без изменения формата.
  - Запустить:
    - `npm run lint`
    - `npx tsc --noEmit`
    - `npm run build`
    - `npm run test:atdb:table-components`
    - `npm run test:atdb:table-view`
    - `npm run test:atdb:edit-draft`
    - `npm run test:atdb:batch-edit`
    - новый UI interaction script, если он добавлен
    - `git diff --check`
  - Выполнить browser smoke: upload fixture, switch tabs, search/filter, edit one field, bulk preview/apply, export button state. Если file upload/download smoke не автоматизируется, явно оставить verify partial.

  Files:
  - `README.md` и/или `docs/getting-started.md` только если меняется пользовательский workflow
  - `docs/*` при необходимости
  - No docs change required if UI behavior remains self-explanatory and existing docs stay accurate

  LOGGING REQUIREMENTS:
  - Documentation examples не должны содержать raw rows, имена, места, заметки, GUID, `ValuesStr` или локальные private paths.
  - Verification output должен фиксировать команды и pass/fail/partial, без дампа пользовательских `.atdb`.
  - Browser smoke notes должны ссылаться на actions/statuses, а не на персональные данные fixture.

<!-- Commit checkpoint: tasks 7-8 -->
