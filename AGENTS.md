# AGENTS.md

> Project map for AI agents. Keep this file up-to-date as the project evolves.

## Project Overview

**GeneoTools** — браузерный инструмент для работы с генеалогическими базами данных программы «Древо Жизни 6» (`.atdb`). Все операции происходят локально в браузере с использованием sql.js.

## Tech Stack

- **Language:** TypeScript 5
- **Framework:** Next.js 16 (App Router)
- **Database:** SQLite (файлы .atdb, обрабатываются через sql.js)
- **UI:** Tailwind CSS 4, shadcn/ui, Lucide React
- **Runtime:** React 19, Node.js 20

## Project Structure

```
geneotools/
├── app/                        # Next.js App Router страницы
│   ├── layout.tsx              # Базовый макет приложения
│   ├── page.tsx                # Главная страница (загрузка и таблицы)
│   └── globals.css             # Глобальные стили
├── components/                 # React компоненты
│   ├── FileUploader.tsx        # Drag-and-drop загрузка файлов
│   ├── DataTable.tsx           # Таблицы с данными (Persons, Families, Events)
│   ├── Filters.tsx             # Фильтры для таблиц
│   ├── Toolbar.tsx             # Панель инструментов
│   └── ui/                     # shadcn/ui компоненты
├── lib/                        # Бизнес-логика и утилиты
│   ├── parseAtdb.ts            # Парсер .atdb в JSON
│   ├── buildAtdb.ts            # Генератор .atdb из JSON
│   ├── initSqlJs.ts            # Инициализация sql.js
│   ├── sqlProcessor.ts         # Основной процессор SQLite
│   └── utils.ts                # Вспомогательные функции
├── docs/                       # Документация проекта
│   └── atdb-structure.md       # Структура базы данных .atdb
├── public/                     # Статические файлы
├── .ai-factory/                # AI Factory конфигурация
│   ├── DESCRIPTION.md          # Спецификация проекта
│   └── ARCHITECTURE.md         # Архитектурные решения
├── .qwen/                      # Qwen конфигурация
│   └── skills/                 # Установленные навыки AI
└── package.json                # Зависимости и скрипты
```

## Key Entry Points

| File | Purpose |
|------|---------|
| `app/page.tsx` | Главная страница — загрузка файлов и отображение таблиц |
| `app/layout.tsx` | Корневой макет с провайдерами |
| `lib/sqlProcessor.ts` | Основной модуль обработки SQLite данных |
| `lib/parseAtdb.ts` | Парсинг .atdb файла в JSON-структуру |
| `lib/buildAtdb.ts` | Сборка .atdb файла из JSON-данных |
| `components/DataTable.tsx` | Компонент таблиц с сортировкой и фильтрацией |
| `components/FileUploader.tsx` | Компонент загрузки файлов |

## Documentation

| Document | Path | Description |
|----------|------|-------------|
| README | README.md | Основная информация о проекте |
| DOCS | DOCS.md | Детальная документация проекта |
| Architecture | .ai-factory/ARCHITECTURE.md | Архитектурные решения |
| Description | .ai-factory/DESCRIPTION.md | Спецификация проекта |

## AI Context Files

| File | Purpose |
|------|---------|
| AGENTS.md | Этот файл — карта проекта |
| .ai-factory/DESCRIPTION.md | Спецификация проекта и стек технологий |
| .ai-factory/ARCHITECTURE.md | Архитектурные решения и паттерны |
| QWEN.md | Правила и стиль разработки для Qwen Code |

## Database Structure (.atdb)

Файлы `.atdb` являются SQLite базами данных с основными таблицами:

| Table | Description |
|-------|-------------|
| `Persons` | Информация о персонах |
| `Families` | Информация о родах |
| `Events` | События |
| `EventDetails` | Детали событий (связывает персон с событиями) |
| `ValuesStr` | Строковые значения для полей |
| `ValuesNum` | Числовые значения |
| `ValuesDates` | Даты |
| `ValuesLinks` | Связи между сущностями |

### EventDetails Roles (er_id)

- `1` — родился (для персоны)
- `2` — отец (для события рождения)
- `3` — мать (для события рождения)

### ValuesStr Fields for Families (rec_table = 9)

- `f_id = 48` — мужская фамилия
- `f_id = 49` — женская фамилия
- `f_id = 50` — название рода
- `f_id = 52` — комментарий

## Development Workflow

1. **Планирование:** `/skills aif-plan <задача>` — создание плана реализации
2. **Реализация:** `/skills aif-implement` — выполнение плана
3. **Ревью:** `/skills aif-review` — проверка кода
4. **Коммит:** `/skills aif-commit` — создание commit message
5. **Документация:** `/skills aif-docs` — генерация документации

## Available Skills

- `/skills aif-plan` — Планирование реализации
- `/skills aif-implement` — Выполнение плана
- `/skills aif-review` — Code review
- `/skills aif-commit` — Создание commit message
- `/skills aif-docs` — Генерация документации
- `/skills aif-roadmap` — Создание roadmap проекта
- `/skills aif-rules` — Добавление правил проекта
- `/skills aif-build-automation` — Настройка автоматизации
- `/skills aif-ci` — CI/CD пайплайны
- `/skills aif-security-checklist` — Проверка безопасности
