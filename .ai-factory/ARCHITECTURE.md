# Architecture: Layered Modular App

## Обзор

GeneoTools использует практичную слоисто-модульную архитектуру внутри одного Next.js приложения. Это не полноценная Clean Architecture и не DDD: проекту важнее низкая сложность, понятные границы и безопасная локальная обработка `.atdb`, чем тяжёлый набор абстракций.

Главное правило: UI управляет пользовательским сценарием, а чтение SQLite, нормализация данных, draft helpers, write-safe validation и сборка `.atdb` находятся в `lib/`. Компоненты получают готовые данные и вызывают публичные helpers, но не выполняют SQL и не знают внутреннюю схему базы.

## Обоснование выбора

- **Тип проекта:** браузерный редактор и анализатор SQLite `.atdb` файлов.
- **Tech stack:** TypeScript 5, Next.js 16 App Router, React 19, Tailwind CSS 4, `sql.js`.
- **Модель развертывания:** один frontend bundle без серверного хранения пользовательских данных.
- **Ключевой фактор:** основная сложность находится в формате `.atdb`, mapping и safe rebuild, а не в бизнес-процессах с несколькими bounded contexts.
- **Почему не microservices:** нет серверного домена и независимых runtime-сервисов.
- **Почему не Explicit Architecture:** текущий размер и предметная область не окупают отдельные Domain/Application/Infrastructure слои.

## Структура папок

```text
geneotools/
├── app/                         # Next.js App Router и верхнеуровневый сценарий
│   ├── layout.tsx
│   ├── page.tsx                 # Upload, parse, draft, errors, export
│   └── globals.css
├── components/                  # Presentation layer
│   ├── BulkEditDialog.tsx       # Batch edit preview/apply controls
│   ├── DataTable.tsx            # Entity table rendering
│   ├── EditableCell.tsx         # Reusable editable cell controls
│   ├── FileUploader.tsx         # File selection and drag-and-drop
│   ├── Modal.tsx
│   ├── ScrollableDataTable.tsx  # Tabs, selection, toolbar, table container
│   └── TableQueryToolbar.tsx    # Quick search, one field filter, visible counts
├── lib/                         # Domain/Data helpers and ATDB processing
│   ├── atdb/
│   │   ├── mapping.json         # Canonical ATDB mapping registry
│   │   ├── mapping.ts
│   │   ├── mappingTypes.ts
│   │   ├── diagnostics.ts
│   │   ├── schemaContext.ts     # Runtime resolver for Fields/EventTypes/EventRoles
│   │   ├── rebuildContract.ts   # AtdbChangeSet, reports, safe errors
│   │   ├── rebuildDiff.ts       # Compatibility ParsedAtdb -> AtdbChangeSet diff
│   │   ├── rebuildValidation.ts # Preflight, post-build validation, fingerprints
│   │   ├── transaction.ts       # SAVEPOINT / rollback helper
│   │   ├── readers/             # Metadata, persons, families, events, places
│   │   └── writers/             # Field-level write-safe changes
│   ├── atdbBatchEdit.ts         # Pure batch preview/apply helper
│   ├── atdbEditDraft.ts         # Draft state and AtdbChangeSet builder
│   ├── atdbTableView.ts         # Query, filter, sort, visible IDs
│   ├── buildAtdb.ts             # Compatibility build exports
│   ├── initSqlJs.ts             # sql.js bootstrap
│   ├── parseAtdb.ts             # Compatibility parse exports
│   ├── sqlProcessor.ts          # Public parse/build facade
│   ├── types.ts                 # Shared domain types
│   └── utils.ts
├── docs/                        # Public documentation
├── scripts/                     # Regression and maintenance scripts
├── public/
├── Dockerfile
└── docker-compose.yml
```

## Правила зависимостей

- Разрешено: `app/` импортирует `components/` и публичные helpers из `lib/`.
- Разрешено: `components/` импортируют типы и чистые helpers из `lib/`.
- Разрешено: `lib/sqlProcessor.ts` координирует `initSqlJs`, `lib/atdb/readers/*`, `lib/atdb/writers/*`, validation и transaction helpers.
- Разрешено: `scripts/` импортируют публичный фасад или специализированные проверочные helpers, когда это нужно для regression gates.
- Запрещено: `lib/` импортирует `app/` или `components/`.
- Запрещено: UI-компоненты выполняют SQL-запросы напрямую.
- Запрещено: UI обходит `lib/sqlProcessor.ts` и импортирует `lib/atdb/readers/*`, `lib/atdb/writers/*`, `rebuildValidation.ts` или `transaction.ts`.
- Запрещено: readers/writers дублируют числовые ATDB-коды вместо `mapping.json` и `AtdbSchemaContext`.
- Запрещено: публичные ошибки, логи и документация раскрывают пользовательские raw-значения.

## Взаимодействие слоёв

### Чтение файла

```text
FileUploader
  -> app/page.tsx
  -> dynamic import('@/lib/sqlProcessor')
  -> parseAtdb(buffer)
  -> sql.js Database
  -> createAtdbSchemaContext
  -> readers
  -> ParsedAtdb
  -> React state
```

### Табличное представление

```text
ParsedAtdb + AtdbEditDraftState
  -> lib/atdbTableView.queryAtdbTableRows
  -> quick search / field filter / sorting
  -> visible rows + visible IDs
  -> ScrollableDataTable / TableQueryToolbar / DataTable
```

### Локальное редактирование

```text
EditableCell / DataTable
  -> app/page.tsx editDraft state
  -> lib/atdbEditDraft
  -> buildAtdbChangeSet only before export
```

### Массовое редактирование

```text
BulkEditDialog
  -> lib/atdbBatchEdit.previewAtdbBatchEdit
  -> affected/skipped/no-op counts
  -> lib/atdbBatchEdit.applyAtdbBatchEdit
  -> updated local draft
```

### Экспорт

```text
app/page.tsx
  -> buildAtdbChangeSet(parsedData, editDraft)
  -> applyAtdbChanges(originalBuffer, changeSet)
  -> preflight validation
  -> SAVEPOINT write phase
  -> post-build validation
  -> Uint8Array
  -> Blob download
```

## Ключевые принципы

1. **Локальная обработка данных.** `.atdb` файлы остаются в браузерной сессии и не отправляются во внешние сервисы.
2. **SQL вне UI.** Компоненты отвечают за отображение, ввод и события; SQLite-запросы остаются в `lib/atdb/`.
3. **Фасад для `.atdb`.** Пользовательский parse/build flow идёт через `lib/sqlProcessor.ts`.
4. **Явный write contract.** UI экспортирует не изменённый `ParsedAtdb`, а `AtdbChangeSet` с поддержанными field-level изменениями.
5. **Update-only scope.** Создание, удаление и изменение неподдержанных структур запрещены до расширения mapping/validation.
6. **Mapping как источник истины.** Числовые коды таблиц, полей и ролей берутся из `lib/atdb/mapping.json` через typed helpers.
7. **Redacted diagnostics.** Ошибки и logs содержат коды, статусы и счётчики, но не raw rows и пользовательские значения.
8. **Проверки рядом с риском.** Для изменений в `.atdb`-логике запускаются профильные `test:atdb:*` и mapping checks, а не только ESLint.

## Code Examples

### Динамический импорт процессора в UI

```typescript
const handleFileUpload = async (file: File, buffer: ArrayBuffer) => {
  setIsLoading(true);
  setError(null);

  try {
    const { parseAtdb } = await import('@/lib/sqlProcessor');
    const parsedResult = await parseAtdb(new Uint8Array(buffer));
    setParsedData(parsedResult);
  } catch (err) {
    const { formatAtdbBuildError } = await import('@/lib/sqlProcessor');
    const safeError = formatAtdbBuildError(err);
    setError(safeError.message);
  } finally {
    setIsLoading(false);
  }
};
```

### Экспорт через явный change-set

```typescript
const { applyAtdbChanges } = await import('@/lib/sqlProcessor');
const changeSet = buildAtdbChangeSet(parsedData, editDraft);
const updatedBuffer = await applyAtdbChanges(originalBuffer, changeSet);
```

UI не должен импортировать writer-модули напрямую. Любые новые writable поля сначала проходят через `AtdbChangeSet`, preflight и post-build validation.

### Фасад чтения в `lib/sqlProcessor.ts`

```typescript
export async function parseAtdb(
  buffer: Uint8Array | Buffer,
  options: AtdbProcessorOptions = {},
): Promise<ParsedAtdb> {
  const normalizedBuffer = buffer instanceof Buffer ? new Uint8Array(buffer) : buffer;
  validateSqliteHeader(normalizedBuffer);

  const { createDbFromBuffer } = await import('./initSqlJs');
  const db = await createDbFromBuffer(normalizedBuffer);

  try {
    return readParsedAtdbFromDb(db, options.logger ?? silentAtdbLogger);
  } finally {
    db.close();
  }
}
```

### Добавление нового write-safe поля

```text
1. Добавить invariant-правило в lib/atdb/mapping.json.
2. Расширить тип поля в lib/atdb/rebuildContract.ts.
3. Добавить draft handling в lib/atdbEditDraft.ts.
4. Добавить writer logic в соответствующий lib/atdb/writers/* модуль.
5. Добавить preflight и post-build validation.
6. Добавить regression coverage в scripts/check-atdb-*.mjs.
7. Обновить docs/atdb_format.md и AGENTS.md при изменении публичного контракта.
```

## Антипаттерны

- Не добавлять SQL-запросы в `components/` или JSX handlers.
- Не импортировать `lib/atdb/writers/*` из UI.
- Не расширять write scope без mapping, validation и regression coverage.
- Не считать `Families` нуклеарной семьёй; это доменная сущность «Роды».
- Не трактовать `EventDetails.er_id` как универсальную роль без `EventRoles`.
- Не перезаписывать весь набор `Values*` сущности ради одного поля.
- Не логировать raw `ValuesStr`, имена, места, заметки, GUID, source text или пути документов.
- Не обновлять Docker, scripts или запуск без синхронизации README/docs, если меняется developer workflow.

## Проверки

Минимальные проверки выбираются по изменённому слою:

| Зона изменения | Проверки |
|----------------|----------|
| UI/components | `npm run lint`, `npx tsc --noEmit`, ручной browser smoke |
| Draft/query/batch helpers | `npm run test:atdb:table-view`, `npm run test:atdb:edit-draft`, `npm run test:atdb:batch-edit` |
| Mapping/write/rebuild | `npm run mapping:atdb:check`, `npm run test:atdb:write-safety`, `npm run test:atdb:rebuild-contract` |
| Документация | link check, `git diff --check`, `npm run lint` |
