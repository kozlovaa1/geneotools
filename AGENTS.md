# AGENTS.md

> Project map for AI agents. Keep this file up-to-date as the project evolves.

## Project Overview

**GeneoTools** is a browser-based tool for working with genealogy databases from "Древо Жизни 6" (`.atdb`). The app parses local SQLite-based `.atdb` files in the browser with `sql.js`, shows extracted entities in tables, and exports an updated `.atdb` file.

## Tech Stack

- **Language:** TypeScript 5
- **Framework:** Next.js 16 (App Router)
- **Runtime:** React 19, Node.js 20
- **Database:** SQLite (`.atdb` files via `sql.js`)
- **UI:** Tailwind CSS 4, Lucide React

## Project Structure

```text
geneotools/
├── app/                        # App Router entrypoints and global styles
│   ├── globals.css             # Global CSS
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Main upload/parse/download page
├── components/                 # UI components
│   ├── DataTable.tsx           # Entity table rendering and sorting
│   ├── DebugAnalyzer.tsx       # Debug helper for inspecting files
│   ├── FileUploader.tsx        # Drag-and-drop and file picker upload UI
│   ├── Modal.tsx               # Reusable modal
│   └── ScrollableDataTable.tsx # Tab navigation and scroll container
├── docs/                       # User-facing and internal project docs
│   ├── architecture.md         # Current architecture overview
│   ├── atdb_format.md          # Notes on the .atdb database format
│   ├── codebase-analysis.md    # Codebase analysis and debt notes
│   ├── getting-started.md      # Installation and first-run guide
│   └── refactoring-plan.md     # Refactoring plan and target state
├── lib/                        # Domain logic and sql.js integration
│   ├── buildAtdb.ts            # Validation helper for export input
│   ├── initSqlJs.ts            # sql.js initialization helpers
│   ├── parseAtdb.ts            # Compatibility type re-export
│   ├── sqlProcessor.ts         # Current parse/build facade and implementation
│   ├── types.ts                # Shared domain interfaces
│   └── utils.ts                # Shared utility helpers
├── public/                     # Static assets
├── .ai-factory/                # AI Factory project context
│   ├── ARCHITECTURE.md         # Current architecture description
│   └── DESCRIPTION.md          # Project specification and constraints
├── test-parsing.js             # Legacy ad-hoc parsing script
├── test-parsing.ts             # TypeScript ad-hoc parsing script
├── DOCS.md                     # Project documentation
├── README.md                   # Project landing page
└── package.json                # Dependencies and scripts
```

## Key Entry Points

| File | Purpose |
|------|---------|
| `app/page.tsx` | Main client page for upload, parse, display, and download flow |
| `components/FileUploader.tsx` | Handles drag-and-drop and file input validation |
| `components/ScrollableDataTable.tsx` | Switches between entity tabs and hosts the active table |
| `components/DataTable.tsx` | Renders table headers/rows and sorting for parsed entities |
| `lib/sqlProcessor.ts` | Current main parser/builder implementation for `.atdb` |
| `lib/initSqlJs.ts` | Creates `sql.js` database instances from uploaded buffers |
| `lib/types.ts` | Shared domain contracts for parser and UI |

## Documentation

| Document | Path | Description |
|----------|------|-------------|
| README | `README.md` | Landing page проекта |
| Getting Started | `docs/getting-started.md` | Установка, запуск, first steps |
| Architecture | `docs/architecture.md` | Текущая структура и ограничения |
| ATDB Format | `docs/atdb_format.md` | Наблюдения по структуре `.atdb` |
| Codebase Analysis | `docs/codebase-analysis.md` | Техдолг и проблемные места |
| Refactoring Plan | `docs/refactoring-plan.md` | Этапы и критерии рефакторинга |
| Description | `.ai-factory/DESCRIPTION.md` | Спецификация проекта |
| Architecture Context | `.ai-factory/ARCHITECTURE.md` | AI-архитектурный контекст |

## AI Context Files

| File | Purpose |
|------|---------|
| `AGENTS.md` | This file: project map for agents |
| `.ai-factory/DESCRIPTION.md` | Project specification, stack, and constraints |
| `.ai-factory/ARCHITECTURE.md` | Current architecture and refactoring direction |
| `QWEN.md` | Additional local coding instructions |

## Domain Notes

`.atdb` files are SQLite databases. Important entities currently extracted by the app:

- `Persons`
- `Families`
- `Events`
- `EventDetails`
- `ValuesStr`
- `ValuesNum`
- `ValuesDates`
- `ValuesLinks`

Known mapping notes currently used in the project:

- Birth event role ids in `EventDetails`:
  - `1` = born person
  - `2` = father
  - `3` = mother
- Family string fields in `ValuesStr` with `rec_table = 9`:
  - `48` = husband surname
  - `49` = wife surname
  - `50` = family name
  - `52` = family comment

## Current State

- `npm run lint` currently passes
- `npx tsc --noEmit` currently passes
- Domain types are centralized in `lib/types.ts`
- Parser/build logic is still monolithic in `lib/sqlProcessor.ts`
- Table rendering is still monolithic in `components/DataTable.tsx`
- Automated parser tests are not configured yet
