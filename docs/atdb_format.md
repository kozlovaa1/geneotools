[← Architecture](architecture.md) · [Back to README](../README.md) · [Codebase Analysis →](codebase-analysis.md)

# Документация по формату `.atdb`

## Обзор
Формат `.atdb`, используемый в программе «Древо Жизни 6», представляет собой обычную базу данных SQLite.

Этот документ уточнён по реальному тестовому файлу `yaman-test.atdb`, а не только по коду приложения. Поэтому в нём отдельно различаются:

- **подтверждённые** факты, наблюдаемые в тестовой базе;
- **наблюдаемые / вероятные** соответствия, которые хорошо подтверждаются данными, но не описаны явно в самой схеме.

Полный технический каталог таблиц, `rec_table`, `Fields`, `f_id`, `EventTypes`, `EventRoles`, связей и расхождений с текущим кодом вынесен в отдельный schema artifact:

- [ATDB schema: yaman-test.atdb](atdb_schema_yaman.md)
- [Machine-readable redacted snapshot](atdb_schema_yaman.snapshot.json)
- [Multi-fixture schema comparison](atdb_multi_fixture_schema.md)
- [Validation questions and answers](atdb_schema_yaman_validation.md)
- [Controlled diff experiments](atdb_experiments/README.md)

Этот документ остаётся обзорным индексом и кратким справочником, но целевым результатом milestone по универсальному mapping должен стать именно он: каноническое описание invariant-правил формата, допустимых variances и legacy fallback. Детальные таблицы и промежуточные evidence-артефакты следует смотреть в schema artifacts.

`docs/atdb_multi_fixture_schema.md` при этом не является конкурирующим каноном формата. Его роль — compatibility evidence и regression-контур: показать, что канонические правила действительно выдерживают несколько проверенных fixtures и где еще остаются fixture-specific differences или `needs more samples`.

## Снимок тестовой базы (`yaman-test.atdb`)

Наблюдаемые метаданные:

- `Global.version = 8`
- `Global.mainlang = 'ru'`
- `Persons`: 294
- `Families`: 11
- `Events`: 665
- `EventDetails`: 1059
- `Places`: 23
- `Documents`: 4
- `Sources`: 12

## Полный список таблиц

В тестовой базе присутствуют следующие таблицы:

- `DocumentDetails` — связи документов с конкретными записями базы
- `Documents` — документы и пути к ним
- `EventDetails` — участники событий и их роли
- `EventRoles` — роли участников внутри типов событий
- `EventTypes` — типы событий и их порядок
- `Events` — сами события
- `Families` — семейные/родовые записи
- `Fields` — определения пользовательских и системных полей
- `Global` — метаданные базы
- `Log` — журнал изменений записей
- `Persons` — персоны
- `Places` — места и их иерархия
- `Recs` — общий реестр записей всех типов
- `SourceDetails` — связи источников с конкретными записями
- `Sources` — источники
- `TaskDetails` — связи задач с конкретными записями
- `Tasks` — задачи
- `ValuesDates` — значения полей типа дата
- `ValuesLinks` — значения полей типа ссылка
- `ValuesNum` — значения полей типа число
- `ValuesStr` — значения полей типа строка

То есть формат шире, чем просто `Persons` / `Families` / `Events`. В нём также есть общий реестр записей (`Recs`), таблицы значений и служебные таблицы для источников, документов, задач и журнала изменений.

## Основные таблицы

### `Persons`

Содержит базовые записи персон.

Подтверждённые столбцы:

- `id INTEGER PRIMARY KEY`
- `sex INTEGER`

Наблюдаемые значения:

- `sex = 1` -> мужчина
- `sex = 2` -> женщина

Большая часть человекочитаемых данных о персоне хранится не в самой таблице `Persons`, а в `ValuesStr`, `ValuesLinks` и иногда в `ValuesNum`.

### `Families`

Содержит базовые записи семей, родов и связанных групп.

Подтверждённые столбцы:

- `id INTEGER PRIMARY KEY`
- `color INTEGER`

Человекочитаемые названия семей хранятся в `ValuesStr` при `rec_table = 9`.

### `Events`

Содержит базовые записи событий.

Подтверждённые столбцы:

- `id INTEGER PRIMARY KEY`
- `et_id INTEGER NOT NULL REFERENCES EventTypes(id)`

Важное исправление:

- В `yaman-test.atdb` полезная нагрузка событий в `ValuesDates`, `ValuesLinks`, `ValuesStr` и `ValuesNum` привязана к **`Events.id`**, а не к `EventDetails.id`.
- То есть `rec_table = 7` в таблицах значений соответствует именно **записи события**, а `rec_id = Events.id`.

### `EventDetails`

Содержит связи «персона <-> событие» и роль персоны в событии.

Подтверждённые столбцы:

- `id INTEGER PRIMARY KEY`
- `p_id INTEGER NOT NULL REFERENCES Persons(id)`
- `e_id INTEGER NOT NULL REFERENCES Events(id)`
- `er_id INTEGER NOT NULL REFERENCES EventRoles(id)`
- `e_ord INTEGER`
- `p_ord INTEGER`

Назначение:

- связывает людей с событием;
- хранит роли участников внутри события;
- задаёт порядок участников.

### `EventRoles`

Содержит справочник ролей участников событий.

Подтверждённые столбцы:

- `id INTEGER PRIMARY KEY`
- `et_id INTEGER REFERENCES EventTypes(id)`
- `maxcount INTEGER`
- `ord INTEGER`
- `roletype INTEGER`
- `ismain INTEGER`

`EventRoles` — это реальный мост между ролью участника и типом события.

Подтвержденные значения флагов по controlled diff пользовательской роли:

- `maxcount = 1` -> включен чекбокс "Не более одного участника с этой ролью"; в событие нельзя добавить больше одной персоны с этой ролью.
- `maxcount = NULL` -> ограничение отключено; можно добавить любое количество персон с этой ролью.
- `ismain = 1` -> роль основная.
- `ismain = NULL` -> роль второстепенная; соответствует включенному чекбоксу "Второстепенная роль".

### `EventTypes`

Содержит справочник типов событий.

Подтверждённые столбцы:

- `id INTEGER PRIMARY KEY`
- `ord INTEGER NOT NULL`

Важное замечание:

- `EventTypes` в тестовой базе хранит только идентификаторы и порядок сортировки.
- Человекочитаемые названия типов событий напрямую в этой таблице не хранятся.

### `Places`

Содержит места и связи между ними.

Подтверждённые столбцы:

- `id INTEGER PRIMARY KEY`
- `parent_id INTEGER REFERENCES Places(id)`
- `group_id INTEGER`
- `maskfull INTEGER`
- `maskshort INTEGER`
- `global_id BLOB`

Места образуют иерархию через `parent_id`.

### `Global`

Содержит общие метаданные базы.

Подтверждённые столбцы:

- `id INTEGER PRIMARY KEY`
- `version INTEGER`
- `guid TEXT`
- `srcguid TEXT`
- `mainlang TEXT`
- `params TEXT`

## Общий слой записей

### `Recs`

Содержит общий реестр записей всех типов.

Подтверждённые столбцы:

- `id INTEGER PRIMARY KEY`
- `rec_table INTEGER NOT NULL`
- `rec_id INTEGER NOT NULL`
- `guid BLOB NOT NULL`
- `di DATETIME NOT NULL`
- `de DATETIME`
- `lconf INTEGER`
- `ltrust INTEGER`
- `fav INTEGER`

Эта таблица важна, потому что внешние ключи в `Values*`, `DocumentDetails`, `SourceDetails` и `TaskDetails` ссылаются на пару `(rec_table, rec_id)` через `Recs`.

Иными словами, формат содержит общий слой идентификации записей поверх предметных таблиц.

## Таблицы значений

### `ValuesStr`

Содержит строковые значения полей.

Подтверждённые столбцы:

- `id INTEGER PRIMARY KEY`
- `f_id INTEGER NOT NULL REFERENCES Fields(id)`
- `rec_table INTEGER NOT NULL`
- `rec_id INTEGER NOT NULL`
- `lang TEXT`
- `vstr TEXT`
- `lconf INTEGER`
- `ltrust INTEGER`

### `ValuesNum`

Содержит числовые значения полей.

Подтверждённые столбцы:

- `id INTEGER PRIMARY KEY`
- `f_id INTEGER NOT NULL REFERENCES Fields(id)`
- `rec_table INTEGER NOT NULL`
- `rec_id INTEGER NOT NULL`
- `vnum REAL`
- `vnum2 REAL`
- `lconf INTEGER`
- `ltrust INTEGER`

Исправление относительно предыдущей версии документа:

- `ValuesNum` тоже содержит `rec_table`, а не только `rec_id`.

### `ValuesDates`

Содержит значения полей типа дата и диапазоны дат.

Подтверждённые столбцы:

- `id INTEGER PRIMARY KEY`
- `f_id INTEGER NOT NULL REFERENCES Fields(id)`
- `rec_table INTEGER NOT NULL`
- `rec_id INTEGER NOT NULL`
- `d`, `m`, `y`
- `d2`, `m2`, `y2`
- `calendar`, `calendar2`
- `type`
- `sort`, `sort2`, `sort3`, `sort4`
- `lconf`, `ltrust`

Важное исправление:

- даты в формате богаче, чем просто `год/месяц/день`;
- поддерживаются диапазоны дат и дополнительные служебные поля для точности и сортировки.

### `ValuesLinks`

Содержит ссылочные значения полей, связывающие записи между собой.

Подтверждённые столбцы:

- `id INTEGER PRIMARY KEY`
- `f_id INTEGER NOT NULL REFERENCES Fields(id)`
- `rec_table INTEGER NOT NULL`
- `rec_id INTEGER NOT NULL`
- `vlink_table INTEGER NOT NULL`
- `vlink_id INTEGER NOT NULL`
- `lconf INTEGER`
- `ltrust INTEGER`

Это основной механизм типизированных связей между записями.

## Таблица `Fields`

Содержит определения полей и их привязку к типам записей.

Подтверждённые столбцы:

- `id INTEGER PRIMARY KEY`
- `tablecode INTEGER NOT NULL`
- `datatype INTEGER`
- `area TEXT`
- `defval INTEGER`
- `noautofill INTEGER`
- `icon BLOB`
- `et_id INTEGER REFERENCES EventTypes(id)`
- `et_ord INTEGER`

Важное исправление:

- `Fields.area` в `yaman-test.atdb` **не является надёжным человекочитаемым именем поля**.
- В тестовой базе `area` часто равно `NULL`, а иногда содержит короткие маркеры вроде `MF`, `mf`, `mF`.
- Поэтому `Fields` нужно рассматривать как реестр определений полей, а не как готовый словарь семантики.
- `Fields.et_ord` расшифровывается как event type order и задает порядок поля.

## Подтверждённые соответствия `rec_table`

Следующие значения подтверждены реальным использованием в `yaman-test.atdb`:

- `7` -> `Events`
- `9` -> `Families`
- `13` -> `Persons`
- `14` -> `Places`

Это подтверждается тем, что соответствующие строки в `Values*` ссылаются на реальные идентификаторы записей из этих таблиц.

Другие коды `rec_table` тоже присутствуют в `Recs`, но эта тестовая база не даёт достаточно прямых доказательств, чтобы безопасно документировать их все.

## Controlled diff для неподтвержденных сущностей

Коды и поля со статусом `unknown` или `needs more samples` нельзя повышать до `confirmed` по одному совпадению count или по `Fields.area`. Для них нужен controlled diff: две локальные before/after базы, одно действие в "Древо Жизни 6", redacted snapshots и sanitized diff.

Текущие кандидаты для экспериментов:

- `rec_table=6` — пользовательские роли событий; controlled diff подтвердил, что `Recs.rec_id` совпадает с `EventRoles.id`, `f_id=132` хранит "Название мужской роли", а `f_id=133` хранит "Название женской роли".
- `rec_table=10` — "Поля данных"; controlled diff для поля персоны подтвердил, что `Recs.rec_id` совпадает с `Fields.id`, `f_id=135` хранит название поля, `Fields.tablecode=13` означает поле персоны, а `Fields.datatype=12` соответствует типу "Текст".
- В UI пользовательские поля можно создавать для сущностей: "Персоны", "События", "Документы", "Места", "Источники", "Роды", "Задачи"; подтверждено `Fields.tablecode=13` -> "Персоны", `7` -> "События", `4` -> "Документы", `14` -> "Места", `16` -> "Источники", `9` -> "Роды", `18` -> "Задачи".
- Для пользовательских полей подтверждены `Fields.datatype=2` -> "Целое число", `5` -> "Логическое значение", `6` -> "Место", `7` -> "URL", `8` -> "Email", `12` -> "Текст".
- Controlled diff создания задачи подтвердил `rec_table=18` -> `Tasks`, `Recs.rec_id=Tasks.id`, `ValuesStr f_id=54` -> название задачи.
- Controlled diff привязки задачи к персоне подтвердил `rec_table=21` -> `TaskDetails`, `Recs.rec_id=TaskDetails.id`; target-связь хранится в `TaskDetails(rec_table, rec_id)` вместе с `t_id=Tasks.id`.
- Значения пользовательских полей сохраняются в таблицах `Values*` по коду целевой сущности: для текстового поля персоны `Fields.id=205` значение хранится в `ValuesStr(rec_table=13, rec_id=Persons.id, f_id=205)`.
- Для пользовательского поля персоны типа "Целое число" (`Fields.id=206`) значение хранится в `ValuesNum(rec_table=13, rec_id=Persons.id, f_id=206)`, число лежит в `vnum`, `vnum2` остается `NULL`.
- Для пользовательского поля места типа "Логическое значение" (`Fields.id=209`) включенное значение хранится в `ValuesNum(rec_table=14, rec_id=Places.id, f_id=209)` как `vnum=1`, `vnum2=NULL`.
- Для пользовательского поля задачи типа "Место" (`Fields.id=212`) значение хранится в `ValuesLinks(rec_table=18, rec_id=Tasks.id, f_id=212)`; ссылка на место использует `vlink_table=14`, `vlink_id=Places.id`.
- Для пользовательского поля источника типа "URL" (`Fields.id=210`) значение хранится в `ValuesStr(rec_table=16, rec_id=Sources.id, f_id=210)`.
- Для пользовательского поля рода типа "Email" (`Fields.id=211`) значение хранится в `ValuesStr(rec_table=9, rec_id=Families.id, f_id=211)`.
- `rec_table=8` — low-count unknown запись; смысл не подтверждается текущей fixture без дополнительного UI-действия.
- `f_id` со статусом `unknown` / `needs more samples` — переносить в mapping только после структурного diff evidence.

Confidence labels:

- `confirmed` — есть прямое структурное соответствие и/или повторяемый controlled diff.
- `observed` — структура видна, но доказательство косвенное, например count match.
- `needs more samples` — есть гипотеза, но нужна еще одна независимая база или повторяемый UI diff.
- `unknown` — смысл не установлен.

Перенос evidence в публичную документацию:

1. Запустить CLI с `--debug` и сохранить verbose/debug artifacts только в ignored path.
2. Проверить `npm run schema:atdb:diff:check`.
3. В публичный Markdown переносить только affected tables, row count deltas, `rec_table`, `f_id`, `datatype`, link targets и confidence.
4. Не переносить raw `ValuesStr`, GUID, document paths, source text, имена, места или заметки.

Безопасный expected output выглядит так:

```text
[safe-atdb-schema-diff] changes: <count>
[safe-atdb-schema-diff] affected-rec-tables: <codes|none>
[safe-atdb-schema-diff] watched-rec-tables: <6,8,10,18,21|none>
```

Если CLI сообщает unsupported artifact version, unsafe snapshot или missing required section, результат считается blocker для интерпретации diff.

## Подтверждённые и наблюдаемые соответствия `f_id`

### Персоны (`rec_table = 13`)

Подтверждено по структурному использованию `ValuesStr` и ручной валидации смысла полей:

- `64` -> фамилия / базовая форма фамилии
- `65` -> альтернативная женская форма фамилии
- `66` -> имя
- `67` -> отчество
- `73` -> социальный статус / занятие
- `89` -> произвольная заметка

Наблюдаемое / вероятное:

- `63` в `ValuesLinks` -> ссылка от персоны к `Places` (`vlink_table = 14`)
- `83` в `ValuesLinks` -> ссылка от персоны к `Families` (`vlink_table = 9`)
- `155` в `ValuesStr` -> конфессия / религиозная принадлежность
- `202` в `ValuesNum` -> пользовательское checkbox-поле
- `201` в `ValuesNum` -> пользовательское checkbox-поле
- `203` в `ValuesNum` -> пользовательское checkbox-поле

Примеры реальных значений намеренно не публикуются: для проверки используйте только `f_id`, `rec_table`, counts и redacted snapshot.

### Семьи (`rec_table = 9`)

Подтверждено по структурному использованию `ValuesStr` и ручной валидации смысла полей:

- `48` -> мужская форма фамилии семьи
- `49` -> женская форма фамилии семьи
- `50` -> отображаемое имя семьи / фамилия во множественном числе
- `52` -> комментарий

Примеры реальных значений намеренно не публикуются: в публичной документации остаются только field IDs и назначение полей.

### Места (`rec_table = 14`)

Подтверждено по структурному использованию `ValuesStr` и ручной валидации смысла полей:

- `93` -> полное название места
- `94` -> краткое название места
- `104` -> комментарий

Наблюдаемое / вероятное:

- `95` в `ValuesDates` -> дата или датировочная метка, связанная с местом
- `97` в `ValuesNum` -> числовой параметр, связанный с местом
- `99` в `ValuesStr` -> "Ссылка (URL)" у места

### События (`rec_table = 7`)

Подтверждено по структурному использованию `Values*` и ручной валидации смысла полей:

- `29` в `ValuesDates` -> дата события
- `28` в `ValuesLinks` -> ссылка события на `Places` (`vlink_table = 14`)
- `37` в `ValuesStr` -> заметка / описание события
- `38` в `ValuesStr` -> причина смерти или дополнительная текстовая заметка
- `39` в `ValuesStr` -> "Род войск" в типе события "Служба в армии"
- `40` в `ValuesStr` -> "Воинское звание" в типе события "Служба в армии"
- `41` в `ValuesStr` -> "Место работы" в типе события "Устройство на работу"
- `42` в `ValuesStr` -> "Должность" в типе события "Устройство на работу"
- `117` в `ValuesStr` -> "Образовательное учреждение" в типе события "Обучение"

Наблюдаемое / вероятное:

- `204` в `ValuesNum` -> числовой флаг на уровне события для типа события `34`
- `27` в `ValuesStr` -> дублирует `f_id=38` с припиской названия поля (semantic wording needs more samples)

### Документы (`rec_table = 4`)

Подтверждено:

- `8` в `ValuesLinks` -> "Место" у документа (ссылка на `Places`)
- `9` в `ValuesStr` -> "Описание"
- `10` в `ValuesDates` -> "Дата"
- `11` в `ValuesStr` -> "Тип"
- `16` в `ValuesStr` -> "Комментарий"
- `128` в `ValuesNum` -> "Координаты"

### Ссылки на источники (`rec_table = 15`)

Подтверждено:

- `105` в `ValuesStr` -> "Позиция в источнике"
- `108` в `ValuesStr` -> "Цитата"

### Задачи (`rec_table = 18`)

Подтверждено:

- `54` в `ValuesStr` -> название задачи
- `57` в `ValuesStr` -> комментарий задачи

### Служебные коды для пользовательских сущностей

Подтверждено:

- `f_id=134` (`tablecode=8`) -> "Название типа события" в настройках пользовательского типа события
- `f_id=135` (`tablecode=10`) -> "Название поля" в настройках пользовательского поля данных

Примеры данных из `ValuesStr` намеренно не публикуются: для событий фиксируются только field IDs, типы связей и безопасные описания назначения.

## Модель событий

В тестовой базе модель событий устроена так:

1. `Events` хранит само событие.
2. `EventDetails` хранит участников этого события.
3. `EventRoles` определяет смысл каждой роли участника.
4. `ValuesDates` / `ValuesLinks` / `ValuesStr` / `ValuesNum` при `rec_table = 7` хранят полезную нагрузку события.

### Типы событий, реально используемые в `yaman-test.atdb`

Наблюдаемые значения `Events.et_id`:

- `1` -> рождение
- `2` -> смерть
- `3` -> брак
- `34` -> захоронение

Эти значения выведены по структуре ролей и текстовому содержимому и согласуются с данными тестовой базы.

### Наблюдаемые шаблоны ролей

Для событий рождения (`et_id = 1`) в базе присутствуют роли:

- `EventRoles.id = 1` -> основная персона (ребёнок)
- `EventRoles.id = 2` -> отец
- `EventRoles.id = 3` -> мать

Для событий смерти (`et_id = 2`):

- `EventRoles.id = 4` -> основная персона

Для брака (`et_id = 3`):

- `EventRoles.id = 5` -> супруг 1
- `EventRoles.id = 6` -> супруг 2

Важная оговорка:

- идентификаторы ролей `1`, `2`, `3`, `4`, `5`, `6` подтверждены именно в этой тестовой базе;
- их нельзя автоматически считать универсальными для всех `.atdb` без проверки таблицы `EventRoles`.

## Корректный путь получения даты и места события

Надёжный путь в `yaman-test.atdb` такой:

1. Начать с `Events.id`.
2. Прочитать `ValuesDates`, где `rec_table = 7 AND rec_id = Events.id`, чтобы получить дату события.
3. Прочитать `ValuesLinks`, где `rec_table = 7 AND rec_id = Events.id AND vlink_table = 14`, чтобы получить связанное место.
4. Использовать `EventDetails`, чтобы перечислить участников события.

Это исправляет прежнюю версию документа, где полезная нагрузка события ошибочно описывалась как привязанная к `EventDetails.id`.

## Извлечение родителей из событий рождения

Для `yaman-test.atdb` родителей можно извлекать так:

1. Найти событие персоны через `EventDetails`.
2. Присоединить `EventRoles` и оставить строки, где `EventRoles.et_id = 1`, чтобы выделить события рождения.
3. Внутри одного и того же `e_id` найти:
   - роль `1` -> ребёнок
   - роль `2` -> отец
   - роль `3` -> мать

Практическая рекомендация:

- лучше присоединять `EventRoles`, а не полагаться только на жёстко зашитый `er_id`;
- использовать жёстко заданные ID ролей стоит только тогда, когда вы точно работаете с файлами того же шаблона, что и `yaman-test.atdb`.

## Практические замечания по парсингу

- Не стоит предполагать, что важные текстовые поля находятся в базовых таблицах сущностей: большая часть семантики живёт в `Values*`.
- Не стоит предполагать, что `Fields.area` содержит читаемые имена полей.
- Не стоит предполагать, что `rec_table = 7` означает `EventDetails`; в тестовой базе это `Events`.
- Не стоит переносить в код огромные списки типов событий из вторичных источников без проверки конкретного файла; лучше смотреть `Events`, `EventTypes` и `EventRoles`.
- Для проверки ссылочной целостности полезно использовать `Recs` как канонический реестр записей.

## Рекомендуемые SQL-проверки

Полезные запросы при анализе другого `.atdb`-файла:

```sql
SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;
SELECT * FROM Global;
SELECT rec_table, COUNT(*) FROM Recs GROUP BY rec_table ORDER BY rec_table;
SELECT f_id, COUNT(*) FROM ValuesStr WHERE rec_table = 13 GROUP BY f_id ORDER BY f_id;
SELECT f_id, COUNT(*) FROM ValuesDates WHERE rec_table = 7 GROUP BY f_id ORDER BY f_id;
SELECT e.et_id, COUNT(*) FROM Events e GROUP BY e.et_id ORDER BY COUNT(*) DESC;
SELECT er.et_id, er.id, er.ord, er.roletype, er.ismain FROM EventRoles er ORDER BY er.et_id, er.ord;
```

## See Also

- [Architecture](architecture.md) — где эти таблицы используются в приложении
- [Codebase Analysis](codebase-analysis.md) — ограничения текущего parser flow
- [Refactoring Plan](refactoring-plan.md) — как будет меняться parser layer
