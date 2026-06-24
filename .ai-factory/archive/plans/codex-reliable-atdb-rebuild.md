---
archived: 2026-06-24
---

# Implementation Plan: Надежная обратная сборка `.atdb`

Branch: codex/reliable-atdb-rebuild
Created: 2026-06-22

## Settings
- Testing: yes
- Logging: verbose
- Docs: yes

## Roadmap Linkage
Milestone: "Надежная обратная сборка `.atdb`"
Rationale: План переводит экспорт из режима пересборки полной `ParsedAtdb` модели в контролируемое применение пользовательских изменений с валидацией, транзакционным откатом и защитой структуры SQLite.

## Research Context
Source: `.ai-factory/RESEARCH.md` (Active Summary), `.ai-factory/ROADMAP.md`, текущий `$aif-explore ROADMAP "Надежная обратная сборка .atdb"`.

Goal:
- Расширить экспорт от сохранения исходной базы к надежному применению изменений, не ломая существующие invariant mapping, write-safe правила и hard-fail drift gate.

Constraints:
- SQL-логика остается в `lib/`; UI не должен напрямую работать со схемой SQLite или `lib/atdb/*`.
- Не выводить raw rows, имена, места, заметки, GUID, `ValuesStr.vstr`, document/source text или локальные пути к private fixtures.
- Запись разрешена только для `invariant` + `write: true` правил из `lib/atdb/mapping.json`; `fixture-specific`, `legacy-fallback`, unknown и неоднозначные значения должны сохраняться без изменений.
- `Families` означает "Роды", а не нуклеарные семьи; не планировать вывод ролей "муж", "жена", "дети" из `Families`.
- Предыдущий milestone уже закрепил нулевой `parse -> build -> reparse` count drift как hard-fail gate; этот план не должен ослаблять этот gate.

Decisions:
- Ввести явный contract изменений (`change-set` / internal diff), чтобы отличать намеренное очищение поля от отсутствующего значения в полной `ParsedAtdb` модели.
- Оставить `buildAtdb(data, originalBuffer, options)` совместимым публичным API, но внутри направить его через strict diff/apply path.
- Добавить новый явный публичный путь для будущего UI редактирования: применить заранее собранный набор изменений к исходному буферу.
- Первый безопасный scope: обновление существующих записей и write-safe полей; создание и удаление `Persons`, `Families`, `Events`, `Places`, `EventRoles`, `Fields` и `Recs` оставить вне этого milestone.
- Изменение `Events.et_id` считать небезопасным до отдельного плана, потому что смена типа события может сделать существующие `EventDetails.er_id` семантически несовместимыми.
- Изменение `Global`/metadata в этом milestone запрещено: compatibility diff должен требовать точного совпадения metadata, а no-op export не должен переписывать `Global`.

Open questions:
- Должен ли следующий UI milestone формировать `change-set` напрямую или временно использовать compatibility diff через `buildAtdb`.
- Какие write-safe поля первыми раскрывать в UI редактирования после завершения этого milestone.

Success signals:
- No-op export сохраняет нулевой count drift и проходит существующие fixture gates.
- Поддержанные изменения existing records применяются и подтверждаются через reparse.
- Неподдержанные изменения завершают сборку ошибкой до экспорта файла, без частичной записи и без утечки пользовательских данных в diagnostics.
- `Global`, `Fields`, `Recs`, `EventRoles`, неизвестные `Values*`, чужие `ValuesLinks`, fixture-specific поля, legacy fallback и unchanged owned rows остаются неизменными.

## Commit Plan
- **Commit 1** (after tasks 1-3): `feat(atdb): add strict rebuild contract`
- **Commit 2** (after tasks 4-6): `test(atdb): cover validated rebuild flow`
- **Commit 3** (after tasks 7-8): `docs(atdb): document reliable rebuild contract`

## Tasks

### Phase 1: Контракт изменений и preflight
- [x] Task 1: Ввести типизированный контракт изменений для обратной сборки.

  Deliverable:
  - Добавить внутренние типы `AtdbChangeSet`, `AtdbEntityChange`, `AtdbFieldChange`, `AtdbBuildReport`, `AtdbBuildIssue`, `AtdbBuildOptions` и `AtdbBuildError` для update-only изменений существующих записей.
  - Поддержать только безопасный стартовый набор: `Person.firstName`, `Person.lastName`, `Person.patronymic`, `Person.gender`, `Person.birthPlaceId`, `Person.deathPlaceId`, `Family.familyName`, `Family.husbandLastName`, `Family.wifeLastName`, `Family.comment`, `Family.color`, `Place.name`, `Place.shortName`, `Place.comment`.
  - Явно запретить создание/удаление сущностей, изменение `Event.eventType`, изменение участников событий, любые изменения `metadata.*`/`Global`, `EventRoles`, `Fields`, `Recs` и любых custom/fixture-specific полей.
  - Добавить единый safe formatter/result helper для UI и scripts: наружу отдавать только безопасный code/message/counts, без raw values.
  - Сохранить существующие доменные типы `ParsedAtdb`, `Person`, `Family`, `Event`, `Place`; новые типы должны дополнять write path, а не ломать read-side API.

  Files:
  - `lib/atdb/rebuildContract.ts` (new)
  - `lib/atdb/diagnostics.ts` при необходимости safe formatter/helper
  - `lib/types.ts` при необходимости публичного type export
  - `lib/sqlProcessor.ts`

  LOGGING REQUIREMENTS:
  - Runtime diagnostics должны идти через `AtdbDiagnosticLogger`.
  - `DEBUG`: количество изменений по типам сущностей и количество noop-изменений.
  - `WARN`: пропущенные unsupported changes только с entity type, field name и безопасным reason code.
  - `ERROR`: invalid change-set без `rec_id`, raw field values, имен, мест, заметок, GUID или локальных путей.

- [x] Task 2: Добавить strict preflight validation для исходной базы и набора изменений.

  Deliverable:
  - Проверять SQLite header, наличие обязательных таблиц для запрошенных операций, совместимость `Fields`/`AtdbSchemaContext`, существование изменяемых записей и отсутствие duplicate updates.
  - Проверять runtime-значения до записи: допустимые `gender`, integer/null для `Family.color` и place IDs, строковые/null поля, отсутствие duplicate entity IDs в compatibility input.
  - Для ссылок на места (`birthPlaceId`, `deathPlaceId`) проверять, что целевой `Places.id` существует в исходной базе.
  - Для `null`/empty string определить единое поведение: `null` или `undefined` в явном change-set означает удаление write-safe значения, пустая строка сохраняется как строка только если такое поведение явно принято в validation helper.
  - Возвращать structured report, а в strict режиме бросать typed error до записи.

  Files:
  - `lib/atdb/rebuildValidation.ts` (new)
  - `lib/atdb/schemaContext.ts`
  - `lib/atdb/sqlHelpers.ts`
  - `lib/sqlProcessor.ts`

  LOGGING REQUIREMENTS:
  - `DEBUG`: результат schema preflight по таблицам и catalog counts.
  - `WARN`: optional-table ограничения, которые делают конкретное изменение неприменимым.
  - `ERROR`: strict validation failure с code и агрегированным count issues; не логировать значения пользовательских полей.

- [x] Task 3: Реализовать compatibility diff из `ParsedAtdb` в `AtdbChangeSet`.

  Deliverable:
  - `buildAtdb(data, originalBuffer, options)` должен читать исходное состояние из `originalBuffer`, сравнивать его с переданным `data` и формировать явный `AtdbChangeSet`.
  - Строить comparison через by-id maps с точным совпадением count и ID для `persons`, `families`, `events`, `places`; duplicate IDs должны быть отдельной strict validation error.
  - Отличать no-op, supported update, supported clear и unsupported structural change.
  - Если count сущностей изменился, ID исчез или появился, изменилось `metadata.*`, либо изменилось неподдержанное поле, strict build должен завершаться ошибкой до записи.
  - Для каждого read-side поля, не входящего в write-safe scope (`notes`, `occupation`, `motherLastName`, события, участники, fixture-specific/legacy fallback), формировать unsupported diff category без raw values.
  - Добавить отдельную публичную функцию для будущего UI: `applyAtdbChanges(originalBuffer, changes, options)`.
  - Сохранить compatibility re-export `lib/parseAtdb.ts` для parse API.
  - Синхронизировать `lib/buildAtdb.ts`: убрать устаревшую отдельную validation-модель или превратить файл в совместимый re-export нового strict contract.

  Files:
  - `lib/atdb/rebuildDiff.ts` (new)
  - `lib/sqlProcessor.ts`
  - `lib/parseAtdb.ts`
  - `lib/buildAtdb.ts`

  LOGGING REQUIREMENTS:
  - `DEBUG`: counts для compared entities и generated changes.
  - `WARN`: unsupported diff categories без raw values.
  - `ERROR`: structural diff failure с entity type и reason code, без персональных данных.

<!-- Commit checkpoint: tasks 1-3 -->

### Phase 2: Транзакционное применение и post-build validation
- [x] Task 4: Перевести writer path на применение явных изменений внутри транзакционного блока.

  Deliverable:
  - Добавить `SAVEPOINT`/`ROLLBACK TO`/`RELEASE` вокруг write phase в `sql.js`.
  - Добавить общий transaction helper, чтобы `buildAtdb` и `applyAtdbChanges` использовали одинаковый rollback path.
  - Writer-модули должны применять только явно запрошенные изменения, а не проходить по всей `ParsedAtdb` модели.
  - Перевести writer entrypoints на field-level changes; старый full-model writer path не должен оставаться доступным для strict build.
  - `replaceOwnedValue` продолжает удалять/заменять только owned write-safe value rows с точной комбинацией `valueTable`, `f_id`, `rec_table`, `rec_id` и `vlink_table`.
  - `writeEvents` не должен менять `Events.et_id` в рамках этого milestone; попытка такого изменения должна блокироваться preflight/diff.
  - `writeMetadata`/`metadataWriter.ts` не должен удалять и пересоздавать `Global` в рамках strict rebuild; любые metadata изменения блокируются preflight/diff.
  - При любой ошибке до `db.export()` база должна быть откатана, а ошибка должна быть safe для UI.

  Files:
  - `lib/atdb/transaction.ts` (new)
  - `lib/atdb/writers/personsWriter.ts`
  - `lib/atdb/writers/familiesWriter.ts`
  - `lib/atdb/writers/placesWriter.ts`
  - `lib/atdb/writers/lifeEventWriter.ts`
  - `lib/atdb/writers/eventsWriter.ts`
  - `lib/atdb/writers/metadataWriter.ts`
  - `lib/atdb/writers/valueWriter.ts`
  - `lib/sqlProcessor.ts`

  LOGGING REQUIREMENTS:
  - `DEBUG`: transaction start/release, applied changes by entity type, noop counts.
  - `WARN`: skipped optional write path with safe reason code.
  - `ERROR`: rollback reason code and phase name only; не логировать SQL row values или пользовательские строки.

- [x] Task 5: Добавить post-build validation перед возвратом `Uint8Array`.

  Deliverable:
  - После записи запускать `PRAGMA integrity_check` и считать любой результат кроме `ok` ошибкой сборки.
  - Reparse rebuilt buffer и проверять, что counts `persons`, `families`, `events`, `places` не изменились.
  - Проверять, что supported changes действительно видны после reparse, а unsupported/noop изменения не привели к изменению неизвестных `Values*`.
  - Снимать safe fingerprints до/после для `Global`, `Fields`, `Recs`, `EventRoles`, неизвестных `Values*`, чужих `ValuesLinks` и unchanged owned rows; mismatch должен быть strict build error.
  - Ввести typed build error/result так, чтобы UI мог показать безопасное сообщение без анализа внутренних diagnostics.

  Files:
  - `lib/atdb/rebuildValidation.ts`
  - `lib/atdb/rebuildContract.ts`
  - `lib/sqlProcessor.ts`
  - `lib/initSqlJs.ts` при необходимости повторного открытия rebuilt buffer

  LOGGING REQUIREMENTS:
  - `DEBUG`: integrity status, reparse counts, applied/verified change counts.
  - `WARN`: verification mismatch category без raw values.
  - `ERROR`: validation failure code; не выводить `ValuesStr`, GUID, места, заметки или локальные пути.

### Phase 3: Regression gates и безопасный экспорт
- [x] Task 6: Расширить write-safety regression harness под strict rebuild contract.

  Deliverable:
  - Обновить `test:atdb:write-safety` или добавить отдельный `test:atdb:rebuild-contract`, включенный в финальный gate.
  - Покрыть оба публичных write API: `buildAtdb(parsed, original)` compatibility diff и `applyAtdbChanges(original, changes)`.
  - Покрыть успешные изменения существующих персон, родов, мест и birth/death place links.
  - Покрыть failure paths: создание сущности, удаление сущности, изменение `eventType`, изменение metadata/`Global`, изменение unsupported/fixture-specific поля, несуществующий place link, invalid scalar value, duplicate IDs, duplicate field changes, несовместимый `Fields` catalog.
  - Проверить rollback: после synthetic failure `Global`, `Fields`, `Recs`, неизвестные `Values*`, `EventRoles`, чужие `ValuesLinks` и unchanged owned values остаются прежними.
  - Regression harness не должен читать private fixtures и не должен печатать raw user data.

  Files:
  - `scripts/check-atdb-write-safety.mjs`
  - `scripts/check-atdb-rebuild-contract.mjs` (new, if separated)
  - `package.json` при добавлении нового npm-скрипта

  LOGGING REQUIREMENTS:
  - Safe output только с fixture label, statuses, counts, delta/hash status и synthetic reason codes.
  - Не печатать temp absolute paths, raw rows, имена, места, заметки, GUID, `ValuesStr.vstr` или source/document text.
  - Failure output должен указывать фазу и reason code, достаточные для диагностики без персональных данных.

<!-- Commit checkpoint: tasks 4-6 -->

- [x] Task 7: Подключить strict build path к текущему UI экспорта без добавления редактирования.

  Deliverable:
  - `app/page.tsx` должен продолжить использовать публичный фасад из `lib/sqlProcessor.ts`, без импорта `lib/atdb/*`.
  - No-op export текущего `parsedData` должен проходить через новый validated build path.
  - Ошибки сборки должны отображаться пользователю через safe formatter/code из `lib/sqlProcessor.ts` или `lib/atdb/diagnostics.ts`; подробные diagnostics не должны попадать в UI или console с персональными данными.
  - Не добавлять UI редактирование в этом плане; milestone "Редактирование данных в UI" остается отдельным следующим этапом.

  Files:
  - `app/page.tsx`
  - `lib/sqlProcessor.ts`
  - `lib/atdb/diagnostics.ts` при необходимости безопасного formatter/helper

  LOGGING REQUIREMENTS:
  - UI может использовать `console.error` только с безопасным message/code, без дампа `Error` object, объекта базы или пользовательских строк.
  - Runtime diagnostics остаются opt-in через `AtdbDiagnosticLogger`.
  - В пользовательском сообщении не показывать SQL, raw values, GUID или локальные пути.

### Phase 4: Документация и финальная проверка
- [x] Task 8: Документировать новый contract и выполнить полный безопасный gate.

  Deliverable:
  - Обновить `docs/atdb_format.md`: описать strict rebuild contract, явный change-set/diff, update-only scope, запрет metadata/`Global`, `EventRoles`/`Fields`/`Recs`/`eventType` changes и post-build validation.
  - Обновить `docs/getting-started.md`: добавить новую проверочную команду, если она появится, и уточнить, что экспорт падает при unsupported structural changes.
  - При необходимости обновить `docs/architecture.md`: зафиксировать, что reliable rebuild остается в `lib/` за фасадом `lib/sqlProcessor.ts`.
  - Запустить проверки: `npm run lint`, `npx tsc --noEmit`, `npm run mapping:atdb:check`, `npm run test:atdb:write-safety`, новый rebuild-contract test при наличии, `npm run smoke:atdb:matrix`, `npm run schema:atdb:fixtures:check`.
  - Если local-only fixtures отсутствуют, подтвердить safe skip behavior и не считать это ошибкой.

  Files:
  - `docs/atdb_format.md`
  - `docs/getting-started.md`
  - `docs/architecture.md` при необходимости
  - `package.json` при добавлении нового npm-скрипта

  LOGGING REQUIREMENTS:
  - Документация и примеры вывода должны содержать только labels, statuses, counts, reason codes и drift deltas.
  - Проверочные команды не должны выводить raw values, имена, места, заметки, GUID, document/source text или локальные private fixture paths.
  - Если какая-либо проверка падает из-за безопасного gate, не маскировать failure и не понижать strict режим.

<!-- Commit checkpoint: tasks 7-8 -->
