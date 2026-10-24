# Перенос изменений: F5-7 = А (`TYPE_PREFIX`: `_` и 3–20) — метамодель 1.2.0, плагин 0.3.1

Дата: 2026-10-24 · База: рабочее дерево после применения `f5-8-logging.patch` (коммит `e4b5135` в песочнице ассистента = ваш закоммиченный батч журналирования) · Патч: `f5-7-prefix-rules.patch`

> [!important] Порядок обязателен
> Этот патч построен **поверх батча журналирования** (`f5-8-logging.patch`). Сначала нужно
> завершить предыдущий перенос (шаги 0–1 ниже: вылечить `npm ci`, прогнать проверки,
> сделать коммит и push), и **только потом** применять этот патч (шаги 2–4). Если применять
> в незакоммиченное дерево — изменения двух батчей смешаются, откатывать будет нечего.

## Что это

**F5-7 = А (DL-253)** — последний открытый вопрос этапа A закрыт. Норма `TYPE_PREFIX`:
длина **3–20** (было 3–12), допустимы `A–Z`, `0–9`, дефис и **подчёркивание** (было запрещено).
Реестровые snake_case-префиксы (`OBJECT_TYPE`, `RELATION_TYPE`, `SERIES_COLLECTION`, …)
теперь легальны — бутстрап `Metamodel/` (A2 часть 2) разблокирован.

Плюс микро-закрытие (DL-254): временный id `object.frontmatter.broken` зарегистрирован
постоянно в реестре правил (группа A, error, уровень 2) → **170 правил**.

Метамодель **1.1.0 → 1.2.0** (MINOR: расширение схемы — старые заметки не ломаются,
миграция не нужна). Плагин **0.3.0 → 0.3.1** (PATCH: приведение валидации к норме).

## Шаг 0. Вылечить `npm ci` после ошибки EPERM (ваш инцидент 2026-10-24)

Симптом: `EPERM: operation not permitted, unlink …\@esbuild\win32-x64\esbuild.exe`,
а следом `npm test` говорит «"vitest" не является внутренней или внешней командой».

Причина: файл `esbuild.exe` **заблокирован запущенным процессом** — почти всегда это
оставленный `npm run dev` (esbuild --watch) в другом окне PowerShell; реже — антивирус,
который сканирует свежий `.exe`. `npm ci` успевает снести часть `node_modules` до ошибки,
поэтому vitest и «не распознаётся»: папка осталась полуудалённой.

Лечение (PowerShell, команды по одной, из папки `plugin`):

1. Закройте окно, где запущен `npm run dev` (Ctrl+C), и Obsidian. Если окно не найти:

```powershell
Get-Process esbuild -ErrorAction SilentlyContinue | Stop-Process -Force
```

2. Удалите остатки `node_modules`:

```powershell
Remove-Item -Recurse -Force node_modules
```

Если команда тоже упрётся в блокировку — выполните её же ещё раз, либо
`cmd /c "rmdir /s /q node_modules"`, в крайнем случае перезагрузите компьютер
(блокирующий процесс гарантированно умрёт) и повторите.

3. Установите зависимости заново:

```powershell
npm ci
```

Профилактика на будущее: перед `npm ci`/`npm install` останавливайте `npm run dev`
(это добавлено в `docs/plugin/dev-setup.md` §6 — v0.2.0).

## Шаг 1. Завершить перенос батча журналирования (`f5-8-logging.patch`)

Из корня репозитория (`git status` должен показывать изменения от уже наложенного патча):

```powershell
cd "D:\Пользаватель\Документы\Метамодель\Qwen 4\SB_Qwen_PKB"
```

```powershell
npm run check
```

Ожидание: **74 OK, 0 FAIL**.

```powershell
cd plugin
```

```powershell
npm test
```

Ожидание: **137 passed**.

```powershell
npm run build
```

Ожидание: `[second-brain] сборка завершена → main.js`.

```powershell
cd ..
```

Коммит и push — **сообщение из `docs/handoff/2026-10-24-f5-8-logging.md`**, раздел
«Сообщение коммита» (в прошлый раз в коммит `c44172d` случайно попал текст плашки —
скопируйте именно блок `text` из handoff целиком):

```powershell
git add -A
```

```powershell
git commit
```

```powershell
git push origin main
```

## Шаг 2. Применить этот патч

Положите `f5-7-prefix-rules.patch` в корень репозитория, затем:

```powershell
git apply --ignore-whitespace --stat f5-7-prefix-rules.patch
```

(предпросмотр: список файлов, ничего не меняет)

```powershell
git apply --ignore-whitespace f5-7-prefix-rules.patch
```

Предупреждения «LF will be replaced by CRLF» при `git add` — норма (`core.autocrlf=true`).

## Шаг 3. Проверки

Зависимости не менялись — `npm ci` не нужен.

```powershell
cd plugin
```

```powershell
npm test
```

Ожидание: **137 passed** (тесты переведены на новую норму: snake_case-префиксы легальны, границы 3/20/21).

```powershell
npm run typecheck
```

```powershell
npm run build
```

```powershell
cd ..
```

```powershell
npm run check
```

Ожидание: **74 OK, 0 FAIL**.

## Шаг 4. Коммит и push

```powershell
git add -A
```

```powershell
git commit
```

Вставьте сообщение из раздела ниже целиком.

```powershell
git push origin main
```

## Сообщение коммита

```text
feat: метамодель 1.2.0 — F5-7 = А: TYPE_PREFIX легализованы «_» и длина 3–20; плагин 0.3.1 (DL-253…DL-254)

Ответ пользователя: F5-7 = А — последний открытый вопрос этапа A закрыт.

Норма (DL-253): TYPE_PREFIX — 3–20 символов, A–Z, 0–9, дефис, подчёркивание
(UPPER_SNAKE_CASE); уникальность как целой строки сохранена. Реестровые
snake_case-префиксы (OBJECT_TYPE, RELATION_TYPE, SERIES_COLLECTION, …) легальны —
бутстрап Metamodel/ (A2 часть 2) разблокирован. Частично пересмотрен DL-047.

Схема: defs#type_prefix — паттерн ^[A-Z][A-Z0-9_-]*$ + minLength 3 / maxLength 20;
паттерны wikilink и file_link (not-ветка) синхронизированы; типизированные link_*
не менялись (hardcoded-префиксы уже содержали «_»).

Документы: ADR-001 ревизия 0.2.0 (следствие 2 закрыто); 02-entities §6 v0.11.0;
04-attributes §7 v0.9.0; rules.md v0.13.0 — зарегистрирован постоянный id
object.frontmatter.broken (группа A, error, 2; DL-254) → 170 правил; 00-overview
v0.6.0 (170/47/19); примеры valid-03/invalid-02 приведены к норме (74 OK).

Плагин 0.3.1: identity — TYPE_PREFIX_PATTERN с «_», MAX_LENGTH 20, сообщения
creation/identity/модалки create-object-type; тесты — реестровые префиксы легальны,
границы 3/20/21, WEB_PAGE создаётся командой; 137/137 (матрица TZ).

dev-setup.md v0.2.0: симптом EPERM esbuild.exe при npm ci (инцидент пользователя) —
лечение и профилактика.

Учёты: decision log v1.39.0, CHANGELOG [1.2.0] (v0.33.0), PROJECT_MAP v1.36.0,
architecture v0.5.0 (расхождения закрыты), phases v0.7.0, mvp-scope v0.13.0 (170),
glossary v1.24.0, README v0.5.0, docs/README v0.3.12, CHECKPOINT v45.0.0.

Дальше: A2 часть 2 — бутстрап Metamodel/ (F5-9 = А: фиксированные ULID;
F5-10 = Б: 7 OBJECT_TYPE-заметок), затем A3 (D2 + front-matter-title-adapter).
```

## После применения — ручная проверка в Obsidian (1–2 минуты)

1. Пересоберите/перезагрузите плагин (`Ctrl+R` в Obsidian, см. dev-setup §4).
2. Палитра → **Second Brain: Создать тип объекта** → заполните: ключ `web_page`,
   подпись «Страница», префикс `WEB_PAGE` → создаётся без ошибки (до 0.3.1 префикс
   с подчёркиванием отклонялся). Подсказка поля теперь: «3–20 символов: A–Z, 0–9,
   дефис, «_»».
3. Попробуйте префикс из 21 символа — отказ с сообщением про 3–20.
4. Удалите созданные тестовые заметки (или оставьте — бутстрап их не тронет).

## Если что-то пошло не так

- `git apply` сообщает об ошибке — не применяйте частично: `git apply --ignore-whitespace --check f5-7-prefix-rules.patch` покажет проблему заранее; убедитесь, что шаг 1 (коммит батча журналирования) выполнен и `git status` чист.
- Откатить применённый патч: `git apply -R --ignore-whitespace f5-7-prefix-rules.patch`.
- Тесты красные — пришлите вывод `npm test` (из `plugin/`) и `npm run check` (из корня) следующим сообщением.

## Состав патча

**Схема:** `schema/common/defs.json` — `type_prefix` (паттерн, minLength/maxLength, $comment), `wikilink`, `file_link` (not-ветка).

**Код плагина (0.3.1):** `plugin/src/core/identity.ts` (паттерн, длины, комментарии, сообщение buildFileName), `plugin/src/core/creation.ts` (сообщение, комментарии), `plugin/src/core/registry.ts` (комментарии — F5-7 закрыт), `plugin/src/core/validation.ts` (комментарий — id постоянный), `plugin/src/commands/create-object-type.ts` (подсказка поля), `plugin/src/main.ts` (комментарий), `plugin/manifest.json` + `plugin/versions.json` + `plugin/package.json` (0.3.1).

**Тесты:** `plugin/tests/unit/identity.test.ts` (реестровые snake_case-префиксы легальны; границы 3/20/21), `plugin/tests/integration/commands.test.ts` (WEB_PAGE создаётся; 21 символ — отказ), `plugin/tests/integration/parser-examples.test.ts` (каноническое имя — для всех типов).

**Нормы:** `docs/adr/ADR-001-identity-and-file-naming.md` (0.2.0), `docs/metamodel/02-entities.md` (v0.11.0, §6), `docs/metamodel/04-attributes.md` (v0.9.0, §7 + строки истории 0.8.0/0.9.0), `docs/validation/rules.md` (v0.13.0, 170), `docs/metamodel/00-overview.md` (v0.6.0), `examples/instances/object_type/valid-03-deprecated.md`, `examples/instances/object_type/invalid-02.md`.

**Учётные:** `docs/decisions/decision-log.md` v1.39.0 (DL-253/254 + пересмотр DL-047), `docs/changelog/CHANGELOG.md` v0.33.0 ([1.2.0]), `docs/project-map/PROJECT_MAP.md` v1.36.0, `docs/plugin/architecture.md` v0.5.0, `docs/plugin/dev-setup.md` v0.2.0 (EPERM-симптом), `docs/roadmap/phases.md` v0.7.0, `docs/roadmap/mvp-scope.md` v0.13.0 (170 правил), `docs/glossary/glossary.md` v1.24.0, `README.md` v0.5.0, `docs/README.md` v0.3.12, `docs/CHECKPOINT.md` v45.0.0, этот handoff.

## Результаты проверок в песочнице ассистента

- `plugin`: vitest **137/137** (матрица TZ: UTC, Europe/Moscow, Pacific/Kiritimati, Pacific/Niue), `tsc --noEmit` чисто, `npm run build` → main.js.
- Корень: `npm run check` — **74 OK, 0 FAIL**.
- E2E: свежий клон `e8869ce` + `f5-8-logging.patch` + этот патч — тесты и прогон зелёные, дерево совпадает с песочницей.
