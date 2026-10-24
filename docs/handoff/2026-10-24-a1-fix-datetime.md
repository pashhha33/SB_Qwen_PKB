---
doc_type: handoff
title: "Передача: фикс 0.1.1 — TZ-баг нормализации дат + vitest 4 (DL-245)"
status: actual
created: 2026-10-24
metamodel_version: 1.0.2
covers: DL-245
tags: [handoff, commit, phase5, bugfix]
---

# Передача изменений — 2026-10-24, плагин 0.1.1 (фикс TZ-бага, DL-245)

> [!info] Что делать — два шага
>
> **Шаг 0 (рекомендуется, до применения патча): исправить сообщение коммита `c44172d`.**
> В коммит попал текст плашки F5-7 из чата вместо сообщения из handoff. Содержимое
> коммита корректное — правим только сообщение. Репозиторий одиночный, перезапись
> последнего коммита безопасна:
>
> ```powershell
> git log --oneline -1
> git commit --amend
> ```
>
> Откроется редактор: удалить всё, вставить сообщение коммита из
> `docs/handoff/2026-10-24-phase5-a1-scaffold.md` (раздел «Сообщение коммита»),
> сохранить и закрыть. Затем:
>
> ```powershell
> git push --force-with-lease
> ```
>
> Если перезаписывать историю не хочется — пропустите шаг 0, ничего не сломается
> (сообщение останется нестандартным).
>
> **Шаг 1: применить фикс.** Патч **`a1-fix-datetime.patch`** основан на вашем
> текущем HEAD (**`c44172d`**) и применяется напрямую. Команды построчно:
>
> ```powershell
> # 0. Рабочая копия чистая, HEAD — c44172d (или новый hash после amend)
> git status --short
> git log --oneline -1
>
> # 1. Применить патч
> git apply --ignore-whitespace a1-fix-datetime.patch
>
> # 2. Зависимости (обновился lock: vitest 4.1.12)
> cd plugin
> npm ci
>
> # 3. Тесты (ожидание: Test Files 8 passed, Tests 84 passed)
> npm test
>
> # 4. Аудит зависимостей (ожидание: found 0 vulnerabilities)
> npm audit
>
> # 5. Типы и сборка
> npm run typecheck
> npm run build
>
> # 6. Корневой прогонщик (ожидание: ИТОГ: 72 OK, 0 FAIL)
> cd ..
> npm run check
>
> # 7. Коммит и push
> git add -A
> git commit
> git push
> ```
>
> Сообщение коммита — в разделе ниже. Предупреждения «LF will be replaced by CRLF»
> при `git add` — безвредны (у вас `core.autocrlf=true`; в репозитории канон LF).

## Что произошло

Ваш терминал показал: A1 применён и запушен корректно (`c44172d`, 42 файла —
побайтово равно снимку песочницы), typecheck/build/`npm run check` — зелёные,
но **2 теста из 82 красные**, и только на вашей машине.

**Диагноз (воспроизведён в песочнице под TZ=Europe/Moscow):** js-yaml разбирает
НЕкавычные YAML-метки времени как **UTC** (`finished_on: 2026-09-14` → Date в
UTC-полночь), а парсер A1 форматировал такие Date **локальными** геттерами —
в часовом поясе UTC+3 значение съезжало на 3 часа: «2026-09-14» → «2026-09-14T03:00».
Песочница работает в TZ=UTC, где локальное время совпадает с UTC, — поэтому там
тесты были зелёные. Баг пойман ровно тем механизмом, для которого тесты писались.

**Исправление (DL-245) — два TZ-независимых уровня:**

1. **Лексический (основной):** значение извлекается из СЫРОГО текста frontmatter —
   «что написано, то и хранится»: `2026-09-14` → `2026-09-14`;
   `2026-09-14 10:30:00` → `2026-09-14T10:30` (секунды отбрасываются — точность
   до минут); `…+03:00`/`…Z` → смещение отбрасывается (норма «локальное время без
   смещения», ADR-006). Частичные даты (`1928-00-00`) проходят как есть.
2. **Fallback (Date внутри списков, где сырой скаляр не найти):** UTC-геттеры —
   они возвращают ровно написанный текст, потому что js-yaml построил Date в UTC.

Новые метки плагин по-прежнему пишет **локальным** временем (`nowStamp`) —
хранение локальное, как и предписывает ADR-006. Нормализация не молча —
issue `date_normalized` (спецификация v1.0 §19).

**Проверка фикса:** тесты 82 → **84** (+2 TZ-регрессии); матрица часовых поясов —
**UTC, Europe/Moscow (+3), Pacific/Kiritimati (+14), Pacific/Niue (−11): везде 84/84**;
typecheck/build/корневой check — зелёные.

**Попутно — аудит зависимостей:** `npm audit` у вас показал 6 уязвимостей
(2 critical — tinypool). Все — в dev-инструментарии vitest и **не попадают в бандл**
плагина (runtime-зависимостей у плагина ноль). Тем не менее обновлено:
**vitest 2.1.9 → 4.1.12**, `npm audit` — **0 уязвимостей**; все 84 теста зелёные
на vitest 4.

## Состав патча

| Путь | Что изменилось |
|---|---|
| `plugin/src/core/datetime.ts` | `normalizeDateScalarText` (лексическая нормализация), `formatDateUTC`/`formatDateTimeUTC`, `isUtcMidnight`; fallback-функции переведены на UTC-геттеры; `nowStamp`/`formatDateTimeLocal` не изменились (новые метки — локальные) |
| `plugin/src/core/markdown-parser.ts` | `rawScalarFor` + `normalizeDateWithRaw`: двухуровневая нормализация для свойств и `created_at`/`updated_at` |
| `plugin/tests/unit/datetime.test.ts` | +тесты `normalizeDateScalarText`; fallback-тесты переведены на `Date.UTC`-конструкции (TZ-независимы) |
| `plugin/tests/unit/parser.test.ts` | +тест TZ-регрессии (date-only и скаляр со смещением `+03:00`) |
| `plugin/manifest.json`, `plugin/versions.json`, `plugin/package.json`, `plugin/package-lock.json` | версия **0.1.1**; vitest ^4.1.12 (lock обновлён) |
| `docs/decisions/decision-log.md` | **v1.36.0**: раздел + запись **DL-245** |
| `docs/changelog/CHANGELOG.md` | **[1.0.2] + «Исправлено»** (док. v0.30.1) |
| `docs/CHECKPOINT.md` | **v42.1.0**: §6.57, frontmatter (next_step), §12 (плагин 0.1.1), §14 |
| `docs/project-map/PROJECT_MAP.md` | **v1.33.0**: §3/§8 (фикс, amend-рекомендация), §10 (плагин 0.1.1) |
| `docs/plugin/architecture.md` | **v0.2.0**: конвенция двухуровневой нормализации дат + плашка ограничения (Date в списках — допроверка в A2) |
| `docs/glossary/glossary.md` | **v1.20.0**: +термин «UTC» → **272 активных** (289 всего) |
| `README.md` (корень) | счётчик тестов 82 → 84 |
| `docs/handoff/2026-10-24-a1-fix-datetime.md` | этот документ |

## Сообщение коммита

```text
fix(plugin): 0.1.1 — TZ-баг нормализации дат из YAML: лексический уровень из сырого текста; vitest 4.1.12 (аудит 0) (DL-245)

- диагноз: js-yaml разбирает некавычные метки времени как UTC; нормализация A1
  форматировала Date локальными геттерами — на машине UTC+3 даты съезжали на +3ч
  («2026-09-14» → «2026-09-14T03:00»); в песочнице TZ=UTC не воспроизводилось,
  воспроизведено под TZ=Europe/Moscow
- datetime.ts: normalizeDateScalarText (лексика: date-only как есть, datetime до
  минут, секунды и смещение отбрасываются — ADR-006), formatDateUTC/formatDateTimeUTC;
  fallback normalizeDateValue/normalizeSystemDateTime — UTC-геттеры; новые метки
  по-прежнему локальные (nowStamp)
- markdown-parser.ts: rawScalarFor + normalizeDateWithRaw — двухуровневая
  нормализация свойств и created_at/updated_at; ограничение (Date в списках —
  fallback, допроверка parseYaml Obsidian в A2) — architecture.md v0.2.0
- тесты: +2 (TZ-регрессия, лексика) → 84; матрица TZ: UTC / Europe/Moscow /
  Pacific/Kiritimati (+14) / Pacific/Niue (−11) — везде 84/84
- vitest 2.1.9 → 4.1.12: npm audit 6 (2 critical, dev-инструментарий) → 0
- версии: manifest/versions/package 0.1.1
- учёты: decision log v1.36.0 (DL-245), CHANGELOG [1.0.2]+Исправлено (v0.30.1),
  PROJECT_MAP v1.33.0, architecture v0.2.0, glossary v1.20.0 (+UTC, 272 активных),
  README, CHECKPOINT v42.1.0
- проверки: tsc --noEmit чисто, npm run build OK, корневой npm run check 72 OK,
  0 FAIL; E2E на свежем клоне c44172d зелёный
```

## Проверено в песочнице (E2E)

Свежий клон `c44172d` → `git apply` → `npm ci` → `npm test` **84/84**
(включая прогон под TZ=Europe/Moscow) → `npm audit` **0** → `npm run typecheck` →
`npm run build` → корневой `npm run check` **72 OK, 0 FAIL** → дерево побайтово
равно снимку песочницы.
