# 🧬 GeneoTools

**GeneoTools** — это веб-сервис для работы с генеалогическими базами программы **«Древо Жизни 6» (Agelong Tree 6)** (
`.atdb`) прямо в браузере.
Сервис позволяет загружать, просматривать, фильтровать и редактировать данные, а затем выгружать обновлённую версию
базы.

**Важно:** Файлы `.atdb` являются SQLite базами данных. Приложение использует sql.js для обработки этих файлов в
браузере.

---

## 🚀 Текущий статус

**Этап:** MVP
**Хостинг:** [Vercel](https://vercel.com/)
**Авторизация:** отсутствует (всё выполняется в рамках сессии, файлы не сохраняются на сервере)

---

## 🏗️ Архитектура

### Фронтенд

- **Next.js 16** (App Router)
- **React 19**
- **Tailwind CSS**
- **TypeScript**
- **sql.js** - для обработки SQLite баз данных (`.atdb` файлы)

### Бэкенд

- API routes / Edge functions Next.js
- Парсер `.atdb` (SQLite) → JSON
- Генератор JSON → `.atdb` (SQLite)
- Все данные обрабатываются локально в браузере

---

## ⚙️ Основной функционал (MVP)

| Функция              | Описание                                                                     |
|----------------------|------------------------------------------------------------------------------|
| **Загрузка `.atdb`** | Drag-and-drop или выбор файла с компьютера                                   |
| **Парсинг**          | Преобразование в JSON-структуру с таблицами (персоны, роды, события и т. д.) |
| **Просмотр**         | Отображение данных в таблицах (Persons, Families, Events, Places, Sources)   |
| **Редактирование**   | Ручная корректировка полей данных в таблицах                                 |
| **Сохранение**       | Выгрузка изменённого `.atdb` файла обратно на компьютер                      |
| **Ошибки**           | Отображаются через toast-уведомления                                         |

---

## 📁 Структура проекта

```
geneotools/
├── app/
│   ├── layout.tsx           # Базовый макет приложения
│   └── page.tsx             # Главная страница (загрузка и таблицы)
├── components/
│   ├── FileUploader.tsx     # drag&drop загрузка
│   └── DataTable.tsx        # таблица с данными
├── lib/
│   ├─ parseAtdb.ts          # парсер .atdb формата (SQLite)
│   └─ buildAtdb.ts          # генератор .atdb формата (SQLite)
├── docs/
│   └─ atdb-structure.md     # документация по формату .atdb
├── public/                  # Static assets
├── .gitignore
├── next.config.ts           # Next.js configuration
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── eslint.config.mjs        # ESLint configuration
├── postcss.config.mjs       # PostCSS configuration
└── README.md
```

---

## 🧩 Установка и запуск

```bash
# Установка зависимостей
npm install

# Запуск dev-сервера
next dev --webpack

# Открыть в браузере
http://localhost:3000
```

---

## 🧪 Тестирование

```bash
# Линтер
npm run lint
```

---

## 🪶 Лицензия

MIT License © 2025 GeneoTools