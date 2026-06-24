# AGENTS.md

> Карта проекта для AI-агентов. Обновляйте файл, когда структура проекта заметно меняется.

## Обзор проекта

**GeneoTools** — браузерный инструмент для работы с генеалогическими базами «Древо Жизни 6» (`.atdb`). Приложение открывает SQLite-файлы локально через `sql.js`, показывает данные в таблицах, разрешает write-safe редактирование ограниченного набора полей и собирает обновлённый `.atdb` для скачивания.

## Tech Stack

- **Язык:** TypeScript 5
- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS 4, Lucide React
- **SQLite:** `sql.js`
- **ORM:** отсутствует
- **Runtime:** Node.js 20

## Структура проекта

```text
geneotools/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Корневой layout
│   ├── page.tsx                # Загрузка, просмотр, draft, ошибки и экспорт
│   └── globals.css             # Глобальные стили Tailwind
├── components/                 # React-компоненты интерфейса
│   ├── atdb-table/             # Entity-specific таблицы и общие primitives таблиц
│   │   ├── AtdbTablePrimitives.tsx # Table frame, sortable headers, selection и empty state
│   │   ├── EventTable.tsx      # Read-only таблица событий
│   │   ├── FamilyTable.tsx     # Таблица родов
│   │   ├── PersonTable.tsx     # Таблица персон
│   │   ├── PlaceTable.tsx      # Таблица мест
│   │   └── useAtdbTableEditors.tsx # Presentation helpers editable ячеек
│   ├── BulkEditDialog.tsx      # Предпросмотр и применение массового редактирования
│   ├── DataTable.tsx           # Router-wrapper для entity-specific таблиц
│   ├── EditableCell.tsx        # Presentation controls редактируемых ячеек
│   ├── FileUploader.tsx        # Drag-and-drop загрузка файлов
│   ├── Modal.tsx               # Модальное окно
│   ├── ScrollableDataTable.tsx # Вкладки, toolbar, selection и таблица
│   ├── TableQueryToolbar.tsx   # Поиск, фильтр и счётчик видимых строк
│   └── uiStyles.ts             # Shared interaction styles для controls/status surfaces
├── lib/                        # Работа с .atdb, sql.js, типы и утилиты
│   ├── atdb/                   # Внутренние readers/writers/helpers .atdb-процессора
│   │   ├── mapping.json        # Канонический машиночитаемый реестр правил формата
│   │   ├── mapping.ts          # Типизированный доступ к mapping
│   │   ├── mappingTypes.ts     # Типы mapping-реестра
│   │   ├── rebuildContract.ts  # Типы change-set/report/error для strict rebuild
│   │   ├── rebuildDiff.ts      # Compatibility diff ParsedAtdb -> AtdbChangeSet
│   │   ├── rebuildValidation.ts # Preflight/post-build validation и fingerprints
│   │   ├── schemaContext.ts    # Resolver каталогов Fields/EventTypes/EventRoles
│   │   ├── transaction.ts      # SAVEPOINT/rollback helper для write phase
│   │   ├── readers/            # Чтение metadata, персон, родов, событий и мест
│   │   └── writers/            # Field-level запись разрешённых изменений
│   ├── atdbBatchEdit.ts        # Предпросмотр и apply массового редактирования
│   ├── atdbEditDraft.ts        # UI draft state и сборка явного AtdbChangeSet
│   ├── atdbIntegerInput.ts     # Strict parser целочисленного UI input
│   ├── atdbTableView.ts        # Поиск, фильтрация, sorting и visible IDs
│   ├── buildAtdb.ts            # Совместимый re-export сборки .atdb
│   ├── emptyNodeModule.ts      # Заглушка для браузерной сборки
│   ├── initSqlJs.ts            # Инициализация sql.js
│   ├── parseAtdb.ts            # Совместимый re-export парсера
│   ├── sqlProcessor.ts         # Публичный SQLite/.atdb фасад
│   ├── types.ts                # Типы доменных данных
│   └── utils.ts                # Общие утилиты
├── docs/                       # Публичная документация проекта
├── public/                     # Статические изображения и логотипы
├── scripts/                    # Проверочные и служебные скрипты
├── .ai-factory/                # AI Factory контекст проекта
├── .agents/                    # Локальные skills для агентов
├── .codex/                     # Локальная конфигурация Codex и MCP
├── Dockerfile                  # Контейнерная сборка приложения
├── docker-compose.yml          # Compose-конфигурация для запуска
└── package.json                # npm-скрипты и зависимости
```

## Ключевые точки входа

| Файл | Назначение |
|------|------------|
| `app/page.tsx` | Главный пользовательский сценарий: загрузка, draft, ошибки, экспорт |
| `app/layout.tsx` | Корневой layout приложения |
| `lib/sqlProcessor.ts` | Публичный фасад чтения и сборки SQLite/.atdb |
| `lib/parseAtdb.ts` | Совместимый экспорт парсинга `.atdb` |
| `lib/buildAtdb.ts` | Совместимый экспорт strict build API |
| `lib/types.ts` | Типы `Person`, `Family`, `Event`, `Place`, `ParsedAtdb` |
| `lib/atdb/mapping.json` | Единый канонический реестр `rec_table`, полей, типов и ролей |
| `lib/atdb/schemaContext.ts` | Runtime resolver схемы для readers/writers |
| `lib/atdb/rebuildContract.ts` | Контракт `AtdbChangeSet`, build report и safe error formatter |
| `lib/atdb/rebuildDiff.ts` | Compatibility diff из `ParsedAtdb` в явный набор изменений |
| `lib/atdb/rebuildValidation.ts` | Strict preflight, post-build validation и protected fingerprints |
| `lib/atdb/transaction.ts` | Общий transaction helper для strict write phase |
| `lib/atdb/readers/*` | Внутренние модули чтения metadata, персон, родов, событий и мест |
| `lib/atdb/writers/*` | Внутренние модули field-level записи разрешённых изменений |
| `lib/atdbEditDraft.ts` | Чистые helper'ы локального draft state и сборки `AtdbChangeSet` |
| `lib/atdbBatchEdit.ts` | Чистые helper'ы массового редактирования |
| `lib/atdbIntegerInput.ts` | Strict parser целочисленного ввода для таблиц и batch edit |
| `lib/atdbTableView.ts` | Чистый table-view/query слой поверх `ParsedAtdb + AtdbEditDraftState` |
| `components/FileUploader.tsx` | Загрузка файлов в браузере |
| `components/ScrollableDataTable.tsx` | Основное табличное представление данных |
| `components/TableQueryToolbar.tsx` | Быстрый поиск, field-level фильтр и счётчик видимой выборки |
| `components/DataTable.tsx` | Router-wrapper, который выбирает таблицу по активной сущности |
| `components/atdb-table/AtdbTablePrimitives.tsx` | Общие table frame, sort headers, selection cells и empty state |
| `components/atdb-table/PersonTable.tsx` | Entity-specific таблица персон |
| `components/atdb-table/FamilyTable.tsx` | Entity-specific таблица родов |
| `components/atdb-table/EventTable.tsx` | Read-only entity-specific таблица событий |
| `components/atdb-table/PlaceTable.tsx` | Entity-specific таблица мест |
| `components/atdb-table/useAtdbTableEditors.tsx` | Presentation helpers для draft-aware editable cells |
| `components/EditableCell.tsx` | Переиспользуемые controls редактируемых ячеек |
| `components/BulkEditDialog.tsx` | Предпросмотр и применение массового редактирования |
| `components/uiStyles.ts` | Общие hover/focus/disabled/status классы |
| `scripts/check-atdb-mapping.mjs` | Regression gate для канонического mapping |
| `scripts/check-atdb-table-view.mjs` | Regression gate для query/filter/sort helper'ов |
| `scripts/check-atdb-table-components.mjs` | Regression gate для component-level table contract |
| `scripts/check-atdb-edit-draft.mjs` | Regression gate для UI draft/change-set helper'ов |
| `scripts/check-atdb-batch-edit.mjs` | Regression gate для batch edit preview/apply |
| `scripts/check-atdb-write-safety.mjs` | Regression gate для write-safety |
| `scripts/check-atdb-rebuild-contract.mjs` | Regression gate для strict rebuild contract |

## Документация

| Документ | Путь | Описание |
|----------|------|----------|
| README | `README.md` | Landing page проекта |
| Начало работы | `docs/getting-started.md` | Установка и запуск |
| Архитектура | `docs/architecture.md` | Слои и зависимости |
| Формат ATDB | `docs/atdb_format.md` | Структура `.atdb` |
| Анализ кода | `docs/codebase-analysis.md` | Риски и техдолг |
| План рефакторинга | `docs/refactoring-plan.md` | Следующие этапы |

## AI Context Files

| Файл | Назначение |
|------|------------|
| `AGENTS.md` | Карта проекта и правила для AI-агентов |
| `.ai-factory/config.yaml` | Настройки AI Factory |
| `.ai-factory/DESCRIPTION.md` | Спецификация проекта и стек технологий |
| `.ai-factory/ARCHITECTURE.md` | Архитектурные решения и правила зависимостей |
| `.ai-factory/ROADMAP.md` | Дорожная карта проекта |
| `.ai-factory/PLAN.md` | Текущий быстрый план AI Factory |
| `.ai-factory/rules/base.md` | Автоматически выявленные базовые правила проекта |
| `.codex/config.toml` | Локальная конфигурация Codex и MCP |

## Установленные внешние skills

| Skill | Путь | Когда использовать |
|-------|------|--------------------|
| `nextjs-app-router-patterns` | `.agents/skills/nextjs-app-router-patterns` | Работа с Next.js App Router, Server/Client Components, streaming и routing |
| `typescript-react-reviewer` | `.agents/skills/typescript-react-reviewer` | Ревью TypeScript/React 19 кода, anti-patterns и типизации |
| `sqlite-database-expert` | `.agents/skills/sqlite-database-expert` | Проверка SQLite, параметризованных запросов, транзакций и безопасности данных |

## Структура базы данных (.atdb)

Файлы `.atdb` являются SQLite-базами данных. Основные таблицы, с которыми работает проект:

| Таблица | Назначение |
|---------|------------|
| `Persons` | Информация о персонах |
| `Families` | Информация о родах |
| `Events` | События |
| `EventDetails` | Связь персон с событиями и ролями |
| `EventTypes` | Каталог типов событий |
| `EventRoles` | Каталог ролей событий |
| `Places` | Места |
| `Fields` | Описание системных и пользовательских полей |
| `Recs` | Общий реестр записей |
| `ValuesStr` | Строковые значения дополнительных полей |
| `ValuesNum` | Числовые значения |
| `ValuesDates` | Даты |
| `ValuesLinks` | Связи между сущностями |
| `Global` | Метаданные базы |

### Доменное значение `Families`

- Таблица `Families` в контексте «Древо Жизни 6» означает **«Роды»**, а не нуклеарные семьи.
- Роды группируют неограниченное количество персон, обычно выбранных пользователем как рождённые с одной фамилией.
- У рода нет доменных ролей «муж», «жена» и «дети».
- Связь персоны с родом хранится как отдельная ссылка от персоны к `Families` и не равна браку, родительству или составу семьи.

### Роли EventDetails (`er_id`)

- ID `1`, `2`, `3` являются только legacy fallback для ролей рождения.
- Семантику ролей определяйте через каталог `EventRoles` по типу события, типу роли и порядку.
- Числовой ID роли не является универсальным.

### Правила write-safe scope

- Разрешены только update-only изменения существующих персон, родов и мест.
- События, даты, участники событий, `Global`, `Fields`, `Recs`, `EventRoles`, custom fields и unknown `Values*` остаются read-only.
- `Person.gender = null` или `undefined` нормализуется в `Unknown` (`Persons.sex = 0`).
- Ошибки и diagnostics должны быть redacted: код, счётчики и безопасный контекст без raw rows.

## Правила для агентов

- Перед редактированием проверяйте `git status` и учитывайте существующие пользовательские изменения.
- Если пользователь пишет по-русски, отвечайте естественным русским языком и так же пишите русскоязычную документацию.
- Английские названия оставляйте только для API, команд, путей, библиотек, типов, таблиц и терминов без точного русского аналога.
- Не печатайте содержимое пользовательских `.atdb` файлов, `.env` и других чувствительных файлов.
- Не добавляйте в публичные artifacts raw `ValuesStr`, имена, места, заметки, пути документов, GUID или source text.
- Команды с несколькими шагами выполняйте по отдельности: сначала `git checkout master`, затем `git pull origin master`.
- SQL-логику держите в `lib/`; UI-компоненты не должны напрямую выполнять запросы к базе.
- После изменений запускайте минимальную релевантную проверку, обычно `npm run lint`.
