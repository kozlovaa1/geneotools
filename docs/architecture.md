[← Getting Started](getting-started.md) · [Back to README](../README.md) · [ATDB Format →](atdb_format.md)

# Architecture

## Overview

GeneoTools сейчас устроен как client-first modular monolith внутри одного Next.js приложения. Это описание текущего состояния, а не целевой архитектуры после рефакторинга.

## Актуальная структура

```text
geneotools/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── DataTable.tsx
│   ├── DebugAnalyzer.tsx
│   ├── FileUploader.tsx
│   ├── Modal.tsx
│   └── ScrollableDataTable.tsx
├── docs/
│   ├── atdb_format.md
│   ├── codebase-analysis.md
│   ├── getting-started.md
│   └── refactoring-plan.md
├── lib/
│   ├── buildAtdb.ts
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

### Domain / Processing

- `lib/types.ts` — единая доменная модель
- `lib/sqlProcessor.ts` — текущая реализация parse/build flow
- `lib/buildAtdb.ts` — validation helper перед сборкой
- `lib/initSqlJs.ts` — bootstrap `sql.js`

## Поток данных

```text
User
  -> FileUploader
  -> app/page.tsx
  -> lib/sqlProcessor.parseAtdb
  -> sql.js Database
  -> ParsedAtdb in React state
  -> ScrollableDataTable / DataTable
```

Экспорт:

```text
User
  -> app/page.tsx
  -> lib/sqlProcessor.buildAtdb
  -> Blob
  -> browser download
```

## Текущие архитектурные ограничения

- `lib/sqlProcessor.ts` совмещает слишком много ответственности
- `components/DataTable.tsx` совмещает rendering и sorting для нескольких сущностей
- `parseAtdb.ts` пока используется как compatibility layer, а не как отдельный parser module
- Автоматические тесты критичных parsing-ветвей ещё не созданы

## Правила зависимостей

- `app/` может импортировать `components/` и `lib/`
- `components/` могут импортировать `lib/`
- `lib/` не должен зависеть от `app/` и `components/`
- Доменные типы должны импортироваться из `lib/types.ts`
- SQL-запросы должны оставаться в `lib/`, а не в UI

## See Also

- [Getting Started](getting-started.md) — запуск и основной пользовательский сценарий
- [Codebase Analysis](codebase-analysis.md) — детализированные проблемы текущей реализации
- [Refactoring Plan](refactoring-plan.md) — план перехода к более чистой архитектуре
