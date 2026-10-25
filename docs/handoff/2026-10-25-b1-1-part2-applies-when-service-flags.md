# Перенос изменений: плагин 0.7.0 — B1.1 часть 2: applies-when (М1–М7) + service-flags (sb_issues) + create-property + validate-vault + группа E + правило П2

Дата: 2026-10-25 · База: ваш коммит `3fa0699` (B1.1 часть 1 — текущий HEAD `main`) · Патч: `b1-1-part2-applies-when-service-flags.patch`

> [!note] Зависимости не менялись — `npm ci` НЕ нужен
> Код плагина: 2 новых модуля ядра + 2 новые команды + расширение существующих файлов.
> **Норма изменена (метамодель 1.2.0 → 1.3.0)**: зарегистрировано правило П2
> `date.all_unknown.optional_only` (Ч2-3 = А, DL-265) — rules.md v0.14.0 (**171 правило**).
> Миграция не нужна: старые заметки остаются корректными, новое правило — warning.

## Что это

**B1.1 «определения и валидация», часть 2** (разбивка DL-261) — под-батч закрывается целиком:

**1. Условные свойства заработали (движок `applies-when`, 04-attributes §11).**
Свойства с `applies_when` больше не пропускаются при проверке значений:

- условие выполнено (свойство **видно**) — проверки в полном объёме, включая обязательность;
- условие не выполнено (свойство **скрыто**) — обязательность НЕ проверяется (М6:
  «скрытое свойство не мешает сохранить объект»), но сохранённые значения проверяются
  на качество (М2: значения «погасших» свойств не удаляются — испорченные данные видно);
- операции: `equals` и `includes_any` — пересечение значений триггера со списком условия
  (М7: одно свойство обслуживает несколько групп значений), `in_category` — объекту
  назначена категория из списка (по ULID из `categories`; предки категорий — B1.3).

Пример: у `book` свойство `file_size` с условием «format = file». Пока `format: web_novel`,
незаполненный `file_size` не ошибка; заполненный текстом «много» вместо числа — ошибка
(данные испорчены независимо от видимости поля).

**2. Служебный слой диагностик (`service-flags`, 08-views §7, DL-168).**
После проверки (validate-object / validate-vault) плагин пишет в заметку **парой**:

- служебные метки в `tags`: `sb/error` (есть ошибки) / `sb/warning` (предупреждения без
  ошибок) / `sb/info` (только заметки) — для встроенной фильтрации Bases (`file.hasTag`);
- служебное свойство `sb_issues` — список строк «{rule_id}: {severity}» — для колонки
  в таблицах. Объявление свойства **сеется бутстрапом**: при первой загрузке 0.7.0 в
  `Metamodel/Properties/` появится `PROPERTY-01M5K0XB00T6WT7SFWZBG4M9NB.md`
  (фиксированный ULID — рецепт B1-4 = А; Notice «бутстрап … создано 1»). **Не удаляйте
  эту заметку** — без неё правило `diagnostics.service_property.declared` выдаёт ошибку.

Правила группы K: ручная правка `sb_issues` (readonly), рассинхрон меток и свойства
(synced), отсутствие/дубль объявления (declared). Метки снимаются, когда проблема
исправлена и проверка повторена. Служебная запись не трогает `updated_at` и пишется
только на объекты Second Brain (заметки с `id` или `type` во frontmatter) — ваши
дневники и MOC-заметки не помечаются.

**3. Команда `create-property`** — определение свойства командой (ADR-004): vanilla-модалка
(ключ, подпись, тип значения, кардинальность, область, типы, перечисление, цели ссылки,
link_mode/media_target, условие `applies_when`, пояснение). `required` выводится из
`cardinality` автоматически (таблица 04-attributes §4) — рассогласование невозможно.
Отказы уровня 1 (до записи) зеркалят группу B правил и **пишутся в журнал**.
Созданное определение проходит validate-object без диагностик (тест).

**4. Команда `validate-vault`** — проверка всего хранилища (уровни 2–4, 6): один общий
индекс на прогон, область — заметки с признаком объекта (`id`/`type`), служебные метки
обновляются, сводка: Notice («заметок N, ошибок E, предупреждений W») + окно (итоги,
vault-диагностики, топ-10 проблемных заметок с кнопкой «Открыть»), одна запись в журнал.

**5. Группа E — определения типов (`object_type.*`)**: родитель существует, циклов в
иерархии нет, `TYPE_PREFIX` уникален, у абстрактного типа нет экземпляров (последнее —
в validate-vault: правило масштаба хранилища).

**6. Правило П2 (Ч2-3 = А, DL-265)**: дата, неизвестная целиком (`0000-00-00`), в
**обязательном** поле — warning `date.all_unknown.optional_only` (в необязательном —
допустима молча). Зарегистрировано в rules.md v0.14.0 — **171 правило**; метамодель
**1.3.0** (новое правило-warning = MINOR по классификации 10-migration-rules §3).

**7. Фикс наблюдаемости (DL-264)**: отказ модалки create-object-type на неформатный
`type_key` раньше показывал только Notice и НЕ писался в журнал — так был диагностирован
инцидент «плагин не позволил создать объект». Пред-чек удалён — отказ проходит через ядро
и виден в журнале (error/creation) и в copy-log.

**Границы части 2 (честно, M6 — architecture.md §5, B1.1-4…9)**: `in_category` — только
прямое назначение категории (предки — B1.3); служебная запись не трогает `updated_at`;
правила `diagnostics.*` не попадают в `sb_issues` (иначе слой диагностик осциллировал бы
сам на себе); `abstract.no_instance` — только в validate-vault; validate-vault читает
заметки дважды (индекс + проверка — упрощение MVP); create-property не предлагает
`target_facet`/`default_value`/`display.*` (фасеты — B1.3, показ — B1.2).

Версии: плагин **0.6.0 → 0.7.0**; метамодель **1.2.0 → 1.3.0** (CHANGELOG [1.3.0]);
тесты **206 → 263** (+57).

## Шаг 1. Применить патч

Положите `b1-1-part2-applies-when-service-flags.patch` в корень репозитория, затем из корня (команды по одной):

```powershell
cd "D:\Пользаватель\Документы\Метамодель\Qwen 4\SB_Qwen_PKB"
```

```powershell
git status
```

Ожидание: «nothing to commit, working tree clean» (HEAD — `3fa0699`).

```powershell
git apply --ignore-whitespace --stat b1-1-part2-applies-when-service-flags.patch
```

(предпросмотр: ~35 файлов, ничего не меняет)

```powershell
git apply --ignore-whitespace b1-1-part2-applies-when-service-flags.patch
```

## Шаг 2. Проверки (`npm ci` не нужен)

```powershell
cd plugin
```

```powershell
npm test
```

Ожидание: **263 passed** (было 206; +12 applies-when, +11 service-flags, +10 группа E/П2, +11 create-property, +6 validate-vault, +4 семя sb_issues, +3 условные значения).

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

Ожидание: **74 OK, 0 FAIL** (схемы и примеры не менялись).

```powershell
npm run check:docs
```

Ожидание: «разрывов таблиц нет — OK» (189 файлов).

## Шаг 3. Коммит и push

```powershell
git add -A
```

```powershell
git commit
```

Сообщение — ниже (первая строка `feat: метамодель 1.3.0 + плагин 0.7.0 — B1.1 часть 2…`).

```powershell
git push origin main
```

## Сообщение коммита

```text
feat: метамодель 1.3.0 — правило П2 зарегистрировано (171 правило); плагин 0.7.0 — B1.1 часть 2: applies-when, service-flags, create-property, validate-vault, группа E (DL-265…DL-266, 1.3.0)

Под-батч B1.1 «определения и валидация» ЗАКРЫТ обеими частями (разбивка DL-261).

НОРМА (метамодель 1.2.0 → 1.3.0, Ч2-3 = А, DL-265): зарегистрировано правило П2 —
`date.all_unknown.optional_only` (warning, уровень 2, группа H): дата, неизвестная
целиком (0000-00-00), допустима только в необязательном поле (06-time-and-intervals
§2). Поведение утверждено ранее ADR-011 — добавлен отсутствовавший id (пробел
architecture §5 B1.1-2 закрыт). rules.md v0.14.0 — 171 правило в 14 группах;
06-time-and-intervals v0.2.0; 00-overview v0.7.0. Новое правило-warning = MINOR
(классификация 10-migration-rules §3); миграция не нужна — старые заметки корректны.

КОД (плагин 0.6.0 → 0.7.0, DL-266):

applies-when (src/core/applies-when.ts) — движок условных свойств (04-attributes §11):
equals/includes_any — пересечение значений триггера со списком условия (М7);
in_category — ULID из системного `categories` (прямое назначение; предки категорий —
B1.3, граница B1.1-4); безопасные отказы (пустой триггер/значение, операция вне
набора М4 → свойство скрыто). Интеграция в проверку значений: скрытое условное
свойство — value.cardinality не применяется (М6), сохранённые значения проверяются
на качество (М2 — данные не удаляются); видимое — проверки в полном объёме.

service-flags (src/core/service-flags.ts) — служебный слой диагностик (08-views §7,
DL-168): служебные метки sb/error|sb/warning|sb/info (наивысшая серьёзность; прочие
метки в tags сохраняются) + служебное свойство sb_issues (text 0..N, формат
«{rule_id}: {severity}») — запись строго парой через processFrontMatter по итогам
проверки; правила группы K — diagnostics.service_property.readonly (warning, 4),
diagnostics.tags_issues_synced (warning, 6), diagnostics.service_property.declared
(error, 3 — ровно одно универсальное служебное объявление; в validate-vault — один
раз на прогон). Проектные решения (architecture §5 B1.1-5/6): правила diagnostics.*
не попадают в sb_issues (сходимость за один проход — без осцилляции); служебная
запись не трогает updated_at (служебные данные — не данные пользователя); метки
пишутся только на объекты Second Brain (frontmatter с id/type).

Семя PROPERTY sb_issues в бутстрапе (механизм B1-4 = А — опережает PROPERTY-сиды
B1.3: без объявления служебный слой не работает): фиксированный ULID
01M5K0XB00T6WT7SFWZBG4M9NB (рецепт: SHA-256 от
«second-brain/system-property/universal.sb_issues», первые 16 байт, время —
2026-10-23; воспроизведён тестом), байт-стабильное содержимое (LF, без BOM),
идемпотентность по существованию; бутстрап создаёт папки ObjectTypes/ и Properties/.

Команда create-property (vanilla-модалка; ядро createPropertyDefinition в creation.ts):
ключ/подпись/value_type (7)/cardinality (4)/scope+object_types (universal|family|
specific — согласованность как в группе B)/allowed_values/target_types + link_mode
(object_reference — ADR-009/010) + media_target (media_reference — ADR-008)/
applies_when (триггер должен быть объявлен)/definition. required ВЫВОДИТСЯ из
cardinality (04-attributes §4 — рассогласование невозможно по построению);
service: true не предлагается (служебные свойства объявляет плагин);
target_facet/default_value/display.* не предлагаются (граница B1.1-9 — B1.2/B1.3).
Проверки уровня 1 зеркалят группу B; все отказы пишутся в журнал (error/creation).

Команда validate-vault (ядро validateVault в validation.ts): один общий индекс
buildVaultIndex(readTypes) на прогон — типы заметок и признак SB-объекта; область —
заметки с id/type (произвольные заметки не проверяются и не помечаются); служебные
метки пишутся (applyServiceFlags); сводка — Notice + окно (итоги, vault-диагностики,
топ-10 проблемных с кнопкой «Открыть»); журнал — одна сводная запись (по-заметочные
подавлены); двойное чтение заметок — упрощение MVP (B1.1-8). Реализовано 7 из 20
команд реестра MVP.

Группа E (validateObjectTypeDefinition в schema-engine): object_type.parent.exists
(error, 3), object_type.parent.no_cycle (error, 3 — обход с посещёнными id),
object_type.type_prefix.unique (error, 2), object_type.abstract.no_instance (error, 4 —
только при индексе с типами, т.е. в validate-vault; одиночный validate-object
пропускает — B1.1-7). Классификация (category.*, facet.*, taxonomy.*, assignment.*) —
B1.3 с classification-service. Правило П2 — в date-ветке проверки значений: 0000-00-00
в видимом обязательном поле → warning (datetime не покрывается — П2 о датах).

Реестр: PropertyDef + service (признак служебного свойства); linkIdList экспортирован.

Фикс наблюдаемости (DL-264 — инцидент «плагин не позволил создать объект»): пред-чек
формата type_key в модалке create-object-type удалён — отказ уровня 1 проходит через
ядро (SbError) и пишется в журнал (error/creation); раньше это была единственная
нелогируемая точка отказа создания.

Границы части 2 (честно, M6 — architecture.md §5 B1.1-4…9): in_category — прямое
назначение (предки — B1.3); updated_at не трогается; diagnostics.* вне sb_issues;
abstract.no_instance только в validate-vault; validate-vault читает заметки дважды;
create-property без target_facet/default_value/display.*.

Тесты 206 → 263 (+57): applies-when ×12 (equals/includes_any/in_category, М7,
безопасные отказы), service-flags ×11 (выбор метки, формат, сходимость записи,
сохранность пользовательских меток, updated_at, degraded-режим без объявления,
declared-проблемы), группа E + П2 ×10 (чистое дерево, висячий родитель, цикл,
дубль префикса, экземпляры абстрактного типа, readTypes-индекс; П2 в
обязательном/необязательном/скрытом условном поле), create-property ×11 (счастливый
путь, required-вывод, «созданное проходит группу B», ссылки и link_mode/media_target,
отказы уровня 1, scope/покрытие, уникальность ключа F5-8, перечисления и applies_when,
журнал, полный цикл с условным свойством), validate-vault ×6 (чистое хранилище,
проблемный экземпляр + метки, не-SB-заметки вне прогона, abstract.no_instance,
declared один раз, журнал), семя sb_issues ×4 (рецепт, путь, норма 08-views §7,
байт-стабильность), условные свойства в значениях ×3 (М6/М2). Правки существующих:
бутстрап-счётчики (8 семян), layering (+2 команды), фикстуры части 1 (объявление
sb_issues / опция checkServiceDeclaration). Матрица TZ (UTC/Moscow/Kiritimati/Niue/
New_York) — 263/263; typecheck/build зелёные; корень — 74 OK; check:docs — 0 разрывов.

Учёты: decision log v1.48.0 (DL-264…DL-266), CHANGELOG [1.3.0] (v0.39.0), rules.md
v0.14.0 (171 правило), 06-time-and-intervals v0.2.0, 00-overview v0.7.0, architecture
v0.10.0 (B1.1-2 закрыт, +B1.1-4…9), phases v0.12.0 (B1.1 ✅), PROJECT_MAP v1.43.0,
dev-setup v0.3.0 (§7 — факт 0.7.0), README v0.9.0 + plugin/README (раздел «Часть 2»),
CHECKPOINT v52.0.0 (§6.68/6.69, §8.22/23, §14).

Дальше: B1.2 «формы и контролы» — первое включение Svelte 5 + esbuild-svelte (B1-2 = А):
plugin-ui, property-editor (модалка свойств с русскими подписями и условными полями),
display-renderer (звёзды/прогресс), object-service, контролы дат/рейтинга/ссылки,
toggle-label-mode; критерий B1 — форма book с условными свойствами.
```

## Шаг 4. После применения — ручная проверка в Obsidian (3 минуты)

1. Перенесите в папку плагина хранилища **`main.js` и `manifest.json`** (или
   `npm run link:vault`), перезагрузите Obsidian. Ожидание:
   - Notice **«Second Brain: бутстрап Metamodel/ — создано 1, уже было 7, ошибок 0»**
     (семя `sb_issues`; при повторных загрузках Notice нет — идемпотентность);
   - Notice **«Second Brain 0.7.0: загружен (типов в реестре: 7)»**.
2. В `Metamodel/Properties/` появилась заметка **`PROPERTY-01M5K0XB00T6WT7SFWZBG4M9NB.md`**
   («Проблемы», `service: true`) — не удаляйте.
3. `Ctrl+P` → **Second Brain: Проверить хранилище (validate-vault)**. Ожидание: Notice
   «Проверка хранилища: заметок 8, ошибок 0, предупреждений 0» (8 = 7 типов + sb_issues;
   больше, если вы создавали тестовые объекты — тогда числа и окно сводки понятные).
4. `Ctrl+P` → **Проверить объект (validate-object)** на любой заметке
   `Metamodel/ObjectTypes/` — по-прежнему 0 нарушений.
5. **Негативная проба create-property** (проверка фикса DL-264): `Ctrl+P` → **Создать
   свойство (create-property)**, введите ключ `Неверный!`, подпись любую, нажмите
   «Создать свойство». Ожидание: Notice с понятным отказом И запись в журнале
   (show-log): `ERROR creation: Ключ свойства «Неверный!» не соответствует формату…`.
6. **Негативная проба служебного слоя** (по желанию): создайте объект командой
   create-object (например, типа `category`), затем ВРУЧНУЮ удалите строку `title:` из
   frontmatter заметки и запустите на ней validate-object. Ожидание: диагностика
   `object.title.required`, а в заметке появятся `tags: … sb/error` и
   `sb_issues: ["object.title.required: error", …]`. Верните title, повторите
   проверку — метка и `sb_issues` снимутся автоматически (служба пишется парой).

Если что-то не так — `Ctrl+P` → **copy-log** и вставьте журнал в чат.

## Состав патча (~35 файлов)

Код плагина (0.7.0):

- `plugin/src/core/applies-when.ts` — **новый**: движок условий М1–М7;
- `plugin/src/core/service-flags.ts` — **новый**: метки + sb_issues + группа K;
- `plugin/src/core/schema-engine.ts` — группа E, applies-when в значениях, П2, readTypes-индекс;
- `plugin/src/core/validation.ts` — опции, группа K, запись меток, `validateVault`;
- `plugin/src/core/creation.ts` — `createPropertyDefinition` (+экспорты наборов);
- `plugin/src/core/bootstrap.ts` — семя PROPERTY `sb_issues`;
- `plugin/src/core/registry.ts` — PropertyDef + `service`;
- `plugin/src/core/date-engine.ts` — `isFullyUnknownDate` (П2);
- `plugin/src/commands/create-property.ts`, `validate-vault.ts` — **новые**;
- `plugin/src/commands/validate-object.ts` (запись меток), `create-object-type.ts` (фикс DL-264);
- `plugin/src/main.ts` — регистрация команд (7);
- `plugin/manifest.json`, `plugin/versions.json`, `plugin/package.json` — 0.7.0;
- тесты: `applies-when`, `service-flags`, `schema-engine-object-types`, `create-property`,
  `validate-vault` — **новые**; `bootstrap`, `bootstrap-vault`, `commands`, `validation`,
  `schema-engine-values`, `layering` — обновлены.

Нормы и документация:

- `docs/validation/rules.md` — **v0.14.0**: +`date.all_unknown.optional_only` (**171 правило**);
- `docs/metamodel/06-time-and-intervals.md` — **v0.2.0**: строка П2 получила id;
- `docs/metamodel/00-overview.md` — **v0.7.0**: счётчики (171 правило);
- `docs/decisions/decision-log.md` — **v1.48.0**: DL-264, DL-265, DL-266;
- `docs/changelog/CHANGELOG.md` — **v0.39.0**: запись **[1.3.0]**;
- `docs/plugin/architecture.md` — **v0.10.0**: модули applies-when/service-flags, §5 (B1.1-2 закрыт, +B1.1-4…9);
- `docs/plugin/dev-setup.md` — **v0.3.0**: §7 приведён к факту 0.7.0;
- `docs/roadmap/phases.md` — **v0.12.0**: B1.1 ✅ (обе части);
- `docs/project-map/PROJECT_MAP.md` — **v1.43.0**: §3, §8.21/22, §9, §10;
- `README.md` — **v0.9.0**; `plugin/README.md` — 0.7.0, раздел «Часть 2 (0.7.0)»;
- `docs/CHECKPOINT.md` — **v52.0.0**: §6.68/§6.69, §8.22/23, frontmatter, §10–§12, §14;
- `docs/handoff/2026-10-25-b1-1-part2-applies-when-service-flags.md` — этот файл.

## Проверка E2E в песочнице ассистента (выполнена до передачи)

Свежий клон `origin/main` (`3fa0699`) + этот патч: `npm test` — **263/263**, матрица TZ
(UTC / Europe/Moscow / Pacific/Kiritimati / Pacific/Niue / America/New_York) — везде
263/263, `npm run typecheck` — чисто, `npm run build` — main.js, корневой `npm run check` —
**74 OK, 0 FAIL**, `npm run check:docs` — 189 файлов, 0 разрывов.
