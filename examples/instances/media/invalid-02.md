---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2BX
type: media
title: Сломанная обёртка
aliases:
  - Сломанная обёртка
created_at: 2026-10-23T17:37
updated_at: 2026-10-23T17:37
file: Attachments/photo.jpg
role:
  - cover
  - обложка
creation_method:
  - paint
origin:
  - clipboard
  - vault
ai_steps: "32"
---

**Некорректный** экземпляр `media` (батч 6, D4). Разбор:

| Нарушение | Правило | Кто ловит |
|---|---|---|
| Нет `media_kind` | `media.kind.enum` / обязательность | **схема** (`required`) |
| `file` — голый путь без `[[ ]]` | формат `file_link` | **схема** (паттерн) |
| `role: обложка` — кириллица (рядом с валидным `cover`) | `media.roles.enum` | **схема** (`enum` 13 значений) |
| `creation_method: paint` — нет в 8 | `media.creation_method.enum` | **схема** (`enum`, §3.17.6) |
| `origin` — список из двух (0..1) | `value.cardinality` | **схема** (`maxItems: 1`) |
| `ai_steps: "32"` — строка | `value.type_conformance` | **схема** (`type: number`) |
| Файла нет в хранилище / уже обёрнут | `media.file.exists`, `media.file.single_wrapper` | runner (error, межобъектные) |

Схема: `schema/entities/media.schema.json`.
