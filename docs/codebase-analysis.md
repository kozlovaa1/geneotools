[← Формат ATDB](atdb_format.md) · [К README](../README.md) · [План рефакторинга →](refactoring-plan.md)

# Анализ кода GeneoTools

## Срез состояния

GeneoTools уже прошёл базовую декомпозицию: `lib/sqlProcessor.ts` работает как фасад, доменные типы вынесены в `lib/types.ts`, а ATDB-логика разделена на readers, writers, mapping, validation и transaction helpers.

Текущий основной риск сместился с «одного монолитного парсера» на поддержку границ между UI, draft helpers и strict rebuild contract.

## Сильные стороны

| Область | Что уже хорошо |
|---------|----------------|
| Локальность данных | `.atdb` обрабатывается в браузере без отправки на сервер |
| Фасад обработки | UI обращается к `lib/sqlProcessor.ts`, а не к внутренним readers/writers |
| Типы | Общие модели находятся в `lib/types.ts` |
| Mapping | Числовые ATDB-коды централизованы в `lib/atdb/mapping.json` |
| Rebuild safety | Экспорт использует `AtdbChangeSet`, preflight, transaction и post-build validation |
| UI helpers | Поиск, фильтры, сортировка, draft, batch edit и table chrome вынесены в отдельные helpers/components |
| Таблицы | `DataTable` стал router-wrapper, а рендер персон, родов, событий и мест разделён по entity-specific компонентам |
| Диагностика | Ошибки и проверки ориентированы на redacted context |

## Текущие риски

### 1. Табличный UI не виртуализирован

Сценарий с большими базами может упереться в объём DOM-строк. Сейчас приоритетом была корректность write-safe flow и декомпозиция таблиц, а не производительность больших таблиц.

Риск: на больших файлах поиск и переключение вкладок могут ощущаться медленными.

### 2. UI-regression требует browser smoke

Скриптовые проверки покрывают helpers, component contract и strict rebuild contract, но полный пользовательский путь upload → edit → download остаётся browser workflow.

Риск: регрессия в загрузке fixture или скачивании файла может не проявиться в чистых Node.js checks.

### 3. Поддержка формата шире текущего UI

`.atdb` содержит больше сущностей и типов значений, чем редактирует приложение. Strict rebuild намеренно запрещает custom fields, события, роли и metadata, но readers всё равно должны сохранять терпимость к вариативности структуры.

Риск: расширение write scope без mapping/validation слоя может повредить неизвестные данные.

### 4. Документация должна оставаться redacted

Проект работает с генеалогическими данными. Даже технические исследования формата должны публиковать только структурные сведения.

Риск: случайное добавление raw `ValuesStr`, имён, мест, заметок, путей документов или GUID в документацию.

## Рекомендации

| Приоритет | Рекомендация | Критерий готовности |
|-----------|--------------|---------------------|
| Must | Держать `npm run lint` и `npx tsc --noEmit` обязательными gates | Проверки проходят перед merge |
| Must | Держать `npm run test:atdb:table-components` рядом с изменениями таблиц | Component contract ловит regressions в table chrome и editor wiring |
| Should | Добавить browser smoke для upload/edit/download | Проверяется полный пользовательский путь |
| Should | Ввести виртуализацию или paging для больших таблиц | Большие базы не перегружают DOM |
| Could | Расширять mapping только через invariant-правила | Новые write paths проходят preflight/post-build checks |

## Технический долг

- Состояния selection, query и batch edit нужно регулярно проверять на независимость по вкладкам.
- Нет автоматической browser-проверки скачанного файла.
- Документация по формату требует дисциплины redaction при каждом обновлении.

## См. также

- [Архитектура](architecture.md) — фактические границы слоёв
- [Формат ATDB](atdb_format.md) — safe write contract
- [План рефакторинга](refactoring-plan.md) — порядок следующих улучшений
