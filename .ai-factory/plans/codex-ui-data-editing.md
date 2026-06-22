# Implementation Plan: Редактирование данных в UI

Branch: codex/ui-data-editing
Created: 2026-06-22

## Settings
- Testing: yes
- Logging: verbose
- Docs: yes

## Roadmap Linkage
Milestone: "Редактирование данных в UI"
Rationale: План реализует следующий unchecked roadmap milestone после завершения надежной обратной сборки `.atdb`.

## Research Context
Source: текущий `$aif-explore ROADMAP "Редактирование данных в UI"`, `.ai-factory/ROADMAP.md`, `.ai-factory/RESEARCH.md` (только релевантные ограничения Active Summary).

Goal:
- Добавить безопасное локальное редактирование данных в интерфейсе и экспорт через явный `AtdbChangeSet`.

Constraints:
- SQL-логика остается в `lib/`; UI не должен напрямую работать со схемой SQLite или `lib/atdb/*`.
- Пользовательские `.atdb` и персональные значения не должны попадать в логи, документацию или тестовые артефакты.
- Первый UI milestone раскрывает только уже write-safe поля из `AtdbChangeSet`: `person`, `family`, `place`.
- Создание, удаление и прямое редактирование `event`, дат событий, участников событий, родственных связей, notes/occupation и metadata остаются вне scope.

Decisions:
- UI должен формировать явный `AtdbChangeSet` и вызывать `applyAtdbChanges(originalBuffer, changeSet)`, а не изменять всю `ParsedAtdb` модель для compatibility diff.
- Места рождения/смерти персоны редактируются как `birthPlaceId` / `deathPlaceId` через выбор существующего `Place.id`; отображаемые `birthPlace` / `deathPlace` остаются read-only derived text.
- Вкладка "События" остается read-only и должна явно не создавать ожидания, что `eventType`, `date`, `place`, `description` или `personIds` записываются.
- Для тестов не вводить тяжелый React test framework в этом плане; покрыть чистые draft/change-set helpers script-level regression и оставить UI поведение за lint/build/manual QA.

Open questions:
- Нужен ли отдельный будущий milestone для редактирования событий и дат после расширения `AtdbWritableEntity`.
- Нужно ли позже добавить полноценный browser/UI test runner для редактирования таблиц.

Success signals:
- Пользователь может изменить write-safe поля персон, родов и мест, увидеть счетчик/подсветку изменений, сбросить изменения и скачать пересобранный `.atdb`.
- Экспорт использует `applyAtdbChanges` и показывает только safe error message/code/counts.
- `npm run lint`, `npx tsc --noEmit`, `npm run build`, новый draft regression script и существующие ATDB rebuild/write-safety checks проходят или корректно skip'ают отсутствующие local-only fixtures.

## Commit Plan
- **Commit 1** (after tasks 1-4): `feat(ui): add edit draft state for atdb changes`
- **Commit 2** (after tasks 5-7): `feat(ui): edit write-safe atdb fields`
- **Commit 3** (after tasks 8-9): `test(ui): cover atdb edit draft flow`
- **Commit 4** (after task 10): `docs(ui): document atdb editing workflow`

## Tasks

### Phase 1: Контракт локальных изменений
- [x] Task 1: Согласовать публичный write-contract и allowlist UI.

  Deliverable:
  - Расширить type re-export в `lib/sqlProcessor.ts` и compatibility `lib/buildAtdb.ts` для всех публично нужных UI/draft типов: `AtdbWritableEntity`, `AtdbPersonField`, `AtdbFamilyField`, `AtdbPlaceField`, `AtdbFieldName`, `AtdbFieldValue`, `AtdbChangeSet`, `AtdbEntityChange`, `AtdbFieldChange`.
  - Зафиксировать типизированные allowlist'ы для UI draft: `person` (`firstName`, `lastName`, `patronymic`, `gender`, `birthPlaceId`, `deathPlaceId`), `family` (`familyName`, `husbandLastName`, `wifeLastName`, `comment`, `color`), `place` (`name`, `shortName`, `comment`).
  - Зафиксировать scalar semantics на уровне helper/API boundary: строковые поля принимают строку/null/undefined, `gender` принимает `M`/`F`/`Unknown`/null/undefined, `color` принимает integer/null/undefined, place links принимают существующий `Place.id` или clear value.
  - Не импортировать `lib/atdb/*` из UI-компонентов; UI должен опираться на фасад `@/lib/sqlProcessor` и доменные типы `@/lib/types`, а helper внутри `lib/` должен использовать type-only imports из `./sqlProcessor`.
  - Отдельно учитывать подтвержденное поведение strict rebuild: `gender: null` и `gender: undefined` очищают значение до `Unknown`, а не до отсутствующего поля.

  Files:
  - `lib/sqlProcessor.ts`
  - `lib/buildAtdb.ts`
  - `lib/atdbEditDraft.ts`

  LOGGING REQUIREMENTS:
  - Изменение фасадов и allowlist'ов не должно добавлять runtime logs.
  - Любые будущие diagnostic labels должны быть aggregate-only и не содержать raw values, GUID, имена, места, заметки или пути к файлам.

- [x] Task 2: Добавить чистый UI helper для draft state и сборки `AtdbChangeSet`.

  Deliverable:
  - Создать `lib/atdbEditDraft.ts` или близкий по смыслу модуль с типами локального draft state, ключом изменения (`entityType`, `id`, `field`), helper'ами `setDraftField`, `resetDraftField`, `resetDraftEntity`, `clearDraft`, `getDraftValue`, `isFieldDirty`, `buildAtdbChangeSet`, `countDraftChanges`.
  - Использовать публичные типы `AtdbChangeSet`, `AtdbWritableEntity`, `AtdbFieldName`, `AtdbFieldValue` из фасада `lib/sqlProcessor.ts` (`./sqlProcessor` внутри `lib/`, `@/lib/sqlProcessor` из UI); не импортировать `lib/atdb/*` в UI-facing code.
  - Сравнивать draft value с исходным значением и не включать no-op изменения в `buildAtdbChangeSet`, включая сценарий "поменяли поле и вернули старое значение".
  - Нормализовать `undefined` и `null` как clear value для write-safe полей, но сохранять пустую строку как строку.
  - Явно покрыть `gender` clear semantics: `null`/`undefined` должны уходить в change-set как clear value и ожидаться как `Unknown` после strict rebuild.
  - Не включать unsupported поля в `buildAtdbChangeSet`; helper должен принимать только заранее типизированный allowlist.
  - Возвращать стабильный порядок изменений (`entityType`, `id`, `field`) для предсказуемого тестирования и UI counters.

  Files:
  - `lib/atdbEditDraft.ts`
  - возможно `lib/types.ts` только если нужен общий presentation-only тип

  Dependencies:
  - Depends on Task 1.

  LOGGING REQUIREMENTS:
  - Helper не должен логировать значения полей или персональные данные.
  - Для будущей отладки допустимы только aggregate counters на уровне вызывающего UI: количество измененных записей/полей, без raw values.
  - Ошибочные runtime-входы должны возвращать безопасную ошибку/guard result без дампа записи.

- [x] Task 3: Подключить draft state на уровне `app/page.tsx`.

  Deliverable:
  - Добавить состояние локальных изменений рядом с `parsedData`, `originalBuffer`, `originalFilename`.
  - При начале загрузки нового файла очищать `parsedData`, `originalBuffer`, `originalFilename`, draft state, `error`, `success` и модальные статусы, чтобы старые данные не оставались видимыми или доступными для экспорта после failed parse.
  - Передать в таблицу callbacks для изменения и сброса поля/записи, а также `places` для select-контролов мест.
  - Считать `changeSet` из draft helper только перед экспортом, а не держать второй измененный `ParsedAtdb` как источник истины.
  - Для счетчиков/dirty-индикаторов использовать draft helper, а не мутировать `parsedData`.

  Files:
  - `app/page.tsx`
  - `components/ScrollableDataTable.tsx`

  Dependencies:
  - Depends on Task 2.

  LOGGING REQUIREMENTS:
  - `console.error` оставлять только для критичных parse/export ошибок и логировать `{ code, issueCount, changes }` без raw values.
  - Не логировать содержимое измененных ячеек, имена, места, заметки, GUID или путь к локальному файлу.
  - Для успешного UI-состояния использовать React state messages, не console logs.

- [x] Task 4: Переключить скачивание на явный `applyAtdbChanges`.

  Deliverable:
  - В `handleDownload` заменить `buildAtdb(parsedData, originalBuffer)` на `applyAtdbChanges(originalBuffer, changeSet)`.
  - Если изменений нет, не запускать `applyAtdbChanges`, отключить кнопку скачивания обновленного файла и показать понятное UI-сообщение "нет изменений" без ошибки; выбранное поведение зафиксировать в коде и документации.
  - На ошибках использовать `formatAtdbBuildError` и показывать safe message без SQL, raw values, GUID, мест или локальных путей.
  - Добавить отдельное `isDownloading` loading/disabled состояние на кнопку скачивания, чтобы двойной клик не запускал параллельные сборки и не конфликтовал с `isLoading` загрузки файла.
  - Не логировать `changeSet` целиком; для console payload использовать только safe `{ code, issueCount, changes }`.

  Files:
  - `app/page.tsx`
  - возможно `lib/atdbEditDraft.ts`

  Dependencies:
  - Depends on Tasks 2 and 3.

  LOGGING REQUIREMENTS:
  - `ERROR`: только safe code, issueCount, changes count.
  - `DEBUG`/`INFO`: не добавлять runtime console logs с пользовательскими значениями; счетчик изменений можно показывать в UI.
  - Не логировать `changeSet` целиком, потому что он содержит пользовательские значения.

<!-- Commit checkpoint: tasks 1-4 -->

### Phase 2: Редактируемые таблицы
- [x] Task 5: Вынести переиспользуемые presentation controls для редактируемых ячеек.

  Deliverable:
  - Создать `components/EditableCell.tsx` или аналогичные небольшие компоненты для text input, select, numeric input и reset action.
  - Использовать устойчивые размеры и compact table styling, чтобы input/select не ломали ширину строк и sticky header.
  - Поддержать dirty visual state для измененной ячейки и reset для конкретного поля.
  - Не превращать read-only поля в disabled inputs; read-only значения должны оставаться обычным текстом.
  - Передать в `DataTable` явный режим активной сущности из `ScrollableDataTable` (`persons`/`families`/`events`/`places`) вместо выбора таблицы по первому непустому массиву.

  Files:
  - `components/EditableCell.tsx`
  - `components/DataTable.tsx`
  - `components/ScrollableDataTable.tsx`

  Dependencies:
  - Depends on Task 3.

  LOGGING REQUIREMENTS:
  - UI controls не логируют ввод пользователя.
  - Ошибки валидации показывать рядом с контролом или через общий UI state, без console output.
  - Внутренние debug-счетчики в production не добавлять.

- [x] Task 6: Реализовать редактирование write-safe полей персон, родов и мест.

  Deliverable:
  - Персоны: редактировать `lastName`, `firstName`, `patronymic`, `gender`, `birthPlaceId`, `deathPlaceId`.
  - Роды: редактировать `familyName`, `husbandLastName`, `wifeLastName`, `comment`, `color`.
  - Места: редактировать `name`, `shortName`, `comment`.
  - Для `birthPlaceId` и `deathPlaceId` использовать select по существующим `places`; добавить clear option для удаления ссылки.
  - Для `birthPlaceId` и `deathPlaceId` не добавлять SQL/preflight-запросы в UI. Минимально: показывать control только там, где исходная parsed-ссылка уже существует, а невозможность записи из-за отсутствующего life-event должна приходить как safe export error через `formatAtdbBuildError`.
  - Для `gender` использовать ограниченный select `M`/`F`/`Unknown` плюс clear, где clear эквивалентен `Unknown`; для `color` использовать numeric input с integer/null semantics.
  - Оставить read-only: `birthDate`, `deathDate`, derived `birthPlace`/`deathPlace` text, `fatherId`, `motherId`, `spouseIds`, `notes`, `occupation`, `motherLastName`, все поля событий.
  - Сортировка должна продолжать работать по отображаемым значениям; dirty draft value должен учитываться в отображении и сортировке ячейки, но не должен мутировать исходный `parsedData`.

  Files:
  - `components/DataTable.tsx`
  - `components/ScrollableDataTable.tsx`
  - `lib/atdbEditDraft.ts`

  Dependencies:
  - Depends on Task 5.

  LOGGING REQUIREMENTS:
  - Не логировать значения редактируемых полей.
  - При невозможности отрендерить select для места показывать safe UI warning без raw record dump.
  - Не выводить в консоль `person`, `family`, `place` объекты целиком.

- [x] Task 7: Добавить панель состояния изменений и действия сброса.

  Deliverable:
  - Показать количество измененных полей и записей рядом с кнопкой скачивания.
  - Добавить действие "Сбросить все изменения" с защитой от случайного клика, если есть несохраненные изменения.
  - Добавить reset для конкретной записи или поля, если это не перегружает текущий table UI; минимально нужен field-level reset через `EditableCell`.
  - При успешном скачивании не очищать draft автоматически, пока пользователь не подтвердил/не загрузил новый файл; поведение должно быть предсказуемым.
  - Обновить success/error сообщения так, чтобы пользователь понимал, что изменения применяются только при скачивании нового файла.

  Files:
  - `app/page.tsx`
  - `components/ScrollableDataTable.tsx`
  - `components/DataTable.tsx`
  - `components/EditableCell.tsx`

  Dependencies:
  - Depends on Task 6.

  LOGGING REQUIREMENTS:
  - UI state changes не писать в console.
  - Ошибки export показывать через safe formatter; console payload только code/issueCount/changes.
  - Не логировать filename, raw rows, GUID, place names или пользовательские строки.

<!-- Commit checkpoint: tasks 5-7 -->

### Phase 3: Проверки
- [x] Task 8: Добавить regression-проверку draft/change-set helper'ов.

  Deliverable:
  - Добавить script-level проверку, например `scripts/check-atdb-edit-draft.mjs`, по существующему проектному паттерну: временная директория, TypeScript `transpileModule` для нужных `lib/**/*.ts`, загрузка helper из compiled output.
  - Скрипт должен быть fixture-free: не читать `.atdb`, не импортировать `sql.js`, не использовать реальные строки из пользовательских баз.
  - Проверить:
    - одно изменение поля превращается в один `AtdbEntityChange`;
    - несколько полей одной записи группируются в одну запись change-set;
    - возврат поля к исходному значению удаляет no-op изменение;
    - reset поля/записи/всего draft очищает соответствующие изменения;
    - `null`/`undefined` сохраняются как clear value, пустая строка остается строкой, `gender` clear остается совместимым с `Unknown`;
    - unsupported/runtime-invalid field не попадает в change-set.
  - Добавить npm script, например `test:atdb:edit-draft`.
  - Не читать пользовательские `.atdb` fixtures в этом тесте; использовать synthetic IDs и synthetic values.

  Files:
  - `scripts/check-atdb-edit-draft.mjs`
  - `package.json`
  - `lib/atdbEditDraft.ts`

  Dependencies:
  - Depends on Tasks 1 and 2.

  LOGGING REQUIREMENTS:
  - Regression output должен содержать только synthetic labels, statuses и counts.
  - Не печатать реальные имена, места, заметки, GUID, raw `ValuesStr`, filenames или paths из пользовательских баз.
  - При failure печатать safe assertion message без дампа всего draft state, если он содержит значения.

- [x] Task 9: Выполнить финальную проверку UI editing flow и ATDB write safety.

  Deliverable:
  - Запустить `npm run lint`.
  - Запустить `npx tsc --noEmit`.
  - Запустить `npm run build`.
  - Запустить новый `npm run test:atdb:edit-draft`.
  - Запустить `npm run test:atdb:rebuild-contract`.
  - Запустить `npm run test:atdb:write-safety`.
  - Запустить `npm run smoke:atdb:matrix`.
  - Запустить `npm run schema:atdb:fixtures:check`.
  - Если local-only fixtures отсутствуют, явно зафиксировать skip behavior и не считать это ошибкой.
  - Ручной UI smoke: загрузить разрешенную fixture, изменить одно поле персоны, одно поле рода, одно место, выбрать/очистить место рождения/смерти при наличии подходящих данных, скачать файл и убедиться, что UI показывает только safe статусы.

  Files:
  - Исправления только в файлах из Tasks 1-8, если проверки выявят проблему.

  Dependencies:
  - Depends on Tasks 1-8.

  LOGGING REQUIREMENTS:
  - Итог проверок фиксировать как команды/statuses, fixture labels, counts и deltas.
  - Не добавлять debug logs в runtime UI ради прохождения проверки.
  - Не печатать raw `.atdb` contents, `ValuesStr.vstr`, GUID, document/source text, имена, места, заметки или локальные private fixture paths.

<!-- Commit checkpoint: tasks 8-9 -->

### Phase 4: Документация
- [x] Task 10: Обновить документацию пользовательского сценария и архитектурные ограничения.

  Deliverable:
  - Обновить `docs/getting-started.md`: описать локальное редактирование write-safe полей, применение изменений только при скачивании, поведение "нет изменений" без сборки и safe skip/failure поведение проверок.
  - Обновить `docs/architecture.md`: заменить "UI пока не формирует `AtdbChangeSet` напрямую" на актуальный поток `UI draft -> AtdbChangeSet -> applyAtdbChanges`.
  - При необходимости обновить `README.md`: кратко перечислить, какие поля редактируются, а какие остаются read-only.
  - Не обновлять `.ai-factory/ROADMAP.md` в рамках implementation; milestone completion должен быть подтвержден через `$aif-verify` / owner workflow после реализации.

  Files:
  - `docs/getting-started.md`
  - `docs/architecture.md`
  - `README.md`

  Dependencies:
  - Depends on Tasks 4, 6 and 9.

  LOGGING REQUIREMENTS:
  - Документация не должна содержать реальные значения из `.atdb`, имена, места, заметки, GUID, document paths, source text или raw `ValuesStr`.
  - Примеры держать на уровне названий полей, статусов, counts и synthetic values.
  - Не добавлять скриншоты или дампы пользовательской базы.

<!-- Commit checkpoint: task 10 -->
