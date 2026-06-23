[Back to README](../README.md) · [Architecture →](architecture.md)

# Getting Started

## Что это

GeneoTools — клиентское Next.js приложение для работы с `.atdb` файлами. База открывается локально, читается через `sql.js`, затем данные отображаются в табличном интерфейсе.

## Требования

- Node.js 20+
- npm
- Современный браузер с поддержкой `ArrayBuffer`, `Blob` и `FileReader`

## Установка

```bash
npm install
```

## Запуск в разработке

```bash
npm run dev
```

После запуска откройте `http://localhost:3000`.

## Основной сценарий

1. Загрузите локальный `.atdb` файл через drag-and-drop или file picker.
2. Приложение проверит SQLite header и откроет базу через `sql.js`.
3. После парсинга будут доступны вкладки:
   - Персоны
   - Роды
   - События
   - Места
4. Отредактируйте разрешённые поля прямо в таблицах:
   - персоны: фамилия, имя, отчество, пол, существующие ссылки на место рождения и смерти;
   - роды: название рода, мужская фамилия, женская фамилия, комментарий и цвет;
   - места: название, краткое название и комментарий.
5. Для массового редактирования выберите строки на вкладке персон, родов или мест, откройте «Массовое редактирование», выберите поле, область и операцию, затем сначала построите предпросмотр.
6. Доступные области массового редактирования:
   - выбранные строки;
   - все строки текущей editable вкладки;
   - строки текущей вкладки по простому field-level условию `contains`, `equals`, `empty` или `not empty`.
7. Доступные операции:
   - заполнить поле значением;
   - очистить поле;
   - заменить строку только в строковых write-safe полях.
8. Предпросмотр показывает affected/skipped/no-op counts, reason codes и изменения по ID. Кнопка применения активна только для актуального предпросмотра.
9. Применение массового редактирования меняет только локальный draft. Скачивание `.atdb` остаётся отдельным шагом и использует общий `AtdbChangeSet`.
10. Вкладка событий остаётся только для просмотра: тип события, дата, место, описание и участники не записываются.
11. Счётчик рядом с кнопкой скачивания показывает количество изменённых полей и записей. Пока изменений нет, кнопка скачивания обновлённого файла отключена и сборка не запускается.
12. Скачайте обновлённый `.atdb`. Изменения применяются только к скачанному файлу; исходный локальный файл не перезаписывается.

## Полезные команды

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run smoke:atdb
npm run smoke:atdb:matrix
npm run schema:atdb:check
npm run schema:atdb:diff:check
npm run schema:atdb:fixtures
npm run schema:atdb:fixtures:diff
npm run schema:atdb:fixtures:check
npm run mapping:atdb:check
npm run test:atdb:fixtures:missing-local
npm run test:atdb:edit-draft
npm run test:atdb:batch-edit
npm run test:atdb:write-safety
npm run test:atdb:rebuild-contract
```

`schema:atdb:diff:check` проверяет tracked redacted snapshot и diff harness без доступа к локальной `.atdb` базе. Для локального сравнения двух экспериментальных баз или snapshot-файлов используйте:

```bash
npm run schema:atdb:diff -- <baseline.snapshot.json> <after.snapshot.json>
```

`schema:atdb:fixtures` строит redacted snapshot matrix для allow-list fixtures: tracked `yaman` и local-only `yaman-full` / `family`. `schema:atdb:fixtures:diff` показывает structural deltas baseline-vs-fixture в warn-only режиме, а `schema:atdb:fixtures:check` объединяет schema, diff, smoke matrix и redaction checks.

`smoke:atdb:matrix` и `schema:atdb:fixtures:check` падают при любом ненулевом parse/build/reparse delta по `persons`, `families`, `events` или `places`. Отсутствующие local-only fixtures остаются safe skip и не считаются ошибкой. `test:atdb:fixtures:missing-local` проверяет этот skip path и synthetic drift failure без чтения пользовательских `.atdb`.

`mapping:atdb:check` валидирует единый реестр правил `lib/atdb/mapping.json`, baseline трёх fixtures и отсутствие конфликтующих кодов в readers/writers. `test:atdb:edit-draft` проверяет чистые helper'ы локального draft state и сборку `AtdbChangeSet` на synthetic данных без чтения `.atdb`. `test:atdb:batch-edit` проверяет batch preview/apply, predicate scope, stale-preview protection и place-link skip reasons на synthetic данных без чтения `.atdb`. `test:atdb:write-safety` проверяет, что сборка не изменяет неизвестные `Values*`, не создаёт новые `EventRoles` и блокирует небезопасные write paths. `test:atdb:rebuild-contract` покрывает оба публичных write API: compatibility `buildAtdb(parsed, original)` и явный `applyAtdbChanges(original, changeSet)`.

Экспорт UI проходит через явный `AtdbChangeSet`, который собирается из локального draft state только перед скачиванием. No-op export не запускает `applyAtdbChanges`: UI показывает состояние без изменений и оставляет кнопку скачивания отключённой. Если набор изменений содержит недоступную запись, неподдержанное поле или несовместимую схему, экспорт падает с безопасным сообщением до возврата файла.

Локальные `.atdb`, before/after snapshots, verbose/debug logs и private summaries не коммитьте. Публичные artifacts должны содержать только redacted counts, `rec_table`, `f_id`, `datatype`, link targets и confidence labels. `yaman-test.atdb` остается tracked research fixture; любые дополнительные `.atdb` с реальными данными держите только как local-only файлы.

## Что проверить после изменений

- Парсинг реального `.atdb` файла не падает
- Таблицы переключаются между вкладками
- Счётчик изменений обновляется после редактирования и field-level reset
- Массовое редактирование сначала строит предпросмотр, затем применяет изменения только в draft
- Экспорт формирует скачиваемый `.atdb` только при ненулевом `AtdbChangeSet`
- `npm run lint` остаётся зелёным
- `npm run test:atdb:edit-draft` подтверждает draft/change-set semantics
- `npm run test:atdb:batch-edit` подтверждает batch preview/apply semantics
- `npm run schema:atdb:diff:check` проходит без локальной fixture
- `npm run schema:atdb:fixtures:check` проходит на разрешенных fixtures без raw values в artifacts и падает при ненулевом parse/build drift
- `npm run test:atdb:rebuild-contract` подтверждает strict rebuild success/failure paths

## Известные ограничения

- Табличный UI пока не разделён на entity-specific компоненты
- Создание и удаление записей, изменение событий, дат, участников событий, родственных связей, notes/occupation, metadata/`Global`, `Fields`, `Recs`, `EventRoles` и custom fields намеренно запрещены strict rebuild contract
- Ссылки `birthPlaceId` и `deathPlaceId` редактируются только там, где исходный parse уже нашёл существующую ссылку на место; добавление новых life-event links вынесено за пределы текущего UI milestone
- Массовое редактирование использует только локальную область текущей вкладки; глобальный поиск и постоянные table filters остаются отдельным этапом

## See Also

- [Architecture](architecture.md) — текущая структура проекта и ограничения
- [Codebase Analysis](codebase-analysis.md) — что именно сейчас считается техдолгом
- [Refactoring Plan](refactoring-plan.md) — куда должен прийти проект
