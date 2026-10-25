# Перенос изменений: плагин 0.6.0 — B1.1 часть 1: schema-engine (группы B/C/G) + date-engine (группа H)

Дата: 2026-10-25 · База: ваш коммит `fb5c6e2` (docs-tables-fix — текущий HEAD `main`) · Патч: `b1-1-part1-schema-engine.patch`

> [!note] Зависимости не менялись — `npm ci` НЕ нужен
> Код плагина: 2 новых модуля ядра + расширение реестра + усиление validate-object.
> Метамодель не менялась (**1.2.0**) — CHANGELOG **[1.2.5]** (учётная запись).

## Что это

Первый код этапа B — **B1.1 «определения и валидация», часть 1** (разбивка DL-261): движок
проверки данных по метамодели, без UI. `validate-object` теперь проверяет не только
системные атрибуты (группа A), но и:

**1. Определения свойств — группа B реестра правил, все 16** (`schema-engine`,
`validatePropertyDefinition`). Примеры того, что теперь ловится на заметках
`Metamodel/Properties/PROPERTY-….md`:

- ключ вне формата `^[a-z][a-z0-9_]*$` или конфликт с системным атрибутом (И6);
- один ключ у двух свойств с пересекающимся покрытием типов (`unique_in_type` — с учётом
  F5-8: universal / family+потомки / specific);
- пустая русская подпись; восьмой `value_type` (набор из семи закрыт, ADR-006);
- противоречие `required`/`cardinality` (таблица 04-attributes §4);
- у `object_reference`/`media_reference` не заполнен `target_types`;
- `target_facet` ведёт не на фасет;
- пять правил `applies_when`: неполное условие, операция вне закрытого набора (М4),
  несуществующий триггер, цепочка условий (М3), `includes_any` при одиночном триггере (warning);
- `create_from_link: auto` при неоднозначной цели (раздел 12);
- `object_types` не согласован со `scope` или ведёт в никуда (F5-8).

**2. Значения экземпляров — группы C и G** (`validateInstanceValues`):

- `value.type_conformance` — значение соответствует типу значения (текст/число/логическое/дата/ссылка);
- `value.cardinality` — обязательное свойство заполнено; значений не больше, чем допускает кардинальность;
- `value.reference.exists` / `value.reference.target_type` — цель ссылки существует
  (индекс хранилища: канонические имена по ULID, прочие — по имени файла) и относится
  к допустимому типу (уровень 3);
- перечисления: `enum.value.no_mixed_script` (кириллица), `enum.value.format`,
  `enum.value.in_set` (значение входит в `allowed_values` определения).

**3. Даты — группа H** (`date-engine`): `date.format`, `date.partial.no_gap`
(«1928-00-15» — неизвестный месяц не может предшествовать известному дню, П1),
`date.partial.unknown_only_zero` (заполнитель — только `00`), `date.range.valid`
(30 февраля, 29 февраля невисокосного — ловятся; 2024/2000 — високосные),
`datetime.format`, `datetime.no_seconds` (warning — секунды не храним).
Плюс нормализация частичной даты в диапазон (П4 — единственная точка входа для вычислений,
мера M4 ADR-011) и сравнение по П3 — понадобятся интервалам этапа C.

**Границы части 1 (честно, M6; реестр — `architecture.md` §5):** значения **условных
свойств** (`applies_when`) пока не проверяются — движок условий (М1–М7) в части 2 (скрытые
поля и не должны проверяться — rules.md); ссылки разрешаются без псевдонимов (alias-index — B2);
существование файлов-вложений у `media_target: file` — этап D; `period.*` — этап C;
`display_template.*` — B1.2; правило П2 (`0000-00-00` в необязательном поле) не реализуется —
в реестре правил нет отдельного id (пробел зафиксирован, закроем ревизией rules.md или в B1.2).

Версии: плагин **0.5.0 → 0.6.0**; тесты **165 → 206** (+41).

## Шаг 1. Применить патч

Положите `b1-1-part1-schema-engine.patch` в корень репозитория, затем из корня (команды по одной):

```powershell
cd "D:\Пользаватель\Документы\Метамодель\Qwen 4\SB_Qwen_PKB"
```

```powershell
git status
```

Ожидание: «nothing to commit, working tree clean» (HEAD — `fb5c6e2`).

```powershell
git apply --ignore-whitespace --stat b1-1-part1-schema-engine.patch
```

(предпросмотр: ~25 файлов, ничего не меняет)

```powershell
git apply --ignore-whitespace b1-1-part1-schema-engine.patch
```

## Шаг 2. Проверки (`npm ci` не нужен)

```powershell
cd plugin
```

```powershell
npm test
```

Ожидание: **206 passed** (было 165; +11 date-engine, +17 группа B, +13 значения C/G/H).

```powershell
npm run typecheck
```

Ожидание: пусто (без ошибок).

```powershell
npm run build
```

Ожидание: `[second-brain] сборка завершена → main.js`.

```powershell
cd ..
```

```powershell
npm run check
```

Ожидание: **74 OK, 0 FAIL**.

```powershell
npm run check:docs
```

Ожидание: «разрывов таблиц нет — OK».

## Шаг 3. Коммит и push

```powershell
git add -A
```

```powershell
git commit
```

Сообщение — ниже (первая строка `feat(plugin): 0.6.0 — B1.1 часть 1…`).

```powershell
git push origin main
```

## Сообщение коммита

```text
feat(plugin): 0.6.0 — B1.1 часть 1: schema-engine (группы правил B/C/G) + date-engine (группа H) (DL-263, 1.2.5)

Первый код этапа B (разбивка B1 — DL-261): движок проверки данных по
метамодели, без UI. Нормы не менялись — метамодель остаётся 1.2.0
(CHANGELOG [1.2.5] — учётная запись); реализованы зарегистрированные
правила реестра rules.md.

date-engine (src/core/date-engine.ts) — группа H уровня 2: date.format;
date.partial.no_gap (П1 — неизвестный компонент не после известного);
date.partial.unknown_only_zero (заполнитель — только «00»; специальное
правило приоритетнее общего — rules.md «Перекрывающиеся правила»);
date.range.valid (високосные учтены); datetime.format; datetime.no_seconds
(warning — секунды не храним, 04-attributes §6). Нормализация частичной даты
в диапазон (П4 — единственная точка входа для вычислений, мера M4 ADR-011) и
сравнение по П3. Ограничение П6 (формат не ISO 8601) — в шапке модуля.
period.* — этап C; display_template.* (уровень 5) — B1.2.

schema-engine (src/core/schema-engine.ts, слой 2) — группа B целиком, 16
правил определений свойств (validatePropertyDefinition): key.format,
key.no_system_conflict (И6 — переехал из инлайновой проверки A2, id тот же),
key.unique_in_type (пересечение покрытия типов — F5-8: universal/family+
потомки/specific), label.required, value_type.closed (7 типов, ADR-006),
required.cardinality_consistency (04-attributes §4), target_types.for_reference
(object_reference и media_reference — по схеме), target_facet.is_facet (по
индексу: префикс FACET), applies_when ×5 (value_present, operation_closed —
М4, property_exists, no_chain — М3, operation_matches_cardinality — warning),
create_from_link.auto_needs_single_target (раздел 12), object_types.
scope_consistency + .exists (F5-8 = А). Группы C/G — значения экземпляров
(validateInstanceValues): value.type_conformance по 7 типам, value.cardinality
(обязательность + количество; не применяется к скрытым условным — rules.md),
value.reference.exists / .target_type (уровень 3 — buildVaultIndex:
канонические имена по ULID, прочие по имени файла; псевдонимы — B2),
перечисления — enum.value.no_mixed_script → .format → .in_set (runtime-
носитель реестра перечислений — allowed_values определения).

Реестр расширен (property-definitions): PropertyDef + allowedValues,
targetTypeIds/targetTypeKeys (разрешение ULID → ключи в reindex),
targetFacetId, mediaTarget, createFromLink, appliesWhen.

validate-object усилен: группа A + schema-engine; определения свойств
проверяются, даже если метатип property не зарегистрирован (ADR-002 —
битое определение не мешает проверкам); опциональный общий индекс хранилища
(sharedIndex) — задел для validate-vault (часть 2). Условные свойства в
проверке значений пропускаются до части 2 (движок условий М1–М7).

Границы части 1 (честно, M6 — architecture.md §5, B1.1-1…3): value.
allowed_values и enum.value.in_set в runtime — одна проверка (id in_set);
warning П2 (0000-00-00 в необязательном поле) не реализуется — в реестре
нет отдельного id (пробел правил — закрыть ревизией rules.md или в B1.2);
вложения media_target: file — этап D; псевдонимы — B2; группа E
(object_type.*, классификация) — часть 2/B1.3.

Тесты 165 → 206 (+41): date-engine ×11 (форматы, частичные, високосные,
диапазоны, сравнение), группа B ×17 (каждое правило — положительный и
отрицательный путь), значения C/G/H ×13 (чистый экземпляр — 0 диагностик;
обязательность, кардинальности, типы, висячая ссылка, чужой тип цели,
enum ×3, даты ×3, секунды-warning, пропуск условных, неизвестные поля,
sharedIndex). Матрица TZ (UTC/Moscow/Kiritimati/Niue/New_York) — 206/206;
typecheck/build зелёные; корень — 74 OK; check:docs — 0 разрывов.

Учёты: decision log v1.47.0 (DL-263), CHANGELOG [1.2.5] (v0.38.0),
architecture v0.9.0 (модули B1 + 3 границы в §5), phases v0.11.0 (B1.1
часть 1 ✅), PROJECT_MAP v1.42.0, README v0.8.0 + plugin/README (раздел
«Валидация по метамодели»), CHECKPOINT v51.0.0 (§6.67).

Дальше: B1.1 часть 2 — движок applies_when для значений (М1–М7),
service-flags (sb_issues), команды create-property и validate-vault,
правила object_type.* группы E.
```

## Шаг 4. После применения — ручная проверка в Obsidian (2 минуты)

1. Перенесите в папку плагина хранилища **`main.js` и `manifest.json`** (или
   `npm run link:vault`), перезагрузите Obsidian. Ожидание: Notice **«Second Brain 0.6.0:
   загружен (типов в реестре: 7)»**.
2. `Ctrl+P` → **Second Brain: Проверить объект (validate-object)** на любой из семи заметок
   `Metamodel/ObjectTypes/` — нарушений нет (определения типов группа B не трогает; значения
   предметных полей у них не объявлены до B1.3).
3. Негативная проба (по желанию): создайте в хранилище заметку с frontmatter
   `type: object_type`, `id` — любой ULID, но `type_key: Неверный!` — validate-object
   выдаст диагностики группы A (формат type_key группа A не проверяет — а вот пустой `title`
   или рассинхрон `aliases` увидит). Полноценная проверка определений свойств появится
   в части 2 вместе с командой `create-property`.
4. Журнал (`show-log`): запись области `validation` с итогом проверки.

Если что-то не так — `Ctrl+P` → **copy-log** и вставьте журнал в чат.

## Состав патча (~25 файлов)

Код плагина (0.6.0):

- `plugin/src/core/date-engine.ts` — **новый**: правила группы H, нормализация П4, сравнение П3;
- `plugin/src/core/schema-engine.ts` — **новый**: группа B (16 правил), группы C/G, `buildVaultIndex`;
- `plugin/src/core/registry.ts` — PropertyDef расширен (6 новых полей, разрешение target_types в reindex);
- `plugin/src/core/validation.ts` — подключение движка, sharedIndex, определения свойств без метатипа;
- `plugin/tests/unit/date-engine.test.ts`, `plugin/tests/unit/schema-engine-definitions.test.ts`,
  `plugin/tests/integration/schema-engine-values.test.ts` — **новые** (41 тест);
- `plugin/manifest.json`, `plugin/versions.json`, `plugin/package.json` — 0.6.0.

Документация:

- `docs/decisions/decision-log.md` — **v1.47.0**: запись **DL-263**;
- `docs/changelog/CHANGELOG.md` — **v0.38.0**: запись **[1.2.5]**;
- `docs/plugin/architecture.md` — **v0.9.0**: строки модулей B1 (property-definitions,
  schema-engine, date-engine, validation-runner), §5 + три записи границ (B1.1-1…3);
- `docs/roadmap/phases.md` — **v0.11.0**: B1.1 часть 1 ✅ в таблице под-батчей, строка истории;
- `docs/project-map/PROJECT_MAP.md` — **v1.42.0**: §3, §8.20, §9, §10;
- `README.md` — **v0.8.0**: стадия (этап B, 0.6.0);
- `plugin/README.md` — 0.6.0, раздел «Валидация по метамодели (B1.1 часть 1)»;
- `docs/CHECKPOINT.md` — **v51.0.0**: §6.67, §8.21, frontmatter, §11/§12, §14;
- `docs/handoff/2026-10-25-b1-1-part1-schema-engine.md` — этот файл.

## Проверка E2E в песочнице ассистента (выполнена до передачи)

Свежий клон `origin/main` (`fb5c6e2`) + этот патч: `npm test` — **206/206**, матрица TZ
(UTC / Europe/Moscow / Pacific/Kiritimati / Pacific/Niue / America/New_York) — везде
206/206, `npm run typecheck` — чисто, `npm run build` — main.js, корневой `npm run check` —
**74 OK, 0 FAIL**, `npm run check:docs` — 0 разрывов.
