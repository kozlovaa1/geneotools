# Документация проекта GeneoTools

## Обзор

GeneoTools — браузерный инструмент для работы с генеалогическими базами программы «Древо Жизни» (`.atdb`).

## Архитектура проекта

```
geneotools/
├── app/
├── components/
├── lib/
├── public/
├── DOCS.md        # Текущий файл документации
├── README.md
└── ...
```

## Функциональность

### Основные возможности:
1. Загрузка локального файла `.atdb`
2. Парсинг файла на сервере в JSON-структуру
3. Отображение данных в таблицах с фильтрацией и редактированием
4. Экспорт обратно в `.atdb` после изменений
5. Полную автономность без базы данных и авторизации

### Новые возможности (добавленные функции):

#### 1. Извлечение данных о родителях из событий рождения
- Извлечение `fatherId` (ID отца) и `motherId` (ID матери) из событий рождения
- Алгоритм:
  - Находим событие рождения для персоны в `EventDetails`, где `p_id` = ID персоны и `er_id` = 1 (означает, что родился человек)
  - Получаем `e_id` (ID события) из этой записи
  - Находим все записи `EventDetails` с этим `e_id`, где `er_id` = 2 (отец) или `er_id` = 3 (мать)
  - Используем `p_id` из этих записей как `fatherId` и `motherId`

#### 2. Обновление отображения таблицы "Роды"
- Добавлена колонка "Название рода" после колонки ID
- Обновленное отображение таблицы "Роды" теперь показывает только следующие колонки:
  - ID
  - Название рода
  - Мужская фамилия
  - Женская фамилия
  - Комментарий

#### 3. Извлечение данных из таблицы ValuesStr
- Новые поля для таблицы "Роды" берутся из таблицы `ValuesStr`:
  - `f_id=50` — Название рода (familyName)
  - `f_id=48` — Мужская фамилия (husbandLastName)
  - `f_id=49` — Женская фамилия (wifeLastName)
  - `f_id=52` — Комментарий (comment)
- Используется `rec_table=9` для таблицы Families (по требованиям)

## Структура данных

### Интерфейс Person
```ts
interface Person {
  id: number;
  firstName?: string;
  lastName?: string;
  patronymic?: string;
  gender: 'M' | 'F' | 'Unknown';
  birthDate?: string;
  deathDate?: string;
  birthPlace?: string;
  deathPlace?: string;
  birthPlaceId?: number;
  deathPlaceId?: number;
  notes?: string;
  fatherId?: number;      // Новое поле
  motherId?: number;      // Новое поле
  spouseIds?: number[];
}
```

### Интерфейс Family
```ts
interface Family {
  id: number;
  familyName?: string;        // Название рода (f_id=50 from ValuesStr)
  husbandLastName?: string;   // Мужская фамилия (f_id=48 from ValuesStr)
  wifeLastName?: string;      // Женская фамилия (f_id=49 from ValuesStr)
  comment?: string;           // Комментарий (f_id=52 from ValuesStr)
  husbandId?: number;
  wifeId?: number;
  childrenIds: number[];
  marriedDate?: string;
  divorcedDate?: string;
  notes?: string;
  color?: number;
}
```

## Архитектура компонентов

### DataTable.tsx
- Отображает три основные таблицы: Persons, Families, Events
- Для таблицы Families реализовано новое отображение с нужными колонками
- Использует сортировку по колонкам

### SqlProcessor.ts
- Основной модуль для обработки .atdb файлов
- Содержит логику парсинга и сборки базы данных
- Реализует извлечение родительских связей из событий рождения
- Обрабатывает данные из таблицы ValuesStr для заполнения полей рода

## Технологии

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- sql.js (для работы с SQLite базами .atdb)
- shadcn/ui (UI компоненты)

## Запуск проекта

```bash
npm install
npm run dev
```

## Сборка проекта

```bash
npm run build
```

## Структура базы данных .atdb

Файлы .atdb являются SQLite базами данных с следующими основными таблицами:
- `Persons` — информация о персонах
- `Families` — информация о родах
- `Events` — события
- `EventDetails` — детали событий (связывает персон с событиями)
- `ValuesStr` — строковые значения для различных полей
- `ValuesNum` — числовые значения
- `ValuesDates` — даты
- `ValuesLinks` — связи между сущностями

## Важные поля в EventDetails
- `p_id` — ID персоны
- `e_id` — ID события
- `er_id` — ID роли в событии
  - 1 — родился (для персоны)
  - 2 — отец (для события рождения)
  - 3 — мать (для события рождения)

## Используемые поля в ValuesStr для таблицы Families (rec_table = 9)
- `f_id = 48` — мужская фамилия
- `f_id = 49` — женская фамилия
- `f_id = 50` — название рода
- `f_id = 52` — комментарий