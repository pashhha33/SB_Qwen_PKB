# Перенос изменений: плагин 0.11.0 — B1.3 часть 2a «классификация»: classification-service + 15 правил группы E; метамодель 1.4.0 (DL-278/DL-279)

Дата: 2026-10-26 · База: **`bd7fef7`** (ваш единый коммит part1 + Windows-фиксы) · Патч: `b1-3-part2a-classification.patch`

> [!note] `npm ci` НЕ нужен — зависимости не менялись
> Метамодель **1.3.0 → 1.4.0** (MINOR: добавлено необязательное поле `label` в схемах
> `facet`/`category`/`taxonomy`). **Миграция не нужна**: существующие заметки корректны
> как были — поле необязательное.

## Что доставлено

**1. `classification-service`** (`plugin/src/core/classification.ts`, реестр `09-modules`
слой 3) — снимок классификации хранилища:

- читает определения из `Metamodel/{Taxonomies,Facets,Categories}` (плюс канонические
  имена `TAXONOMY-`/`FACET-`/`CATEGORY-` в любом месте хранилища);
- **наследование умолчаний** «значение фасета → значение таксономии → таблица
  `01-classification` §2.2» (`hierarchy_mode`, `assignment_cardinality`,
  `root_requirement_min/max`, `allowed_object_types`);
- **предки категории** — транзитивное замыкание по `parent` (цикл обрывается безопасно);
- `findSystemFacet('genre' | 'literary_form')` — сначала фиксированный ULID рецепта
  (B1-4 = А), затем `title`/`label` (ваш фасет «Жанр», созданный до установки библиотеки,
  узнаётся — конвенция DL-277);
- **кэш** `.sb/cache/classification.json` — производные данные (ADR-002): пишет
  `validate-vault`; можно удалить, перестроится из заметок.

**2. Правила группы E — 15 из 19** (`plugin/src/core/classification-engine.ts`;
4 `object_type.*` работают с 0.7.0). Норма — `docs/validation/rules.md` §E:

| Правило | Уровень | Что ловит |
|---|---|---|
| `category.facet.required` | error, 2 | у категории нет фасета |
| `category.facet.single` | error, 4 | категория в двух фасетах сразу |
| `category.parent.exists` | error, 3 | родителя нет среди категорий |
| `category.parent.same_facet` | error, 4 | родитель из другого фасета |
| `category.parent.no_cycle` | error, 3 | цикл в цепочке родителей |
| `category.parent.strict_mode` | error, 4 | два родителя в строгом фасете |
| `category.taxonomy_direct.forbidden` | error, 4 | категория ссылается на таксономию (П8) |
| `facet.taxonomy.exists` | error, 3 | таксономии нет |
| `facet.allowed_types.conflict` | warning, 4 | область фасета шире области таксономии |
| `facet.root_requirement` | warning, 4 | корневых категорий меньше минимума (или больше максимума) |
| `taxonomy.facets.min_one` | error, 2 | у таксономии нет фасетов |
| `assignment.type_allowed` | error, 4 | фасет назначен типу вне `allowed_object_types` (потомки включаются — DL-208/209) |
| `assignment.cardinality` | error при `1`/`1..N`, warning при превышении `0..1` | число назначенных категорий фасета |
| `facet.genre.required_for_book` | **error, 4** | у книги нет жанра |
| `facet.genre.not_form` | warning, 4 | одно название одновременно в жанре и в форме (DL-126) |

Специальные правила **приоритетнее общих** (rules.md «Перекрывающиеся правила»): на полях
`category.facet`, `category.parent`, `facet.taxonomy`, `taxonomy.facets` общие
`value.cardinality` / `value.reference.exists` / `value.reference.target_type`
подавляются — диагностика не дублируется. Строки добавлены в rules.md **v0.15.0**
(состав реестра не менялся — **171 правило**).

**3. `in_category` с предками** — граница **B1.1-4 закрыта**: назначен потомок
(«Космическая опера») → условие по предку («Научная фантастика») истинно. Работает
одинаково в валидации и в форме (снимок строят `edit-object`/`create-object` и передают в
`computeVisibleKeys`) — расхождение «форма ↔ проверка» исключено (урок DL-271).

**4. Решения DL-278 в данных и нормах:**

- **B1.3-4 = Б** — `person.writing_genres` объявлен на всей группе «Литература и текст»
  (**7 ролей**: `author`, `novelist`, `poet`, `screenwriter`, `translator`, `editor`,
  `blogger`); карточка `person` §4.2 приведена к группе. ULID сида не изменился
  (рецепт по ключу) — **перезапускать `install-base-types` не нужно**, но если свойство
  уже установлено в вашем хранилище, пропуск по ключу оставит СТАРЫЙ список из 4 ролей:
  см. шаг 5 ниже (одна правка поля `applies_when.value`).
- **B1.3-6 = А** — `label` объявлен **необязательным** полем в
  `schema/metamodel/{facet,category,taxonomy}.schema.json` (+ строки в карточках тройки);
  добавлены PROPERTY-сиды `facet.label`, `category.label`, `taxonomy.label` →
  сидов **135 → 138** (системные **62 → 65**). TS-типы перегенерированы
  (`src/generated/{facet,category,taxonomy}.ts`).

**5. Производительность (урок DL-255/259):** снимок классификации строится **один на
прогон** (`validate-vault` передаёт его каждой проверке), а для одиночной
`validate-object` — только когда действительно нужен (определение классификации, наличие
`categories`, тип `book`/потомок, свойства с `in_category`). Повторных сканов в цикле нет.

**Тесты 368 → 399** (+31): `classification.test.ts` (11), `classification-engine.test.ts`
(20 — каждое правило: id/severity/level, подавление общих правил, жанр у книги,
назначение потомком, `assignment.type_allowed` на человеке, кардинальности, `not_form`,
`in_category` с предками). Матрица TZ ×6 — 399/399.

## Состав патча

| Область | Файлы |
|---|---|
| Код (новое) | `plugin/src/core/classification.ts`, `plugin/src/core/classification-engine.ts` |
| Код (правки) | `plugin/src/core/applies-when.ts` (предки; `assignedCategoryIds` переехал в classification и реэкспортируется), `schema-engine.ts` (DefinitionContext + подавление общих правил), `validation.ts` (группа E + один снимок на прогон + кэш), `object-service.ts` (`computeVisibleKeys` + снимок), `ui/property-editor-modal.ts`, `commands/edit-object.ts`, `commands/create-object.ts`, `core/seeds/library-specs.ts` (+3 сида `label`, `writing_genres` — 7 ролей), `core/seed-library.ts`, `scripts/generate-seed-ulids.mjs` (+3 рецепта), `core/seeds/seed-ulids.ts` (перегенерирован: 138), `src/generated/{facet,category,taxonomy}.ts`, `manifest.json`/`package.json`/`versions.json` (0.11.0) |
| Нормы | `schema/metamodel/{facet,category,taxonomy}.schema.json` (+`label`), `docs/metamodel/entities/{person,facet,category,taxonomy}.md`, `docs/validation/rules.md` (v0.15.0), `docs/metamodel/00-overview.md` (v0.10.0) |
| Тесты (новые) | `tests/unit/classification.test.ts`, `tests/unit/classification-engine.test.ts`, `tests/support/classification-fixtures.ts`; правки счётчиков: `tests/unit/{seed-ulids,seed-consistency,install-base-types,library-integration}.test.ts` |
| Документы | `docs/plugin/architecture.md` (v0.14.0), `docs/plugin/dev-setup.md` (v0.6.1), `docs/roadmap/phases.md` (v0.18.0), `docs/roadmap/mvp-scope.md` (v0.16.1), `docs/project-map/PROJECT_MAP.md` (v1.49.0), `docs/decisions/decision-log.md` (v1.57.0 — DL-278/DL-279), `docs/changelog/CHANGELOG.md` (v0.48.0 — [1.4.0]), `docs/glossary/glossary.md` (v1.33.0 — 291), `plugin/README.md`, `docs/CHECKPOINT.md` (v61.0.0), этот handoff |

## Шаг 1. Применить патч

```powershell
cd "D:\Пользаватель\Документы\Метамодель\Qwen 4\SB_Qwen_PKB"
git status
```

Ожидание: «nothing to commit, working tree clean», HEAD — `bd7fef7`.

```powershell
git apply --ignore-whitespace --stat b1-3-part2a-classification.patch
git apply --ignore-whitespace b1-3-part2a-classification.patch
```

## Шаг 2. Проверки (`npm ci` не нужен)

```powershell
cd plugin
npm test
```

Ожидание: **399 passed** (39 файлов; было 368; +31: classification, classification-engine).

> [!warning] Если `classification-engine.test.ts` падает по таймауту (Windows)
> Это дефект 0.11.0, исправленный в **0.11.1** (DL-281): `loadClassification` читала всю
> `Metamodel/` (~146 заметок) на каждый вызов, а каждый из 20 тестов файла заново ставил
> базовую библиотеку. Примените следующий патч
> `b1-3-part2a-fix-classification-perf.patch` — после него ожидание **401 passed**.

```powershell
npm run typecheck
npm run build
npm run check:types-fresh
node scripts/generate-seed-ulids.mjs --check
```

Ожидание: typecheck пуст; сборка — `[second-brain] сборка завершена → main.js` без
WARNING; «13 файлов свежи»; «seed-ulids.ts свеж».

```powershell
cd ..
npm run check
npm run check:docs
```

Ожидание: **74 OK, 0 FAIL**; «разрывов таблиц нет — OK» (**200 файлов** — добавился этот handoff).

## Шаг 3. Коммит и push

```powershell
git add -A
git commit
git push origin main
```

Сообщение коммита — ниже.

## Сообщение коммита

```text
feat(plugin): 0.11.0 — B1.3 часть 2a «классификация»: classification-service + 15 правил группы E; метамодель 1.4.0 — label у facet/category/taxonomy (DL-278/DL-279, 1.4.0)

Поставка по организации DL-276 (часть 2 из двух) и решению DL-278 (гранулярность = Б:
две поставки — 2a «ядро и правила» → 2b «assign-category + UX-проверка B3»).

classification-service (src/core/classification.ts, 09-modules слой 3): снимок
таксономий/фасетов/категорий (Metamodel/{Taxonomies,Facets,Categories} + канонические
имена TAXONOMY-/FACET-/CATEGORY- где угодно); наследование умолчаний «фасет →
таксономия → таблица 01-classification §2.2»; предки категории (транзитивное замыкание
по parent, защита от цикла); findSystemFacet (семенной ULID рецепта, резерв —
title/label: пользовательский «Жанр» узнаётся, конвенция DL-277); кэш
.sb/cache/classification.json (ADR-002 — производные данные, пишет validate-vault).

Правила группы E — 15 из 19 (src/core/classification-engine.ts): category.facet.required
(error, 2), category.facet.single (error, 4), category.parent.exists (error, 3),
category.parent.same_facet (error, 4), category.parent.no_cycle (error, 3),
category.parent.strict_mode (error, 4), category.taxonomy_direct.forbidden (error, 4 —
П8), facet.taxonomy.exists (error, 3), facet.allowed_types.conflict (warning, 4),
facet.root_requirement (warning, 4), taxonomy.facets.min_one (error, 2),
assignment.type_allowed (error, 4 — потомки включаются, DL-208/209),
assignment.cardinality (error при 1/1..N, warning при превышении 0..1),
facet.genre.required_for_book (error, 4), facet.genre.not_form (warning, 4 — граница
DL-126). Существование цели в системном поле categories — value.reference.exists (И6).
Приоритет специальных правил над общими (rules.md «Перекрывающиеся правила»):
CLASSIFICATION_SPECIALIZED_RULES подавляет value.cardinality / value.reference.exists /
value.reference.target_type на полях классификации; строки добавлены в rules.md v0.15.0
(состав — 171 правило, не менялся).

in_category с предками (граница B1.1-4 ЗАКРЫТА): isPropertyVisible(def, note,
classification?) раскрывает назначенные категории предками — одинаково в валидации
(validateInstanceValues) и в форме (computeVisibleKeys; снимок строят edit-object и
create-object) — расхождение «форма ↔ проверка» исключено (урок DL-271). Без снимка —
прямое назначение (безопасный отказ). Производительность (урок DL-255/259): снимок ОДИН
на прогон (validate-vault передаёт его через options.classification); для одиночной
проверки строится только когда нужен (needsClassification).

Нормы — метамодель 1.3.0 → 1.4.0 (MINOR, миграция не нужна): B1.3-6 = А — label
объявлен необязательным полем (string, minLength 1) в schema/metamodel/facet, category,
taxonomy + PROPERTY-сиды label у тройки (сидов 135 → 138, системные 62 → 65; TS-типы
перегенерированы, тест свежести); B1.3-4 = Б — person.writing_genres на всей группе
«Литература и текст» (7 ролей вместо явного перечня из 4; М7), карточка person §4.2
приведена к группе, ULID сида не изменился.

Тесты 368 → 399 (+31): classification (снимок, область чтения, битый frontmatter,
наследование умолчаний, предки и цикл, findSystemFacet, назначения, кэш round-trip),
classification-engine (каждое правило группы E: id/severity/level; подавление общих
правил; жанр у книги; назначение потомком; assignment.type_allowed на человеке;
кардинальности 1 и 0..1; not_form; in_category с предками). Матрица TZ ×6 — 399/399;
typecheck/build без предупреждений; корень — 74 OK; check:docs — 200 файлов, 0 разрывов.

Границы (architecture §5): B1.3-7 — отдельный снимок и кэш классификации (RegistrySnapshot
не расширялся: иначе format 1 → 2 и миграция кэша); B1.3-8 — root_requirement_min
реализован по rules.md как требование к составу фасета (пример valid-01-genre читает
иначе) → вопрос Ч4-1; B1.3-9 — согласованность taxonomy.facets ↔ facet.taxonomy не
проверяется: правила в реестре нет → вопрос Ч4-2. Команда assign-category, UX-проверка
B3 и контрол categories в форме — часть 2b.

Учёты: architecture v0.14.0, dev-setup v0.6.1, phases v0.18.0, rules v0.15.0,
00-overview v0.10.0, mvp-scope v0.16.1, PROJECT_MAP v1.49.0, glossary v1.33.0 (291),
decision log v1.57.0 (DL-278/DL-279), CHANGELOG [1.4.0] (v0.48.0), plugin/README,
CHECKPOINT v60.1.0 → v61.0.0 (§6.78, §8.33), handoff.

Дальше: ручная проверка 0.11.0 (сценарий в handoff) → B1.3 часть 2b (assign-category,
UX-проверка B3, вопросы Ч4-1/Ч4-2).
```

## Шаг 4. Ручная проверка в Obsidian

1. Перенесите в папку плагина хранилища **ОБА файла**: `main.js` **И** `manifest.json`
   (версия **0.11.0** — сверьте в списке плагинов). **ПЕРЕЗАГРУЗИТЕ Obsidian (Ctrl+R)**.
2. **Категории жанра** (если ещё не создавали): «Создать объект (create-object)» → тип
   «Категория» → в форме появилось поле **«Подпись»** (новое, B1.3-6 = А):
   title `Science fiction`, подпись «Научная фантастика», «Фасет» — `Genre`,
   «Родительские категории» — пусто (корень). Создайте 2–3 категории.
3. **validate-object на книге без жанра** → **ОЖИДАЕТСЯ error**: «У книги не назначен
   жанр (фасет «Жанр»)» (`facet.genre.required_for_book`) с подсказкой про
   `assign-category`. Это норма Ч3-3 = Б, а не дефект: команда назначения — часть 2b,
   до неё жанр можно вписать в поле `categories` вручную (каноническая ссылка
   `[[CATEGORY-{ULID}.md|Название]]`) — проверка примет.
4. **validate-object на фасете «Жанр»** до создания категорий → **warning**
   `facet.root_requirement` («корневых категорий: 0 (минимум 1)»); после создания
   корневой категории — предупреждение уходит.
5. **Правила категорий**: у категории с родителем из другого фасета →
   error `category.parent.same_facet`; с полем `taxonomy` → error
   `category.taxonomy_direct.forbidden` (П8); у таксономии с `facets: []` →
   error `taxonomy.facets.min_one`. Общих дублей (`value.cardinality` на поле «Фасет»)
   быть не должно — специальное правило приоритетнее.
6. **B1.3-4 = Б**: «Создать объект» → Человек → `role`: добавьте **`translator`** —
   в форме появились **«Жанры работ»** (в 0.10.0 их не было), «Языки работ»,
   «Основные работы».
7. **validate-vault** → сводка; в `.sb/cache/` появился `classification.json`
   (производные данные — можно удалить).
8. **copy-log** → записи проверок и (debug) «Кэш снимка классификации сохранён».

## Шаг 5. Одна правка в уже установленном хранилище (B1.3-4 = Б)

`install-base-types` **идемпотентна и пропускает существующее по ключу** (DL-276),
поэтому свойство `person.writing_genres`, установленное в 0.10.0, сохранит старый
список из 4 ролей. Если хотите 7 ролей у себя (рекомендуется — иначе у переводчика,
редактора и блогера поле «Жанры работ» не появится):

откройте `Metamodel/Properties/PROPERTY-….md` со `key: writing_genres` и замените блок

```yaml
applies_when:
  property: role
  operation: includes_any
  value:
    - author
    - novelist
    - poet
    - screenwriter
```

на

```yaml
applies_when:
  property: role
  operation: includes_any
  value:
    - author
    - novelist
    - poet
    - screenwriter
    - translator
    - editor
    - blogger
```

(правка определения вручную — исключение из ADR-004; альтернатива — удалить эту
PROPERTY-заметку и снова запустить «Установить основные типы»: свойство создастся
заново по новому сиду, ULID тот же.)

> Если в вашем хранилище библиотеки ещё нет (0.10.0 не устанавливали) — просто запустите
> «Установить основные типы (book, person)»: будет создано **138** определений.

## Вопросы части 2b (ответьте, когда удобно — не блокируют перенос)

- **Ч4-1 (граница B1.3-8).** `root_requirement_min` у фасета: **А** — требование к
  СОСТАВУ фасета («в фасете минимум N корневых категорий») — так реализовано сейчас по
  формулировке `rules.md` и ADR-005 П5; **Б** — требование к НАЗНАЧЕНИЮ («объекту нужна
  минимум одна КОРНЕВАЯ категория этого фасета») — так читает пример
  `examples/instances/facet/valid-01-genre.md`. При Б книга с назначенным
  НЕкорневым жанром («Космическая опера» при корне «Научная фантастика») получала бы
  ошибку — это строже и, возможно, неудобнее. Рекомендация будет обоснована в части 2b.
- **Ч4-2 (граница B1.3-9).** Таксономия объявляет фасеты в `facets`, а фасет ссылается
  обратно в `taxonomy`; расхождение (таксономия объявляет фасет, который на неё не
  ссылается) сейчас **не проверяется**: правила в реестре `rules.md` нет, а выдумывать
  id нельзя. **А** — зарегистрировать правило (предложение: `taxonomy.facets.consistent`,
  warning, уровень 4) и реализовать в части 2b; **Б** — не проверять (достаточно
  `facet.taxonomy.exists`). Рекомендация — А (дешёвое правило, ловит реальную
  рассинхронизацию), но это изменение реестра правил → MINOR метамодели.

## Если что-то пойдёт не так

- `git apply` конфликтует — НЕ применяйте силой: пришлите `git status` и
  `git log --oneline -3` (база патча — `bd7fef7`).
- Тесты красные — пришлите хвост `npm test` (failed-секцию целиком).
- После обновления `validate-vault` показывает много ошибок жанра — это
  `facet.genre.required_for_book` (норма): назначьте жанры или дождитесь части 2b
  с командой `assign-category`.
- Откат: `git apply -R --ignore-whitespace b1-3-part2a-classification.patch`;
  в хранилище — `main.js` + `manifest.json` от 0.10.0 и Ctrl+R. Созданные заметки
  определений (`label`-свойства) можно удалить вручную — реестр перестроится при загрузке.
