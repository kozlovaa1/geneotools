# Research

Updated: 2026-05-28 17:56
Status: active

## Active Summary (input for $aif-plan)
<!-- aif:active-summary:start -->
Topic: Исследование тестовой базы ATDB `yaman-test.atdb`
Goal: Зафиксировать подтвержденную структуру тестовой `.atdb` базы и разрыв между фактической схемой, документацией и текущим parser/build mapping.
Constraints:
- `yaman-test.atdb` разрешена пользователем как публично доступная персональная fixture, но выводы и артефакты должны оставаться без персональных строк, GUID, мест, заметок и содержимого `ValuesStr`.
- SQL-логика остается в `lib/`; UI не должен напрямую работать со схемой SQLite.
- Следующий implementation-plan должен отделять подтвержденные факты от legacy fallback-поведения.
Decisions:
- Использовать `yaman-test.atdb` как разрешенную исследовательскую fixture.
- Считать подтвержденными для этой базы `rec_table`: `7 -> Events`, `9 -> Families`, `13 -> Persons`, `14 -> Places`.
- Считать `Fields.area` ненадежным источником семантики: почти все `area` равны `NULL`, кроме части полей персон.
- Полезная нагрузка событий в `ValuesDates`, `ValuesLinks`, `ValuesStr`, `ValuesNum` при `rec_table = 7` привязана к `Events.id`, а не к `EventDetails.id`.
Open questions:
- Нужно ли хранить `yaman-test.atdb` как tracked fixture, или оставить ее локальной разрешенной fixture с `ATDB_SMOKE_FIXTURE`.
- Как именно разделить в коде `confirmed mapping`, `observed mapping` и `legacy fallback` для вариативных ATDB-схем.
- Должен ли следующий план исправлять только read-side mapping или сразу затрагивать build-side drift.
Success signals:
- Mapping `rec_table`, `f_id`, `EventTypes`, `EventRoles` централизован и покрыт smoke/unit-проверками.
- `parse -> build -> reparse` на `yaman-test.atdb` не меняет количество сущностей без явной причины.
- Документация `docs/atdb_format.md` и кодовые константы не противоречат друг другу.
Next step: Запустить `$aif-plan` для milestone "Централизованный mapping формата ATDB" или отдельного плана стабилизации `parse -> build -> reparse` drift.
<!-- aif:active-summary:end -->

## Sessions
<!-- aif:sessions:start -->
### 2026-05-28 17:56 — Исследование yaman-test.atdb
What changed:
- Пользователь подтвердил, что `yaman-test.atdb` можно использовать для исследования: база персональная, но публично доступная и не содержит секретных/опасных данных.
- Проведен безопасный структурный анализ через `sql.js` без вывода персональных строк.
- Выполнен smoke-check с `ATDB_SMOKE_FIXTURE=C:\Users\kozlo\PhpstormProjects\geneotools\yaman-test.atdb`.

Key notes:
- Файл: `1,015,808` bytes, `21` таблица.
- Основные счетчики: `Persons=294`, `Families=11`, `Events=665`, `EventDetails=1059`, `Places=23`, `Documents=4`, `Sources=12`.
- Подтвержденные `rec_table`: `7 -> Events`, `9 -> Families`, `13 -> Persons`, `14 -> Places`.
- Дополнительные вероятные соответствия по счетчикам `Recs`: `3 -> Documents`, `4 -> DocumentDetails`, `5 -> EventDetails`, `15 -> SourceDetails`, `16 -> Sources`; `6` и `8` выглядят как частичные служебные записи, не равные полному числу `EventRoles`/`EventTypes`.
- `ValuesLinks`: `rec_table=7, f_id=28 -> vlink_table=14`; `rec_table=13, f_id=63 -> vlink_table=14`; `rec_table=13, f_id=83 -> vlink_table=9`.
- `ValuesDates`: `rec_table=7, f_id=29` содержит даты событий; `rec_table=14, f_id=95` содержит даты/датировочные метки мест.
- `ValuesStr`: для семей `f_id=48/49/50/52`; для персон основные `f_id=64/65/66/67/73/89/155`; для мест `f_id=93/94/104`; для событий `f_id=37/38`.
- `ValuesNum`: `rec_table=7, f_id=204`; `rec_table=13, f_id=202`; `rec_table=14, f_id=97`.
- `Values*` не имеют orphan-ссылок относительно `Recs`.
- `Events.et_id` в используемых событиях: `1=294`, `2=294`, `3=67`, `34=10`.
- Роли рождения подтверждаются через `EventRoles`: `id=1` основная персона, `id=2` отец, `id=3` мать. Эти ID подтверждены для `yaman-test.atdb`, но не должны считаться универсальными без проверки `EventRoles`.
- Smoke-check проходит, но выявляет drift: `parse -> build -> reparse` меняет количество событий с `665` на `678`.
- В коде есть расхождения с исследованием: часть constants/readers/writers все еще использует старую или смешанную трактовку `rec_table` (`7` как EventDetails, `11` как Events, `9` как Persons).

Links (paths):
- `yaman-test.atdb`
- `docs/atdb_format.md`
- `lib/atdb/constants.ts`
- `lib/atdb/readers/eventsReader.ts`
- `lib/atdb/readers/personsReader.ts`
- `lib/atdb/readers/familiesReader.ts`
- `lib/atdb/writers/eventsWriter.ts`
- `lib/atdb/writers/personsWriter.ts`
- `lib/atdb/writers/familiesWriter.ts`
- `scripts/smoke-atdb.mjs`
<!-- aif:sessions:end -->
