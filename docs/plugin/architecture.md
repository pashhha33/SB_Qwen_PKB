---
doc_type: plugin_doc
title: "Архитектура плагина: слои, модули, соответствие исходникам"
status: actual
version: 0.1.0
created: 2026-10-24
updated: 2026-10-24
metamodel_version: 1.0.2
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
| `metamodel-bootstrap` | A | — | A2 |
| `type-registry` | A | — | A2 |
| `label-resolver` | A | — | A2 |
| `commands` (тонкая обёртка — DL-244/9.5) | A | — | A2 (`create-object-type`, `create-object`, `validate-object`) |
| `front-matter-title-adapter` | A | — | A3 (изолирован, мягкий отказ) |
| (D2: генератор TS-типов) | A/B | — | A3: `json-schema-to-typescript`, сгенерированные файлы коммитятся, тест «перегенерация == зафиксированное» (DL-222) |

Вспомогательные файлы, не являющиеся модулями реестра:
`src/core/errors.ts` (коды ошибок), `src/main.ts` (точка входа),
`esbuild.config.mjs`, `scripts/link-vault.mjs` (dev-инструменты).

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
проверяется вручную по чек-боксам DoD.

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
| Переводы строк: парсер принимает CRLF и LF; записывает LF | Среда пользователя Windows; ADR-010 (`.sb/` — LF) |
| Ошибки — класс `SbError` с кодом; диагностика — формат 11 полей (A2) | `severity-policy` §4 |
| Ничего не чиним молча: нормализация дат/DOM фиксируется в `issues` | Спецификация v1.0 §19 |
| Зависимости runtime — ноль; dev: esbuild, typescript, vitest, obsidian (типы), js-yaml (только тесты) | Рамки: минимум зависимостей |

## 5. Известные расхождения норм (открытые вопросы)

| # | Расхождение | Влияние | Статус |
|---|---|---|---|
| **F5-7** | Реестр `02-entities` §6 содержит 12 префиксов с `_` (`OBJECT_TYPE`, `RELATION_TYPE`, `SERIES_COLLECTION`…) и 4 длиннее 12 символов, но схема `defs.json#type_prefix` (`^[A-Z][A-Z0-9-]*$`) и правило ADR-001 («только A–Z, 0–9, дефис», 3–12) подчёркивание запрещают; ADR-001 при этом сам говорит «UPPER_SNAKE_CASE» | **Блокирует A2**: бутстрап пишет файлы `OBJECT_TYPE-{ULID}.md`. Код A1 следует схеме (строгая валидация), имена файлов читает деликатно (парсер `_` допускает) | **Вопрос пользователю** (рекомендация: легализовать `_` и длину 3–20 — MINOR-расширение схемы) |

## История изменений

| Дата | Версия | Что изменилось | Ссылка |
|---|---|---|---|
| 2026-10-24 | 0.1.0 | Документ создан: слои, соответствие модулей исходникам A1, тесты (FakeVault, контракт, отклонение М4), конвенции кода, находка F5-7 | Под-батч A1, DL-244 |
