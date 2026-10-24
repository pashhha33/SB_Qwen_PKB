---
doc_type: handoff
title: "Передача: Фаза 5, этап A, под-батч A1 — каркас плагина second-brain 0.1.0 (DL-244)"
status: actual
created: 2026-10-24
metamodel_version: 1.0.2
covers: DL-244
tags: [handoff, commit, phase5]
---

# Передача изменений — 2026-10-24, под-батч A1 (плагин 0.1.0, метамодель 1.0.2)

> [!info] Что делать
> Патч **`phase5-a1-scaffold.patch`** основан на вашем текущем HEAD (**`b6b0287`**,
> метамодель 1.0.1) и применяется **напрямую**. Команды для **Windows PowerShell 5.1** —
> построчно (`&&` не использовать):
>
> ```powershell
> # 0. Убедиться, что рабочая копия чистая и HEAD — коммит 1.0.1
> git status --short
> git log --oneline -1
>
> # 1. Применить патч
> git apply --ignore-whitespace phase5-a1-scaffold.patch
>
> # 2. Установить зависимости плагина (в первый раз — обязательно; нужен интернет)
> cd plugin
> npm ci
>
> # 3. Тесты плагина (ожидание: Test Files 8 passed, Tests 82 passed)
> npm test
>
> # 4. Проверка типов (ожидание: тишина, код возврата 0)
> npm run typecheck
>
> # 5. Сборка (ожидание: «[second-brain] сборка завершена → main.js»)
> npm run build
>
> # 6. Корневой прогонщик метамодели не должен сломаться (ожидание: ИТОГ: 72 OK, 0 FAIL)
> cd ..
> npm run check
>
> # 7. Закоммитить (сообщение ниже) и запушить
> git add -A
> git commit
> git push
> ```
>
> `main.js` и `node_modules/` в коммит **не попадут** (игнорируются `plugin/.gitignore`) —
> это правильно: бандл собирается локально.
> Если `git apply` сообщает «already exists / does not apply» — патч уже применён;
> диагностика: `git apply -R --check phase5-a1-scaffold.patch`.

## Что произошло

Вы ответили **А / А / А / А** на вопросы F5-3…F5-6 старта этапа A (запись **DL-244**):

1. **F5-3 = А — монорепозиторий**: код плагина живёт в подпапке **`plugin/`** этого
   репозитория (свой `package.json`, tsconfig, esbuild, vitest). Схемы `schema/` рядом —
   генератор D2 (под-батч A3) будет читать `../schema` в том же коммите.
2. **F5-4 = А — тесты**: **vitest**; юнит — `plugin/tests/unit/`, интеграционные —
   `plugin/tests/integration/` на **FakeVault** (настоящая папка во временном каталоге
   за интерфейсом `VaultAdapter`, без запуска Obsidian); материал парсера — **62 примера**
   `examples/instances/`. Вопрос 9.3 `09-modules` закрыт.
3. **F5-5 = А — под-батчи A1/A2/A3** (состав этапа A не менялся, только гранулярность
   передачи; `phases.md` v0.5.0).
4. **F5-6 = А — один плагин** (9.2) и **`commands` — тонкая обёртка** (9.5). Раздел 9
   `09-modules` закрыт целиком (v0.6.0).

**Доставлен под-батч A1** — плагин `second-brain` **0.1.0**: каркас, `obsidian-adapter`,
`identity` (ULID, И1/И2), универсальный парсер. Проверки в песочнице ассистента:
**vitest 82/82**, `tsc --noEmit` чисто, `npm run build` → `main.js`, корневой
`npm run check` — **72 OK, 0 FAIL**; E2E на свежем клоне (apply → npm ci → test →
build → check → побайтовая сверка).

> [!warning] Найдено расхождение норм — вопрос F5-7 (блокирует A2)
> Реестр `02-entities` §6 содержит **12 префиксов с подчёркиванием** (`OBJECT_TYPE`,
> `PROPERTY_TYPE`, `RELATION_TYPE` — core; `SERIES_COLLECTION` и ещё 8 — phase2) и
> **4 префикса длиннее 12 символов**, но схема `defs.json#type_prefix`
> (`^[A-Z][A-Z0-9-]*$`) и правило ADR-001 («только A–Z, 0–9, дефис», 3–12) подчёркивание
> **запрещают**; ADR-001 при этом сам предписывает «UPPER_SNAKE_CASE». Примеры шага 9
> следуют схеме (`type_prefix: IMGWRAP` — «без подчёркивания!»). Код A1 следует схеме
> (строгая валидация создания), имена файлов парсит деликатно (`_` допускает).
> **A2 не начинать до решения F5-7** — бутстрап пишет файлы `OBJECT_TYPE-{ULID}.md`.
> Варианты и рекомендация — в чате и в `docs/plugin/architecture.md` §5.

## Состав патча

### Новые файлы — код плагина (29)

| Путь | Что |
|---|---|
| `plugin/manifest.json` | паспорт плагина: id `second-brain` (F5-1), version 0.1.0, minAppVersion 1.9.0 (Bases — этап D), isDesktopOnly |
| `plugin/versions.json` | соответствие версий плагина и minAppVersion |
| `plugin/package.json` + `plugin/package-lock.json` | dev-зависимости: esbuild, typescript 5.9, vitest 2.1.9, obsidian (типы), js-yaml 4.x (только тесты); runtime-зависимостей **ноль**; скрипты dev/build/typecheck/test/link:vault/check |
| `plugin/tsconfig.json` | strict, noEmit (typecheck), ES2018 |
| `plugin/esbuild.config.mjs` | dev-watch + production; `SB_VAULT_PATH` — сборка main.js прямо в хранилище |
| `plugin/vitest.config.ts` | тесты из `tests/**` |
| `plugin/.gitignore` | node_modules, main.js, data.json |
| `plugin/README.md` | быстрый старт, состав A1, правила кода |
| `plugin/scripts/link-vault.mjs` | копия manifest/versions/main.js в хранилище (вариант Б dev-связки) |
| `plugin/src/adapter/vault-adapter.ts` | **интерфейс слоя 0** `VaultAdapter` (файлы, YAML через среду — ADR-002, `.sb/` через DataAdapter) |
| `plugin/src/adapter/obsidian-adapter.ts` | прод-реализация: vault.*, **fileManager.processFrontMatter** (проверено по obsidian.d.ts 1.14 — метод на fileManager, не на vault), parseYaml/stringifyYaml приложения, vault.adapter для `.sb/` |
| `plugin/src/core/ulid.ts` | ULID: Crockford Base32, зеркало `defs#ulid`; generate/isValid/decodeTime; без зависимостей |
| `plugin/src/core/identity.ts` | TYPE_PREFIX, buildFileName/parseFileName (`{TYPE_PREFIX}-{ULID}.md`), И2-проверка и починка `repairFileNameById`, И1-скан `findDuplicateIds`, запрещённые символы имён |
| `plugin/src/core/datetime.ts` | локальное время до минут (ADR-006), нормализация Date→строка (DL-228), отдельно для created_at/updated_at |
| `plugin/src/core/markdown-parser.ts` | **универсальный парсер**: BOM/CRLF, splitFrontmatter, 8 системных атрибутов, properties, wikilink-и тела (код-блоки/инлайн-код пропускаются), yaml_error → `frontmatterBroken` (ADR-002: не применять, не чинить молча) |
| `plugin/src/core/model.ts` | `SbNote`, `SystemAttributes`, `WikilinkRef`, закрытый список 8 системных ключей |
| `plugin/src/core/errors.ts` | `SbError` с кодами |
| `plugin/src/main.ts` | точка входа: загрузка, адаптер, Notice «плагин загружен (A1)» |
| `plugin/tests/support/fake-vault.ts` | **FakeVault**: tmp-папка за интерфейсом; семантика Obsidian (create на существующий — ошибка; listMarkdown без dot-папок; processFrontMatter сохраняет тело) |
| `plugin/tests/support/examples.ts` | доступ к `examples/instances/` (пути через `fileURLToPath` — урок DL-232) |
| `plugin/tests/unit/ulid.test.ts` | 9 тестов: алфавит, детерминизм, сортируемость, 5000 уникальных, отклонение I/L/O/U |
| `plugin/tests/unit/datetime.test.ts` | 7 тестов: форматы, частичные даты, нормализация Date, полночь у created_at |
| `plugin/tests/unit/identity.test.ts` | 15 тестов: префиксы, имена файлов (включая префикс с дефисом), И1/И2, починка имени, запрещённые символы, **тест-документация находки F5-7** |
| `plugin/tests/unit/parser.test.ts` | 16 тестов: splitFrontmatter (пустой блок, линейка в теле), CRLF, BOM, битый YAML, Date-нормализация, aliases-строка |
| `plugin/tests/unit/wikilinks.test.ts` | 9 тестов: подпись, embed, #/^, fenced-блоки (включая ```sb-chapter-nav), инлайн-код |
| `plugin/tests/integration/adapter-contract.test.ts` | 13 тестов: контракт VaultAdapter на FakeVault (кириллица, пробелы, вложенность, .sb/) |
| `plugin/tests/integration/parser-examples.test.ts` | парсер × **62 примера**: все читаются без yaml_error; valid-* — И1, И4, каноническое имя; invalid-* — парсер ничего не «чинит молча»; sb-chapter-nav и И8 |
| `plugin/tests/integration/layering.test.ts` | 3 теста: `core/**` не импортирует `obsidian` (М2) |

### Новые файлы — документы (3)

| Путь | Что |
|---|---|
| `docs/plugin/dev-setup.md` | **dev-связка с хранилищем**: вариант А — junction (рекомендуется), вариант Б — `SB_VAULT_PATH`; цикл разработки, три способа перезагрузки плагина, troubleshooting для Windows/PowerShell 5.1 |
| `docs/plugin/architecture.md` | слои, соответствие «модуль `09-modules` → файлы», тесты и отклонение от М4 для obsidian-adapter, конвенции кода, реестр расхождений (F5-7) |
| `docs/handoff/2026-10-24-phase5-a1-scaffold.md` | этот документ |

### Изменённые файлы (10)

| Путь | Что изменилось |
|---|---|
| `docs/decisions/decision-log.md` | **v1.35.0**: раздел + запись **DL-244** (F5-3…F5-6, доставка A1, находка F5-7) |
| `docs/metamodel/09-modules.md` | **v0.6.0**: вопросы 9.2/9.3/9.5 закрыты (DL-244); раздел 9 закрыт целиком; metamodel_version 1.0.2 |
| `docs/roadmap/phases.md` | **v0.5.0**: плашка «Разбивка этапа A на под-батчи» (A1 ✅ / A2 / A3) + блокер F5-7; строка истории |
| `docs/changelog/CHANGELOG.md` | **[1.0.2]** (док. v0.30.0): добавлено/решено/найдено/изменено/проверено |
| `docs/glossary/glossary.md` | **v1.19.0**: +6 терминов (монорепозиторий, manifest.json, тестовый фреймворк, подделка/FakeVault, junction, watch-режим) → **271 активная запись** (288 всего) |
| `docs/project-map/PROJECT_MAP.md` | **v1.32.0**: §3 (Фаза 5 идёт, A1 доставлен, блокер F5-7), §6 (+F5-7 с вариантами), §8 п.11, §9 (+3 строки инвентаря, версии), §10 (метамодель 1.0.2, доки 1.32.0, **плагин 0.1.0**) |
| `docs/metamodel/00-overview.md` | **v0.4.11**: строка истории 1.0.2; шапка «в числах» — 1.0.2 (состав модели не менялся) |
| `README.md` (корень) | **v0.3.3**: стадия — Фаза 5, этап A, A1 доставлен; metamodel_version 1.0.2 |
| `docs/README.md` | **v0.3.11**: дерево — `docs/plugin/` (dev-setup, architecture) и `plugin/` целиком |
| `docs/CHECKPOINT.md` | **v42.0.0**: frontmatter (фаза/next_step), §6.56 (A1 + DL-244 + F5-7), §8, §9, §11, §12, §14 |

## Сообщение коммита

```text
feat(plugin): Фаза 5 этап A, под-батч A1 — каркас плагина second-brain 0.1.0: адаптер, identity (ULID), универсальный парсер (DL-244, 1.0.2)

- F5-3…F5-6 = А (DL-244): монорепозиторий plugin/, vitest + FakeVault,
  под-батчи A1/A2/A3, один плагин + commands — тонкая обёртка;
  09-modules §9 закрыт целиком (v0.6.0)
- plugin/ 0.1.0: manifest.json (id second-brain, minAppVersion 1.9.0),
  versions.json, esbuild (dev-watch + production, SB_VAULT_PATH), tsconfig
  strict, vitest; src/adapter (интерфейс VaultAdapter + ObsidianVaultAdapter:
  fileManager.processFrontMatter, parseYaml приложения, vault.adapter для .sb/),
  src/core (ulid — Crockford, identity — И1/И2 и починка имени, datetime —
  локальное время до минут, markdown-parser — frontmatter/wikilink-и/BOM/CRLF,
  model, errors), src/main.ts; scripts/link-vault.mjs
- тесты 82/82: unit (ulid 9, datetime 7, identity 15, parser 16, wikilinks 9)
  + integration (контракт VaultAdapter на FakeVault 13, парсер × 62 примера,
  слой-тест М2 — core без импорта obsidian)
- docs/plugin/: dev-setup.md (junction / SB_VAULT_PATH, troubleshooting) +
  architecture.md (модули → исходники, конвенции, отклонение М4)
- находка F5-7: 12 префиксов реестра 02-entities с «_» и 4 длиннее 12 против
  схемы defs#type_prefix и ADR-001 — блокирует A2, вопрос вынесен пользователю
- учёты: CHANGELOG [1.0.2], decision log v1.35.0, PROJECT_MAP v1.32.0,
  phases v0.5.0, 09-modules v0.6.0, 00-overview v0.4.11, glossary v1.19.0
  (+6 терминов, 271 активная), README v0.3.3, docs/README v0.3.11,
  CHECKPOINT v42.0.0
- проверки: plugin — npm test 82/82, typecheck 0 ошибок, build → main.js;
  корень — npm run check 72 OK, 0 FAIL; E2E на свежем клоне зелёный
```

## После применения

1. Настройте dev-связку с хранилищем по **`docs/plugin/dev-setup.md`** (вариант А —
   junction — рекомендуется) и включите плагин в Obsidian: должно появиться
   уведомление «Second Brain 0.1.0: плагин загружен (этап A1 — каркас)».
2. Ответьте на вопрос **F5-7** (варианты — в PROJECT_MAP §6 и в чате): без него
   под-батч A2 (бутстрап `Metamodel/`) не стартует.
