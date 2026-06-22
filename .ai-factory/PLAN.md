# Implementation Plan: Устранение parse-build drift

Branch: codex/universal-atdb-mapping-docs
Created: 2026-06-22

## Settings
- Testing: yes
- Logging: standard
- Docs: yes

## Roadmap Linkage
Milestone: "Устранение parse-build drift"
Rationale: План закрепляет уже достигнутый нулевой `parse -> build -> reparse` drift как блокирующий regression gate перед расширением обратной сборки `.atdb`.

## Research Context
Source: `.ai-factory/RESEARCH.md` (Active Summary), `.ai-factory/ROADMAP.md`, текущий `$aif-explore ROADMAP "Устранение parse-build drift"`.

Goal:
- Запретить неявное изменение counts после `parse -> build -> reparse` на разрешённых ATDB-fixtures.

Constraints:
- SQL-логика остаётся в `lib/`; UI не должен напрямую работать со схемой SQLite.
- Вывод проверок и документация не должны содержать персональные строки, GUID, места, заметки, raw `ValuesStr` или локальные пути к private fixtures.
- Local-only fixtures `yaman-full` и `family` должны по-прежнему корректно пропускаться, если файлы отсутствуют.

Decisions:
- Текущий локальный `npm run smoke:atdb:matrix` показывает нулевой drift для `yaman`, `yaman-full` и `family`.
- Исторические значения `665 -> 678` и `7586 -> 8116` считать историческим контекстом, а не текущим поведением.
- Цель milestone теперь не широкий ремонт writers, а перевод drift из warn-only сигнала в hard-fail gate.

Open questions:
- Нужен ли отдельный npm-скрипт для regression-проверок fixture gates или достаточно расширить существующий `test:atdb:fixtures:missing-local`.

Success signals:
- Любой ненулевой drift по `persons`, `families`, `events` или `places` завершает smoke/gate проверку с ошибкой.
- `npm run schema:atdb:fixtures:check` падает при drift, но продолжает пропускать отсутствующие local-only fixtures.
- Документация и roadmap больше не описывают исторический drift как активную текущую проблему.

## Commit Plan
- **Commit 1** (after tasks 1-3): `test(atdb): fail on parse-build drift`
- **Commit 2** (after tasks 4-5): `docs(atdb): document drift gate semantics`

## Tasks

### Phase 1: Сделать drift блокирующим
- [x] Task 1: Перевести `scripts/smoke-atdb.mjs` с warn-only поведения на hard-fail при любом ненулевом drift.

  Deliverable:
  - После успешных `parse`, `build` и `reparse` скрипт сравнивает counts `persons`, `families`, `events`, `places`.
  - Если любой delta не равен `0`, скрипт печатает безопасные `drift-*` строки, статус failure и выставляет ненулевой `process.exitCode`.
  - При нулевом drift текущий success output сохраняется.
  - Missing local fixture behavior остаётся safe skip, а не failure.

  Files:
  - `scripts/smoke-atdb.mjs`

  LOGGING REQUIREMENTS:
  - Печатать только fixture label, статусы фаз, размеры, counts и drift deltas.
  - Не печатать raw rows, имена, места, заметки, GUID, `ValuesStr.vstr`, document/source text или локальные пути.
  - Ошибки drift формулировать как безопасный gate failure без дампа данных.

- [x] Task 2: Обновить matrix wrapper, чтобы `scripts/check-atdb-fixtures.mjs` явно отображал и наследовал hard-fail drift gate.

  Deliverable:
  - `runSmokeMatrix()` сохраняет текущую пропускную модель для отсутствующих local-only fixtures.
  - Summary matrix показывает deltas по всем отслеживаемым сущностям, а не только `deltaEvents`.
  - Если `scripts/smoke-atdb.mjs` падает из-за drift, `smoke:atdb:matrix` и `schema:atdb:fixtures:check` тоже падают.
  - Safe output остаётся пригодным для redaction gate.

  Files:
  - `scripts/check-atdb-fixtures.mjs`

  LOGGING REQUIREMENTS:
  - В обычном режиме выводить только labels, статусы и числовые deltas.
  - Подробный режим может показывать выбранный fixture label, но не абсолютные пути и не содержимое базы.
  - Ошибки wrapper должны ссылаться на label fixture и фазу, без пользовательских данных.

- [x] Task 3: Добавить regression-проверку failure-пути drift gate без изменения реальных `.atdb` fixtures.

  Deliverable:
  - Расширить существующий regression harness или добавить новый скрипт, который в temp directory моделирует smoke output с ненулевым drift и проверяет, что matrix/gate завершается ошибкой.
  - Сохранить отдельную проверку missing-local behavior: отсутствующие local-only fixtures остаются skip/success.
  - Если добавляется новый npm-скрипт, добавить его в `package.json` и включить в финальный gate.

  Files:
  - `scripts/check-atdb-fixtures-regression.mjs` или новый `scripts/check-atdb-drift-gate-regression.mjs`
  - `package.json` при добавлении нового npm-скрипта

  LOGGING REQUIREMENTS:
  - Regression output должен содержать только synthetic labels/statuses/deltas.
  - Не читать пользовательские `.atdb` для моделирования failure-пути.
  - Не выводить temp absolute paths, если они не нужны для диагностики сбоя.

<!-- Commit checkpoint: tasks 1-3 -->

### Phase 2: Синхронизировать документацию и завершить gate
- [x] Task 4: Обновить документацию и roadmap-формулировки под новую семантику hard-fail drift gate.

  Deliverable:
  - В `docs/atdb_multi_fixture_schema.md` заменить описание drift как warn-only на hard-fail для `parse/build/reparse` count deltas.
  - В `docs/atdb_schema_yaman.md` оставить исторический drift как historical note и явно указать, что текущий gate должен блокировать его повторение.
  - В `docs/getting-started.md` описать, что `smoke:atdb:matrix` и `schema:atdb:fixtures:check` падают при ненулевом drift.
  - В `.ai-factory/ROADMAP.md` обновить активный milestone: убрать формулировку, будто увеличение counts всё ещё текущая проблема, и описать закрепление regression gate.

  Files:
  - `docs/atdb_multi_fixture_schema.md`
  - `docs/atdb_schema_yaman.md`
  - `docs/getting-started.md`
  - `.ai-factory/ROADMAP.md`

  LOGGING REQUIREMENTS:
  - Документация не должна включать raw data, имена, места, заметки, GUID, локальные пути или содержимое `ValuesStr`.
  - Примеры вывода держать на уровне labels/count deltas/statuses.
  - Исторические drift values можно упоминать только как агрегированные counts.

- [x] Task 5: Выполнить финальную проверку drift gate и общего качества.

  Deliverable:
  - Запустить `npm run lint`.
  - Запустить `npm run smoke:atdb:matrix`.
  - Запустить `npm run schema:atdb:fixtures:check`.
  - Запустить regression-проверку из Task 3.
  - Если local-only fixtures отсутствуют, явно подтвердить skip behavior и не считать это ошибкой.
  - Если доступные fixtures показывают drift, не маскировать failure: вернуться к Task 1-2 или локализовать writer/read path отдельной правкой в рамках этого плана.

  Files:
  - Исправления только в файлах из Tasks 1-4, если проверки выявят ошибку.

  LOGGING REQUIREMENTS:
  - Итоговый вывод команд должен содержать только статусы, fixture labels, counts и deltas.
  - Не добавлять debug logs в `app/`, `components/` или runtime `lib/` ради этого gate.
  - При падении проверки фиксировать safe error message без дампа пользовательских данных.

<!-- Commit checkpoint: tasks 4-5 -->
