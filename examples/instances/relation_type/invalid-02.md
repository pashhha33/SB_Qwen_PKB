---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2RY
type: relation_type
title: Ещё один сломанный тип
aliases:
  - Ещё один сломанный тип
created_at: 2026-10-23T18:04
updated_at: 2026-10-23T18:04
key: Member_of
label: Участие
forward_label: состоит в
reverse_label: участник
direction: directed
subject_to_object: many
object_to_subject: 0..N
uniqueness_rule: double
---

**Некорректный** экземпляр `relation_type` (батч 6, D4). Разбор:

| Нарушение | Правило | Кто ловит |
|---|---|---|
| `key: Member_of` — заглавные | ADR-003 (английский `snake_case`) | **схема** (паттерн `type_key`) |
| `subject_to_object: many` | `value.allowed_values` | **схема** (`cardinality`: `1`/`0..1`/`0..N`/`1..N`) |
| `uniqueness_rule: double` | `value.allowed_values` | **схема** (`enum`: `pair`/`triple`/`none`, §3.7) |
| Симметричные метки не совпадают (если бы `direction: symmetric`) | `relation_type.symmetric.labels_equal` | runner (warning — сравнение двух строк) |

Схема: `schema/metamodel/relation_type.schema.json`.
