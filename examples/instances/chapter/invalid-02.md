---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2BW
type: chapter
title: Глава без номера
aliases:
  - Глава без номера
created_at: 2026-10-23T17:38
updated_at: 2026-10-23T17:38
is_front_matter: false
draft_status: published
word_count: много
---

**Некорректный** экземпляр `chapter` (батч 6, D4). Разбор:

| Нарушение | Правило | Кто ловит |
|---|---|---|
| Нет `chapter_number` при `is_front_matter: false` | условная обязательность (DL-230, вопрос 9-8 ответ А) | **схема** (if/then/else — ветвь else) |
| `draft_status: published` — нет в 4 значениях | `value.allowed_values` | **схема** (`enum`, §3.17.11) |
| `word_count: много` — текст | `value.type_conformance` | **схема** (`type: number`) |
| `title: «Глава без номера»` при пустом `chapter_title` | `chapter.title.fallback` (И7: ожидается «Глава {N}» — но номер отсутствует, правило неприменимо до его появления) | runner (error) |
| Нет связи `contains` с произведением | `chapter.contains.required` | runner (error; `.sb/relations/`) |

Если бы `is_front_matter` был `true` (или отсутствовал ключ при номере) — схема
пропустила бы файл: обязательность номера **условна** (DL-230).

Схема: `schema/entities/chapter.schema.json`.
