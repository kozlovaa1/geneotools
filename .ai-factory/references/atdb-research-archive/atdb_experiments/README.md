# ATDB controlled diff experiments

Этот каталог хранит только публичные redacted-артефакты для экспериментов по неопределенным сущностям `.atdb`. Локальные базы, raw logs, private snapshots и before/after результаты не коммитятся.

## Artifact contract

Базовый формат расширяет redacted snapshot из `scripts/inspect-atdb-schema.mjs` и `docs/atdb_schema_yaman.snapshot.json`. Каждый публичный snapshot или diff должен фиксировать только:

- `artifactVersion`
- `generatedBy`
- `safety.redacted = true`
- `redactionPolicy`
- список `sections`
- table names и row counts
- `rec_table` / `rec_id` shape
- `f_id`, `datatype`, `vlink_table`
- structural counts и confidence labels: `confirmed`, `observed`, `needs more samples`, `unknown`

Запрещено включать raw `ValuesStr.vstr`, GUID, document paths, source text, имена, места, заметки, параметры базы и любые пользовательские значения.

## Tracked and ignored files

Tracked public files:

- `README.md`
- curated Markdown summaries without private values
- experiment templates
- redacted JSON snapshots or diff summaries, если они прошли проверку redaction policy

Ignored local files:

- `docs/atdb_experiments/runs/`
- `docs/atdb_experiments/local/`
- `docs/atdb_experiments/private/`
- `*.local.*`, `*.private.*`, `*.debug.*`, `*.verbose.*`, `*.before.*`, `*.after.*`, `*.raw.*`

Локальные `before.atdb` и `after.atdb` храните вне git-tracked paths или под ignored каталогами. Verbose/debug logs должны оставаться локальными artifacts.

## Safe commands

Создать redacted snapshot:

```bash
npm run schema:atdb -- yaman-test.atdb --output <ignored-snapshot-path>.json
```

Проверить tracked snapshot без локальной `.atdb` fixture:

```bash
npm run schema:atdb:snapshot:check
```

Построить allow-list matrix для `yaman`, `yaman-full`, `family`:

```bash
npm run schema:atdb:fixtures
npm run schema:atdb:fixtures:diff
```

Сравнить два redacted snapshot-файла или две локальные `.atdb` базы:

```bash
npm run schema:atdb:diff -- <baseline.snapshot.json> <after.snapshot.json>
```

Ожидаемый safe output содержит только status, counts, affected sections, affected `rec_table` и sanitized field IDs. Если optional table или column отсутствует, CLI пишет `warning` и пропускает секцию без raw rows. При ошибке CLI должен выводить safe failure reason без дампа SQL rows.

## Manual experiment protocol

1. Создайте локальную копию исходной `.atdb` в ignored path.
2. Discovery step: снимите baseline distribution через `npm run schema:atdb -- <before.atdb> --output <ignored-before-snapshot>.json --debug`.
3. Проверьте low-count/unknown candidates в safe summary: `rec_table=6`, `8`, `10`, `18`, `21` и неизвестные `f_id`.
4. В "Древо Жизни 6" выполните ровно одно UI-действие:
   - добавьте одну пользовательскую роль события;
   - или добавьте/измените одно "Поле данных" для персоны;
   - или добавьте/измените одно "Поле данных" для события;
   - или выполните одно действие-кандидат для `rec_table=8`, `18`, `21`.
5. Сохраните modified `.atdb` как отдельный локальный файл в ignored path.
6. Создайте after snapshot через `npm run schema:atdb -- <after.atdb> --output <ignored-after-snapshot>.json --debug`.
7. Сравните artifacts: `npm run schema:atdb:diff -- <before.snapshot.json> <after.snapshot.json> --debug`.
8. Перенесите в публичный Markdown только sanitized counts, affected tables, `rec_table`, `f_id`, link targets и confidence status.

Expected summary lines for every experiment:

```text
[safe-atdb-schema-diff] changes: <count>
[safe-atdb-schema-diff] affected-rec-tables: <codes|none>
[safe-atdb-schema-diff] watched-rec-tables: <6,8,10,18,21|none>
```

Interpretation blockers:

- diff contains unexpected multi-action changes;
- CLI reports unsupported artifact version;
- snapshot is not marked redacted;
- missing required section prevents comparing the target entity;
- output would require raw `ValuesStr`, GUID, note, source text or document path to explain the result.

Use [role-and-field-experiment-template.md](role-and-field-experiment-template.md) for `rec_table=6` / `10`, and [unknown-rec-table-experiment-template.md](unknown-rec-table-experiment-template.md) for `rec_table=8`, `18`, `21` and other unknown candidates.
