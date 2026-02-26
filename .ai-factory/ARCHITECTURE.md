# Architecture: Modular Monolith

## Overview

**GeneoTools** использует архитектуру **Modular Monolith** с элементами **Layered Architecture**. Это оптимальный выбор для проекта с следующими характеристиками:
- Команда: 1-2 разработчика
- Домен: средняя сложность (генеалогические данные, SQLite)
- Развёртывание: Vercel (serverless)
- Требование: быстрая итерация и простота поддержки

Архитектура обеспечивает чёткое разделение ответственности между модулями при сохранении простоты развёртывания в виде единого приложения Next.js.

## Decision Rationale

- **Project type:** Browser-based SQLite editor для генеалогических данных
- **Tech stack:** Next.js 16 (App Router), React 19, TypeScript 5, sql.js
- **Key factor:** Простота разработки при сохранении модульности для будущего расширения

## Folder Structure

```
geneotools/
├── app/                          # Next.js App Router (Presentation Layer)
│   ├── layout.tsx                # Корневой макет с провайдерами
│   ├── page.tsx                  # Главная страница
│   ├── globals.css               # Глобальные стили
│   └── api/                      # API routes (Edge functions)
│       └── process/              # Обработка файлов
│           └── route.ts          # POST /api/process
├── components/                   # UI компоненты (Presentation Layer)
│   ├── FileUploader.tsx          # Загрузка файлов
│   ├── DataTable.tsx             # Таблицы с данными
│   ├── Filters.tsx               # Фильтры
│   ├── Toolbar.tsx               # Панель инструментов
│   └── ui/                       # shadcn/ui компоненты (Button, Table, etc.)
├── lib/                          # Business Logic & Data Access Layers
│   ├── sqlProcessor.ts           # Основной процессор SQLite (Domain Logic)
│   ├── parseAtdb.ts              # Парсинг .atdb → JSON (Data Access)
│   ├── buildAtdb.ts              # Сборка .atdb из JSON (Data Access)
│   ├── initSqlJs.ts              # Инициализация sql.js (Infrastructure)
│   └── utils.ts                  # Вспомогательные функции (Shared)
├── docs/                         # Документация
│   └── atdb-structure.md         # Структура базы данных .atdb
├── public/                       # Статические файлы
└── .ai-factory/                  # AI Factory конфигурация
    ├── DESCRIPTION.md            # Спецификация проекта
    └── ARCHITECTURE.md           # Архитектурные решения
```

## Dependency Rules

```
┌─────────────────────────────────────────────────────────┐
│                    app/ (Presentation)                   │
│  ┌─────────────────────────────────────────────────┐    │
│  │              components/ (UI Layer)              │    │
│  │  ┌─────────────────────────────────────────┐    │    │
│  │  │           lib/ (Business Logic)          │    │    │
│  │  │  ┌─────────────────────────────────┐    │    │    │
│  │  │  │   Domain Logic (sqlProcessor)   │    │    │    │
│  │  │  └─────────────────────────────────┘    │    │    │
│  │  └─────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Правила зависимостей:**

- ✅ `components/` → `lib/` (UI вызывает бизнес-логику)
- ✅ `app/` → `components/` + `lib/` (Страницы используют компоненты и утилиты)
- ✅ `lib/sqlProcessor.ts` → `lib/parseAtdb.ts`, `lib/buildAtdb.ts` (Домен использует Data Access)
- ❌ `lib/` → `components/` (Бизнес-логика не зависит от UI)
- ❌ `lib/` → `app/` (Бизнес-логика не зависит от Presentation)
- ❌ Прямые SQL запросы в компонентах (только через `lib/`)

## Layer/Module Communication

### Data Flow (Загрузка файла)

```
User → FileUploader.tsx → sqlProcessor.ts → parseAtdb.ts → sql.js → JSON → DataTable.tsx
```

### Data Flow (Экспорт файла)

```
User → Toolbar.tsx → sqlProcessor.ts → buildAtdb.ts → sql.js → .atdb файл
```

### State Management

- **Локальное состояние React:** `useState`, `useReducer` для UI состояния
- **Глобальное состояние:** Отсутствует (данные передаются через props)
- **Кэширование:** `useMemo`, `useCallback` для оптимизации пересчётов

## Key Principles

1. **Чистые функции в lib/** — Все функции в `lib/` должны быть чистыми, без побочных эффектов
2. **Типобезопасность** — Строгая типизация TypeScript (`strict: true`), никаких `any`
3. **Изоляция домена** — `sqlProcessor.ts` инкапсулирует всю логику работы с SQLite
4. **UI без логики** — Компоненты только отображают данные и вызывают функции из `lib/`
5. **Сессионность** — Данные не сохраняются на сервере, только в памяти браузера
6. **Производительность** — Обработка 5–10k записей без блокировки UI (использовать Web Workers при необходимости)

## Code Examples

### Domain Logic (sqlProcessor.ts)

```typescript
// 🔹 Пример: Извлечение данных о родителях из событий рождения
export async function extractParentRelationships(
  db: SqlJs.Database,
  persons: Person[]
): Promise<Person[]> {
  const birthEvents = db.exec(`
    SELECT ed.p_id, ed.e_id
    FROM EventDetails ed
    WHERE ed.er_id = 1  -- 1 = родился
  `);

  const parentMap = new Map<number, { fatherId?: number; motherId?: number }>();

  for (const event of birthEvents[0]?.values || []) {
    const personId = event[0] as number;
    const eventId = event[1] as number;

    const parents = db.exec(`
      SELECT ed.er_id, ed.p_id
      FROM EventDetails ed
      WHERE ed.e_id = ${eventId} AND ed.er_id IN (2, 3)  -- 2 = отец, 3 = мать
    `);

    const fatherId = parents[0]?.values.find(v => v[0] === 2)?.[1] as number | undefined;
    const motherId = parents[0]?.values.find(v => v[0] === 3)?.[1] as number | undefined;

    parentMap.set(personId, { fatherId, motherId });
  }

  return persons.map(person => ({
    ...person,
    ...(parentMap.get(person.id) || {}),
  }));
}
```

### Data Access (parseAtdb.ts)

```typescript
// 🔹 Пример: Парсинг таблицы Families с ValuesStr
export async function parseFamilies(db: SqlJs.Database): Promise<Family[]> {
  const families = db.exec('SELECT * FROM Families');
  const valuesStr = db.exec('SELECT * FROM ValuesStr WHERE rec_table = 9');

  const valuesMap = new Map<number, Map<number, string>>();
  for (const row of valuesStr[0]?.values || []) {
    const recId = row[0] as number;
    const fieldId = row[1] as number;
    const value = row[2] as string;

    if (!valuesMap.has(recId)) {
      valuesMap.set(recId, new Map());
    }
    valuesMap.get(recId)!.set(fieldId, value);
  }

  return families[0]?.values.map(row => {
    const id = row[0] as number;
    const familyValues = valuesMap.get(id) || new Map();

    return {
      id,
      familyName: familyValues.get(50),      // Название рода
      husbandLastName: familyValues.get(48), // Мужская фамилия
      wifeLastName: familyValues.get(49),    // Женская фамилия
      comment: familyValues.get(52),         // Комментарий
    } as Family;
  }) || [];
}
```

### Presentation (DataTable.tsx)

```typescript
// 🔹 Пример: Отображение таблицы Persons с сортировкой
interface DataTableProps {
  persons: Person[];
  onEdit: (person: Person) => void;
}

export function DataTable({ persons, onEdit }: DataTableProps) {
  const [sortField, setSortField] = useState<keyof Person>('lastName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const sortedPersons = useMemo(() => {
    return [...persons].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const direction = sortDirection === 'asc' ? 1 : -1;
      return (aVal! < bVal! ? -1 : aVal! > bVal! ? 1 : 0) * direction;
    });
  }, [persons, sortField, sortDirection]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead onClick={() => handleSort('lastName')}>Фамилия</TableHead>
          <TableHead onClick={() => handleSort('firstName')}>Имя</TableHead>
          <TableHead>Отчество</TableHead>
          <TableHead>Дата рождения</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedPersons.map(person => (
          <TableRow key={person.id}>
            <TableCell>{person.lastName}</TableCell>
            <TableCell>{person.firstName}</TableCell>
            <TableCell>{person.patronymic}</TableCell>
            <TableCell>{person.birthDate}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

### Infrastructure (initSqlJs.ts)

```typescript
// 🔹 Пример: Инициализация sql.js в браузере
import initSqlJs, { SqlJsStatic } from 'sql.js';

let sqlJsInstance: SqlJsStatic | null = null;

export async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsInstance) {
    sqlJsInstance = await initSqlJs({
      locateFile: file => `https://sql.js.org/dist/${file}`,
    });
  }
  return sqlJsInstance;
}

export async function loadDatabase(file: File): Promise<SqlJs.Database> {
  const sqlJs = await getSqlJs();
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  return new sqlJs.Database(uint8Array);
}
```

## Anti-Patterns

- ❌ **Прямые SQL запросы в компонентах** — Вся работа с БД только через `lib/sqlProcessor.ts`
- ❌ **Хранение файлов на сервере** — Файлы обрабатываются только в памяти браузера
- ❌ **Использование `any` в TypeScript** — Строгая типизация для всех данных
- ❌ **Побочные эффекты в чистых функциях** — Функции `lib/` не должны мутировать состояние
- ❌ **Пропуск слоёв** — `app/` не должен напрямую вызывать `parseAtdb.ts`, только через `sqlProcessor.ts`
- ❌ **Глобальное состояние для данных** — Данные передаются через props, не через Context/Redux

## Performance Guidelines

### Обработка больших объёмов данных (5–10k записей)

```typescript
// ✅ Использовать виртуализацию для больших таблиц
import { useVirtualizer } from '@tanstack/react-virtual';

// ✅ Мемоизация тяжёлых вычислений
const processedData = useMemo(() => heavyProcessing(data), [data]);

// ✅ Web Workers для фоновой обработки
const worker = new Worker(new URL('./sqlWorker.ts', import.meta.url));
```

### Оптимизация sql.js

```typescript
// ✅ Кэширование экземпляра sql.js
let cachedDb: SqlJs.Database | null = null;

// ✅ Пакетная обработка запросов
const queries = [
  'SELECT * FROM Persons',
  'SELECT * FROM Families',
  'SELECT * FROM Events',
].map(q => db.exec(q));
```
