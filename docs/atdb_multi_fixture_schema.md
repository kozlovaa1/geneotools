[← ATDB Format](atdb_format.md) · [Back to README](../README.md)

# Multi-fixture schema check

Этот документ фиксирует безопасное structural comparison для трех разрешенных fixtures:

- `yaman` -> tracked `yaman-test.atdb`
- `yaman-full` -> local-only `yaman-test-full.atdb`
- `family` -> local-only `family-test.atdb`

Политика redaction остается такой же, как в [docs/atdb_experiments/README.md](atdb_experiments/README.md): в tracked artifacts допускаются только table names, counts, `rec_table`, `f_id`, `datatype`, `vlink_table`, link-target codes и confidence labels. Raw `ValuesStr`, GUID, document paths, source text, names, places и notes не публикуются.

Этот документ не должен превращаться в отдельный канон формата `.atdb`. Его назначение уже уже: служить compatibility evidence и regression-контуром для канонического описания в `docs/atdb_format.md`. Иными словами, здесь фиксируется, на каких fixtures проверены инварианты, где есть fixture-specific differences и какие зоны еще требуют дополнительных samples.

## Fixture policy

- `yaman-test.atdb` остается tracked research fixture и baseline для schema checks.
- `yaman-test-full.atdb` и `family-test.atdb` используются только как local-only fixtures под действующим `*.atdb` ignore rule.
- Tracked snapshot по-прежнему создается только для `yaman`.
- Дополнительные snapshots пишутся только в ignored local path и используются как input для diff/smoke matrix.

## Safe commands

```bash
npm run schema:atdb:fixtures
npm run schema:atdb:fixtures:diff
npm run smoke:atdb:matrix
npm run schema:atdb:fixtures:check
npm run mapping:atdb:check
npm run test:atdb:write-safety
```

Ожидаемый safe output содержит только labels, statuses, counts, `rec_table`, section summaries и drift deltas.

`mapping:atdb:check` использует канонический `lib/atdb/mapping.json` и проверяет invariant baseline на всех доступных snapshots. `test:atdb:write-safety` подтверждает сохранение неизвестных `Values*` и отсутствие новых `EventRoles` при build.

## Confirmed across fixtures

- Во всех трех fixtures обнаружено 21 user table.
- Во всех трех fixtures orphan-check для `ValuesStr`, `ValuesNum`, `ValuesDates`, `ValuesLinks` возвращает `0`.
- Во всех трех fixtures общий structural rec-table baseline включает `3, 4, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16`.
- Во всех трех fixtures присутствуют groups для `ValuesStr`, `ValuesDates` и `ValuesLinks`, поэтому базовый parser surface нельзя сужать до одной сущности.
- `Persons`, `Families`, `Events`, `Places` присутствуют во всех fixtures.
- `ValuesDates` сохраняет три structural groups во всех fixtures.
- Общий baseline event type IDs: `1..37`, `200`.
- Общий baseline event role IDs: `1..32`, `36..41`, `200`.
- Подтвержденные link-target patterns across fixtures: `13:63 -> 14`, `13:83 -> 9`, `7:28 -> 14`.

## Safe count matrix

| Fixture | Persons | Families | Events | Places | rec_table codes | EventTypes | EventRoles | ValuesLinks target groups |
|---------|---------|----------|--------|--------|-----------------|------------|------------|---------------------------|
| `yaman` | 294 | 11 | 665 | 23 | 12 | 38 | 41 | 3 |
| `yaman-full` | 3020 | 42 | 7586 | 203 | 14 | 40 | 51 | 4 |
| `family` | 7086 | 132 | 18011 | 2873 | 12 | 89 | 39 | 5 |

## Fixture-specific observations

### Additional rec_table coverage

- `yaman-full` добавляет `rec_table=18` и `21`, которых нет в baseline `yaman`.
- `family` не расширяет rec-table set относительно baseline, но резко увеличивает объемы `Events`, `Places` и `EventTypes`.

### EventTypes and EventRoles

- `yaman-full` добавляет event type IDs `201`, `202`.
- `family` добавляет event type IDs `201..251`.
- `yaman-full` расширяет event role IDs до `201..212`.
- `yaman` содержит role IDs `210`, `211`, которых нет в `family`; это признак вариативности role catalogs между fixtures.

### Values and link-target differences

- `family` добавляет link-target group `7:25 -> 14`.
- `yaman-full` и `family` содержат document-oriented link group `4:8 -> 14`, которого нет в baseline `yaman`.
- `yaman-full` расширяет `ValuesNum` groups до 8 и `ValuesStr` groups до 37.
- `family` дает наиболее широкий `ValuesLinks` target surface: 5 groups.

## Diff summary against baseline

| Pair | Structural changes | Watched rec_tables | Section summary |
|------|--------------------|--------------------|-----------------|
| `yaman -> yaman-full` | 122 | `6, 8, 10, 18, 21` | `tables=20`, `recTableDistribution=14`, `ValuesStr=37`, `ValuesNum=8`, `ValuesLinks=4`, `fieldCatalog=23`, `eventRoles=10`, `eventTypes=2` |
| `yaman -> family` | 156 | `6, 8, 10` | `tables=18`, `recTableDistribution=12`, `ValuesStr=35`, `ValuesNum=6`, `ValuesLinks=5`, `fieldCatalog=23`, `eventTypes=51`, `eventRoles=2` |

Эти diff summaries пока считаются warn-only и нужны для следующего слоя universal mapping, а не для немедленного fail-fast по каждой variативности.

## Known drift

Parse/build/reparse drift остаётся отдельным warn-only diagnostic signal: критерий gate не был повышен до hard-fail в рамках этого milestone. После подключения write-safe mapping текущий локальный запуск показал:

| Fixture | Parse Events | Reparse Events | Drift |
|---------|--------------|----------------|-------|
| `yaman` | 665 | 665 | `0` |
| `yaman-full` | 7586 | 7586 | `0` |
| `family` | 18011 | 18011 | `0` |

Инвариант текущего gate не менялся: parser/build flow должен успешно пройти все три фазы и вывести только safe counts, а ненулевой drift остаётся предупреждением для отдельного milestone `Устранение parse-build drift`.

## Gate semantics

### Hard-fail

- invalid SQLite fixture
- snapshot/artifact without `safety.redacted = true`
- missing required sections in redacted snapshot
- broken inspect/diff/smoke harness execution

### Warn-only

- fixture-specific `rec_table`, `Fields`, `EventTypes`, `EventRoles`, `Values*` differences
- parse/build drift deltas
- missing local-only fixture in matrix mode

## Needs more samples

- `rec_table=18` и `21` пока подтверждены только в `yaman-full`; нужен еще один независимый fixture или controlled diff.
- Role and event type IDs `201+` нельзя поднимать до universal mapping без отдельного rules layer.
- Различие `7:25 -> 14` против `7:28 -> 14` требует explicit mapping layer, а не hard-coded assumption по одной fixture.

## Next use

- Использовать этот документ как structural input и verification surface для следующего milestone по универсальному mapping.
- Любые новые fixtures сначала подключать через allow-list registry в `scripts/atdb-fixtures.mjs`.
- После выделения канонического rules layer переносить сюда только compatibility matrix, regression evidence и unresolved variances, а не дублировать полное описание формата.
- Публичные markdown/json artifacts по-прежнему не должны содержать local-only snapshot paths или raw field values.
