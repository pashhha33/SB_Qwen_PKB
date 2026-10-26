# Перенос изменений: плагин 0.10.0 — B1.3 часть 1 «библиотека»: сиды book/person/системные, 5 фасетов, команда `install-base-types` (DL-277)

Дата: 2026-10-26 · База: дерево **после применения `b1-3-answers.patch`** (ваш коммит DL-276) · Патч: `b1-3-part1-library.patch`

> [!warning] Порядок применения — ТРИ патча
> `dl-275-answers.patch` → `b1-3-answers.patch` → **этот**. Каждый — отдельный коммит.
> Если первые два уже применены и запушены — применяйте этот сразу.

> [!note] `npm ci` НЕ нужен — зависимости не менялись
> Нормы не менялись (метамодель **1.3.0**) — CHANGELOG **[1.3.8]** учётный. Миграция не нужна.

## Что доставлено

**Команда «Установить основные типы (book, person)»** (`install-base-types` — 22-я команда
реестра, DL-276) ставит **135 семенных определений** в `Metamodel/`:

- **OBJECT_TYPE**: `book` (BOOK, родитель `work`), `person` (PERSON) + **структурные**
  `work` (абстрактный — родитель book по 07-hierarchy, свойств нет) и `media` (цель ссылок
  `media_reference` у cover/file_path/portrait; свойства media — этап D, но ULID уже
  зарезервирован рецептом — этап D использует тот же);
- **FACET**: `Genre` (Жанр — 1..N, минимум 1 корень, только книги), `Literary form`
  (Литературная форма), `Country` (Страна), `Language` (Язык), `Sport` (Спорт).
  **Категории НЕ создаются** (Ч3-3 = Б): жанры добавите сами командой «Создать объект»;
- **PROPERTY (126)**: системные типы — 62 (долг F5-10 = Б закрыт), `book` — 22
  (12 базовых + 10 условных по `format`), `person` — 42 (15 базовых + 27 условных по `role`).

Механизм (B1-4 = А): сиды — статические данные плагина (`src/core/seeds/`), фиксированные
ULID — рецепт SHA-256 (`scripts/generate-seed-ulids.mjs`, файл `seed-ulids.ts` коммитится).
**Идемпотентность — пропуск по ключу**: ваши `book`/`person`/свойства/фасеты, созданные
командами при прежних проверках, НЕ дублируются — недостающие свойства добавятся и
привяжутся к ВАШИМ определениям (ссылки разрешаются в их ULID).

Границы части 1 — `architecture.md` §5 (B1.3-1…B1.3-6): сиды `relation` — этап C;
`display`/`applies_when` как поля типа `property` не сеются (составные структуры);
enum-ы кардинальностей не объявляются `allowed_values` (`enum.value.format`);
`book.publisher` — этап 2 (`organization`); `related_to` — C; `cover_file`/`portrait_file`
(теневые) — D; `chapter_count` — вычисляемое; `categories`/`tags` — системные (И6).
Зарегистрировано расхождение B1.3-4 (`writing_genres`: карточка — 4 роли, 05-enumerations
§3.17.5 — группа 7): сиды следуют карточке; вопрос разрешения — в части 2.

**Тесты 327 → 368** (+41): рецепты и свежесть ULID; согласованность «сиды == `schema/**`»
(состав полей, enum-ы, обязательность, applies_when); установка/идемпотентность/пропуск по
ключу/отказоустойчивость/байт-стабильность; интеграция — **143 заметки `Metamodel/` проходят
validate-object с 0 ошибок**, критерий B1 на модели формы (web_novel → 4 условных, file → 2).

## Состав патча

| Область | Файлы |
|---|---|
| Код (новое) | `plugin/src/core/seed-library.ts`, `plugin/src/core/seeds/library-specs.ts`, `plugin/src/core/seeds/seed-ulids.ts`, `plugin/src/commands/install-base-types.ts`, `plugin/scripts/generate-seed-ulids.mjs` |
| Код (правки) | `plugin/src/main.ts` (регистрация команды), `plugin/manifest.json` / `package.json` / `versions.json` (0.10.0) |
| Тесты (новые) | `tests/unit/seed-ulids.test.ts`, `tests/unit/seed-consistency.test.ts`, `tests/unit/install-base-types.test.ts`, `tests/unit/library-integration.test.ts`; правка `tests/integration/layering.test.ts` (whitelist +install-base-types) |
| Документы | `docs/plugin/architecture.md` (v0.13.0), `docs/plugin/dev-setup.md` (v0.6.0), `docs/roadmap/phases.md` (v0.17.0), `docs/project-map/PROJECT_MAP.md` (v1.48.0), `docs/decisions/decision-log.md` (v1.56.0, DL-277), `docs/changelog/CHANGELOG.md` (v0.47.0, [1.3.8]), `docs/glossary/glossary.md` (v1.32.0 — +«Гонка», +«Базовая библиотека»; 288 активных), `plugin/README.md`, `docs/CHECKPOINT.md` (v60.0.0), этот handoff |

## Шаг 1. Применить патч

```powershell
cd "D:\Пользаватель\Документы\Метамодель\Qwen 4\SB_Qwen_PKB"
git status
```

Ожидание: «nothing to commit, working tree clean» (HEAD — ваш коммит DL-276
`docs: DL-276 — организация B1.3 подтверждена…`).

```powershell
git apply --ignore-whitespace --stat b1-3-part1-library.patch
git apply --ignore-whitespace b1-3-part1-library.patch
```

## Шаг 2. Проверки (`npm ci` не нужен)

```powershell
cd plugin
npm test
```

Ожидание: **368 passed** (37 файлов; было 327; +41: seed-ulids, seed-consistency,
install-base-types, library-integration).

```powershell
npm run typecheck
npm run build
```

Ожидание: typecheck пуст; сборка — `[second-brain] сборка завершена → main.js`, без WARNING.

```powershell
cd ..
npm run check
npm run check:docs
```

Ожидание: **74 OK, 0 FAIL**; «разрывов таблиц нет — OK» (**198 файлов** — добавился этот handoff).

## Шаг 3. Коммит и push

```powershell
git add -A
git commit
git push origin main
```

Сообщение коммита — ниже.

## Сообщение коммита

```text
feat(plugin): 0.10.0 — B1.3 часть 1 «библиотека»: сиды book/person/системные (135, фиксированные ULID), 5 фасетов без категорий, команда install-base-types (DL-277, 1.3.8)

Поставка по организации DL-276 (Ч3-1 = А — часть 1 из двух; Ч3-2 = А — install-base-types
22-я команда; Ч3-3 = Б — фасеты без категорий).

Состав (135 семенных заметок):
- OBJECT_TYPE book (BOOK, parent work) + person (PERSON) + структурные work (абстрактный,
  DL-214) и media (цель media_reference; свойства — этап D, ULID зарезервирован рецептом
  system-type/media — обязательство этапа D, граница B1.3-5);
- FACET Genre (1..N, root_requirement_min 1, allowed book — по valid-01-genre),
  Literary form, Country, Language, Sport — категории НЕ сеются (Ч3-3 = Б);
- PROPERTY: системные 62 (object_type 8, property 24, relation_type 13, taxonomy 7,
  facet 7, category 3 — долг F5-10 = Б закрыт), book 22 (12 базовых + 10 условных по
  format), person 42 (15 базовых + 27 условных includes_any по role, М7).

Механизм (B1-4 = А): сиды — статические данные плагина (seeds/library-specs.ts);
фиксированные ULID — seeds/seed-ulids.ts (генератор scripts/generate-seed-ulids.mjs,
135 рецептов SHA-256 от second-brain/system-{type|facet|property}/…, время 2026-10-23;
--check сторожит свежесть). installBaseLibrary: идемпотентность — ПРОПУСК ПО КЛЮЧУ
(существующие типы/свойства/фасеты пользователя не дублируются; ссылки сидов разрешаются
в их ULID), отказоустойчивость, журнал; команда — Notice + перечитывание реестра.

Границы (architecture §5, B1.3-1…6): сиды relation — этап C; display/applies_when как
поля property не сеются (составные структуры); не-snake enum-ы кардинальностей без
allowed_values (enum.value.format); writing_genres — 4 роли по карточке (расхождение
с группой 7 из 05-enum §3.17.5 зарегистрировано — вопрос части 2); label у фасетов —
по 01-classification §2.2 (решение части 2); publisher — этап 2, related_to — C,
cover_file/portrait_file — D, chapter_count — вычисляемое, categories/tags — И6.

Тесты 327 → 368 (+41), матрица TZ ×6 — 368/368: seed-ulids (рецепт/уникальность/свежесть),
seed-consistency (сиды == schema/** — состав, enum-ы, required⟺cardinality, applies_when),
install-base-types (установка/идемпотентность/пропуск по ключу на «живом» хранилище/
отказоустойчивость/LF-BOM-Templater-И4/байт-стабильность), library-integration (143
заметки Metamodel/ — validate-object 0 ошибок; критерий B1 на модели: web_novel → 4
условных, file → 2; role [author, physician] → две группы; подписи русские; service вне
формы). Typecheck/build 0 предупреждений; корень 74 OK; check:docs 198 файлов 0 разрывов.

Учёты: architecture v0.13.0, dev-setup v0.6.0, phases v0.17.0, PROJECT_MAP v1.48.0,
glossary v1.32.0 (+Гонка, +Базовая библиотека — 288), decision log v1.56.0 (DL-277),
CHANGELOG [1.3.8] (v0.47.0), plugin/README, CHECKPOINT v59.0.0 → v60.0.0 (§6.77, §8.31),
handoff. Нормы не менялись (метамодель 1.3.0).

Дальше: ручная проверка 0.10.0 (сценарий в handoff) → B1.3 часть 2 «классификация»
(classification-service, assign-category, facet.genre.* уровня 4, UX-проверка B3).
```

## Шаг 4. Ручная проверка в Obsidian

1. Перенесите в папку плагина хранилища **ОБА файла**: `main.js` **И** `manifest.json`
   (версия **0.10.0** — сверьте в списке плагинов). **ПЕРЕЗАГРУЗИТЕ Obsidian (Ctrl+R)**.
2. `Ctrl+P` → **«Установить основные типы (book, person)»** → Notice:
   «Second Brain: базовая библиотека — создано N (типов …, фасетов …, свойств …),
   пропущено существующих M». **M > 0 — нормально**: ваши `book`/`person` (и созданные
   при проверках свойства, например `rating`) пропускаются по ключу, недостающее добавлено
   к ним.
3. Запустите команду **ещё раз** → Notice «создано 0, пропущено 135…» — идемпотентность.
4. В `Metamodel/` появились: `ObjectTypes/OBJECT_TYPE-…` (work, media — если ваших book/person
   не было, то и они), `Facets/FACET-…` ×5 (Genre, Literary form, Country, Language, Sport),
   `Properties/PROPERTY-…` (много). Откройте пару: русские подписи, `applies_when` у условных.
5. **Категории жанров** (содержимое — ваше): «Создать объект (create-object)» → тип
   «Категория» → создайте 2–3 (например, title `Science fiction`, label «Научная фантастика»;
   поле `facet` — ссылка на `FACET-…|Genre`).
6. **«Создать объект» → Книга** → форма: заполните `format = web_novel` — появились 4 поля
   (Площадка публикации, Статус публикации, Периодичность…, Дата последней главы);
   смените на `file` — остались 2 других (Путь к файлу, Формат файла); введённые значения
   не удаляются (М2). «Выбрать…» у поля **Автор** → человек. **Сохранить**.
7. **validate-object** на книге → 0 ошибок (жанр пока НЕ обязателен — правило
   `facet.genre.required_for_book` заработает в части 2).
8. **«Создать объект» → Человек** → `role`: добавьте `author` и `physician` — появились
   поля двух групп (Жанры работ… и Медицинская специальность…) + «Известен за».
9. **validate-vault** → заметки `Metamodel/` без ошибок (сводка Notice/окно).
10. **copy-log** → запись «Базовая библиотека установлена: создано …» (info/creation).

**Вопрос B1.3-4 (не блокирует, ответьте когда удобно):** `person.writing_genres` («Жанры
работ») сеяно по явному списку карточки person — 4 роли (`author`, `novelist`, `poet`,
`screenwriter`); группа «Литература и текст» в 05-enumerations §3.17.5 шире — 7 (+`translator`,
`editor`, `blogger`). У переводчика поле «Жанры работ» не появляется. Варианты: **А** —
оставить 4 (карточка точнее; поправим 05-enumerations в части 2); **Б** — расширить сид до 7
(группа важнее; поправим карточку). Рекомендация будет обоснована в части 2.

## Если что-то пойдёт не так

- `git apply` конфликтует — НЕ применяйте силой: проверьте, применены ли `dl-275-answers`
  и `b1-3-answers`; пришлите `git status` и `git log --oneline -5`.
- Тесты падают — пришлите хвост `npm test` и `copy-log` из Obsidian.
- После установки validate-vault показывает ошибки — пришлите `copy-log` (сводку и топ-10).
- Откат: `git apply -R --ignore-whitespace b1-3-part1-library.patch`; в хранилище —
  `main.js`+`manifest.json` от 0.9.1 и Ctrl+R; созданные сиды в `Metamodel/` можно удалить
  вручную (это заметки хранилища — плагин их не «помнит», кроме реестра, который
  перестроится при загрузке).
