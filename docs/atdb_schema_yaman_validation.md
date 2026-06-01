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
   - Answered partially: пользователь предполагает, что `rec_table=6` относится к ролям участников событий (`EventRoles`) и UI-группе "Участники"; `f_id=132` содержит два пользовательских значения ролей для одного события (`rec_id` values `210` and `211`). Нужен эксперимент с созданием ролей для других событий, чтобы подтвердить ID-pattern.

3. `rec_table=8`
   - Context: `Recs count=1`, no `Values*` usage.
   - Question: является ли это записью уровня базы/проекта, или отдельной сущностью?

4. `rec_table=10`
   - Context: `Recs count=14`, no same-count domain table in snapshot.
   - Usage: `ValuesStr f_id=135 count=2`.
   - Answered partially: пользователь предполагает, что `rec_table=10` — это "Поля данных". Отдельная таблица под такую сущность пока не найдена. Обе записи `f_id=135` являются пользовательскими значениями, добавленными к разным сущностям: `rec_id=202` — дополнительное поле персоны, `rec_id=204` — дополнительное поле одного из типов событий. Нужны targeted tests с добавлением значений для уточнения хранения.

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
   - Fields: `f_id=9`, `10`, `105`, `110`, `115`, `128`, `142`.
   - Answered: document fields: `f_id=9` — "Описание", `f_id=10` — "Дата", `f_id=128` — "Координаты"; source detail field: `f_id=105` — "Позиция в источнике"; source fields: `f_id=110` — "Название источника", `f_id=115` — "Комментарий", `f_id=142` — "Ссылка (URL)".

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
