# Документация проекта GeneoTools

## Обзор

GeneoTools — браузерный инструмент для работы с генеалогическими базами программы «Древо Жизни 6» (`.atdb`).
Все ключевые операции выполняются локально в браузере на базе `sql.js`.

## Актуальная структура проекта

```text
geneotools/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── DataTable.tsx
│   ├── ScrollableDataTable.tsx
│   ├── FileUploader.tsx
│   ├── Modal.tsx
│   └── DebugAnalyzer.tsx
├── lib/
│   ├── initSqlJs.ts
│   ├── sqlProcessor.ts
│   ├── parseAtdb.ts
│   ├── buildAtdb.ts
│   └── utils.ts
├── docs/
│   ├── atdb_format.md
│   ├── codebase-analysis.md
│   └── refactoring-plan.md
├── README.md
└── DOCS.md
```

## Основной пользовательский сценарий

1. Пользователь загружает `.atdb` файл (drag-and-drop или выбор).
2. Файл парсится в клиенте (`parseAtdb` из `lib/sqlProcessor.ts`).
3. Данные отображаются в табличном интерфейсе (персоны, роды, события, места).
4. Пользователь скачивает обновлённый `.atdb` (`buildAtdb` из `lib/sqlProcessor.ts`).

## Ключевые модули

- `app/page.tsx` — композиция UI, обработка upload/download сценария.
- `components/FileUploader.tsx` — загрузка и первичная валидация файла.
- `components/ScrollableDataTable.tsx` — табы и скроллируемый контейнер таблиц.
- `components/DataTable.tsx` — рендер и сортировка данных по сущностям.
- `lib/initSqlJs.ts` — инициализация sql.js и создание Database.
- `lib/sqlProcessor.ts` — текущее ядро парсинга/сборки `.atdb`.

## Текущее состояние качества

- Проект находится на этапе MVP.
- В кодовой базе есть технический долг, зафиксированный в отдельном анализе.
- Рекомендуется выполнить план рефакторинга перед активным расширением функционала.

## Связанные документы

- Анализ кодовой базы: `docs/codebase-analysis.md`
- План рефакторинга: `docs/refactoring-plan.md`
- Описание структуры `.atdb`: `docs/atdb_format.md`

## Команды разработки

```bash
npm install
npm run dev
npm run lint
npm run build
```
