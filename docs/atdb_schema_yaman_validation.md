# ATDB schema validation questions: yaman-test.atdb

Этот файл содержит только безопасный контекст для ручной валидации неоднозначных смыслов. Не добавляйте сюда реальные имена, места, заметки, причины смерти, пути документов, GUID, тексты источников или значения `ValuesStr`.

## rec_table questions

1. `rec_table=4`
   - Context: `Recs count=4`, matches `DocumentDetails count=4`.
   - Usage: `ValuesStr f_id=9 count=4`, `ValuesDates f_id=10 count=2`, `ValuesNum f_id=128 count=1`.
   - Answered: пользователь подтвердил, что `rec_table=4` — документы; `f_id=9` — "Описание", `f_id=10` — "Дата", `f_id=128` — "Координаты".

2. `rec_table=6`
   - Context: `Recs count=3`, no same-count domain table in snapshot.
   - Usage: `ValuesStr f_id=132 count=2`.
   - Answered: controlled diff с добавлением одной пользовательской роли события подтвердил, что `rec_table=6` относится к пользовательским ролям участников событий (`EventRoles`); `Recs.rec_id` совпадает с `EventRoles.id`; `f_id=132` — "Название мужской роли"; `f_id=133` — "Название женской роли".
   - Answered: controlled edit той же роли подтвердил `EventRoles.maxcount`: `1` — включен чекбокс "Не более одного участника с этой ролью", `NULL` — можно добавить любое количество персон; `EventRoles.ismain`: `1` — основная роль, `NULL` — второстепенная роль / чекбокс "Второстепенная роль".

3. `rec_table=8`
   - Context: `Recs count=1`, no `Values*` usage.
   - Question: является ли это записью уровня базы/проекта, или отдельной сущностью?
   - Attempted: controlled global-settings edit changed `Global.params` (safe hash/length changed) without changes in `Recs`, `rec_table` distribution, or `Values*`; `rec_table=8` remained unchanged in this scenario.

3a. `rec_table=18`
   - Context: not present in initial `Recs` distribution, but `Fields.tablecode=18` belongs to "Задачи".
   - Answered: controlled diff с созданием одной задачи подтвердил `rec_table=18` -> `Tasks`; `Recs.rec_id` совпадает с `Tasks.id`; `ValuesStr rec_table=18, f_id=54` хранит название задачи.

3b. `rec_table=21`
   - Context: присутствовал как unknown low-count code.
   - Answered: controlled diff с добавлением одной привязки задачи к персоне подтвердил `rec_table=21` -> `TaskDetails`; `Recs.rec_id` совпадает с `TaskDetails.id`; сама связь хранит `t_id=Tasks.id` и целевую пару `rec_table/rec_id` (в эксперименте `rec_table=13`, `rec_id=Persons.id`).

4. `rec_table=10`
   - Context: `Recs count=14`, no same-count domain table in snapshot.
   - Usage: `ValuesStr f_id=135 count=2`.
   - Answered partially: controlled diff с добавлением одного пользовательского поля персоны подтвердил, что `rec_table=10` — это "Поля данных"; `Recs.rec_id` совпадает с `Fields.id`; `f_id=135` хранит название поля; `Fields.tablecode=13` привязывает поле к персонам; `Fields.datatype=12` соответствует UI-типу "Текст".
   - Answered: controlled diff с добавлением пользовательского поля персоны типа "Целое число" подтвердил `Fields.datatype=2`.
   - Answered: controlled diff с добавлением пользовательского поля события типа "Текст" подтвердил `Fields.tablecode=7` для "События".
   - Answered: controlled diff с добавлением пользовательского поля документа типа "Текст" подтвердил `Fields.tablecode=4` для "Документы".
   - Answered: controlled diff с добавлением пользовательского поля места типа "Логическое значение" подтвердил `Fields.tablecode=14` для "Места" и `Fields.datatype=5` для "Логическое значение".
   - Answered: controlled diff с добавлением пользовательского поля источника типа "URL" подтвердил `Fields.tablecode=16` для "Источники" и `Fields.datatype=7` для "URL".
   - Answered: controlled diff с добавлением пользовательского поля рода типа "Email" подтвердил `Fields.tablecode=9` для "Роды" и `Fields.datatype=8` для "Email".
   - Answered: controlled diff с добавлением пользовательского поля задачи типа "Место" подтвердил `Fields.tablecode=18` для "Задачи" и `Fields.datatype=6` для "Место"; также сдвинулись `Fields.et_ord` у существующих полей задач. Пользователь подтвердил расшифровку `et_ord` как event type order.
   - UI entity scopes observed in creation menu: "Персоны", "События", "Документы", "Места", "Источники", "Роды", "Задачи". Confirmed: `Fields.tablecode=13` -> "Персоны", `7` -> "События", `4` -> "Документы", `14` -> "Места", `16` -> "Источники", `9` -> "Роды", `18` -> "Задачи".
   - UI field types observed in creation menu: "Текст", "Логическое значение", "Целое число", "Место", "URL", "Email". Datatype mapping for all listed UI types is now confirmed via controlled diff.

4a. User field values
   - Answered: controlled diff с заполнением пользовательского текстового поля персоны подтвердил хранение значения в `ValuesStr` по `rec_table=13`, `rec_id=Persons.id`, `f_id=Fields.id`; для поля `Fields.id=205` добавлена строка `ValuesStr rec_table=13, f_id=205`.
   - Answered: controlled diff с заполнением пользовательского поля персоны типа "Целое число" подтвердил хранение значения в `ValuesNum` по `rec_table=13`, `rec_id=Persons.id`, `f_id=Fields.id`; числовое значение хранится в `ValuesNum.vnum`, `vnum2` остается `NULL`.
   - Answered: controlled diff с включением пользовательского поля места типа "Логическое значение" подтвердил хранение значения в `ValuesNum` по `rec_table=14`, `rec_id=Places.id`, `f_id=Fields.id`; включенное значение хранится как `vnum=1`, `vnum2=NULL`.
   - Answered: controlled diff с заполнением пользовательского поля задачи типа "Место" подтвердил хранение значения в `ValuesLinks` по `rec_table=18`, `rec_id=Tasks.id`, `f_id=Fields.id`; ссылка на место использует `vlink_table=14`, `vlink_id=Places.id`.
   - Answered: controlled diff с заполнением пользовательского поля источника типа "URL" подтвердил хранение значения в `ValuesStr` по `rec_table=16`, `rec_id=Sources.id`, `f_id=Fields.id`.
   - Answered: controlled diff с заполнением пользовательского поля рода типа "Email" подтвердил хранение значения в `ValuesStr` по `rec_table=9`, `rec_id=Families.id`, `f_id=Fields.id`.

5. `rec_table=15`
   - Context: `Recs count=298`, matches `SourceDetails count=298`.
   - Usage: `ValuesStr f_id=105 count=49`.
   - Answered: пользователь подтвердил, что `rec_table=15` — "Ссылки на источники" (`SourceDetails`); `f_id=105` — "Позиция в источнике".

## Field questions

1. Event fields
   - Context: `rec_table=7`, source table `Events`.
   - Fields: `f_id=37 count=12`, `f_id=38 count=11`, `f_id=204 count=3`.
   - Answered: `f_id=37` — "Комментарий" для событий; `f_id=38` — "Причина смерти" для типа события "Смерть" (`EventTypes.id=2`); `f_id=204` — пользовательское поле для типа события "Захоронение" (`EventTypes.id=34`), тип checkbox (`Fields.datatype=5`).

2. Person name parts
   - Context: `rec_table=13`, source table `Persons`.
   - Fields: `f_id=64 count=293`, `65 count=62`, `66 count=294`, `67 count=202`.
   - Answered: `f_id=64` — "Фамилия"; `f_id=65` — "Фамилия при рождении"; `f_id=66` — "Имя"; `f_id=67` — "Отчество".

3. Person extra fields
   - Context: `rec_table=13`.
   - Fields: `f_id=73 count=33`, `89 count=243`, `155 count=8`, `202 count=12`.
   - Answered: `f_id=73` — "Основное занятие"; `f_id=89` — "Комментарий" у персоны; `f_id=155` — "Вероисповедание"; `f_id=202` — пользовательское checkbox-поле для персоны (`Fields.datatype=5`), также связано с `rec_table=10` / "Поля данных".

4. Person links
   - Context: `ValuesLinks rec_table=13`.
   - Fields: `f_id=63 -> vlink_table=14 count=226`, `f_id=83 -> vlink_table=9 count=150`.
   - Answered: `f_id=63` links to `vlink_table=14` (`Places`) and means person field "Место жительства"; `f_id=83` links to `vlink_table=9` (`Families`) and means person field "Род".

5. Place fields
   - Context: `rec_table=14`, source table `Places`.
   - Fields: `f_id=93 count=23`, `94 count=23`, `95 count=22`, `97 count=9`, `104 count=2`.
   - Answered: `f_id=93` — "Название места"; `f_id=94` — "Краткое название"; `f_id=95` — "Дата именования"; `f_id=97` — "Координаты"; `f_id=104` — "Комментарий" места.

6. Source and document fields
   - Context: source/document-related `rec_table` codes.
   - Fields: `f_id=8`, `9`, `10`, `11`, `16`, `105`, `108`, `110`, `115`, `128`, `142`.
   - Answered: document fields: `f_id=8` — "Место" (link to place), `f_id=9` — "Описание", `f_id=10` — "Дата", `f_id=11` — "Тип", `f_id=16` — "Комментарий", `f_id=128` — "Координаты"; source detail fields: `f_id=105` — "Позиция в источнике", `f_id=108` — "Цитата"; source fields: `f_id=110` — "Название источника", `f_id=115` — "Комментарий", `f_id=142` — "Ссылка (URL)".

7. Additional event/task/custom fields
   - `f_id=27`: непонятное поле, дублирует `f_id=38` с припиской названия поля (status: observed).
   - `f_id=39`: "Род войск" в типе события "Служба в армии".
   - `f_id=40`: "Воинское звание" в типе события "Служба в армии".
   - `f_id=41`: "Место работы" в типе события "Устройство на работу".
   - `f_id=42`: "Должность" в типе события "Устройство на работу".
   - `f_id=57`: "Комментарий" у задачи.
   - `f_id=99`: "Ссылка (URL)" у места.
   - `f_id=117`: "Образовательное учреждение" у типа события "Обучение".
   - `f_id=134`: "Название типа события" в настройках пользовательского типа события.
   - `f_id=135`: "Название поля" в настройках пользовательского поля данных.
   - `f_id=201`, `f_id=203`: пользовательские поля данных, checkbox (`datatype=5`).

## Event role questions

1. Event type `1`
   - Context: `Events.et_id=1 count=294`; roles `1 count=294`, `2 count=182`, `3 count=140`.
   - Answered: `EventTypes.id=1` — "Рождение"; role `1` — "Родился"; role `2` — "Отец"; role `3` — "Мать".

2. Event type `2`
   - Context: `Events.et_id=2 count=294`; role `4 count=294`.
   - Answered: `EventTypes.id=2` — "Смерть"; role `4` — "Умер/умерла".

3. Event type `3`
   - Context: `Events.et_id=3 count=67`; roles `5`, `6`, `210`, `211`.
   - Answered: `EventTypes.id=3` — "Свадьба"; role `5` — "Муж"; role `6` — "Жена"; roles `210` and `211` — пользовательские роли, связанные с `rec_table=6` and `f_id=132`.

4. Event type `34`
   - Context: `Events.et_id=34 count=10`; role `36 count=10`; `ValuesNum f_id=204 count=3`.
   - Answered: `EventTypes.id=34` — "Захоронение"; role `36` — "Умер"; связанное поле `f_id=204` — пользовательский checkbox (`Fields.datatype=5`), также упоминается в `rec_table=10` and `rec_table=7`.

## Validation rules

- Не вставлять в git-tracked документы реальные строки из `ValuesStr`.
- Не переносить GUID, document paths, source text или notes.
- После ответа пользователя обновлять `docs/atdb_schema_yaman.md` только обобщенным смыслом и статусом evidence.

## Controlled diff workflow

Для вопросов со статусом partial/unknown используйте только controlled diff experiments из [`docs/atdb_experiments/README.md`](atdb_experiments/README.md). Каждый эксперимент начинается с discovery step: снимите baseline `rec_table` distribution, найдите low-count/unknown candidates (`6`, `8`, `10`, `18`, `21` и неизвестные `f_id`), затем выполните ровно одно UI-действие в "Древо Жизни 6" и сравните before/after через redacted diff.

Минимальные сценарии:

- `rec_table=6`: создать одну пользовательскую роль события и проверить изменения `Recs`, `EventRoles`, `ValuesStr f_id=132/133` и связанных event role counts.
- `rec_table=10`: создать одно "Поле данных" для персоны и отдельно одно "Поле данных" для события; сравнивать `Fields`, `Values*`, affected `rec_table` и `datatype`.
- `rec_table=8`, `18`, `21`: выбрать одно UI-действие-кандидат после discovery step, сохранить isolated before/after базы и фиксировать только structural deltas.

Ожидаемые safe summary lines:

```text
[safe-atdb-schema-diff] changes: <count>
[safe-atdb-schema-diff] affected-rec-tables: <codes|none>
[safe-atdb-schema-diff] watched-rec-tables: <6,8,10,18,21|none>
```

Используйте шаблоны:

- [`role-and-field-experiment-template.md`](atdb_experiments/role-and-field-experiment-template.md) для `rec_table=6` и `rec_table=10`.
- [`unknown-rec-table-experiment-template.md`](atdb_experiments/unknown-rec-table-experiment-template.md) для `rec_table=8`, `18`, `21` и других unknown.

Blocker для интерпретации: unsupported artifact version, unsafe snapshot, отсутствие нужной секции, несколько UI-действий в одном diff или необходимость раскрыть raw values для объяснения результата.
