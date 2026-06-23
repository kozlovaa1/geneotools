[← Анализ кода](codebase-analysis.md) · [К README](../README.md)

# План рефакторинга GeneoTools

## Цели

- Сохранять локальную и безопасную обработку `.atdb`.
- Уменьшать сложность UI без расширения write scope.
- Развивать поддержку формата через mapping и validation, а не через разрозненные literals.
- Держать документацию публично-безопасной и синхронизированной с кодом.

## Уже выполнено

| Этап | Результат |
|------|-----------|
| Базовая стабилизация качества | `npm run lint` используется как основной gate |
| Единые доменные типы | `Person`, `Family`, `Event`, `Place`, `ParsedAtdb` живут в `lib/types.ts` |
| Декомпозиция ATDB-процессора | `lib/sqlProcessor.ts` стал фасадом, internals вынесены в `lib/atdb/` |
| Канонический mapping | `lib/atdb/mapping.json` стал источником числовых правил |
| Strict rebuild contract | `AtdbChangeSet`, preflight, transaction и post-build validation защищают экспорт |
| Draft helpers | `lib/atdbEditDraft.ts` собирает изменения без мутации `ParsedAtdb` |
| Table query helpers | `lib/atdbTableView.ts` отвечает за поиск, фильтры, сортировку и visible IDs |
| Batch edit helpers | `lib/atdbBatchEdit.ts` строит предпросмотр и применяет изменения только в draft |
| Разделение таблиц | `components/DataTable.tsx` стал router-wrapper, entity-specific таблицы и table primitives вынесены в `components/atdb-table/` |

## Следующие этапы

### Этап 1 — Browser smoke для основного сценария

**Задачи:**

- Автоматизировать upload → edit → download на локальном тестовом файле пользователя или специально подготовленной безопасной базе.
- Проверять, что no-op export остаётся отключённым.
- Проверять, что скачивание появляется только после ненулевого `AtdbChangeSet`.

**Критерий готовности:**

- UI-regression в загрузке, draft state или скачивании ловится до ручного релиза.

### Этап 2 — Производительность больших таблиц

**Задачи:**

- Измерить стоимость рендера строк по вкладкам.
- Добавить виртуализацию или paging без поломки selection и visible IDs.
- Убедиться, что batch edit область «видимые строки» остаётся предсказуемой.

**Критерий готовности:**

- Большие базы не создают заметных зависаний при поиске, сортировке и переключении вкладок.

### Этап 3 — Расширение mapping без расширения риска

**Задачи:**

- Добавлять новые invariant-правила только вместе с validation и тестами.
- Оставлять custom, legacy и неоднозначные значения read-only до явного подтверждения write-safety.
- Держать диагностику redacted.

**Критерий готовности:**

- Новый write path проходит preflight, transaction, post-build validation и safe fingerprint checks.

### Этап 4 — Документация и DX

**Задачи:**

- Поддерживать README как landing page, а детали хранить в `docs/`.
- Обновлять `AGENTS.md`, когда меняется структура проекта.
- Не публиковать raw-значения из пользовательских баз.

**Критерий готовности:**

- Новый разработчик понимает запуск, архитектуру, safe write contract и ограничения без чтения истории задач.

## Definition of Done

- `npm run lint` проходит.
- `npx tsc --noEmit` проходит.
- Релевантные `test:atdb:*` проверки проходят.
- Для изменений в таблицах проходит `npm run test:atdb:table-components`.
- Изменение не расширяет write scope без mapping/validation покрытия.
- Документация обновлена вместе с кодом.
- В публичных artifacts нет пользовательских raw-значений.

## См. также

- [Анализ кода](codebase-analysis.md) — почему эти этапы остаются актуальными
- [Архитектура](architecture.md) — текущие границы зависимостей
- [Начало работы](getting-started.md) — команды и ручной smoke
