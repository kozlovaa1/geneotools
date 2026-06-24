---
archived: 2026-06-24
---

# Implementation Plan: Эксперименты по неопределённым ATDB-сущностям

Branch: codex/eksperimenty-po-neopredelyonnym-atdb-sushchnostyam
Created: 2026-06-01

## Settings
- Testing: yes
- Logging: verbose
- Docs: yes

## Roadmap Linkage
Milestone: "Эксперименты по неопределённым ATDB-сущностям"
Rationale: План закрывает следующий roadmap milestone после базового исследования `yaman-test-full.atdb` через controlled diff-эксперименты по `rec_table=8`, `18`, `21`, пользовательским ролям событий, "Полям данных" и полям со статусом `unknown` / `needs more samples`.

## Research Context
Source: .ai-factory/RESEARCH.md (Active Summary)

Goal:
- Зафиксировать подтвержденную структуру тестовой `.atdb` базы и разрыв между фактической схемой, документацией и текущим parser/build mapping.

Constraints:
- `yaman-test.atdb` разрешена пользователем как публично доступная персональная fixture, но выводы и артефакты должны оставаться без персональных строк, GUID, мест, заметок и содержимого `ValuesStr`.
- SQL-логика остается в `lib/`; UI не должен напрямую работать со схемой SQLite.
- План должен отделять подтвержденные факты от legacy fallback-поведения.

Decisions:
- Использовать `yaman-test.atdb` как разрешенную исследовательскую fixture.
- Считать подтвержденными для этой базы `rec_table`: `7 -> Events`, `9 -> Families`, `13 -> Persons`, `14 -> Places`.
- Считать `Fields.area` ненадежным источником семантики.
- Полезная нагрузка событий в `ValuesDates`, `ValuesLinks`, `ValuesStr`, `ValuesNum` при `rec_table = 7` привязана к `Events.id`, а не к `EventDetails.id`.

Open questions:
- Как подтвердить `rec_table=8`, `18`, `21` и другие low-count служебные записи без публикации чувствительных значений.
- Как подтвердить ID-pattern для пользовательских ролей событий (`rec_table=6`) и "Полей данных" (`rec_table=10`) через controlled diff.
- Какие результаты должны перейти в универсальный mapping, а какие остаться fixture-specific observations.

## Commit Plan
- **Commit 1** (after tasks 1-6): "test: add atdb controlled diff experiment harness"
- **Commit 2** (after tasks 7-9): "docs: document unresolved atdb entity experiments"
- **Commit 3** (after tasks 10-11): "test: verify atdb experiment artifacts"

## Tasks

### Phase 1: Experiment Harness
- [x] Task 1: Спроектировать безопасный формат controlled diff artifacts для ATDB-экспериментов.

  Deliverable: определить структуру файлов для baseline/after snapshots и diff summaries, например `docs/atdb_experiments/README.md` и JSON/Markdown artifacts с redacted fields. Формат должен расширять существующий redacted snapshot contract из `scripts/inspect-atdb-schema.mjs` и `docs/atdb_schema_yaman.snapshot.json`, а не вводить параллельный формат с нуля. Artifact должен фиксировать только table names, counts, `rec_table`, `rec_id` shape, `f_id`, `datatype`, link targets и confidence labels; запрещены raw `ValuesStr.vstr`, GUID, document paths, source text и персональные значения.

  Files: `docs/atdb_experiments/README.md`, при необходимости `scripts/inspect-atdb-schema.mjs`

  LOGGING REQUIREMENTS:
  - DEBUG: логировать выбранные входные/выходные пути, режим redaction и список включенных секций snapshot.
  - INFO: логировать начало и успешное завершение генерации artifact.
  - WARN: логировать пропуск optional-секций из-за отсутствующих таблиц/колонок.
  - ERROR: логировать только безопасные сообщения ошибок без SQL rows и пользовательских значений.

- [x] Task 2: Добавить gitignore policy для локальных experiment artifacts.

  Deliverable: расширить `.gitignore` правилами для локальных experiment runs, verbose/debug logs, temporary before/after snapshots и приватных Markdown summaries внутри `docs/atdb_experiments/`. Tracked должны оставаться только redacted templates, README и curated public summaries; локальные artifacts не должны попадать в git даже при запуске CLI в verbose/debug mode.

  Files: `.gitignore`, `docs/atdb_experiments/README.md`

  LOGGING REQUIREMENTS:
  - DEBUG: не применимо к `.gitignore`, но README должен описывать локальные пути verbose/debug artifacts.
  - INFO: README должен явно отделять tracked public artifacts от ignored local artifacts.
  - WARN: README должен предупреждать, что before/after `.atdb`, raw logs и private snapshots не коммитятся.
  - ERROR: README должен описывать safe failure handling без вставки raw rows.

- [x] Task 3: Версионировать формат snapshot/diff artifacts.

  Deliverable: добавить в snapshot/diff artifacts явный `artifactVersion` или `schemaVersion`, `generatedBy`, redaction policy и список секций. Diff CLI должен проверять версию входных snapshot-файлов и безопасно завершаться с понятной ошибкой при неподдерживаемом формате.

  Files: `scripts/inspect-atdb-schema.mjs`, `scripts/diff-atdb-schema.mjs`, `docs/atdb_experiments/README.md`

  LOGGING REQUIREMENTS:
  - DEBUG: логировать обнаруженную artifact version и список проверенных секций.
  - INFO: логировать поддерживаемую artifact version при успешной генерации/проверке.
  - WARN: логировать пропуск optional-секций старых artifacts, если это явно поддержано.
  - ERROR: логировать safe error для неподдерживаемой версии без содержимого snapshot rows.

- [x] Task 4: Добавить CLI-сценарий сравнения двух ATDB snapshot-файлов.

  Deliverable: создать или расширить script, который принимает baseline и modified `.atdb` или snapshot JSON, строит redacted diff по `Recs`, `ValuesStr`, `ValuesNum`, `ValuesDates`, `ValuesLinks`, `Fields`, `EventRoles`, `EventTypes` и выводит структурные изменения. Для `.atdb` входов сценарий должен строить temporary redacted snapshots и сравнивать только sanitized структуры. Diff output должен иметь deterministic sorting, стабильные exit codes для `success`, `diff found`, `unsupported input`, `unsafe artifact`, `failure`, и не должен печатать raw row dumps. Скрипт должен явно подсвечивать изменения по `rec_table=6`, `8`, `10`, `18`, `21` и неизвестным `f_id`.

  Files: `scripts/inspect-atdb-schema.mjs`, возможно новый `scripts/diff-atdb-schema.mjs`, `package.json`

  LOGGING REQUIREMENTS:
  - DEBUG: логировать количество строк до/после по каждой проверяемой таблице и список секций diff.
  - INFO: логировать summary changes по counts и affected `rec_table`.
  - WARN: логировать неизвестные таблицы/поля и невозможность сравнения отдельных секций.
  - ERROR: логировать безопасную причину сбоя без дампа значений.

- [x] Task 5: Добавить npm-команды и smoke-check для diff harness.

  Deliverable: добавить команды в существующий namespace `schema:atdb`, например `npm run schema:atdb:diff` и `npm run schema:atdb:diff:check`, а также check-mode, который можно запускать без локальных персональных значений. Сохранить совместимость с текущими командами `schema:atdb`, `schema:atdb:check`, `schema:atdb:check:yaman`. Проверка должна проходить на существующем redacted snapshot и не требовать публикации `.atdb`, если fixture отсутствует.

  Files: `package.json`, `scripts/inspect-atdb-schema.mjs`, `scripts/diff-atdb-schema.mjs`, `docs/getting-started.md`

  LOGGING REQUIREMENTS:
  - DEBUG: логировать resolved fixture path только как путь, без содержимого базы.
  - INFO: логировать status `skipped` при отсутствии local fixture и `success` при успешном check.
  - WARN: логировать отсутствие optional fixture как ожидаемое состояние.
  - ERROR: логировать failure code и безопасное имя failed check.

- [x] Task 6: Добавить check по tracked redacted snapshot без `.atdb` fixture.

  Deliverable: реализовать проверку, которая читает `docs/atdb_schema_yaman.snapshot.json` или другой tracked redacted snapshot, валидирует artifact version, redaction marker, required sections и минимальные structural invariants без доступа к локальной `.atdb` базе. Эта проверка должна быть частью `schema:atdb:diff:check` или отдельной `schema:atdb:snapshot:check` команды и должна проходить в окружении без `yaman-test.atdb`.

  Files: `scripts/inspect-atdb-schema.mjs`, `scripts/diff-atdb-schema.mjs`, `package.json`, `docs/getting-started.md`

  LOGGING REQUIREMENTS:
  - DEBUG: логировать путь проверяемого redacted snapshot и список validated sections.
  - INFO: логировать `success` при валидном tracked snapshot.
  - WARN: логировать отсутствие optional local fixture отдельно от snapshot-check результата.
  - ERROR: логировать safe failure code и имя failed invariant без raw values.

### Phase 2: Controlled Diff Scenarios
- [x] Task 7: Описать протокол ручных экспериментов в "Древо Жизни 6".

  Deliverable: документировать пошаговые сценарии создания minimal before/after баз: добавить пользовательскую роль события, добавить/изменить "Поле данных" для персоны и события, создать сущность/операцию для проверки `rec_table=8`, `18`, `21`, а также изолировать один change per file. Протокол должен начинаться с discovery step: зафиксировать baseline `rec_table` distribution и low-count/unknown candidates, включая `8`, `18`, `21`, перед выбором UI-действия. Протокол должен требовать сохранения исходной и измененной базы локально и анализа только через redacted diff.

  Files: `docs/atdb_experiments/README.md`, `docs/atdb_schema_yaman_validation.md`

  LOGGING REQUIREMENTS:
  - DEBUG: не применимо к markdown, но инструкции должны требовать DEBUG-логов от CLI при запуске экспериментов.
  - INFO: документ должен описывать expected summary lines для каждого эксперимента.
  - WARN: документ должен явно предупреждать о запрете публикации raw values.
  - ERROR: документ должен описывать, какие ошибки считать blocker для интерпретации diff.

- [x] Task 8: Создать шаблон experiment result для `rec_table=6` и `rec_table=10`.

  Deliverable: добавить Markdown-шаблон, куда пользователь или агент сможет перенести только redacted diff evidence: affected tables, new/deleted rows counts, linked `Fields.id`, `EventRoles.id`, `EventTypes.id`, `rec_table`, confidence, unresolved questions. Отдельно зафиксировать expected hypotheses: `rec_table=6` как пользовательские роли событий и `rec_table=10` как "Поля данных".

  Files: `docs/atdb_experiments/role-and-field-experiment-template.md`, `docs/atdb_schema_yaman_validation.md`

  LOGGING REQUIREMENTS:
  - DEBUG: шаблон должен включать место для CLI debug run id/path.
  - INFO: шаблон должен включать summary counts.
  - WARN: шаблон должен включать список redaction warnings.
  - ERROR: шаблон должен включать поле для safe error summary.

- [x] Task 9: Создать шаблон experiment result для `rec_table=8`, `18`, `21` и прочих unknown.

  Deliverable: добавить Markdown-шаблон для low-count/unknown сущностей, где фиксируются только структурные изменения и связь с UI-действием в "Древо Жизни 6". План должен предусмотреть статус `confirmed`, `observed`, `needs more samples`, `unknown` и запрет на повышение confidence без повторяемого diff evidence.

  Files: `docs/atdb_experiments/unknown-rec-table-experiment-template.md`, `docs/atdb_schema_yaman_validation.md`

  LOGGING REQUIREMENTS:
  - DEBUG: шаблон должен ссылаться на полный verbose CLI log как локальный artifact, не включаемый в git.
  - INFO: шаблон должен фиксировать affected `rec_table` и row count deltas.
  - WARN: шаблон должен фиксировать ambiguity warnings.
  - ERROR: шаблон должен фиксировать safe failure reason.

### Phase 3: Documentation and Verification
- [x] Task 10: Обновить ATDB-документацию под controlled experiment workflow.

  Deliverable: добавить в `docs/atdb_format.md` и `docs/atdb_schema_yaman_validation.md` разделы о том, какие сущности требуют controlled diff, какие уже подтверждены, и как переносить evidence из экспериментов в публичную документацию. Документация должна ссылаться на templates из Tasks 8-9 и правила confidence escalation: `confirmed`, `observed`, `needs more samples`, `unknown`. Не менять parser/build mapping в этом плане, кроме вспомогательных redacted tooling changes.

  Files: `docs/atdb_format.md`, `docs/atdb_schema_yaman_validation.md`, `docs/atdb_experiments/README.md`

  LOGGING REQUIREMENTS:
  - DEBUG: не применимо к markdown, но документация должна требовать запуска CLI с verbose/debug при сборе evidence.
  - INFO: документация должна показывать безопасный expected output summary.
  - WARN: документация должна повторять redaction policy.
  - ERROR: документация должна описывать safe failure handling.

- [x] Task 11: Запустить релевантные проверки и зафиксировать test gate.

  Deliverable: выполнить `npm run lint`, `npm run schema:atdb:check`, новую snapshot/diff check-команду для существующего redacted snapshot и, если локальная fixture доступна, `npm run smoke:atdb` / `ATDB_SCHEMA_FIXTURE=...` check без публикации raw values. Обновить docs при изменении команд запуска.

  Files: `package.json`, `docs/getting-started.md`, `scripts/*.mjs`

  LOGGING REQUIREMENTS:
  - DEBUG: фиксировать команды и sanitized paths, используемые в локальной проверке.
  - INFO: фиксировать итог каждого check.
  - WARN: фиксировать skipped checks из-за отсутствия локальной fixture.
  - ERROR: фиксировать failed command и безопасный summary без содержимого `.atdb`.
