---
doc_type: handoff
title: "Передача: шаг 9, батч 3, часть 2 — схема chapter (ответ А на 9-8), draft_status, счётчики; v2 — с Windows-исправлением прогонщика"
status: actual
created: 2026-10-23
metamodel_version: 0.26.0
covers: DL-230, DL-231, DL-232
tags: [handoff, commit]
---

# Передача изменений — 2026-10-23, шаг 9, батч 3, часть 2 (`chapter`)

> [!info] Что делать (v2 — заменяет прежнюю инструкцию)
> Использовать патч **`batch3-chapter-v2.patch`** (прежний `batch3-chapter.patch` устарел —
> не содержит Windows-исправление прогонщика, DL-232). Часть 1 батча 3 уже в вашем
> репозитории (`a45fe0f`). Чтобы не гадать, что уже применено, идём детерминированным
> путём: возврат к закоммиченному состоянию → применение v2. Команды для
> **Windows PowerShell 5.1** — построчно (`&&` не поддерживается; ignored-файлы
> `node_modules/` и `*.patch` команда `git clean -fd` **не трогает**):
>
> ```powershell
> # 0. Вернуть рабочую копию к последнему коммиту (a45fe0f)
> git checkout -- .
> git clean -fd
>
> # 1. Применить v2-патч (часть 2 + Windows-исправление прогонщика)
> git apply --ignore-whitespace batch3-chapter-v2.patch
>
> # 2. Проверка (ожидание: Скомпилировано схем: 11 … ИТОГ: 13 OK, 0 FAIL)
> npm install
> npm run check
>
> # 3. Закоммитить (сообщение ниже)
> git add -A
> git commit
> ```
>
> Если шаг 1 сообщает «already exists / does not apply» — шаг 0 выполнен не полностью
> или патч уже применён; диагностика: `git apply -R --check batch3-chapter-v2.patch`
> (нет ошибок = применён полностью). Коммит делаете **вы**.

## Новые файлы

| Файл | Что это |
|---|---|
| `schema/entities/chapter.schema.json` | схема слоя 3 «Глава»: 6 свойств; **условный `required` для `chapter_number`** (if/then/else): обязателен при `is_front_matter ≠ true` (DL-230, ответ А на 9-8); `draft_status` — enum 4 (§3.17.11); связи с произведением во frontmatter нет — `contains` (reified) в `.sb/relations/*.jsonl` (ADR-010), семантика глав у runner'а |
| `examples/instances/chapter/valid-01-numbered.md` | корректный: глава 7 веб-новелы «Путь Восхождения» (согласована с `book/valid-02-web-novel.md`), блок `sb-chapter-nav` в теле, `draft_status: final` |
| `examples/instances/chapter/valid-02-front-matter.md` | корректный: пролог — `is_front_matter: true`, **без номера** (демонстрация нормы DL-230), `title` задан ролью |
| `examples/instances/chapter/invalid-01.md` | некорректный: разбор 11 нарушений с колонкой «кто ловит — схема/runner» |
| `docs/handoff/2026-10-23-step9-batch3-chapter.md` | этот файл |

## Изменённые файлы

| Файл | Что изменилось |
|---|---|
| `docs/metamodel/05-enumerations.md` | v0.13.0 — **+§3.17.11 `draft_status`** (outline/draft/revised/final, закрыто — DL-231, по образцу DL-226: жило только в карточке `chapter`); сводная таблица и счётчики → **26 перечислений, 24 закрыто**; история |
| `scripts/check-examples.cjs` | **Windows-исправление (DL-232):** ключи схем строятся штатным `pathToFileURL()` вместо склейки `file://` + путь — на Windows литеральный путь (`D:\\…`, пробелы, кириллица) давал невалидный URI и крах ajv «URI authority must not contain a literal backslash»; на Linux/macOS поведение не изменилось |
| `docs/glossary/glossary.md` | v1.17.0 — +2 термина («условная обязательность (if/then/else)», «file URL») → **265 активных** |
| `docs/validation/rules.md` | v0.11.2 — **область И7 и `chapter.title.fallback` уточнена по DL-230**: только нумерованные части (у `is_front_matter: true` заголовок задаётся ролью); состав **167 правил не менялся** |
| `docs/metamodel/entities/chapter.md` | §3: `chapter_number` — «да, условно» (DL-230), кардинальности приведены к закрытому словарю ADR-006 (`single` → `1`/`0..1` — устаревшее обозначение), `draft_status` → ссылка на §3.17.11; §10: **вопрос 1 закрыт** (А, DL-230), вопрос 2 помечен (схема следует рекомендации — тип `number`, дробные допустимы); история |
| `docs/decisions/decision-log.md` | v1.26.0 — **DL-230** (ответ А: условная обязательность номера; уточнение И7), **DL-231** (часть 2 создана; `draft_status` зарегистрирован; проверка 11/13/19), **DL-232** (Windows-исправление прогонщика) |
| `docs/changelog/CHANGELOG.md` | v0.23.0 — запись **[0.26.0]** (весь батч 3: `media` + `chapter` + `defs` + теневые/служебные + `draft_status` + пересчёт `$defs` 19/25 + счётчики) |
| `docs/glossary/glossary.md` | v1.16.0 — +1 термин («условная обязательность (if/then/else)») → **264 активных** |
| `README.md` (корень) | 26 перечислений (24 закрыто); глоссарий 265 |
| `docs/README.md` | v0.3.5 — дерево: `schema/entities/` (book, person, media, chapter), `examples/instances/` (+media, chapter), реестр 26/24 |
| `docs/metamodel/00-overview.md` | v0.4.4 — «модель в числах»: перечислений 26 (24 закрыто) |
| `docs/roadmap/mvp-scope.md` | v0.11.2 — счётчик перечислений 26/24 |
| `docs/roadmap/readiness-checklist.md` | v0.20.3 — сноски D1 (батч 3 готов, 11 схем), D3/D4 (media, chapter — по 2+1; примеры 13/13), A5 (26/24) |
| `docs/project-map/PROJECT_MAP.md` | v1.24.0 — шаг 9: батч 3 готов; инвентарь: +строка схем `media`/`chapter`, примеры (12), defs 25; версии 0.26.0 / 1.24.0; глоссарий 265; строка D |
| `docs/CHECKPOINT.md` | **v33.1.0** — §6.46 (батч 3 завершён), §6.47 (Windows-исправление, DL-232), артефакты, версии, прогресс D, история; `next_step` — батч 4 (`project`+`knowledge`) |

## Удалённые файлы

Нет.

## Предложенное сообщение коммита

```text
feat(schema): шаг 9, батч 3 ч.2 — схема chapter (9-8 ответ А), draft_status, 0.26.0

- решение DL-230 (ответ А на вопрос 9-8): chapter_number обязателен только при
  is_front_matter ≠ true — условный required в схеме через if/then/else;
  И7/chapter.title.fallback действуют только для нумерованных частей
  (rules.md v0.11.2, 167 правил — состав не менялся); карточка chapter:
  вопрос 1 закрыт, кардинальности §3 приведены к словарю ADR-006
- schema/entities/chapter.schema.json: 6 свойств; draft_status enum 4;
  связь с произведением (contains, reified) — в .sb/relations/*.jsonl,
  не во frontmatter (ADR-010): семантика глав у validation-runner
- 05-enumerations v0.13.0: зарегистрирован §3.17.11 draft_status (по образцу
  DL-226) → 26 перечислений, 24 закрыто; счётчики в шести живых учётах
- examples/instances/chapter: глава 7 веб-новелы (согласована с book/valid-02,
  sb-chapter-nav в теле), пролог без номера (демонстрация DL-230), некорректный
  с разбором 11 нарушений «схема/runner»
- проверка: 11 схем компилируются, примеры 13/13, ad-hoc 19/19 (матрица
  условного required, регрессия book/person/media)
- Windows-исправление прогонщика (DL-232): pathToFileURL вместо склейки file:// + путь —
  на Windows ajv падал с "URI authority must not contain a literal backslash";
  найдено в среде пользователя (PowerShell 5.1, Node v24.15.0)
- глоссарий +3 (регрессионная проверка, условная обязательность, file URL) → 265;
  CHANGELOG [0.26.0]; decision log v1.26.0 (DL-230/231/232); CHECKPOINT v33.1.0;
  далее — батч 4: project + knowledge
```

## Дальше

**Батч 4**: `schema/entities/project.schema.json` + `schema/entities/knowledge.schema.json`
(+ `work`/`activity` как `$defs`, если понадобятся) с примерами сразу. По ходу батча 4
потребуется решение по составу `project_status` (перечисление предварительное: 5 значений
или добавить `blocked`/`backlog` — вопрос 9.1 карточки `project`). Затем батч 5 — связи
`.jsonl` (`schema/relations/`: строка `contains` с `order`/`role`, `authorship`, `ownership`,
`related_to`), батч 6 — примеры D3/D4 до минимумов и шаблоны D5 сводно.
