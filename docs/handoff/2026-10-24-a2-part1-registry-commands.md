---
doc_type: handoff
title: "Передача: Фаза 5, этап A, под-батч A2 часть 1 — реестр типов, валидация группы A, три команды (плагин 0.2.0, DL-246)"
status: actual
created: 2026-10-24
metamodel_version: 1.0.3
covers: DL-246, DL-247, DL-248, DL-249
tags: [handoff, commit, phase5]
---

# Передача изменений — 2026-10-24, A2 часть 1 (плагин 0.2.0, метамодель 1.0.3)

> [!info] Что делать
> Патч **`a2-part1-registry-commands.patch`** основан на вашем текущем HEAD
> (**`c44172d`**, или новый hash, если вы сделали `--amend` сообщения — патчу всё
> равно, он применяется к содержимому). Команды для **Windows PowerShell 5.1** —
> построчно:
>
> ```powershell
> # 0. Рабочая копия чистая
> git status --short
> git log --oneline -1
>
> # 1. Применить патч
> git apply --ignore-whitespace a2-part1-registry-commands.patch
>
> # 2. Зависимости (lock не менялся, но npm ci приведёт всё к lock-файлу)
> cd plugin
> npm ci
>
> # 3. Тесты (ожидание: Test Files 12 passed, Tests 118 passed)
> npm test
>
> # 4. Типы и сборка
> npm run typecheck
> npm run build
>
> # 5. Корневой прогонщик (ожидание: ИТОГ: 72 OK, 0 FAIL)
> cd ..
> npm run check
>
> # 6. Коммит и push (сообщение — в разделе ниже)
> git add -A
> git commit
> git push
> ```

## Что произошло

Вы ответили «всё в норме, продолжай» (F5-7 — позже). Чтобы не простаивать в ожидании,
под-батч **A2 разбит на две части**: **часть 1** не зависит от открытых вопросов и
доставлена этим патчем; **часть 2** (бутстрап `Metamodel/` — 7 системных типов) ждёт
ответов **F5-7** (префиксы), **F5-9** (ULID бутстрапа), **F5-10** (объём семенных данных).
При проектировании части 2 найдена **F5-8** — привязка свойства к типу не кодируется
в данных (блокирует этап B; A2 часть 1 не блокирует). Записи: DL-246 (доставка),
DL-247/248/249 (вопросы). Метамодель **1.0.2 → 1.0.3** (PATCH: учётные документы;
нормы/схемы/примеры не менялись). Плагин **0.1.1 → 0.2.0**.

## Состав патча

### Код плагина (новое/изменённое в `plugin/`)

| Путь | Что |
|---|---|
| `src/core/registry.ts` | **type-registry**: загрузка определений из `Metamodel/**` универсальным парсером; индексы type_key/id/TYPE_PREFIX; `ancestorsOf` (защита от циклов), `instantiableTypes`; issues (битый frontmatter — определение не применяется, остальные работают — ADR-002; неполные поля; дубль type_key; висячие parent/superseded_by); кэш `.sb/cache/registry.json` (М5 — не источник истины); **`SYSTEM_TYPE_PREFIXES`** — изолированная таблица 7 системных префиксов (единственная точка правки при F5-7 = Б/В); `METAMODEL_SUBFOLDERS` (DL-029) |
| `src/core/label-resolver.ts` | **label-resolver**: режимы `view`/`source` (ADR-003), резерв «нет label → ключ»; ограничение до F5-8 задокументировано |
| `src/core/diagnostics.ts` | Формат диагностики — **11 полей** (severity-policy §4) + `formatDiagnostic` |
| `src/core/validation.ts` | **validate-object**: группа A реестра — `object.id.format`, `object.id.unique`, `object.id.filename_match` (+автопочинка И2/M5), `object.type.exists`, `object.type.not_abstract` (И3), `object.title.required`, `object.aliases.first_is_title` (И4 + fix-случай 2), `object.created_at.required` (+fix-случай 1), `object.updated_at.order` (И5), `property.key.no_system_conflict` (И6); сообщения по М1–М5 (подписи через LabelResolver). Пропуск A2: `created_at.immutable` (этап C); временный id `object.frontmatter.broken` |
| `src/core/creation.ts` | **createObjectTypeDefinition** (проверки уровня 1 до записи: type_key `^[a-z][a-z0-9_]*$`, label, TYPE_PREFIX строго по `defs#type_prefix` до F5-7, уникальность key/prefix; запись `Metamodel/ObjectTypes/OBJECT_TYPE-{ULID}.md`; parent_type — каноническая ссылка с псевдонимом, DL-186) и **createObjectInstance** (И3, И4, минимальный каркас — 6 системных атрибутов; принцип DL-183) |
| `src/commands/context.ts`, `create-object-type.ts`, `create-object.ts`, `validate-object.ts` | **Три команды MVP** — тонкие обёртки (DL-244/9.5), vanilla-модалки (мера 09-modules §4.1; Svelte — этап B): форма типа, SuggestModal выбора типа → название → открытие заметки, модалка диагностик с группировкой по severity |
| `src/main.ts` | Загрузка: adapter → реестр (+кэш) → LabelResolver → 3 команды; Notice с числом типов |
| `tests/unit/registry.test.ts` | 12 тестов: индексы, предки, issues, дубли, кэш (roundtrip, повреждённый, отсутствующий), label-resolver |
| `tests/unit/validation.test.ts` | 13 тестов: матрица группы A, 11-польный формат, M1-подписи, M5-счётчики |
| `tests/integration/commands.test.ts` | 6 тестов: полный сценарий DoD (тип из Markdown → `BOOK-{ULID}.md` с И4 → validate 0 ошибок), папки, отказы (дубли, абстрактный И3, подчёркивание в префиксе — до F5-7), каноническая ссылка родителя |
| `tests/integration/registry-examples.test.ts` | Реестр × примеры репозитория: 3 определения типов + 5 свойств из `examples/instances/`, висячие ссылки примеров (DL-019) — issues |
| `tests/integration/layering.test.ts` | Обновлено: `commands/*` — слой 4 (импорт 'obsidian' разрешён), `import type` нарушением не считается (стирается при сборке), +тест «core не импортирует commands» |
| `manifest.json`, `versions.json`, `package.json`, `package-lock.json` | Версия **0.2.0** |

### Документы (новое/изменённое)

| Путь | Что |
|---|---|
| `docs/handoff/2026-10-24-a2-part1-registry-commands.md` | этот документ |
| `docs/decisions/decision-log.md` | **v1.37.0**: DL-246 (доставка A2ч1), DL-247 (**F5-8** — привязка свойства к типу), DL-248 (**F5-9** — ULID бутстрапа), DL-249 (**F5-10** — объём семенных данных) |
| `docs/changelog/CHANGELOG.md` | **[1.0.3]** (док. v0.31.0) |
| `docs/CHECKPOINT.md` | **v43.0.0**: §6.58, frontmatter, §8 п.12, §9 (4 вопроса), §10–§12, §14 |
| `docs/project-map/PROJECT_MAP.md` | **v1.34.0**: §3 (A2ч1), §6 (+F5-8/9/10), §8 п.12, §9 (plugin 0.2.0), §10 |
| `docs/plugin/architecture.md` | **v0.3.0**: соответствие модулей (registry/labels/validation/commands ✅), §5 + **F5-8** и микро-пробел `object.frontmatter.broken`, М4-уточнение про модалки |
| `docs/roadmap/phases.md` | **v0.5.1**: плашка A2 — часть 1 ✅, часть 2 ждёт F5-7/F5-9/F5-10 |
| `docs/plugin/dev-setup.md` | **v0.1.1**: §7 — команды уже в палитре, инструкция ручной проверки |
| `docs/glossary/glossary.md` | **v1.22.0**: +«Кэш», «Идемпотентность», «Семенные данные» → **275 активных** (292 всего) |
| `README.md` (корень) | **v0.3.4**: стадия — A2 часть 1 |

## Сообщение коммита

```text
feat(plugin): Фаза 5 этап A, A2 часть 1 — плагин 0.2.0: реестр типов, валидация группы A, команды create-object-type/create-object/validate-object (DL-246, 1.0.3)

- type-registry: загрузка определений из Metamodel/** универсальным парсером,
  индексы type_key/id/TYPE_PREFIX, ancestorsOf, instantiableTypes; issues
  определений (битый frontmatter не применяется — ADR-002; неполные поля;
  дубль type_key; висячие parent/superseded_by); кэш .sb/cache/registry.json
  (М5 — не источник истины); SYSTEM_TYPE_PREFIXES — изолированная таблица
  (единственная точка правки при F5-7 = Б/В)
- label-resolver: режимы view/source (ADR-003), резерв «нет label → ключ»
- validate-object: группа A реестра (10 правил, И1–И6), диагностики — 11 полей
  (severity-policy §4), сообщения по М1–М5; пропуск A2 — created_at.immutable
  (этап C); временный id object.frontmatter.broken (регистрация — с F5-7/F5-8)
- creation: createObjectTypeDefinition (проверки уровня 1, префикс строго по
  defs#type_prefix до F5-7, каноническая ссылка parent_type с псевдонимом —
  DL-186) + createObjectInstance (И3/И4, минимальный каркас, принцип DL-183)
- 3 команды MVP — тонкие обёртки (DL-244/9.5), vanilla-модалки (09-modules §4.1;
  Svelte — этап B); layering-тест: commands — слой 4, import type не нарушение
- тесты 84 → 118 (+34): registry 12, validation 13, creation-цепочки 6
  (сценарий DoD: тип из Markdown → BOOK-{ULID}.md с И4 → 0 ошибок), реестр ×
  примеры репозитория, layering +1; матрица TZ (UTC/Moscow/Kiritimati) — 118/118
- найдена F5-8 (DL-247): привязка свойства к типу не кодируется в данных —
  блокирует этап B; варианты А/Б/В, рекомендация А (поле object_types, MINOR 1.1.0)
- вопросы F5-9 (ULID бутстрапа: фиксированные — рек.) и F5-10 (объём семенных
  данных: 7 OBJECT_TYPE — рек.) — часть 2 A2 ждёт ответов вместе с F5-7
- версии: manifest/versions/package 0.2.0; метамодель 1.0.3 (PATCH — учётные)
- учёты: decision log v1.37.0, CHANGELOG [1.0.3] (v0.31.0), PROJECT_MAP v1.34.0,
  architecture v0.3.0, phases v0.5.1, dev-setup v0.1.1, glossary v1.22.0
  (+Кэш/Идемпотентность/Семенные данные, 275 активных), README v0.3.4, CHECKPOINT v43.0.0
- проверки: npm test 118/118, typecheck 0 ошибок, build → main.js; корневой
  npm run check 72 OK, 0 FAIL; E2E на свежем клоне зелёный
```

## После применения — ручная проверка в Obsidian (2 минуты)

1. Пересоберите и перезагрузите плагин: в терминале `npm run build` (в `plugin/`),
   в Obsidian `Ctrl+R`. Уведомление: «Second Brain 0.2.0: загружен (типов в реестре: 0)» —
   реестр пуст, пока нет `Metamodel/` (бутстрап — часть 2).
2. `Ctrl+P` → «Создать тип объекта»: key `book`, подпись «Книга», префикс `BOOK` →
   Создать. Файл появится в `Metamodel/ObjectTypes/OBJECT_TYPE-….md`.
3. `Ctrl+P` → «Создать объект» → тип «Книга» → название «Мастер и Маргарита» →
   Создать. Откроется `BOOK-….md` с системными атрибутами.
4. `Ctrl+P` → «Проверить объект» (на открытой книге) → «нарушений нет».
5. (Не обязательно) `Ctrl+R` — при перезагрузке реестр увидит тип `book`;
   кэш ляжет в `.sb/cache/registry.json`.

## Проверено в песочнице (E2E)

Свежий клон `c44172d` → `git apply` → `npm ci` → `npm test` **118/118**
(включая TZ=Europe/Moscow) → `npm run typecheck` → `npm run build` → корневой
`npm run check` **72 OK, 0 FAIL** → дерево побайтово равно снимку песочницы.
