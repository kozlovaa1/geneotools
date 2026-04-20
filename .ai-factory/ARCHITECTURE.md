# Architecture: Client-First Modular Monolith

## Overview

GeneoTools currently uses a client-first modular monolith architecture inside a single Next.js application.

The project is small enough to stay in one deployable unit, but it already benefits from separating:

- presentation logic
- upload/download orchestration
- domain types
- SQLite parsing/building logic

This document describes the actual current architecture, not the target architecture from the refactoring plan.

## Current Structure

```text
geneotools/
├── app/                          # App Router entrypoints and global styles
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                  # Main upload/parse/download screen
├── components/                   # UI components
│   ├── FileUploader.tsx          # File input and drag-and-drop flow
│   ├── ScrollableDataTable.tsx   # Tabs and scroll container
│   ├── DataTable.tsx             # Entity table rendering and sorting
│   ├── Modal.tsx                 # Generic modal
│   └── DebugAnalyzer.tsx         # Debug-only inspection helper
├── lib/                          # Domain and data-processing code
│   ├── types.ts                  # Shared domain model
│   ├── initSqlJs.ts              # sql.js bootstrap
│   ├── sqlProcessor.ts           # Current parse/build implementation
│   ├── buildAtdb.ts              # Validation helper for export
│   ├── parseAtdb.ts              # Compatibility type re-export
│   └── utils.ts                  # Shared utility functions
├── docs/
│   ├── codebase-analysis.md
│   └── refactoring-plan.md
└── public/
```

## Architectural Characteristics

### 1. Client-first processing

The main user flow is entirely client-side:

1. User uploads a local `.atdb` file
2. `app/page.tsx` dynamically imports parsing logic
3. `lib/sqlProcessor.ts` opens the SQLite database through `sql.js`
4. Parsed entities are stored in React state
5. Components render the extracted entities
6. Export rebuilds a new `.atdb` file from the in-memory model

### 2. Single domain model

`lib/types.ts` is the single source of truth for the core entities:

- `Person`
- `Family`
- `Event`
- `Place`
- `ParsedAtdb`

UI and parsing code should depend on these shared contracts rather than redefining interfaces locally.

### 3. Monolithic parser/builder

The current main architectural weakness is that `lib/sqlProcessor.ts` combines:

- SQLite validation
- metadata parsing
- person parsing
- family parsing
- event parsing
- place parsing
- rebuild/export logic

This file is the main refactoring target and should eventually become a facade over smaller modules.

### 4. Monolithic table rendering

`components/DataTable.tsx` currently combines:

- sorting state for multiple entity types
- sorting algorithms
- table headers and rows for multiple entity types
- conditional rendering for tab content

This works for the current MVP, but it increases cognitive load and slows safe iteration.

## Dependency Rules

- `app/` may import from `components/` and `lib/`
- `components/` may import from `lib/`
- `lib/` must not import from `app/` or `components/`
- Domain types must come from `lib/types.ts`
- Direct `sql.js` usage should stay in `lib/`
- UI components should not issue raw SQL queries

## Current Flow

### Upload and parse

```text
User
  -> FileUploader
  -> app/page.tsx
  -> lib/sqlProcessor.parseAtdb
  -> lib/initSqlJs
  -> sql.js Database
  -> ParsedAtdb
  -> ScrollableDataTable / DataTable
```

### Export

```text
User
  -> app/page.tsx
  -> lib/sqlProcessor.buildAtdb
  -> Blob
  -> browser download
```

## Design Constraints

- The app must remain usable without a backend
- Uploaded genealogy data must not be persisted remotely
- Parser changes should preserve behavior unless explicitly intended
- Refactoring should prioritize smaller modules and measurable verification

## Known Architectural Debt

- `lib/sqlProcessor.ts` is too large and mixes responsibilities
- `components/DataTable.tsx` is too large and mixes multiple entity views
- `README.md`, `DOCS.md`, and AI context files can drift from real structure if not refreshed
- There is no automated parsing test harness yet

## Target Direction

The current refactoring plan in `docs/refactoring-plan.md` points toward:

- modular parsing/building under `lib/sql/`
- centralized table-sorting helpers
- smaller entity-specific table components
- automated tests for critical parsing branches

That target architecture is not implemented yet and should be treated as planned work, not current state.
