[← Начало работы](getting-started.md) · [К README](../README.md) · [Формат ATDB →](atdb_format.md)

# Архитектура

## Обзор

GeneoTools устроен как client-first modular app внутри одного Next.js приложения. UI управляет пользовательским сценарием, а вся логика чтения, нормализации, безопасного редактирования и сборки `.atdb` находится в `lib/`.

Главное правило: компоненты не выполняют SQL-запросы напрямую и не знают деталей SQLite-схемы.

## Структура

```text
geneotools/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── atdb-table/
│   │   ├── AtdbTablePrimitives.tsx
│   │   ├── EventTable.tsx
│   │   ├── FamilyTable.tsx
│   │   ├── PersonTable.tsx
│   │   ├── PlaceTable.tsx
│   │   └── useAtdbTableEditors.tsx
│   ├── BulkEditDialog.tsx
│   ├── DataTable.tsx
│   ├── EditableCell.tsx
│   ├── FileUploader.tsx
│   ├── Modal.tsx
│   ├── ScrollableDataTable.tsx
│   └── TableQueryToolbar.tsx
├── docs/
│   ├── architecture.md
│   ├── atdb_format.md
│   ├── codebase-analysis.md
│   ├── getting-started.md
│   └── refactoring-plan.md
├── lib/
│   ├── atdb/
│   │   ├── mapping.json
│   │   ├── mapping.ts
│   │   ├── mappingTypes.ts
│   │   ├── readers/
│   │   ├── writers/
│   │   ├── rebuildContract.ts
│   │   ├── rebuildDiff.ts
│   │   ├── rebuildValidation.ts
│   │   ├── schemaContext.ts
│   │   └── transaction.ts
│   ├── atdbBatchEdit.ts
│   ├── atdbEditDraft.ts
│   ├── atdbIntegerInput.ts
│   ├── atdbTableView.ts
│   ├── buildAtdb.ts
│   ├── initSqlJs.ts
│   ├── parseAtdb.ts
│   ├── sqlProcessor.ts
│   ├── types.ts
│   └── utils.ts
├── public/
├── scripts/
├── Dockerfile
└── docker-compose.yml
```

## Слои

| Слой | Файлы | Ответственность |
|------|-------|-----------------|
| App | `app/page.tsx`, `app/layout.tsx` | Загрузка файла, состояние сценария, ошибки, экспорт |
| Components | `components/*`, `components/atdb-table/*` | Отображение, controls, таблицы, модальные окна |
| Domain helpers | `lib/atdbEditDraft.ts`, `lib/atdbBatchEdit.ts`, `lib/atdbTableView.ts` | Чистая логика draft, массовых операций, поиска и сортировки |
| ATDB facade | `lib/sqlProcessor.ts`, `lib/parseAtdb.ts`, `lib/buildAtdb.ts` | Публичный parse/build API |
| ATDB internals | `lib/atdb/*` | Readers, writers, mapping, validation, transaction helper |
| Scripts | `scripts/*` | Проверки mapping, write-safety, rebuild contract и вспомогательные gates |

## Поток чтения

```text
FileUploader
  -> app/page.tsx
  -> динамический импорт lib/sqlProcessor.ts
  -> parseAtdb(buffer)
  -> sql.js Database
  -> readers + AtdbSchemaContext
  -> ParsedAtdb
  -> React state
  -> atdbTableView
  -> ScrollableDataTable / TableQueryToolbar / DataTable
  -> PersonTable / FamilyTable / EventTable / PlaceTable
```

## Поток редактирования

```text
DataTable / entity-specific tables / EditableCell
  -> local edit draft state
  -> atdbEditDraft
  -> счетчик изменённых полей и записей
```

Массовое редактирование использует тот же draft:

```text
BulkEditDialog
  -> atdbBatchEdit.previewAtdbBatchEdit
  -> preview counts и reason codes
  -> atdbBatchEdit.applyAtdbBatchEdit
  -> local edit draft state
```

## Поток экспорта

```text
app/page.tsx
  -> buildAtdbChangeSet(parsedData, editDraft)
  -> applyAtdbChanges(originalBuffer, changeSet)
  -> strict preflight
  -> SAVEPOINT write phase
  -> post-build validation
  -> Blob
  -> browser download
```

No-op export не запускает сборку: пока `AtdbChangeSet` пустой, кнопка скачивания отключена.

## Правила зависимостей

- `app/` может импортировать `components/` и публичные helpers из `lib/`.
- `components/` могут импортировать типы и чистые helpers из `lib/`.
- `lib/` не должен зависеть от `app/` или `components/`.
- UI не должен импортировать reader/writer-модули из `lib/atdb/` напрямую.
- SQL-запросы остаются в `lib/atdb/` и фасаде `lib/sqlProcessor.ts`.
- Доменные типы импортируются из `lib/types.ts`.
- Числовые ATDB-коды должны идти через `lib/atdb/mapping.json` и `AtdbSchemaContext`.
- Документация, логи и ошибки не должны раскрывать пользовательские raw-значения.

## Текущие ограничения архитектуры

- `components/DataTable.tsx` остаётся совместимым router-wrapper для выбора entity-specific таблицы.
- Entity-specific таблицы выделены в `components/atdb-table/`; общая механика заголовков, selection и empty state вынесена в shared primitives.
- Виртуализация больших таблиц не внедрена.
- Write-safe scope ограничен update-only изменениями существующих записей.
- Compatibility API `buildAtdb(parsed, original)` сохранён, но основной UI export использует явный `AtdbChangeSet`.

## См. также

- [Начало работы](getting-started.md) — запуск и пользовательский сценарий
- [Формат ATDB](atdb_format.md) — структура данных и safe write contract
- [Анализ кода](codebase-analysis.md) — текущие риски и технический долг
