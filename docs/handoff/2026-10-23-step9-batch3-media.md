---
doc_type: handoff
title: "Передача: шаг 9, батч 3, часть 1 — схема media + теневые/служебные поля book/person"
status: actual
created: 2026-10-23
metamodel_version: 0.25.0
covers: DL-229
tags: [handoff, commit]
---

# Передача изменений — 2026-10-23, шаг 9, батч 3, часть 1 (`media`)

> [!info] Что делать
> Батч 2 уже в вашем репозитории (`bbf7803`). Изменения этой части — в патче
> **`batch3-media.patch`** (сгенерирован относительно `bbf7803`, только часть 3 — без батча 2).
> Применить в корне вашего клона:
>
> ```bash
> git apply --stat batch3-media.patch   # посмотреть состав
> git apply batch3-media.patch          # применить
> npm install && npm run check          # ожидается: Скомпилировано схем: 10 … ИТОГ: 10 OK, 0 FAIL
> ```
>
> Коммит делаете **вы** с предложенным ниже сообщением. Часть 2 батча 3 (`chapter`) пойдёт
> отдельным патчем после ответа на вопрос 9-8 — тогда же поднимется версия метамодели
> до **0.26.0** и будет создан общий handoff батча 3.

## Новые файлы

| Файл | Что это |
|---|---|
| `schema/entities/media.schema.json` | схема слоя 3 «обёртка файла»: 16 базовых + 19 условных свойств (триггер `creation_method`, `includes_any`) + 2 теневых (`ai_base_image_file`, `source_materials_file`); обязательны `file` (`file_link`) и `media_kind`; enum'ы: `media_kind` 5, `role` 13, `creation_method` 8 (закрыто, DL-155), `origin` 7 (предварительно, DL-145); `scan_dpi` > 0 (`media.scan.dpi_positive`); И8 — свойство тела, схема его не видит (runner) |
| `examples/instances/media/valid-01-book-cover-ai.md` | корректный: обложка книги `photo`+`ai_generated` — воспроизводимость генерации (`ai_model`/`ai_prompt`/`ai_seed`/`ai_steps`), И8 в теле, три поля авторства |
| `examples/instances/media/valid-02-screenshot.md` | корректный: свободный скриншот — обёртка без исходящих связей (§5 карточки), `origin: clipboard` |
| `examples/instances/media/invalid-01.md` | некорректный: разбор 11 нарушений с колонкой «кто ловит — схема/runner» |
| `docs/handoff/2026-10-23-step9-batch3-media.md` | этот файл |

## Изменённые файлы

| Файл | Что изменилось |
|---|---|
| `schema/common/defs.json` | **+2 `$defs` → 25**: `file_link` (wikilink на вложение; каноническая ссылка на заметку `{TYPE_PREFIX}-{ULID}.md` отклоняется через `not`) и `service_props` (`sb_issues`, формат «{rule_id}: {severity}» — DL-168). Пересчёт: батч 1 фактически содержал **19** `$defs`, а не «13» (список DL-223 всегда перечислял 19 пунктов; исправление по образцу DL-150/228) |
| `schema/entities/book.schema.json` | +`cover_file` (теневое, DL-144/153), +`service_props` в `allOf`; `file_path` переведён с простой строки на `file_link` |
| `schema/entities/person.schema.json` | +`portrait_file` (теневое), +`service_props` в `allOf` |
| `docs/glossary/glossary.md` | v1.15.0 — +1 термин («регрессионная проверка») → **263 активных** |
| `docs/decisions/decision-log.md` | v1.24.0 — **DL-229** (батч 3, часть 1: media, теневые/служебные поля, file_link, пересчёт $defs; вопрос 9-8 вынесен) |
| `docs/CHECKPOINT.md` | v32.1.0 — §6.45 (батч 3 в работе: media ✅, chapter ждёт 9-8), артефакты, история |

## Удалённые файлы

Нет.

## Предложенное сообщение коммита

```text
feat(schema): шаг 9, батч 3 ч.1 — схема media + теневые/служебные поля book/person (DL-229)

- schema/entities/media.schema.json: 16 базовых + 19 условных свойств
  (триггер creation_method, includes_any — DL-141) + 2 теневых
  (ai_base_image_file, source_materials_file); обязательны file и media_kind;
  enum'ы: media_kind 5, role 13, creation_method 8 (закрыто, DL-155),
  origin 7 (предварительно, DL-145); scan_dpi > 0 — единственное error-правило
  диапазона; И8 — свойство тела: схема не видит, проверяет runner
- defs.json +2 $defs → 25: file_link (ссылка на заметку в канонической форме
  отклоняется через not — file и *_file указывают на вложения) и service_props
  (sb_issues, формат «{rule_id}: {severity}» — DL-168); пересчёт: батч 1
  содержал 19 $defs, не 13 (исправление счётчика по образцу DL-150/228)
- схемы батча 2 дополнены принятыми нормами: book + cover_file,
  person + portrait_file (теневые, DL-144/153 — иначе плагинные поля
  «вне схемы» и TS-типы D2 неполны), file_path → file_link, обе + service_props
- examples/instances/media: обложка (photo+ai_generated, ai_*-поля, И8 в теле),
  свободный скриншот, некорректный пример с разбором 11 нарушений «схема/runner»
- проверка: 10 схем компилируются, примеры 10/10, ad-hoc фикстуры 27/27
  (включая регрессию book/person после дополнений)
- глоссарий +1 (регрессионная проверка) → 263; decision log v1.24.0 (DL-229);
  CHECKPOINT v32.1.0
- часть 2 батча 3 (chapter) — после решения вопроса 9-8; версия 0.26.0
  поднимется с завершением батча
```

## Дальше

**Часть 2 батча 3**: `schema/entities/chapter.schema.json` + примеры + регистрация
`draft_status` в `05-enumerations` §3.17.11 (4 значения, по образцу DL-226) + счётчики
26/24 + версия **0.26.0** + CHANGELOG + общий handoff батча 3. Блокирует часть 2 только
**вопрос 9-8**: `chapter_number` обязателен всегда (Б) или только при `is_front_matter ≠ true`
(А — рекомендация: согласуется с §5/§10-1 карточки и правилом `chapter.number.positive`).

Затем батч 4 — `project` + `knowledge` (+ `work`/`activity` как `$defs`), батч 5 — связи
`.jsonl`, батч 6 — примеры D3/D4 до минимумов и шаблоны D5 сводно.
