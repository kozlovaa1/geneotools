# Project: GeneoTools

## Overview

GeneoTools is a browser-based utility for working with genealogy databases from "Древо Жизни 6" (`.atdb`).

The application opens a local `.atdb` file in the browser, parses the SQLite data with `sql.js`, shows the extracted entities in tabular form, and builds an updated `.atdb` file for download. All processing happens locally in the browser session.

## Core Features

- Upload a local `.atdb` file with drag-and-drop or file picker
- Validate that the uploaded file is a valid SQLite database
- Parse core genealogy entities into a typed in-memory model:
  - persons
  - families
  - events
  - places
  - metadata
- Display parsed entities in tabbed tables with client-side sorting
- Export the current in-memory data back into an `.atdb` file
- Show runtime errors and success state in the page UI

## Tech Stack

- **Language:** TypeScript 5
- **Framework:** Next.js 16 (App Router)
- **Runtime:** React 19, Node.js 20
- **Database:** SQLite `.atdb` files processed with `sql.js`
- **ORM / Query Layer:** None; direct SQL over `sql.js`
- **UI:** Tailwind CSS 4, Lucide React

## Current Architecture

### Frontend

- Single-page App Router UI in `app/page.tsx`
- Client-side file upload, parse, and download flow
- Tab-based table browsing via `ScrollableDataTable`
- Entity rendering and sorting via `DataTable`

### Data Layer

- `lib/initSqlJs.ts` initializes `sql.js`
- `lib/sqlProcessor.ts` is the current facade and implementation for parsing/building `.atdb`
- `lib/types.ts` is the single source of truth for domain types
- `lib/parseAtdb.ts` currently acts as a compatibility re-export for domain types
- `lib/buildAtdb.ts` contains validation helpers used before rebuilding output

## Current Project Structure

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
│   ├── codebase-analysis.md
│   └── refactoring-plan.md
├── lib/
│   ├── buildAtdb.ts
│   ├── initSqlJs.ts
│   ├── parseAtdb.ts
│   ├── sqlProcessor.ts
│   ├── types.ts
│   └── utils.ts
├── public/
├── .ai-factory/
└── AGENTS.md
```

## Current Refactoring Status

- Lint currently passes (`npm run lint`)
- TypeScript compilation currently passes (`npx tsc --noEmit`)
- Domain types are centralized in `lib/types.ts`
- The parser/builder logic is still concentrated in `lib/sqlProcessor.ts`
- The tabular UI is still concentrated in `components/DataTable.tsx`
- Automated parser tests are not set up yet
- Documentation has been partially refreshed but still requires alignment with the codebase over time

## Non-Functional Requirements

- **Privacy:** No external API calls are required for file processing
- **Local-first behavior:** User data stays in the browser session
- **Type safety:** Shared domain types are defined in `lib/types.ts`
- **Maintainability:** Ongoing refactoring should reduce coupling in parsing and table rendering
- **Compatibility:** The app targets the `.atdb` format used by the current MVP scope

## Constraints

- No server-side persistence for uploaded genealogy data
- No external database or backend service is required for core functionality
- The parser must tolerate schema variance across `.atdb` files where possible
- Refactoring should avoid accidental behavior changes without verification
