# Implementation Plan: Стандартизация среды Node.js 22

Branch: codex/standardize-node-22-environment
Created: 2026-06-24

## Settings
- Testing: yes
- Logging: standard
- Docs: yes

## Roadmap Linkage
Milestone: "Стандартизация среды Node.js 22"
Rationale: План закрывает project-local фиксацию Node.js 22 и npm без изменения версий Node.js в соседних локальных проектах.

## Research Context
Source: текущий `$aif-explore ROADMAP "Стандартизация среды Node.js 22"`, `.ai-factory/ROADMAP.md`, `.ai-factory/DESCRIPTION.md`, `AGENTS.md`, `docs/getting-started.md`, `package.json`, `Dockerfile`, официальный Node.js release metadata.

Goal:
- Зафиксировать для GeneoTools проектный runtime contract на Node.js 22.x и совместимый npm 10.x.
- Убрать расхождение между `Dockerfile`, где уже используется `node:22-alpine`, и документацией/AI context, где всё ещё указан Node.js 20.

Constraints:
- Изменения должны быть project-local: `.nvmrc`, `package.json`, lockfile и документация в этом checkout; не менять глобальный Node.js и не добавлять инструкции, влияющие на другие локальные проекты.
- Не создавать полноценный CI/CD pipeline в рамках этого milestone: roadmap уже держит отдельный этап "Поставочный контур".
- Не менять прикладную логику `.atdb`, UI или runtime-logging приложения.
- Сохранять русскоязычную документацию и не публиковать пользовательские `.atdb` данные.

Decisions:
- `Dockerfile` уже использует `node:22-alpine`; этот milestone должен синхронизировать остальные источники правды с Node.js 22, а не мигрировать приложение на новую платформу с нуля.
- Текущая локальная среда на момент разведки: `node v22.8.0`, `npm 10.8.2`.
- По официальному metadata Node.js на 2026-06-24 актуальная v22 LTS line остаётся `Jod`; latest v22 release в `https://nodejs.org/dist/index.json` — `v22.23.1` с `npm 10.9.8`.
- Next.js `16.2.9` в установленном пакете требует `node >=20.9.0`, поэтому переход на Node.js 22 находится в поддерживаемом диапазоне текущего стека.

Open questions:
- Нужно ли в `.nvmrc` фиксировать exact patch (`22.23.1`) или оставить major line (`22`) для автоматического получения security patch в Node 22.x.
- Нужно ли закрепить exact `packageManager: "npm@10.9.8"` или ограничиться `engines.npm: ">=10 <11"` вместе с текущим lockfile. Рекомендуемый baseline для implementation: exact `packageManager` по latest v22 LTS metadata и range в `engines`.

Success signals:
- `package.json`, `.nvmrc`, `package-lock.json`, Docker/docs/context не противоречат друг другу по Node.js/npm.
- Команды `npm install`, `npm run lint`, `npx tsc --noEmit`, `npm run build` проходят под Node.js 22.
- Отсутствие CI явно проверено; если `.github/workflows` отсутствует, план не создаёт pipeline и оставляет это на milestone "Поставочный контур".

## Commit Plan
- **Commit 1** (after tasks 1-3): `chore(node): pin node 22 project environment`
- **Commit 2** (after tasks 4-5): `docs(node): document node 22 workflow`

## Tasks

### Phase 1: Runtime contract
- [x] Task 1: Зафиксировать project-local Node.js/npm contract.

  Deliverable:
  - Добавить `.nvmrc` в корень проекта.
  - В `package.json` добавить `engines.node` для Node.js 22.x и `engines.npm` для совместимой npm 10.x.
  - В `package.json` добавить `packageManager` с выбранной npm 10.x версией; baseline — `npm@10.9.8`, если implementation не выявит несовместимость с локальным install flow.
  - Не добавлять глобальные setup-скрипты и не менять системную Node.js установку.

  Files:
  - `.nvmrc`
  - `package.json`

  LOGGING REQUIREMENTS:
  - Runtime application logging не менять.
  - В implementation notes фиксировать только безопасные версии `node -v` и `npm -v`.
  - Не печатать локальные абсолютные пути, кроме обычного git/npm diagnostic output при ошибке.

- [x] Task 2: Синхронизировать TypeScript Node typings и lockfile с Node.js 22.

  Deliverable:
  - Обновить `@types/node` с `^20` до совместимой `^22`.
  - Перегенерировать `package-lock.json` через npm в выбранной Node.js 22/npm 10 среде.
  - Проверить, что обновление lockfile не меняет прикладные зависимости вне ожидаемого npm metadata/types scope без явной причины.

  Files:
  - `package.json`
  - `package-lock.json`

  LOGGING REQUIREMENTS:
  - Не добавлять logs в приложение или scripts.
  - В командном выводе достаточно npm summary; не включать debug logs, dependency tree dumps или содержимое registry cache.
  - При npm failure фиксировать код ошибки и имя команды, без лишнего окружения.

- [x] Task 3: Синхронизировать Docker и CI scope с выбранным Node.js 22 contract.

  Deliverable:
  - Проверить `Dockerfile`: builder и runner stages должны оставаться на Node.js 22 line или быть приведены к выбранной форме pinning.
  - Если остаётся `node:22-alpine`, явно зафиксировать решение в документации как major-line pin с security patch uptake.
  - Проверить наличие `.github/workflows` или другого CI. Если CI отсутствует, не создавать новый pipeline в этом milestone; зафиксировать no-op в implementation notes и оставить создание CI для "Поставочный контур".
  - Если существующий CI появится в ветке до implementation, обновить его Node setup до Node.js 22 в рамках этой задачи.

  Files:
  - `Dockerfile`
  - `.github/workflows/*` при наличии
  - `docs/getting-started.md` или `README.md` для фиксации Docker/CI решения

  LOGGING REQUIREMENTS:
  - Runtime application logging не менять.
  - Docker/CI audit output держать на уровне имени файла, найденной Node.js версии и принятого решения.
  - Не печатать секреты CI, environment variables или registry credentials.

<!-- Commit checkpoint: tasks 1-3 -->

### Phase 2: Documentation and verification
- [x] Task 4: Обновить документацию и AI Factory context под Node.js 22.

  Deliverable:
  - Заменить stale Node.js 20 references в `AGENTS.md` и `.ai-factory/DESCRIPTION.md`.
  - Обновить `docs/getting-started.md`: требования Node.js 22.x/npm 10.x, `nvm use`, установка и базовые команды.
  - При необходимости добавить в `README.md` короткое требование окружения, не раздувая landing page.
  - Не переносить fixture-specific или private environment details в публичные docs.

  Files:
  - `AGENTS.md`
  - `.ai-factory/DESCRIPTION.md`
  - `docs/getting-started.md`
  - `README.md` при необходимости

  LOGGING REQUIREMENTS:
  - Runtime application logging не менять.
  - Документация не должна включать локальные пути, приватные `.atdb`, raw logs или secrets.
  - Примеры команд должны быть короткими и воспроизводимыми: `nvm use`, `npm install`, `npm run lint`, `npm run build`.

- [x] Task 5: Выполнить проверки Node.js 22 standardization gate.

  Deliverable:
  - Запустить `node -v` и `npm -v`, подтвердив Node.js 22.x и npm 10.x.
  - Запустить `npm install` или `npm ci` в выбранной workflow форме после обновления lockfile.
  - Запустить `npm run lint`.
  - Запустить `npx tsc --noEmit`.
  - Запустить `npm run build`.
  - Запустить `git diff --check`.
  - Если `npm run build` падает из-за `.next`/process locking, сначала проверить repo-local Next.js processes и отличить environment issue от ошибки Node.js 22 migration.

  Files:
  - Исправления только в файлах из Tasks 1-4, если проверки выявят несоответствие.

  LOGGING REQUIREMENTS:
  - Не включать verbose npm/debug logs без необходимости.
  - Итоговые verification notes должны содержать команды, exit status и краткий результат.
  - Не публиковать env dump, локальные private paths, `.env` или пользовательские данные.

<!-- Commit checkpoint: tasks 4-5 -->
