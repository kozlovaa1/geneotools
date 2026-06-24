---
archived: 2026-06-24
---

# Implementation Plan: Проверка схемы на нескольких ATDB-fixtures

Branch: codex/proverka-skhemy-na-neskolkikh-atdb-fixtures
Created: 2026-06-02

## Settings
- Testing: yes
- Logging: verbose
- Docs: yes

## Roadmap Linkage
Milestone: "Проверка схемы на нескольких ATDB-fixtures"
Rationale: План расширяет безопасный schema-check с одной эталонной базы `yaman-test.atdb` на набор разрешенных fixtures: `yaman-test.atdb`, `yaman-test-full.atdb`, `family-test.atdb`.

## Research Context
Source: .ai-factory/RESEARCH.md (Active Summary)

Goal:
Зафиксировать подтвержденную структуру тестовой `.atdb` базы и разрыв между фактической схемой, документацией и текущим parser/build mapping.

Constraints:
- `yaman-test.atdb` разрешена пользователем как публично доступная персональная fixture, но выводы и артефакты должны оставаться без персональных строк, GUID, мест, заметок и содержимого `ValuesStr`.
- SQL-логика остается в `lib/`; UI не должен напрямую работать со схемой SQLite.
- Новый multi-fixture контур должен отделять confirmed/invariant observations от fixture-specific differences и known parser/build drift.

Decisions:
- Использовать `yaman-test.atdb` как baseline fixture.
- Добавить в проверку `yaman-test-full.atdb` и `family-test.atdb` как дополнительные разрешенные fixtures.
- Проверять `rec_table`, `Fields`, `EventTypes`, `EventRoles`, `Values*` и parse/build counts только в redacted/structural виде.

Open questions:
- Какие расхождения между fixtures считать допустимой вариативностью схемы, а какие должны блокировать дальнейший mapping.
- Нужно ли хранить redacted snapshots всех fixtures в git, или часть snapshots должна оставаться local-only.
- Должен ли текущий milestone только фиксировать drift, или уже добавлять fail-fast gate для parse/build counts.

## Commit Plan
- **Commit 1** (after tasks 1-3): `test: add multi-fixture atdb schema harness`
- **Commit 2** (after tasks 4-6): `docs: document multi-fixture atdb schema comparison`
- **Commit 3** (after tasks 7-8): `test: verify atdb fixture schema gates`

## Tasks

### Phase 1: Scope Fixtures And Safety Rules
- [x] Task 1: Зафиксировать allow-list fixtures и политику redaction для multi-fixture проверки.

  Создать или обновить конфигурацию/константы для разрешенных fixtures: `yaman-test.atdb`, `yaman-test-full.atdb`, `family-test.atdb`. Зафиксировать, что `yaman-test.atdb` является tracked research fixture, а `yaman-test-full.atdb` и `family-test.atdb` сейчас существуют как local-only fixtures под действующим `.gitignore` (`*.atdb`) и не должны попадать в git без отдельного осознанного решения. Определить, какие outputs можно сохранять в tracked artifacts, а какие должны оставаться local-only. Проверить, что scripts не читают `.env`, не сканируют произвольные пользовательские `.atdb` и не печатают raw rows.

  Files: `scripts/inspect-atdb-schema.mjs`, `scripts/diff-atdb-schema.mjs`, `docs/getting-started.md`, possibly `docs/atdb_fixtures/README.md`.

  LOGGING REQUIREMENTS:
  - DEBUG: выбранный fixture label, режим redaction, относительный путь output, список включенных structural sections.
  - INFO: status, fixture-bytes, artifact-version, snapshot/check result.
  - WARN: fixture missing, skipped local-only fixture, unsupported snapshot mode.
  - ERROR: только тип ошибки и безопасное сообщение без `ValuesStr.vstr`, GUID, имен, мест, заметок, document paths или source text.

### Phase 2: Build Multi-Fixture Schema Harness
- [x] Task 2: Расширить schema inspection на batch/matrix режим для нескольких fixtures.

  Добавить отдельный script или режим существующего `scripts/inspect-atdb-schema.mjs`, который последовательно запускает structural-only inspection для allow-list fixtures и пишет redacted snapshots в предсказуемые paths. Для non-default fixtures требовать явный output или fixture label, чтобы не перезаписывать `docs/atdb_schema_yaman.snapshot.json`. Вынести labels, resolved paths, tracked/local-only status и output paths в единый fixture registry/helper или в один wrapper, потому что сейчас `inspect-atdb-schema.mjs` по умолчанию смотрит на root `yaman-test.atdb`, а `smoke-atdb.mjs` смотрит на `scripts/fixtures/local-smoke.atdb`.

  Files: `scripts/inspect-atdb-schema.mjs`, optionally `scripts/check-atdb-fixtures.mjs`, `package.json`.

  LOGGING REQUIREMENTS:
  - DEBUG: для каждой fixture логировать label, normalized relative path и output path.
  - INFO: safe summary по каждой fixture: tables count, rec-table-codes count, values-link-groups count, orphan-checks count.
  - WARN: fixture skipped because missing или local-only snapshot не должен быть tracked.
  - ERROR: failure label и safe error message без данных из пользовательских таблиц.

- [x] Task 3: Добавить schema comparison для baseline vs `yaman-test-full.atdb` и `family-test.atdb`.

  Расширить `scripts/diff-atdb-schema.mjs` или добавить wrapper, который сравнивает redacted snapshots с baseline `yaman-test.atdb` по `recTableDistribution`, `fieldCatalog`, `eventTypes`, `eventRoles`, `valuesDistribution`, `valuesLinksTargets` и table row counts. Output должен показывать только structural deltas и watched rec_tables. Явно определить exit-code semantics для multi-fixture wrapper: ожидаемые baseline-vs-fixture deltas не должны автоматически давать failure, потому что текущий `diff-atdb-schema.mjs` возвращает `1` при любом diff. Hard-fail только для unsafe artifact, missing required section, invalid SQLite, unsupported artifact или broken script execution; fixture-specific differences идут как warn-only до появления утвержденных invariant gates.

  Files: `scripts/diff-atdb-schema.mjs`, optionally `scripts/check-atdb-fixtures.mjs`, `package.json`.

  LOGGING REQUIREMENTS:
  - DEBUG: diff pair labels, compared sections, watched rec_tables.
  - INFO: changes count, affected-rec-tables, watched-rec-tables, section-level summary.
  - WARN: большие diff summaries должны обрезаться с указанием количества скрытых structural changes.
  - ERROR: unsupported artifact, unsafe artifact или missing input без дампа snapshot contents.

### Phase 3: Capture Parse/Build Counts Without Fixing Drift
- [x] Task 4: Добавить parse/build count matrix для трех fixtures.

  Расширить `scripts/smoke-atdb.mjs` или добавить отдельный matrix wrapper, который для каждой fixture фиксирует counts `persons`, `families`, `events`, `places` после parse и после build/reparse. Output matrix должен включать fixture label, parse/build/reparse status, entity counts и count deltas; single-fixture skipped behavior для отсутствующей локальной fixture нужно сохранить. На этом milestone drift нужно документировать как диагностический факт, а не автоматически исправлять build-side mapping.

  Files: `scripts/smoke-atdb.mjs`, optionally `scripts/check-atdb-fixtures.mjs`, `package.json`.

  LOGGING REQUIREMENTS:
  - DEBUG: fixture label, phase start/end, selected smoke mode.
  - INFO: parse/build/reparse status и безопасные entity counts.
  - WARN: known drift detected with count deltas only.
  - ERROR: phase failure status and safe error message; не выводить персональные values, GUID или paths from DB records.

- [x] Task 5: Определить baseline expectations и допустимые gates для multi-fixture проверки.

  Сформулировать, какие проверки должны быть hard-fail: redaction metadata, required sections, валидность SQLite, наличие базовых tables/sections. Отдельно определить warn-only сигналы: parse/build drift, fixture-specific `Fields`/`EventRoles` differences, missing optional tables. Не смешивать этот task с исправлением reader/writer mapping.

  Files: `scripts/inspect-atdb-schema.mjs`, `scripts/diff-atdb-schema.mjs`, optional matrix script, `docs/atdb_multi_fixture_schema.md`.

  LOGGING REQUIREMENTS:
  - DEBUG: примененные gate rules и reasons.
  - INFO: hard-fail checks passed, warn-only findings count.
  - WARN: fixture-specific differences and parse/build drift with counts only.
  - ERROR: only for unsafe artifacts, missing required sections, invalid SQLite или broken script execution.

### Phase 4: Document Multi-Fixture Findings
- [x] Task 6: Создать redacted documentation artifact по сравнению fixtures.

  Добавить документ, который сравнивает `yaman-test.atdb`, `yaman-test-full.atdb`, `family-test.atdb` по структурным признакам: `rec_table`, `Fields`, `EventTypes`, `EventRoles`, `ValuesStr`, `ValuesNum`, `ValuesDates`, `ValuesLinks`, orphan checks и parse/build counts. Разделить `confirmed across fixtures`, `fixture-specific observations`, `needs more samples`, `known drift`. Переиспользовать правила redacted artifacts из `docs/atdb_experiments/README.md`; если добавляется новый `docs/atdb_multi_fixture_schema.md`, явно связать его с существующими artifact rules вместо создания конкурирующего формата.

  Files: `docs/atdb_multi_fixture_schema.md`, `docs/atdb_format.md`.

  LOGGING REQUIREMENTS:
  - Документ не должен включать raw `ValuesStr`, GUID, имена, места, заметки, document paths или source text.
  - В markdown фиксировать только counts, IDs, table names, f_id, rec_table, value table names, link target table codes и confidence labels.
  - Любые примеры команд должны использовать safe scripts и redacted outputs.
  - Если для интерпретации нужны реальные значения, формулировать вопрос к пользователю без записи значений в artifact.

- [x] Task 7: Обновить README/getting-started инструкции для нового quality gate.

  Добавить краткий запуск multi-fixture schema-check и smoke matrix рядом с `npm run lint`, `npm run build`, `npm run smoke:atdb`, `npm run schema:atdb:diff:check`. Явно указать, что пользовательские `.atdb` с реальными данными нельзя коммитить без осознанного разрешения.

  Files: `README.md`, `docs/getting-started.md`, `package.json`.

  LOGGING REQUIREMENTS:
  - Documentation examples must show only status/count output.
  - Не включать sample rows, names, places, notes, GUID или raw values.
  - Если fixtures отсутствуют, инструкция должна описывать graceful skip или local-only setup.

### Phase 5: Verification
- [x] Task 8: Выполнить финальные проверки и зафиксировать безопасный результат.

  Запустить `npm run lint`, `npm run build`, `npm run smoke:atdb`, существующие schema checks и новый multi-fixture gate. Проверить, что snapshots/artifacts не содержат запрещенных персональных значений и что UI не получил SQL-зависимости. Добавить конкретную redaction-проверку generated markdown/json artifacts на отсутствие запрещенных полей и маркеров: `ValuesStr.vstr`, raw `guid`, document paths, source text, notes, names, places, local-only snapshot paths и private/debug/raw artifacts. Если parse/build drift сохраняется, зафиксировать его как input для milestone "Устранение parse-build drift".

  Files: `package.json`, `scripts/*.mjs`, `docs/atdb_multi_fixture_schema.md`, `docs/atdb_format.md`, `docs/getting-started.md`.

  LOGGING REQUIREMENTS:
  - Итоговый отчет должен содержать только command status, fixture labels, counts and drift deltas.
  - Не печатать или сохранять raw `.atdb` contents, `ValuesStr.vstr`, GUID, document paths, source text, имена, места или заметки.
  - Если проверка не запускается из-за отсутствующей fixture, явно указать skipped fixture и следующий минимальный шаг.
