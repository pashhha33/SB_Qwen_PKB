---
doc_type: plugin_doc
title: "Архитектура плагина: слои, модули, соответствие исходникам"
status: actual
version: 0.4.0
created: 2026-10-24
updated: 2026-10-24
metamodel_version: 1.1.0
governing_documents:
  - docs/metamodel/09-modules.md
  - docs/adr/ADR-002-source-of-truth.md
  - docs/adr/ADR-003-bilingual-keys-and-label-layer.md
  - docs/roadmap/phases.md
tags: [plugin, architecture]
---

# Архитектура плагина Second Brain

> [!info] Назначение
> Живая карта «модуль из реестра `09-modules` → файлы исходников». Нормативный
> реестр модулей — `docs/metamodel/09-modules.md`; этот документ показывает,
> как реестр воплощается в `plugin/src/`, и фиксирует конвенции кода.

## 1. Слои (норма: `09-modules` §3)

```text
┌───────────────────────────────────────────────────────────────┐
│ 5. UI (Svelte)              — этапы B/D/E                     │
│ 4. Команды и представления  — A2: commands (тонкая обёртка)   │
│ 3. Сервисы предметной обл.  — A2/B                            │
│ 2. Схема и валидация        — A2/B                            │
│ 1. Ядро                     — A1: parser, identity, model     │
│ 0. Obsidian API             — A1: obsidian-adapter            │
└───────────────────────────────────────────────────────────────┘
```

Правило слоёв: модуль зависит только от своего слоя и нижележащих. В A1 это
защищено **тестом импортов** (`plugin/tests/integration/layering.test.ts`):
`src/core/**` и интерфейс `vault-adapter.ts` не имеют права импортировать
`obsidian` — разрешено только `src/main.ts` и `src/adapter/obsidian-adapter.ts`.

## 2. Соответствие «модуль реестра → исходники» (этап A)

| Модуль (`09-modules` §4) | Этап | Файлы `plugin/` | Статус в A1 |
|---|---|---|---|
| `obsidian-adapter` | A | `src/adapter/obsidian-adapter.ts` (прод), `src/adapter/vault-adapter.ts` (интерфейс) | ✅ создан |
| `markdown-parser` | A | `src/core/markdown-parser.ts`, `src/core/model.ts` | ✅ создан |
| `identity` | A | `src/core/ulid.ts`, `src/core/identity.ts`, `src/core/datetime.ts` | ✅ создан (И1 формат + уникальность-скан, И2 проверка/починка; И3 — в A2 с реестром) |
| `metamodel-bootstrap` | A | — | **A2 часть 2** (F5-9 = А, F5-10 = Б приняты — DL-250; ждёт только F5-7) |
| `activity-log` | A | `src/core/activity-log.ts` (+ `src/core/settings.ts`) | ✅ A2.5 (DL-251): уровни error/warning/info/debug с выключателями, `.sb/logs/plugin-log.jsonl` (лимит, обрезка по хвосту), кольцевой буфер + подписчики (live); **настройки — `.sb/settings.json`, не data.json (ADR-002)** |
| `type-registry` | A | `src/core/registry.ts` (+ кэш `.sb/cache/registry.json`) | ✅ A2 часть 1: индексы типов/свойств, предки, issues определений (ADR-002: битое определение не применяется, остальные работают) |
| `label-resolver` | A | `src/core/label-resolver.ts` | ✅ A2 часть 1: режимы `view`/`source`, резерв «нет label → ключ» (команда `toggle-label-mode` — этап B) |
| `commands` (тонкая обёртка — DL-244/9.5) | A | `src/commands/create-object-type.ts`, `create-object.ts`, `validate-object.ts`, `context.ts` | ✅ A2 часть 1: три команды MVP, vanilla-модалки (Svelte — этап B); логика — в `src/core/creation.ts` и `src/core/validation.ts` |
| `front-matter-title-adapter` | A | — | A3 (изолирован, мягкий отказ) |
| `log-viewer` | A | `src/commands/show-log.ts` | ✅ A2.5 (DL-251): окно журнала — фильтр по уровню, последние 300, очистка, **живой режим** |
| `settings-ui` (первая инкарнация) | A→E | `src/ui/settings-tab.ts` | ✅ A2.5: выключатели журнала, лимит, «писать результаты проверок», режим подписей; полный модуль — этап E |
| (D2: генератор TS-типов) | A/B | — | A3: `json-schema-to-typescript`, сгенерированные файлы коммитятся, тест «перегенерация == зафиксированное» (DL-222) |

Часть слоя 2 (схема и валидация) в объёме A2: `src/core/validation.ts`
(validate-object — группа A реестра правил, уровни 2–4) и `src/core/diagnostics.ts`
(формат 11 полей, severity-policy §4). Группы B/C и полные свойства — этап B
(schema-engine); связи — этап C.

Вспомогательные файлы, не являющиеся модулями реестра:
`src/core/errors.ts` (коды ошибок), `src/core/creation.ts` (сервис создания —
логика команд), `src/main.ts` (точка входа), `esbuild.config.mjs`,
`scripts/link-vault.mjs` (dev-инструменты).

## 3. Тесты (решение DL-244, вопрос 9.3 = А)

| Где | Что | Как запускать |
|---|---|---|
| `tests/unit/*.test.ts` | Чистая логика: ULID, даты, identity, парсер, wikilink-и | `npm test` (vitest run) |
| `tests/integration/*.test.ts` | Контракт `VaultAdapter` на FakeVault; парсер × 62 примера `examples/instances/`; тест слоёв | там же |
| `tests/support/fake-vault.ts` | **FakeVault** — «поддельное хранилище»: настоящая папка во временном каталоге за интерфейсом `VaultAdapter`, без Obsidian | используется тестами |
| Ручные в Obsidian | Чек-боксы DoD этапа (`phases.md` §4) — на реальном хранилище пользователем | dev-связка: `docs/plugin/dev-setup.md` |

**Отклонение от правила М4 (зафиксировано, DL-244):** у прод-реализации
`obsidian-adapter` автотестов нет — тонкая обёртка над API, её автопроверка
означала бы мокирование самого Obsidian. Замена: поведенческий контракт
интерфейса прогоняется на FakeVault (`adapter-contract.test.ts`), прод-реализация
проверяется вручную по чек-боксам DoD. С A2 части 1 то же касается модалок команд
(`src/commands/*` — vanilla-UI): автотестами покрыта логика ядра (creation,
validation, registry), а не отрисовка окон.

Материал для тестов парсера — **примеры шага 9** (`examples/instances/`,
62 файла): те же заметки, на которых зелёный корневой `npm run check`.
Демонстрационные имена файлов примеров не подчиняются И2 — тесты это учитывают.

## 4. Конвенции кода

| Конвенция | Основание |
|---|---|
| Идентификаторы — английский; комментарии и сообщения — русский | ADR-003, рамки проекта (DL-001) |
| YAML — только `adapter.parseYaml` (в Obsidian — `parseYaml` приложения, в тестах — js-yaml 4.x как в корневом прогонщике) | ADR-002: «не самописным разбором» |
| Чтение frontmatter — через API среды; структурное разбиение `---…---` — наше | ADR-002 + формат Obsidian |
| Пути — `node:path`, file-URL — `pathToFileURL`; никогда не склеивать `file://` + путь руками | Урок DL-232 (Windows, пробелы, кириллица) |
| Настройки плагина — `.sb/settings.json` (НЕ data.json); журнал — `.sb/logs/plugin-log.jsonl` | ADR-002 (настройки и журнал в `.sb/`), ADR-010 (JSONL, LF, UTF-8 без BOM), DL-251 |
| Переводы строк: парсер принимает CRLF и LF; записывает LF | Среда пользователя Windows; ADR-010 (`.sb/` — LF) |
| Ошибки — класс `SbError` с кодом; диагностика — формат 11 полей (A2) | `severity-policy` §4 |
| Ничего не чиним молча: нормализация дат/DOM фиксируется в `issues` | Спецификация v1.0 §19 |
| Даты из YAML нормализуются в два уровня (0.1.1): лексический — из сырого текста frontmatter («что написано, то и хранится»; TZ-независимо; смещение отбрасывается), fallback для Date в списках — UTC-геттеры (js-yaml строит Date в UTC); НОВЫЕ даты плагин пишет локальными геттерами (`nowStamp`) | DL-245 — фикс TZ-бага A1; ADR-006 (локальное время без смещения) |
| Зависимости runtime — ноль; dev: esbuild, typescript, vitest, obsidian (типы), js-yaml (только тесты) | Рамки: минимум зависимостей |

> [!note] Ограничение нормализации дат (0.1.1)
> Лексический уровень работает для скаляров верхнего уровня. Date-объекты ВНУТРИ списков
> (например, список дат у свойства с `cardinality: 0..N`) идут через fallback UTC-геттеров:
> для js-yaml восстановление точное; семантика parseYaml Obsidian для таких значений
> допроверяется в A2 на реальном хранилище. Нормативные даты — скаляры, случай редкий.

## 5. Известные расхождения норм (открытые вопросы)

| # | Расхождение | Влияние | Статус |
|---|---|---|---|
| ~~**F5-8**~~ **РЕШЕНО 2026-10-24 (F5-8 = А, DL-250/252, метамодель 1.1.0)** | Привязка свойства к типу — поле `object_types` у `property` (universal+пусто = все; family = один абстрактный предок, потомки по DL-208; specific = конкретные типы) + правила `property.object_types.scope_consistency` / `.exists` (**169 правил**); в коде — `PropertyDef.objectTypes`, `getPropertiesForType`, типобластные подписи LabelResolver | Реализовано: `property.schema`, `04-attributes` §4.1, карточка `property`, примеры valid-05/valid-06/invalid-03 (прогон **74 OK**) |
| **F5-7** | Реестр `02-entities` §6 содержит 12 префиксов с `_` (`OBJECT_TYPE`, `RELATION_TYPE`, `SERIES_COLLECTION`…) и 4 длиннее 12 символов, но схема `defs.json#type_prefix` (`^[A-Z][A-Z0-9-]*$`) и правило ADR-001 («только A–Z, 0–9, дефис», 3–12) подчёркивание запрещают; ADR-001 при этом сам говорит «UPPER_SNAKE_CASE». Дополнительно (находка A2): схемы `link_object_type`/`link_property` **уже содержат** `OBJECT_TYPE-`/`PROPERTY-` — вариант «переименовать реестр» затронет 14 схем и примеры | **Блокирует A2 часть 2**: бутстрап пишет файлы `OBJECT_TYPE-{ULID}.md`. Код следует схеме (строгая валидация пользовательского ввода), системные префиксы изолированы в таблице `SYSTEM_TYPE_PREFIXES` (`registry.ts`), имена файлов читаются деликатно | **Вопрос пользователю** (рекомендация: легализовать `_` и длину 3–20 — MINOR-расширение схемы) |
| (микро) | Временный id `object.frontmatter.broken`: в реестре 167 правил нет id для «frontmatter заметки не разбирается» (у `.base` есть `view.base.parsable`) | validate-object выдаёт диагностику с временным id | Регистрация постоянного id — вместе с батчем F5-7/F5-8 (MINOR: правило-предупреждение) |

## История изменений

| Дата | Версия | Что изменилось | Ссылка |
|---|---|---|---|
| 2026-10-24 | 0.4.0 | A2.5: `activity-log` + `log-viewer` + первая инкарнация `settings-ui` (DL-251); конвенция `.sb/settings.json`; F5-8 закрыто (object_types, getPropertiesForType); F5-9/F5-10 приняты — бутстрап ждёт только F5-7 | DL-250…DL-252 |
| 2026-10-24 | 0.3.0 | A2 часть 1: type-registry (+кэш), label-resolver, validation (группа A, 11-польный формат), три команды (vanilla-модалки); соответствие модулей обновлено; §5 + F5-8 и временный id `object.frontmatter.broken`; М4-уточнение про модалки | DL-246 |
| 2026-10-24 | 0.2.0 | Конвенция двухуровневой нормализации дат (фикс TZ-бага A1) + плашка ограничения для Date в списках | DL-245, плагин 0.1.1 |
| 2026-10-24 | 0.1.0 | Документ создан: слои, соответствие модулей исходникам A1, тесты (FakeVault, контракт, отклонение М4), конвенции кода, находка F5-7 | Под-батч A1, DL-244 |
