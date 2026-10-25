# Handoff — B1.2 часть 2: подбор цели ссылки, кнопки дат, подписи в форме (плагин 0.9.0)

- **Дата**: 2026-10-25
- **База патча**: `98b8bf7` (main — фикс 0.8.2)
- **Патч**: `b1-2-part2-reference-picker.patch` (в корне репозитория при передаче; 23 файла)
- **Версии**: плагин **0.9.0** (MINOR — новая функциональность); метамодель **1.3.0** без изменений (CHANGELOG `[1.3.4]` — учётная запись); **под-батч B1.2 закрыт** (DL-273)
- **npm ci НЕ нужен** (зависимости не менялись)

## Что в батче

1. **Подбор цели ссылки** (закрывает границу B1.2-1):
   - ядро: `searchReferenceTargets` (object-service) — поиск объектов по названию/имени
     файла с фильтром `target_types`, сортировка «совпадение с начала — раньше», лимит 50,
     самоссылка исключается; выход — каноническая ссылка `[[PREFIX-ULID.md|title]]`
     (ADR-001 + DL-186); `buildVaultIndex(readTypes)` дополнен `titleByPath`;
   - UI: `link-picker-modal.ts` (SuggestModal Obsidian; индекс строится лениво один раз
     на открытие — `getSuggestions` возвращает Promise), оболочка формы передаёт prop
     `pickReference`; в форме у полей `object_reference` и `media_reference`
     (media_target ≠ file) появилась кнопка **«Выбрать…»**.
2. **Быстрые кнопки дат**: «Сегодня» (date), «Сейчас» (datetime), «Неизвестна»
   (`0000-00-00` — только в необязательных полях: П2).
3. **Переключатель подписей в форме**: «Подписи: русские/ключи» (стартует глобальным
   режимом). Глобальный `toggle-label-mode` применяется к вновь открываемым формам
   (граница B1.2-6).
4. Тесты **308 → 321** (+13: `tests/unit/reference-search.test.ts`); учётные записи
   во всех документах (decision-log v1.52.0 — DL-272/273, CHANGELOG [1.3.4] v0.43.0,
   architecture v0.12.0, phases v0.14.0, PROJECT_MAP v1.45.0, README v0.11.0,
   plugin/README, dev-setup v0.5.0, glossary v1.31.0, CHECKPOINT v56.0.0).

## Порядок переноса (PowerShell, из корня репозитория)

```powershell
git fetch origin
git status
```

Убедитесь, что вы на `98b8bf7` (или новее — патч собран от `98b8bf7`) и рабочая копия чистая.

```powershell
git apply --ignore-whitespace b1-2-part2-reference-picker.patch
```

## Проверки

В `plugin/`:

```powershell
npm test
npm run typecheck
npm run build
```

Ожидание: **321/321** (32 файла), typecheck без ошибок, сборка `[second-brain] сборка завершена → main.js` **без WARNING/ERROR**.

В корне репозитория:

```powershell
npm run check
npm run check:docs
```

Ожидание: **74 OK, 0 FAIL**; **194 .md-файла проверено, разрывов таблиц нет — OK**.

## Коммит

```powershell
git add -A
git commit -m "feat(plugin): 0.9.0 — B1.2 часть 2: подбор цели ссылки (LinkPickerModal + searchReferenceTargets), быстрые кнопки дат, переключатель подписей в форме; B1.2 закрыт (DL-273, 1.3.4)"
git push origin main
```

## Ручная проверка (после переноса)

1. Перенесите в хранилище **`main.js` И `manifest.json`** (версия 0.9.0) — или используйте
   junction/`npm run link:vault` (dev-setup §0–§3). **Перезагрузите Obsidian (Ctrl+R)**.
2. **Подбор ссылки**: у объекта (например, книги) должно быть свойство-ссылка на `person`
   (например, «Автор», `value_type: object_reference`, `target_types: [person]`; создаётся
   через create-property). Откройте форму (edit-object) → у поля ссылки кнопка
   **«Выбрать…»** → введите часть названия человека → стрелками выберите → Enter.
   Ожидание: в поле вставилась каноническая ссылка `[[PERSON-….md|Название]]`.
   Esc — отказ, поле не меняется. Сама редактируемая заметка в списке не предлагается.
3. **Кнопки дат**: у поля `date` — «Сегодня» (вставилась текущая дата `ГГГГ-ММ-ДД`);
   у необязательного поля — «Неизвестна» (`0000-00-00`, сохранение проходит);
   у обязательного поля кнопки «Неизвестна» нет. У `datetime` — «Сейчас».
4. **Подписи в форме**: кнопка «Подписи: русские/ключи» переключает подписи полей
   СРАЗУ, не закрывая форму. Глобальный toggle-label-mode влияет на вновь открытые формы.
5. **Контрольно (0.8.2)**: создайте новое свойство (create-property) и БЕЗ перезагрузки
   откройте форму (edit-object) — подпись нового свойства русская; toggle-label-mode →
   откройте форму заново — подписи-ключи; верните режим обратно.
6. Критерий B1 (если ещё не повторяли): форма `book` — при `format: web_novel` видны
   4 условных свойства, при `format: file` — другие 2; сохранить можно; значения скрытых
   полей не теряются.

**Сообщите результаты** (особенно шаги 2–4) — это закрывает под-батч B1.2 и критерий B1;
плюс открытые вопросы: **В1** — `edit-object` как 21-я команда реестра (DL-269:
А подтвердить / Б отклонить); **В2** — подтверждение диагноза инцидента «плагин не
позволил создать объект» (DL-264: какая команда и точный текст Notice).

## Файлы патча (23)

- `plugin/src/core/object-service.ts` — searchReferenceTargets + ReferenceCandidate
- `plugin/src/core/schema-engine.ts` — VaultIndex.titleByPath
- `plugin/src/ui/link-picker-modal.ts` — **новый** (SuggestModal)
- `plugin/src/ui/property-editor-modal.ts` — prop pickReference
- `plugin/src/ui/svelte/property-editor.svelte` — кнопки, локальный режим подписей
- `plugin/src/main.ts` — шапка (факт 0.9.0)
- `plugin/tests/unit/reference-search.test.ts` — **новый** (13 тестов)
- `plugin/tests/unit/schema-engine-object-types.test.ts` — +2 проверки titleByPath
- `plugin/tests/integration/layering.test.ts` — whitelist + link-picker-modal
- `plugin/manifest.json`, `plugin/package.json`, `plugin/versions.json` — 0.9.0
- `plugin/README.md` — факт 0.9.0
- `README.md` — статус (B1.2 закрыт)
- `docs/decisions/decision-log.md` — v1.52.0 (DL-272, DL-273)
- `docs/changelog/CHANGELOG.md` — v0.43.0 ([1.3.4])
- `docs/plugin/architecture.md` — v0.12.0 (B1.2-1 закрыта, +B1.2-6/7)
- `docs/plugin/dev-setup.md` — v0.5.0 (§7 — факт 0.9.0)
- `docs/roadmap/phases.md` — v0.14.0 (B1.2 ✅)
- `docs/project-map/PROJECT_MAP.md` — v1.45.0 (пункты 25–27, строка plugin 0.9.0)
- `docs/glossary/glossary.md` — v1.31.0 (+«Suggest-окно» → 286 активных)
- `docs/CHECKPOINT.md` — v56.0.0 (§6.73, §8.27, §9, §11, §12, §14)
- `docs/handoff/2026-10-25-b1-2-part2-reference-picker.md` — этот документ
