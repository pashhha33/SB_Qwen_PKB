# Second Brain — плагин Obsidian (этап A)

Самоопределяющаяся объектная метамодель личной базы знаний. Нормы — в `docs/`
корня репозитория (метамодель **1.0.x**, утверждена пользователем 2026-10-23);
код плагина живёт здесь, в `plugin/` (решение DL-244: монорепозиторий).

## Быстрый старт (разработка)

```powershell
cd plugin
npm install        # один раз
npm run dev        # watch-сборка main.js при изменении src/
npm test           # витест: юнит + интеграционные (FakeVault, без Obsidian)
npm run typecheck  # строгая проверка типов TypeScript
npm run build      # финальная минифицированная сборка
```

**Как связать с хранилищем Obsidian в режиме dev** — подробная инструкция:
[`docs/plugin/dev-setup.md`](../docs/plugin/dev-setup.md) (два варианта: junction
или `SB_VAULT_PATH`; рекомендации и устранение неполадок).

## Состав под-батча A1 (Фаза 5, этап A)

| Модуль реестра (`09-modules`) | Файлы | Что делает |
|---|---|---|
| `obsidian-adapter` | `src/adapter/obsidian-adapter.ts`, `src/adapter/vault-adapter.ts` | Тонкая обёртка над API Obsidian; ядро знает только интерфейс |
| `identity` | `src/core/ulid.ts`, `src/core/identity.ts`, `src/core/datetime.ts` | ULID, имя файла `{TYPE_PREFIX}-{ULID}.md`, инварианты И1–И2, локальные даты |
| `markdown-parser` | `src/core/markdown-parser.ts`, `src/core/model.ts` | Универсальный парсер: Markdown-заметка → объект модели (frontmatter + тело + wikilink-и) |
| (точка входа) | `src/main.ts` | Загрузка плагина; Notice о версии |

В следующих под-батчах этапа A: **A2** — `metamodel-bootstrap` (7 системных типов),
`type-registry` + `.sb/cache/`, `label-resolver`, команды `create-object-type` /
`create-object` / `validate-object`; **A3** — генератор TS-типов из схем (D2),
`front-matter-title-adapter`.

## Правила кода (кратко)

- Идентификаторы — английский `snake_case`/`camelCase` (ADR-003); комментарии и
  документация — русский.
- Ядро (`src/core/**`) не импортирует `obsidian` — только интерфейс `VaultAdapter`
  (правило М2, `09-modules` §3; проверяется тестом `tests/integration/layering.test.ts`).
- YAML разбирается только реализацией среды (`adapter.parseYaml`), не самописно (ADR-002).
- Пути строим через `node:path` / `pathToFileURL` — урок DL-232 (Windows, пробелы, кириллица).
- Каждый модуль с тестами (правило М4); интеграционные — на `FakeVault`
  (`tests/support/fake-vault.ts`), контракт-тесты — `tests/integration/adapter-contract.test.ts`.

Архитектура и соответствие модулей: [`docs/plugin/architecture.md`](../docs/plugin/architecture.md).
