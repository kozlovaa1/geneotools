[← Getting Started](getting-started.md) · [Back to README](../README.md) · [ATDB Format →](atdb_format.md)

# Architecture

## Overview

GeneoTools сейчас устроен как client-first modular monolith внутри одного Next.js приложения. Основная обработка `.atdb` вынесена во внутренний модульный слой `lib/atdb/`, скрытый за публичным фасадом `lib/sqlProcessor.ts`.

## Актуальная структура

```text
geneotools/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── DataTable.tsx
│   ├── BulkEditDialog.tsx
│   ├── EditableCell.tsx
│   ├── FileUploader.tsx
│   ├── Modal.tsx
│   └── ScrollableDataTable.tsx
├── docs/
│   ├── atdb_format.md
│   ├── codebase-analysis.md
│   ├── getting-started.md
│   └── refactoring-plan.md
├── lib/
│   ├── atdb/
│   │   ├── constants.ts
│   │   ├── dates.ts
│   │   ├── dbTypes.ts
│   │   ├── diagnostics.ts
│   │   ├── fieldDefinitions.ts
│   │   ├── mapping.json
│   │   ├── mapping.ts
│   │   ├── rebuildContract.ts
│   │   ├── rebuildDiff.ts
│   │   ├── rebuildValidation.ts
│   │   ├── schemaContext.ts
│   │   ├── sqlHelpers.ts
│   │   ├── transaction.ts
│   │   ├── readers/
│   │   └── writers/
│   ├── buildAtdb.ts
│   ├── atdbBatchEdit.ts
│   ├── atdbEditDraft.ts
│   ├── initSqlJs.ts
│   ├── parseAtdb.ts
│   ├── sqlProcessor.ts
│   ├── types.ts
│   └── utils.ts
└── public/
```

## Основные слои

### Presentation

- `app/page.tsx` — orchestration upload/parse/download сценария
- `components/FileUploader.tsx` — загрузка и валидация файла
- `components/ScrollableDataTable.tsx` — табы и scroll container
- `components/DataTable.tsx` — рендер таблиц и sorting state
- `components/BulkEditDialog.tsx` — controls массового редактирования, предпросмотр и apply action
- `components/EditableCell.tsx` — компактные presentation controls для write-safe ячеек

### Domain / Processing

- `lib/types.ts` — единая доменная модель
- `lib/sqlProcessor.ts` — публичный фасад parse/build flow
- `lib/atdbEditDraft.ts` — чистые UI-facing helper'ы локального draft state и сборки `AtdbChangeSet`
- `lib/atdbBatchEdit.ts` — чистый helper массового preview/apply поверх `AtdbEditDraftState`
- `lib/atdb/readers/*` — чтение metadata, персон, родов, событий и мест из SQLite
- `lib/atdb/writers/*` — field-level запись разрешённых изменений персон, родов, мест и life-event place links
- `lib/atdb/rebuildContract.ts` — typed contract для `AtdbChangeSet`, build report и safe errors
- `lib/atdb/rebuildDiff.ts` — compatibility diff из `ParsedAtdb` в явный change-set
- `lib/atdb/rebuildValidation.ts` — preflight, post-build validation и protected fingerprints
- `lib/atdb/transaction.ts` — общий `SAVEPOINT` / rollback helper для write phase
- `lib/atdb/sqlHelpers.ts`, `dates.ts`, `fieldDefinitions.ts`, `mapping.ts` — внутренние helper/mapping модули
- `lib/buildAtdb.ts` — compatibility re-export публичного build API
- `lib/initSqlJs.ts` — bootstrap `sql.js`

## Поток данных

```text
User
  -> FileUploader
  -> app/page.tsx
  -> lib/sqlProcessor.parseAtdb
  -> sql.js Database
  -> ParsedAtdb in React state
  -> local edit draft state
  -> ScrollableDataTable / DataTable
```

Экспорт:

```text
User
  -> app/page.tsx
  -> lib/atdbEditDraft.buildAtdbChangeSet
  -> lib/sqlProcessor.applyAtdbChanges
  -> strict change-set validation
  -> transaction write phase
  -> post-build validation
  -> Blob
  -> browser download
```

Массовое редактирование:

```text
User
  -> BulkEditDialog
  -> lib/atdbBatchEdit.previewAtdbBatchEdit
  -> preview counts / reason codes / affected rows
  -> lib/atdbBatchEdit.applyAtdbBatchEdit
  -> local edit draft state
  -> lib/atdbEditDraft.buildAtdbChangeSet
```

## Текущие архитектурные ограничения

- `components/DataTable.tsx` совмещает rendering и sorting для нескольких сущностей
- `parseAtdb.ts` пока используется как compatibility layer, а не как отдельный parser module
- UI формирует `AtdbChangeSet` напрямую только для write-safe полей персон, родов и мест; события, даты, участники событий, родственные связи, notes/occupation и metadata остаются read-only
- Массовое редактирование не расширяет strict rebuild contract: оно работает только как draft operation перед существующим экспортом
- Compatibility `buildAtdb(parsed, original)` сохраняется для старых imports и проверок, но основной UI export использует `applyAtdbChanges(original, changeSet)`

## Правила зависимостей

- `app/` может импортировать `components/` и `lib/`
- `components/` могут импортировать `lib/`
- `lib/` не должен зависеть от `app/` и `components/`
- Доменные типы должны импортироваться из `lib/types.ts`
- SQL-запросы должны оставаться в `lib/`, а не в UI
- `lib/atdb/` считается внутренней реализацией: UI и скрипты должны обращаться к `lib/sqlProcessor.ts`, а не к reader/writer-модулям напрямую
- Reliable rebuild остаётся в `lib/` за фасадом `lib/sqlProcessor.ts`; UI не должен импортировать `lib/atdb/rebuild*` или writer-модули напрямую
- `.atdb` остается локальным файлом браузерной сессии; документация и логи не должны содержать персональные строки из пользовательской базы

## See Also

- [Getting Started](getting-started.md) — запуск и основной пользовательский сценарий
- [Codebase Analysis](codebase-analysis.md) — детализированные проблемы текущей реализации
- [Refactoring Plan](refactoring-plan.md) — план перехода к более чистой архитектуре
