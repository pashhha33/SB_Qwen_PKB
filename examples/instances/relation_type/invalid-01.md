---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2RZ
type: relation_type
title: Сломанный тип отношения
aliases:
  - Сломанный тип отношения
created_at: 2026-10-23T18:03
updated_at: 2026-10-23T18:03
key: employment
label: Работа в
forward_label: работает в
direction: both
subject_to_object: 0..N
object_to_subject: 0..N
uniqueness_rule: triple
---

**Некорректный** экземпляр `relation_type` (батч 6, D4). Разбор:

| Нарушение | Правило | Кто ловит |
|---|---|---|
| Нет `reverse_label` | Р8: обе метки обязательны (автообразование отклонено) | **схема** (`required`) |
| `direction: both` — нет в 2 значениях | `value.allowed_values` | **схема** (`enum`: `directed`/`symmetric`, §3.6) |

Схема: `schema/metamodel/relation_type.schema.json`.
