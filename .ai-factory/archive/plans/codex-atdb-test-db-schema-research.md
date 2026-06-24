---
archived: 2026-06-24
---

# Implementation Plan: Исследование тестовой базы ATDB

Branch: codex/atdb-test-db-schema-research
Created: 2026-05-28

## Settings
- Testing: yes
- Logging: standard
- Docs: yes

## Roadmap Linkage
Milestone: "Исследование тестовой базы ATDB"
Rationale: План закрывает roadmap-задачу по уточнению фактической схемы таблиц, `Fields`, `ValuesStr`, `ValuesDates`, `ValuesLinks`, `EventDetails` и связей между записями на эталонной тестовой базе.

## Research Context

Topic: Исследование тестовой базы ATDB `yaman-test.atdb`

Goal: Зафиксировать подтвержденную структуру тестовой `.atdb` базы и разрыв между фактической схемой, документацией и текущим parser/build mapping.

Constraints:
- `yaman-test.atdb` разрешена пользователем как публично доступная персональная fixture, но выводы и артефакты должны оставаться без персональных строк, GUID, мест, заметок и содержимого `ValuesStr`.
- SQL-логика остается в `lib/`; UI не должен напрямую работать со схемой SQLite.
- План должен отделять подтвержденные факты от вероятных смыслов и legacy fallback-поведения.

Decisions:
- Использовать `yaman-test.atdb` как разрешенную исследовательскую fixture.
- Считать подтвержденными для этой базы `rec_table`: `7 -> Events`, `9 -> Families`, `13 -> Persons`, `14 -> Places`.
- Считать `Fields.area` ненадежным источником семантики: почти все `area` равны `NULL`, кроме части полей персон.
- Полезная нагрузка событий в `ValuesDates`, `ValuesLinks`, `ValuesStr`, `ValuesNum` при `rec_table = 7` привязана к `Events.id`, а не к `EventDetails.id`.

Open questions:
- Нужно ли хранить `yaman-test.atdb` как tracked fixture, или оставить ее локальной разрешенной fixture с `ATDB_SMOKE_FIXTURE`.
- Как именно разделить в коде `confirmed mapping`, `observed mapping` и `legacy fallback` для вариативных ATDB-схем.
- Должен ли следующий plan исправлять только read-side mapping или сразу затрагивать build-side drift.

Success signals:
- Итоговая документация содержит полную схему смыслов таблиц/колонок и каталог `rec_table`, `f_id`, `EventTypes`, `EventRoles`, `Values*` по `yaman-test.atdb`.
- Все неоднозначные смыслы явно помечены как `unknown` или `needs user validation`, а не выданы за факт.
- Подготовлен вход для следующего milestone "Централизованный mapping формата ATDB".

## Scope

Этот план не исправляет parser/build mapping в `lib/atdb/*`. Его результат — воспроизводимое исследование и документация схемы `yaman-test.atdb`, включая пользовательскую валидацию неоднозначных смыслов.

Разрешенные изменения:
- безопасные исследовательские скрипты в `scripts/`;
- документация в `docs/`;
- npm-скрипт для безопасного schema-check, если он нужен;
- обновление `.gitignore` только если требуется явно закрепить политику fixture.

Неразрешенные изменения в рамках этого milestone:
- массовая правка readers/writers;
- изменение пользовательского UI;
- запись персональных значений из `.atdb` в git-tracked artifacts.

## Tasks

### Phase 1: Зафиксировать воспроизводимый безопасный контур исследования

- [x] Task 1: Определить политику fixture и входные параметры анализа.

  Проверить текущий статус `yaman-test.atdb`, `.gitignore`, `scripts/smoke-atdb.mjs` и README-инструкции. Зафиксировать в плане выполнения, используется ли база как tracked fixture или как локальный файл через `ATDB_SMOKE_FIXTURE`. Если файл не должен коммититься, добавить или подтвердить безопасное правило игнорирования без удаления локального файла.

  Files: `.gitignore`, `README.md`, `scripts/smoke-atdb.mjs`, `yaman-test.atdb`.

  LOGGING REQUIREMENTS:
  - Не печатать содержимое `.atdb`, имена персон, места, GUID, notes или строки `ValuesStr`.
  - Допустимо выводить только путь к fixture, размер файла, наличие файла и агрегированные счетчики.
  - Если fixture отсутствует, команда должна завершаться понятным skip/status без дампа ошибки.

- [x] Task 2: Добавить безопасный скрипт структурной инвентаризации ATDB.

  Создать `scripts/inspect-atdb-schema.mjs`, который через `sql.js` читает fixture и выводит/сохраняет только безопасные агрегаты: список таблиц, `PRAGMA table_info`, counts, `Recs.rec_table`, распределения `Values*` по `rec_table/f_id`, `ValuesLinks` по source/target, `EventTypes`, `EventRoles`, orphan-check относительно `Recs`. Скрипт должен принимать путь через `ATDB_SCHEMA_FIXTURE` или аргумент CLI и не выводить пользовательские строки.

  Files: `scripts/inspect-atdb-schema.mjs`, `package.json`.

  LOGGING REQUIREMENTS:
  - Prefix логов: `[safe-atdb-schema]`.
  - Standard logging: start/status, fixture-bytes, counts, output path, success/failure.
  - Не логировать `vstr`, `guid`, `srcguid`, `params`, document paths, source text, place names или person names.

- [x] Task 3: Зафиксировать machine-readable snapshot для проверки документации.

  Добавить возможность `scripts/inspect-atdb-schema.mjs` сохранять redacted JSON snapshot в `docs/atdb_schema_yaman.snapshot.json` или аналогичный безопасный артефакт. Snapshot должен содержать только структурные данные и агрегаты, чтобы документация могла проверяться без повторного ручного SQL-прогона.

  Files: `scripts/inspect-atdb-schema.mjs`, `docs/atdb_schema_yaman.snapshot.json`.

  LOGGING REQUIREMENTS:
  - Логировать только факт записи snapshot и безопасные счетчики разделов.
  - Не включать в snapshot значения `ValuesStr.vstr`, `Recs.guid`, `Global.guid`, `Global.params`, пути документов и другие персональные поля.
  - При обнаружении потенциально чувствительного поля скрипт должен либо исключить его, либо заменить агрегатом.

### Phase 2: Построить техническую схему таблиц и связей

- [x] Task 4: Создать полный каталог таблиц и колонок `yaman-test.atdb`.

  Создать `docs/atdb_schema_yaman.md` с разделом для каждой таблицы: назначение, список колонок, типы, nullable/PK, row count, роль таблицы в модели, связанные таблицы и уровень уверенности (`confirmed`, `observed`, `unknown`). Для служебных таблиц (`Log`, `Tasks`, `TaskDetails`, `Documents`, `Sources`, details-таблицы) фиксировать смысл без раскрытия содержимого.

  Files: `docs/atdb_schema_yaman.md`, `docs/atdb_schema_yaman.snapshot.json`.

  LOGGING REQUIREMENTS:
  - Не вставлять примеры персональных строк в документацию.
  - Допустимы только counts, table/column names, numeric codes, field IDs и обезличенные описания.
  - Не включать GUID, document paths, source contents, place names или names из `ValuesStr`.

- [x] Task 5: Составить полный `rec_table` catalog.

  На основе `Recs`, `Values*`, detail-таблиц и row counts описать все наблюдаемые `rec_table`: подтвержденные (`7`, `9`, `13`, `14`), вероятные (`3`, `4`, `5`, `15`, `16`) и неоднозначные (`6`, `8`, `10`, `18`, `21` или другие обнаруженные коды). Для каждого кода указать evidence: counts, matching table count, usage in `Values*`, usage in details.

  Files: `docs/atdb_schema_yaman.md`, `docs/atdb_schema_yaman.snapshot.json`.

  LOGGING REQUIREMENTS:
  - Логировать только numeric codes, counts и имена таблиц.
  - Не выводить значения записей, с которыми связан `rec_table`.
  - Не повышать вероятные соответствия до confirmed без прямого evidence.

- [x] Task 6: Описать граф связей между таблицами.

  Документировать связи `Recs(rec_table, rec_id)`, `ValuesLinks(vlink_table, vlink_id)`, `EventDetails(p_id, e_id, er_id)`, `EventRoles(et_id)`, `Fields(tablecode, et_id, et_ord)`, `DocumentDetails`, `SourceDetails`, `TaskDetails`, `Places.parent_id`. Добавить ASCII/mermaid-схему потока данных для персон, событий, мест, документов и источников.

  Files: `docs/atdb_schema_yaman.md`.

  LOGGING REQUIREMENTS:
  - Диаграммы должны показывать только таблицы, колонки и numeric keys.
  - Не подписывать диаграммы реальными именами, местами, заметками или документами.
  - Любые неуверенные связи маркировать `observed` или `hypothesis`.

### Phase 3: Каталогизировать поля, роли и значения без утечки данных

- [x] Task 7: Создать полный каталог `Fields` и `f_id`.

  Для каждого `Fields.id` описать `tablecode`, `datatype`, `area` presence без раскрытия чувствительных значений, `et_id`, `et_ord`, фактическое использование в `ValuesStr`, `ValuesNum`, `ValuesDates`, `ValuesLinks`, связанный `rec_table`, count и предварительный смысл. Разделить смысл на `confirmed`, `observed`, `needs user validation`, `unknown`.

  Files: `docs/atdb_schema_yaman.md`, `docs/atdb_schema_yaman.snapshot.json`.

  LOGGING REQUIREMENTS:
  - Не выводить значения `ValuesStr.vstr`; использовать только counts, тип value-таблицы и target table для links.
  - Если для пользовательской валидации нужны примеры значений, подготовить их отдельно как ручной prompt в диалоге, а не коммитить в файл.
  - Не использовать `Fields.area` как достаточное доказательство смысла.

- [x] Task 8: Описать `EventTypes`, `EventRoles` и `EventDetails`.

  Документировать все `EventTypes` и `EventRoles` из базы, отдельно выделив реально используемые `Events.et_id` (`1`, `2`, `3`, `34`) и роли, встречающиеся в `EventDetails`. Для каждого role ID описать evidence: `et_id`, `ord`, `roletype`, `ismain`, `maxcount`, count в `EventDetails`, предполагаемый смысл и статус уверенности.

  Files: `docs/atdb_schema_yaman.md`.

  LOGGING REQUIREMENTS:
  - Логировать только role/type IDs, counts и структурные признаки.
  - Не выводить участников событий или текст событий.
  - Роли `1`, `2`, `3`, `4`, `5`, `6`, `36`, `210`, `211` не считать универсальными за пределами этой fixture.

- [x] Task 9: Подготовить пакет пользовательской валидации неоднозначных смыслов.

  Создать `docs/atdb_schema_yaman_validation.md` со списком вопросов к пользователю по неоднозначным полям и кодам. Для каждого вопроса указать безопасный context: table, column/code, count, link target, datatype, где поле встречается, и почему смысл неясен. Если для понимания нужны реальные значения, сформулировать отдельные вопросы для интерактивного обсуждения с пользователем, не записывая значения в git-tracked файл.

  Files: `docs/atdb_schema_yaman_validation.md`, `docs/atdb_schema_yaman.md`.

  LOGGING REQUIREMENTS:
  - В validation-файл не помещать реальные имена, места, заметки, причины смерти, source text, document paths или GUID.
  - Для полей `ValuesStr` использовать формулировки вида "нужна ручная проверка примеров", а не сами примеры.
  - Standard logging должен показывать только число вопросов и разделов.

- [x] Task 10: Провести пользовательскую валидацию и внести подтвержденные смыслы.

  На основе `docs/atdb_schema_yaman_validation.md` запросить у пользователя подтверждение неоднозначных смыслов. После ответа пользователя обновить `docs/atdb_schema_yaman.md`, меняя статус только там, где есть явное подтверждение. Не подтвержденные поля оставить как `unknown` или `needs more samples`.

  Files: `docs/atdb_schema_yaman.md`, `docs/atdb_schema_yaman_validation.md`.

  LOGGING REQUIREMENTS:
  - Не просить пользователя вставлять большие дампы таблиц или персональные строки в публичные артефакты.
  - Если пользователь обсуждает реальные значения в чате, в документацию переносить только обобщенный смысл и evidence status.
  - Не логировать raw validation examples через скрипты.

### Phase 4: Сверить документацию, кодовые расхождения и quality gate

- [x] Task 11: Сверить итоговую схему с текущим parser/build mapping.

  Добавить в `docs/atdb_schema_yaman.md` или отдельный раздел `Implementation gaps` список расхождений между исследованием и кодом: `TABLE_CODES`, comments/queries в readers/writers, `rec_table=7` как Events vs legacy EventDetails, `rec_table=9/13` для Persons/Families, `rec_table=11` legacy Events, build drift `665 -> 678`. Не исправлять код в этой задаче; сформировать вход для следующего milestone.

  Files: `docs/atdb_schema_yaman.md`, `lib/atdb/constants.ts`, `lib/atdb/readers/*.ts`, `lib/atdb/writers/*.ts`.

  LOGGING REQUIREMENTS:
  - Не запускать verbose row dumps при сверке.
  - В документации указывать только file paths, constants, SQL fragments без пользовательских данных.
  - Любой drift описывать через агрегаты и counts.

- [x] Task 12: Обновить существующую документацию формата как индекс на новую схему.

  Синхронизировать `docs/atdb_format.md` так, чтобы он ссылался на полный schema artifact и больше не был единственным местом для детальной схемы `yaman-test.atdb`. При необходимости обновить README/docs index без дублирования всей схемы.

  Files: `docs/atdb_format.md`, `README.md`, `docs/atdb_schema_yaman.md`.

  LOGGING REQUIREMENTS:
  - Не добавлять примеры реальных значений.
  - Ссылки и краткие описания должны оставаться безопасными для публичного репозитория.
  - Не расширять пользовательскую документацию техническим шумом сверх ссылок на schema artifact.

- [x] Task 13: Добавить минимальную проверку документации/snapshot.

  Добавить npm-script или smoke-mode, который запускает `scripts/inspect-atdb-schema.mjs` на `yaman-test.atdb`/`ATDB_SCHEMA_FIXTURE` и проверяет, что обязательные counts и confirmed mappings присутствуют в snapshot. Проверка должна gracefully skip при отсутствии fixture, но проходить на локальной разрешенной базе.

  Files: `package.json`, `scripts/inspect-atdb-schema.mjs`, `docs/atdb_schema_yaman.snapshot.json`.

  LOGGING REQUIREMENTS:
  - Выводить только status, fixture-bytes, counts, confirmed mapping check status.
  - Не выводить raw SQL rows, `ValuesStr.vstr`, GUID, document paths или source text.
  - Ошибки должны указывать на отсутствующий structural key, а не на содержимое базы.

- [x] Task 14: Финально выполнить проверки и зафиксировать результат milestone.

  Запустить `npm run lint`, существующий `npm run smoke:atdb` с `ATDB_SMOKE_FIXTURE=yaman-test.atdb`, новый schema-check с `ATDB_SCHEMA_FIXTURE=yaman-test.atdb`. Проверить, что итоговые docs содержат полную схему смыслов и список неоднозначностей после пользовательской валидации. Если build drift остается, зафиксировать его как known implementation gap для следующего milestone.

  Files: `docs/atdb_schema_yaman.md`, `docs/atdb_schema_yaman_validation.md`, `docs/atdb_schema_yaman.snapshot.json`, `scripts/inspect-atdb-schema.mjs`, `package.json`.

  LOGGING REQUIREMENTS:
  - Итоговый отчет должен включать только статусы проверок и безопасные счетчики.
  - Не вставлять в отчет персональные строки из `.atdb`.
  - Если fixture отсутствует, явно указать skip и следующий минимальный шаг.

## Commit Plan

- **Commit 1** (after tasks 1-3): `test: add safe atdb schema inspection`
- **Commit 2** (after tasks 4-8): `docs: catalog yaman atdb schema`
- **Commit 3** (after tasks 9-10): `docs: validate ambiguous atdb field meanings`
- **Commit 4** (after tasks 11-14): `docs: finalize atdb research milestone`
