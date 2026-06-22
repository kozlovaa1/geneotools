# AGENTS.md

> Карта проекта для AI-агентов. Обновляйте файл, когда структура проекта заметно меняется.

## Обзор проекта

**GeneoTools** — браузерный инструмент для работы с генеалогическими базами «Древо Жизни 6» (`.atdb`). Приложение открывает SQLite-файлы локально через `sql.js`, показывает данные в таблицах и собирает обновленный `.atdb` для скачивания.

## Tech Stack

- **Язык:** TypeScript 5
- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS 4, Lucide React
- **SQLite:** `sql.js`
- **ORM:** отсутствует
- **Runtime:** Node.js 20

## Структура проекта

```
geneotools/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Корневой layout
│   ├── page.tsx                # Главный экран загрузки, просмотра и экспорта .atdb
│   └── globals.css             # Глобальные стили Tailwind
├── components/                 # React-компоненты интерфейса
│   ├── DataTable.tsx           # Табличное отображение данных
│   ├── FileUploader.tsx        # Drag-and-drop загрузка файлов
│   ├── Modal.tsx               # Модальное окно
│   └── ScrollableDataTable.tsx # Таблица с прокруткой
├── lib/                        # Работа с .atdb, sql.js, типы и утилиты
│   ├── atdb/                   # Внутренние readers/writers/helpers .atdb-процессора
│   │   ├── mapping.json        # Канонический машиночитаемый реестр правил формата
│   │   ├── mapping.ts          # Типизированный доступ к mapping
│   │   ├── rebuildContract.ts  # Типы change-set/report/error для strict rebuild
│   │   ├── rebuildDiff.ts      # Compatibility diff ParsedAtdb -> AtdbChangeSet
│   │   ├── rebuildValidation.ts # Preflight/post-build validation и fingerprints
│   │   ├── schemaContext.ts    # Resolver каталогов Fields/EventTypes/EventRoles
│   │   ├── transaction.ts      # SAVEPOINT/rollback helper для write phase
│   ├── buildAtdb.ts            # Совместимый re-export сборки .atdb
│   ├── emptyNodeModule.ts      # Заглушка для браузерной сборки
│   ├── initSqlJs.ts            # Инициализация sql.js
│   ├── parseAtdb.ts            # Совместимый re-export парсера
│   ├── sqlProcessor.ts         # Основной SQLite-процессор
│   ├── types.ts                # Типы доменных данных
│   └── utils.ts                # Общие утилиты
├── docs/                       # Документация и анализ формата
├── public/                     # Статические изображения и логотипы
├── scripts/                    # Скрипты сборки/обслуживания
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
| `app/page.tsx` | Главный пользовательский сценарий: загрузка, отображение, ошибки, экспорт |
| `app/layout.tsx` | Корневой layout приложения |
| `lib/sqlProcessor.ts` | Публичный фасад чтения и сборки SQLite/.atdb |
| `lib/atdb/readers/*` | Внутренние модули чтения metadata, персон, родов, событий и мест |
| `lib/atdb/writers/*` | Внутренние модули field-level записи разрешённых изменений |
| `lib/atdb/mapping.json` | Единый канонический реестр `rec_table`, полей, типов и ролей событий |
| `lib/atdb/schemaContext.ts` | Единый runtime resolver схемы для readers/writers |
| `lib/atdb/rebuildContract.ts` | Контракт `AtdbChangeSet`, build report и safe error formatter |
| `lib/atdb/rebuildDiff.ts` | Compatibility diff из `ParsedAtdb` в явный набор изменений |
| `lib/atdb/rebuildValidation.ts` | Strict preflight, post-build validation и protected fingerprints |
| `lib/atdb/transaction.ts` | Общий transaction helper для strict write phase |
| `lib/parseAtdb.ts` | Совместимый экспорт парсинга `.atdb` |
| `lib/buildAtdb.ts` | Совместимый экспорт strict build API |
| `lib/types.ts` | Типы `Person`, `Family`, `Event`, `Place`, `ParsedAtdb` |
| `components/FileUploader.tsx` | Загрузка файлов в браузере |
| `components/ScrollableDataTable.tsx` | Основное табличное представление данных |
| `scripts/atdb-fixtures.mjs` | Registry разрешённых fixtures и safe output paths для schema/smoke контуров |
| `scripts/check-atdb-fixtures.mjs` | Batch gate для schema, diff, smoke matrix и redaction-проверок |
| `scripts/smoke-atdb.mjs` | Smoke-проверка parse/build/reparse для одиночной fixture или fixture label |
| `scripts/check-atdb-rebuild-contract.mjs` | Regression gate для strict rebuild contract и failure paths |

## Документация

| Документ | Путь | Описание |
|----------|------|----------|
| README | `README.md` | Основная информация о проекте |
| Getting Started | `docs/getting-started.md` | Инструкции по запуску и проверке |
| Architecture | `docs/architecture.md` | Архитектурный обзор приложения |
| ATDB format | `docs/atdb_format.md` | Описание формата и структуры `.atdb` |
| Multi-fixture schema | `docs/atdb_multi_fixture_schema.md` | Redacted comparison `yaman`, `yaman-test-full`, `family-test` |
| Codebase analysis | `docs/codebase-analysis.md` | Анализ текущей кодовой базы |
| Refactoring plan | `docs/refactoring-plan.md` | План рефакторинга |

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
| `typescript-react-reviewer` | `.agents/skills/typescript-react-reviewer` | Ревью TypeScript/React 19 кода, поиск anti-patterns и проблем типизации |
| `sqlite-database-expert` | `.agents/skills/sqlite-database-expert` | Проверка SQL/SQLite паттернов, параметризованных запросов, транзакций и безопасности данных |

## Структура базы данных (.atdb)

Файлы `.atdb` являются SQLite-базами данных. Основные таблицы, с которыми работает проект:

| Таблица | Назначение |
|---------|------------|
| `Persons` | Информация о персонах |
| `Families` | Информация о родах |
| `Events` | События |
| `EventDetails` | Связь персон с событиями и ролями |
| `Places` | Места |
| `ValuesStr` | Строковые значения дополнительных полей |
| `ValuesNum` | Числовые значения |
| `ValuesDates` | Даты |
| `ValuesLinks` | Связи между сущностями |

### Доменное значение `Families`

- Таблица `Families` в контексте «Древо Жизни 6» означает **«Роды»**, а не нуклеарные семьи.
- Роды группируют неограниченное количество персон, обычно выбранных пользователем как рождённые с одной фамилией.
- У рода нет доменных ролей «муж», «жена» и «дети». Не интерпретируйте `Families` как семейную пару и не выводите из неё супружеские или детско-родительские связи.
- Связь персоны с родом хранится как отдельная ссылка от персоны к `Families` и не равна браку, родительству или составу семьи.

### Роли EventDetails (`er_id`)

- ID `1`, `2`, `3` являются только legacy fallback для ролей рождения.
- Семантику ролей определяйте через каталог `EventRoles` по типу события, типу роли и порядку; числовой ID роли не является универсальным.

### Поля ValuesStr для родов

- `f_id = 48` — мужская фамилия
- `f_id = 49` — женская фамилия
- `f_id = 50` — название рода
- `f_id = 52` — комментарий

## Правила для агентов

- Перед редактированием проверяйте `git status` и учитывайте существующие пользовательские изменения.
- Если пользователь пишет по-русски, отвечайте естественным русским языком и так же пишите русскоязычную документацию: переводите общеупотребимые технические слова и фразы, не смешивайте русский с английским без необходимости. Английские названия оставляйте только для имён API, команд, путей, библиотек, типов, таблиц и терминов без точного русского аналога.
- Не печатайте содержимое пользовательских `.atdb` файлов, `.env` и других чувствительных файлов.
- Команды с несколькими шагами выполняйте по отдельности: сначала `git checkout master`, затем `git pull origin master`.
- SQL-логику держите в `lib/`, UI-компоненты не должны напрямую выполнять запросы к базе.
- После изменений запускайте минимальную релевантную проверку, обычно `npm run lint`.
