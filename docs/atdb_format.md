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
| `Person` | `firstName`, `lastName`, `patronymic`, `gender`, `birthPlaceId`, `deathPlaceId` |
| `Family` | `familyName`, `husbandLastName`, `wifeLastName`, `comment`, `color` |
| `Place` | `name`, `shortName`, `comment` |

Запрещены:

- создание и удаление `Persons`, `Families`, `Events`, `Places`;
- изменение `metadata.*`, `Global`, `Fields`, `Recs`, `EventRoles`;
- изменение `Events.et_id`, участников событий и дат;
- запись custom, legacy, контекстных или неизвестных `Values*`;
- массовое удаление всех значений сущности.

`null` или `undefined` в `AtdbChangeSet` означает очистку write-safe значения. Для `Values*` это удаление owned row, для `Family.color` запись `NULL`, для `Person.gender` нормализация в `Unknown` (`Persons.sex = 0`). Пустая строка остаётся строкой.

## Strict rebuild

Экспорт проходит через несколько защитных этапов:

1. Проверка SQLite header и открытие базы.
2. Чтение `AtdbSchemaContext`.
3. Preflight: существование записей, допустимые значения, отсутствие duplicate updates, доступность целевых `Places.id`.
4. Write phase внутри `SAVEPOINT` / `ROLLBACK TO` / `RELEASE`.
5. `PRAGMA integrity_check`.
6. Повторный parse собранного буфера.
7. Проверка видимости поддержанных изменений.
8. Сравнение safe fingerprints для защищённых и неизвестных структур.

Ошибки наружу возвращаются как typed result/error с безопасным formatter: code, message, counts и redacted context без SQL rows и пользовательских значений.

## Проверки

```bash
npm run mapping:atdb:check
npm run test:atdb:write-safety
npm run test:atdb:rebuild-contract
npm run test:atdb:edit-draft
npm run test:atdb:batch-edit
```

Эти проверки фиксируют mapping, write-safety, strict rebuild failure paths, локальный draft state и массовое редактирование без публикации пользовательских данных.

## См. также

- [Архитектура](architecture.md) — где находится parse/build flow
- [Начало работы](getting-started.md) — как запускать приложение и проверки
- [План рефакторинга](refactoring-plan.md) — как будет расширяться поддержка формата
