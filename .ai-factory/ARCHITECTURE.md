# Architecture: Layered Modular App

## Обзор

GeneoTools использует простую модульную архитектуру с разделением по слоям. Для текущего размера проекта это практичнее тяжелых Clean Architecture/DDD-подходов: приложение работает как единый Next.js frontend, а основная сложность сосредоточена в обработке SQLite/.atdb.

Главное архитектурное правило: UI управляет пользовательским сценарием, а вся логика чтения, нормализации и сборки `.atdb` живет в `lib/`. Это сохраняет компоненты предсказуемыми и позволяет развивать парсер без переписывания интерфейса.

## Обоснование выбора

- **Тип проекта:** браузерный редактор и анализатор SQLite `.atdb` файлов.
- **Tech stack:** TypeScript 5, Next.js 16 App Router, React 19, `sql.js`.
- **Ключевой фактор:** нужна простая структура для небольшой команды и локальной обработки данных без серверного хранилища.

## Структура папок

```
geneotools/
├── app/                         # Presentation: страницы и layout Next.js
│   ├── layout.tsx
│   ├── page.tsx                 # Главный пользовательский сценарий
│   └── globals.css
├── components/                  # Presentation: переиспользуемые React-компоненты
│   ├── FileUploader.tsx
│   ├── ScrollableDataTable.tsx
│   ├── DataTable.tsx
│   └── Modal.tsx
├── lib/                         # Domain/Data: обработка .atdb и общие типы
│   ├── sqlProcessor.ts          # Главный фасад для parse/build
│   ├── parseAtdb.ts             # Парсинг .atdb
│   ├── buildAtdb.ts             # Сборка .atdb
│   ├── initSqlJs.ts             # Инфраструктура sql.js
│   ├── types.ts                 # Доменные типы
│   └── utils.ts                 # Общие утилиты
├── docs/                        # Документация формата и проектные заметки
├── public/                      # Статические ассеты
├── scripts/                     # Вспомогательные скрипты и smoke-проверки
├── Dockerfile                   # Контейнерная сборка приложения
└── docker-compose.yml           # Compose-запуск приложения
```

## Правила зависимостей

- Разрешено: `app/` импортирует `components/` и типы/фасады из `lib/`.
- Разрешено: `components/` импортируют типы и чистые утилиты из `lib/`.
- Разрешено: `lib/sqlProcessor.ts` координирует `initSqlJs`, парсинг и сборку.
- Запрещено: `lib/` импортирует `app/` или `components/`.
- Запрещено: компоненты выполняют SQL-запросы напрямую.
- Запрещено: данные пользовательской базы отправляются во внешние API без явного требования.

## Взаимодействие слоев

- Загрузка: `FileUploader` передает `File` и `ArrayBuffer` в `app/page.tsx`.
- Обработка: `app/page.tsx` динамически импортирует `lib/sqlProcessor.ts`, чтобы избежать SSR-проблем с `sql.js`.
- Данные: `lib/` возвращает типизированный `ParsedAtdb`.
- Отображение: таблицы получают готовые массивы сущностей через props.
- Экспорт: UI вызывает фасад сборки, получает `Uint8Array`, создает `Blob` и скачивает файл.

## Ключевые принципы

1. **Локальная обработка данных.** `.atdb` файлы остаются в браузерной сессии.
2. **SQL вне UI.** Компоненты отвечают за отображение и события, а не за структуру SQLite.
3. **Фасад для сложной логики.** Новые сценарии работы с `.atdb` добавлять через `lib/sqlProcessor.ts` или специализированные модули `lib/`.
4. **Схема `.atdb` вариативна.** Код должен терпимо относиться к отсутствующим таблицам и полям, если они не обязательны для текущего сценария.
5. **Типы рядом с доменом.** Общие модели хранить в `lib/types.ts`.
6. **Проверки рядом с задачей.** Для изменений в `.atdb`-логике запускать не только lint, но и `npm run smoke:atdb`, когда локальная тестовая база доступна.

## Примеры кода

### Динамический импорт процессора в UI

```typescript
const handleFileUpload = async (file: File, buffer: ArrayBuffer) => {
  setIsLoading(true);
  setError(null);

  try {
    const { parseAtdb } = await import('@/lib/sqlProcessor');
    const parsedResult = await parseAtdb(new Uint8Array(buffer));
    setParsedData(parsedResult);
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err));
  } finally {
    setIsLoading(false);
  }
};
```

### Фасадная функция в `lib/`

```typescript
export async function parseAtdb(buffer: Uint8Array | Buffer): Promise<ParsedAtdb> {
  const { createDbFromBuffer } = await import('./initSqlJs');
  const db = await createDbFromBuffer(buffer instanceof Buffer ? new Uint8Array(buffer) : buffer);

  if (buffer.length < 16) {
    throw new Error('Invalid .atdb file: too small to be valid SQLite database');
  }

  // Дальше: чтение таблиц, нормализация и сборка ParsedAtdb.
}
```

## Антипаттерны

- Не добавлять SQL-запросы в `components/` или JSX-обработчики.
- Не хранить пользовательские базы или персональные данные на сервере.
- Не разносить одну доменную операцию по множеству UI-компонентов.
- Не предполагать, что все версии `.atdb` имеют одинаковый набор колонок.
- Не логировать содержимое пользовательских записей из базы.
- Не обновлять Docker/скрипты запуска в отрыве от документации по запуску.
