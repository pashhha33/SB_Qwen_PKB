---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2BV
type: project
title: Сломанный проект
aliases:
  - Сломанный проект
created_at: 2026-10-23T17:39
updated_at: 2026-10-23T17:39
status: blocked
owner:
  - "[[PERSON-01J8Z6M4K2Q7V9X3N5B0C1D2EF.md|Михаил Булгаков]]"
  - "[[PERSON-01J8Z6M4K2Q7V9X3N5B0C1D2ES.md|Аркадий Северов]]"
progress: 60.5
started_on: "2026-13-01"
---

**Некорректный** экземпляр `project` (батч 6, D4). Разбор:

| Нарушение | Правило | Кто ловит |
|---|---|---|
| `status: blocked` — значение НЕ введено (DL-234) | `project.status.enum` | **схема** (`enum` 5 значений). Блокировка = `paused` + `paused_reason` |
| `owner` — два человека при кардинальности `1` | `value.cardinality` | **схема** (`maxItems: 1`) |
| `progress: 60.5` — не целое | `project.progress.range` | **схема** (`integer 0–100`) |
| `started_on: "2026-13-01"` — месяц 13 | `date.range.valid` | **схема** (паттерн `date`) |
| Два владельца семантически | `ownership` `subject_to_object: 1` | runner (error, связь) |

Схема: `schema/entities/project.schema.json`.
