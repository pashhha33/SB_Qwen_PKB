# Перенос изменений: фикс 0.11.1 — область чтения снимка классификации (урок DL-255/259/281)

Дата: 2026-10-26 · База: дерево **после применения `b1-3-answers-2.patch`** (учёт DL-280) · Патч: `b1-3-part2a-fix-classification-perf.patch`

> [!warning] Порядок применения — ТРЕТИЙ патч
> `b1-3-part2a-classification.patch` (у вас применён) → `b1-3-answers-2.patch` (docs-only,
> учёт DL-280) → **этот**. Каждый — отдельный коммит.

> [!note] `npm ci` НЕ нужен; `main.js` МЕНЯЕТСЯ (перенести заново)
> Нормы не менялись (метамодель **1.4.0**) — CHANGELOG **[1.4.1]** учётный. Миграция не
> нужна. Поведение проверок и состав диагностик не изменились — изменилась область чтения.

## Что случилось

Вы применили патч части 2a к `bd7fef7` и прогнали `npm test` до коммита: **1 красный из
399** — `classification-engine.test.ts > facet.taxonomy.exists`: «Test timed out in
20000ms» (файл шёл 147 с, весь прогон — 325 с).

**Важно: данные, сиды и правила не затронуты.** 398 тестов зелёные, включая все 20 проверок
правил группы E, согласованность сидов со схемами, установку библиотеки и критерий B1.

**Диагноз (мой дефект в новом коде, а не «медленный диск»):**

1. `loadClassification` фильтровала пути как `path.startsWith('Metamodel/') ||
   isClassificationPath(path)` — то есть читала **ВСЕ определения метамодели**
   (~146 заметок после установки базовой библиотеки) вместо ~5 заметок классификации.
   Регрессионный замер: **146 обращений к `adapter.read` на один снимок вместо 5** (×29).
2. Каждый из 20 тестов файла заново ставил базовую библиотеку (бутстрап + 138 сидов +
   два перечитывания реестра) — на Windows с антивирусом это 9–15 с на тест.

Итог: 20 × (установка библиотеки + полные сканы) — на быстром диске песочницы укладывалось
в лимит, на вашем нет. **Это тот же класс дефекта, что DL-255 (кэш реестра) и DL-259
(Windows-фиксы части 1)**: чтение/скан в цикле проверок + особенности Windows-среды.

## Что исправлено

| # | Правка | Файлы |
|---|---|---|
| 1 | Фильтр сужен до `isClassificationPath`: три подпапки `Metamodel/{Taxonomies,Facets,Categories}` + канонические имена `TAXONOMY-`/`FACET-`/`CATEGORY-` в любом месте хранилища (та же область, что у `scanExistingFacets` в `seed-library`). Состав снимка и диагностик не изменился | `src/core/classification.ts` |
| 2 | Тесты группы E — **одно общее хранилище на файл** (`beforeAll`, таймаут 120 с) вместо 20 установок библиотеки; переписаны независимыми от порядка (у каждого свои ULID; `facet.root_requirement` проверяется на собственном фасете теста, а не на семенном «Жанре») | `tests/unit/classification-engine.test.ts` |
| 3 | Прогон 146 заметок — **общий снимок классификации** на прогон (паттерн `validate-vault`) + зафиксировано ожидание нормы Ч3-3 = Б: семенной «Жанр» даёт **warning** `facet.root_requirement` при нуле ошибок | `tests/unit/library-integration.test.ts` |
| 4 | **Регрессионный тест**: считает обращения к `adapter.read` при построении снимка — со старым фильтром тест красный (`expected 146 to be 5`). Плюс тест на `root_requirement_max` | `tests/unit/classification.test.ts`, `tests/unit/classification-engine.test.ts` |
| 5 | **Конвенция кода**: «область чтения сервисного снимка — минимальная: только свои заметки; полный скан папки определений в цикле проверок запрещён; общий снимок — один на прогон» | `docs/plugin/architecture.md` §4 (v0.14.2) |

**Тесты 399 → 401**; матрица TZ ×6 — 401/401. Версии: manifest/package/versions **0.11.1**.

## Шаг 1. Применить патчи по порядку

```powershell
cd "D:\Пользаватель\Документы\Метамодель\Qwen 4\SB_Qwen_PKB"
git apply --ignore-whitespace b1-3-answers-2.patch
git apply --ignore-whitespace --stat b1-3-part2a-fix-classification-perf.patch
git apply --ignore-whitespace b1-3-part2a-fix-classification-perf.patch
```

## Шаг 2. Проверки

```powershell
cd plugin
npm test
```

Ожидание: **401 passed** (39 файлов), прежний отказ по таймауту — зелёный; файл
`classification-engine.test.ts` идёт секунды, а не 147 с.

```powershell
npm run typecheck
npm run build
npm run check:types-fresh
node scripts/generate-seed-ulids.mjs --check
cd ..
npm run check
npm run check:docs
```

Ожидание: typecheck пуст; сборка без WARNING; «13 файлов свежи»; «seed-ulids.ts свеж»
(**138** рецептов); **74 OK, 0 FAIL**; «разрывов таблиц нет — OK» (**202 файла**).

## Шаг 3. Коммиты и push

Рекомендуется два коммита (история читается: решения — отдельно, фикс — отдельно):

```powershell
git add docs/          # только учётные документы DL-280
git commit             # сообщение — в handoff 2026-10-26-b1-3-answers-2.md
git add -A
git commit             # сообщение — ниже
git push origin main
```

Если проще одним коммитом — возьмите сообщение ниже и добавьте первой строкой
`docs: DL-280 — ответы Ч4-1 = А и Ч4-2 = А` (учётные патчи уже смешаны в дереве).

## Сообщение коммита

```text
fix(plugin): 0.11.1 — снимок классификации читает только заметки классификации: 146 чтений на снимок вместо 5 (DL-281, урок DL-255/259)

Дефект найден в среде пользователя (Windows): после применения патча части 2a тест
classification-engine > facet.taxonomy.exists ушёл за лимит 20 с (1 красный из 399;
данные, сиды и правила не затронуты — 398 зелёных).

Причины: (1) loadClassification фильтровала пути как startsWith('Metamodel/') ||
isClassificationPath(path), то есть читала ВСЕ определения метамодели (~146 заметок)
вместо ~5 заметок классификации — на каждый вызов; (2) каждый из 20 тестов файла заново
устанавливал базовую библиотеку (бутстрап + 138 сидов + два перечитывания реестра).

Фикс:
- src/core/classification.ts — фильтр сужен до isClassificationPath (Metamodel/{Taxonomies,
  Facets,Categories} + канонические имена TAXONOMY-/FACET-/CATEGORY- где угодно; та же
  область, что у scanExistingFacets в seed-library). Состав снимка и диагностик не изменился;
- tests/unit/classification-engine.test.ts — одно общее хранилище на файл (beforeAll,
  таймаут 120 с) вместо 20 установок библиотеки; тесты переписаны независимыми от порядка
  (свои ULID; facet.root_requirement — на собственном фасете теста, не на семенном «Жанре»);
- tests/unit/library-integration.test.ts — общий снимок классификации на прогон 146 заметок
  (паттерн validate-vault) + ожидание нормы Ч3-3 = Б: семенной «Жанр» даёт warning
  facet.root_requirement при нуле ошибок;
- регрессионный тест считает обращения к adapter.read при построении снимка (со старым
  фильтром — красный: expected 146 to be 5); добавлен тест facet.root_requirement на
  превышение root_requirement_max.

Конвенция (architecture §4, v0.14.2): область чтения сервисного снимка — минимальная
(только свои заметки); полный скан папки определений в цикле проверок запрещён; общий
снимок строится один на прогон. Тот же класс дефекта, что DL-255 и DL-259.

Тесты 399 → 401, матрица TZ ×6 — 401/401; typecheck/build чистые; корень — 74 OK;
check:docs — 202 файла. Нормы не менялись (метамодель 1.4.0).

Учёты: CHANGELOG [1.4.1] (v0.48.1), decision log v1.59.0 (DL-281), architecture v0.14.2,
phases v0.18.2, dev-setup v0.6.2, PROJECT_MAP v1.49.2, plugin/README, CHECKPOINT v62.0.0
(§6.80, §8.35), handoff + примечание в handoff части 2a. Версии: 0.11.1.

Дальше: ручная проверка 0.11.1 (сценарий части 2a, шаг 4) → B1.3 часть 2b
(assign-category, UX-проверка B3, taxonomy.facets.consistent → метамодель 1.5.0).
```

## Шаг 4. Ручная проверка 0.11.1 — сценарий части 2a без изменений

Сценарий — в handoff `2026-10-26-b1-3-part2a-classification.md`, шаг 4 (перенос `main.js`
+ `manifest.json` **0.11.1**, Ctrl+R; поле «Подпись» у категории; error
`facet.genre.required_for_book` у книги без жанра — норма; warning `facet.root_requirement`
у фасета «Жанр» до первой корневой категории; `category.parent.same_facet`; кэш
`.sb/cache/classification.json`; «Жанры работ» у человека с `role: translator`).
Плюс шаг 5 того же handoff: дописать `translator`, `editor`, `blogger` в
`applies_when.value` установленного свойства `writing_genres` (или пересоздать его
командой — ULID тот же).

**Что должно стать заметно быстрее:** `validate-object` на определениях классификации и
`validate-vault` (снимок читает 5–10 заметок вместо 146).

## Если что-то пойдёт не так

- `git apply` конфликтует — НЕ применяйте силой: проверьте, применён ли
  `b1-3-answers-2.patch` (этот патч построен поверх него); пришлите `git status` и
  `git log --oneline -3`.
- Тесты снова красные — пришлите хвост `npm test` (failed-секцию целиком) и время файла.
- Откат: `git apply -R --ignore-whitespace b1-3-part2a-fix-classification-perf.patch`.
