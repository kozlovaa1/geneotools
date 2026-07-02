[← Архитектура](architecture.md) · [К README](../README.md) · [Анализ кода →](codebase-analysis.md)

# Формат ATDB

## Обзор

`.atdb` файлы программы «Древо Жизни 6» являются SQLite-базами. GeneoTools работает с ними локально: открывает файл через `sql.js`, читает структурные таблицы, строит типизированный `ParsedAtdb` и применяет только явно разрешённые изменения при экспорте.

Документация по формату остаётся публично-безопасной. В ней можно фиксировать table names, counts, `rec_table`, `f_id`, `datatype`, link targets и confidence labels. Нельзя публиковать имена, места, заметки, пути документов, GUID, source text или raw `ValuesStr`.

## Основные таблицы

| Таблица | Назначение |
|---------|------------|
| `Persons` | Базовые строки персон |
| `Families` | Роды, а не нуклеарные семьи |
| `Events` | События с типом `et_id` |
| `EventDetails` | Участие персон в событиях и связь с ролями |
| `EventTypes` | Каталог типов событий |
| `EventRoles` | Каталог ролей внутри типов событий |
| `Places` | Места и иерархия мест |
| `Fields` | Каталог системных и пользовательских полей |
| `Recs` | Общий реестр записей разных типов |
| `ValuesStr` | Строковые значения дополнительных полей |
| `ValuesNum` | Числовые и логические значения |
| `ValuesDates` | Даты |
| `ValuesLinks` | Ссылки на другие сущности |
| `Global` | Метаданные базы |

Формат шире, чем текущий UI GeneoTools. Приложение читает только нужные для пользовательского сценария сущности, а неизвестные или неподдержанные структуры должно сохранять без изменения.

## `Families` означает «Роды»

В контексте ATDB6 таблица `Families` означает **роды**. Не интерпретируйте её как семейную пару и не выводите из неё роли «муж», «жена» или «дети».

Связь персоны с родом хранится отдельно и не равна браку, родительству или составу нуклеарной семьи.

## `Recs` и таблицы `Values*`

Многие смысловые поля не лежат в базовых таблицах сущностей. Они хранятся в `ValuesStr`, `ValuesNum`, `ValuesDates` и `ValuesLinks` по связке:

| Поле | Смысл |
|------|-------|
| `rec_table` | Код типа сущности |
| `rec_id` | ID записи внутри соответствующей таблицы |
| `f_id` | ID поля из каталога `Fields` или системного mapping |
| `vstr`, `vnum`, `vdate`, `vlink_id` | Значение нужного типа |
| `vlink_table` | Код целевой таблицы для ссылок |

Поэтому readers и writers не должны полагаться на один hard-coded список кодов. Канонические правила живут в `lib/atdb/mapping.json`, а runtime-разрешение схемы выполняет `AtdbSchemaContext`.

## Даты и иерархия мест

Даты ATDB хранятся в `ValuesDates`. Reader сохраняет отображаемое значение и безопасную metadata-модель: основные сегменты даты, тип диапазона или приближения, календарные и confidence-поля, если такие колонки есть в конкретной базе.

Write-safe запись дат разрешена только для простых дат primary life-event рождения и смерти: `YYYY-MM-DD`, `YYYY-MM-00` или `YYYY-00-00`. Если существующая строка даты содержит диапазон, приблизительность, неизвестный `type` или неподдержанную metadata, strict rebuild должен остановиться до записи, чтобы не потерять смысл исходной даты.

Иерархия мест читается из `Places.parent_id`, когда колонка присутствует. UI показывает draft-aware полный путь места: само место, дата наименования места при наличии и родительские места. `placeNamingDate` читается для отображения, но остаётся read-only.

## Роли событий

`EventDetails.er_id` нельзя считать универсальной семантикой роли само по себе. Роль нужно интерпретировать через `EventRoles` и связанный тип события:

```text
EventDetails.er_id
  -> EventRoles.id
  -> EventRoles.et_id
  -> EventTypes.id
```

Legacy IDs допустимы только как fallback для совместимости. Новая логика должна предпочитать каталог ролей и безопасно диагностировать неоднозначность.

## Канонический mapping

`lib/atdb/mapping.json` описывает правила формата в машинно-читаемом виде. Его используют:

- TypeScript runtime через `lib/atdb/mapping.ts`;
- readers и writers через `AtdbSchemaContext`;
- проверочные скрипты для поиска конфликтующих hard-coded кодов.

Уровни правил:

| Уровень | Как использовать |
|---------|------------------|
| `invariant` | Разрешено для чтения и write-safe записи |
| Контекстное правило | Только осторожное чтение; запись запрещена |
| `legacy-fallback` | Совместимый fallback с безопасной диагностикой |
| unknown | Сохранять как данные без универсальной семантики |

Write-safe запись разрешена только для invariant-правил. Если поле, роль или link target не разрешены однозначно, strict rebuild должен остановиться до записи.

## Safe write contract

Публичный write API работает через `AtdbChangeSet`. Разрешён только update-only scope существующих записей:

| Сущность | Поля |
|----------|------|
| `Person` | `firstName`, `lastName`, `birthLastName`, `patronymic`, `gender`, `birthDate`, `deathDate`, `birthPlaceId`, `deathPlaceId` |
| `Family` | `familyName`, `husbandLastName`, `wifeLastName`, `comment`, `color` |
| `Event` | `placeId` |
| `Place` | `name`, `shortName`, `comment`, `parentId` |

Запрещены:

- создание и удаление `Persons`, `Families`, `Events`, `Places`;
- изменение `metadata.*`, `Global`, `Fields`, `Recs`, `EventRoles`;
- изменение `Events.et_id`, участников событий и любых полей события, кроме `placeId`;
- запись non-simple `ValuesDates`, `placeNamingDate` и неподдержанной metadata дат;
- запись custom, legacy, контекстных или неизвестных `Values*`;
- массовое удаление всех значений сущности.

`null` или `undefined` в `AtdbChangeSet` означает очистку write-safe значения. Для `Values*` это удаление owned row, для `Family.color` запись `NULL`, для `Person.gender` нормализация в `Unknown` (`Persons.sex = 0`). Пустая строка остаётся строкой.

## Strict rebuild

Экспорт проходит через несколько защитных этапов:

1. Проверка SQLite header и открытие базы.
2. Чтение `AtdbSchemaContext`.
3. Preflight: существование записей, допустимые значения, отсутствие duplicate updates, доступность целевых `Places.id`, отсутствие циклов в `Places.parent_id`.
4. Write phase внутри `SAVEPOINT` / `ROLLBACK TO` / `RELEASE`.
5. `PRAGMA integrity_check`.
6. Повторный parse собранного буфера.
7. Проверка видимости поддержанных изменений.
8. Сравнение safe fingerprints для защищённых и неизвестных структур.

Ошибки наружу возвращаются как typed result/error с безопасным formatter: code, message, counts и redacted context без SQL rows и пользовательских значений.

## Тестовый контур parse/build

ATDB-проверки делятся на fixture-free unit gates и smoke gates поверх разрешённых structural artifacts.

- `npm run test:atdb:dates` фиксирует поддержанные формы дат, metadata simple/non-simple дат и безопасное отображение диапазонов.
- `npm run test:atdb:parser-contract` строит synthetic SQLite fixture в памяти и проверяет, что parser читает родителей через `EventRoles`, берёт даты из event-level `ValuesDates`, назначает места рождения/смерти только primary участнику события, читает `Event.placeId`, `Place.parentId` и переживает remapped role IDs.
- `npm run smoke:atdb:matrix` выполняет `parse -> build -> reparse` и hard-fail'ит не только count drift по сущностям, но и aggregate drift по безопасным ключам: количество персон с родителями, датами, местами рождения/смерти, а также событий с датой и участниками.
- `npm run schema:atdb:fixtures:check` объединяет schema, diff, smoke, mapping и redaction checks; missing local-only artifacts допустимы только как controlled skip, а tracked baseline должен существовать.
- `npm run test:atdb:fixtures:missing-local` закрепляет synthetic failure paths без чтения пользовательских `.atdb`.

Общие script-level проверки компилируют `lib/**/*.ts` через `scripts/atdb-test-harness.mjs`. В обычном выводе эти скрипты печатают только safe prefixes, scenario labels, counts, aggregate keys, statuses и reason codes.

## Проверки

```bash
npm run mapping:atdb:check
npm run test:atdb:dates
npm run test:atdb:parser-contract
npm run test:atdb:write-safety
npm run test:atdb:rebuild-contract
npm run test:atdb:edit-draft
npm run test:atdb:batch-edit
npm run test:atdb:table-view
npm run test:atdb:table-components
npm run smoke:atdb:matrix
npm run schema:atdb:fixtures:check
npm run test:atdb:fixtures:missing-local
```

Эти проверки фиксируют mapping, date helpers, parser contract, write-safety, strict rebuild failure paths, локальный draft state, table query contract, component wiring, массовое редактирование и parse/build round-trip без публикации пользовательских данных.

## См. также

- [Архитектура](architecture.md) — где находится parse/build flow
- [Начало работы](getting-started.md) — как запускать приложение и проверки
- [План рефакторинга](refactoring-plan.md) — как будет расширяться поддержка формата
