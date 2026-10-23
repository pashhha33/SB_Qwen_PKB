---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2PZ
type: property
title: Сломанная ссылка
aliases:
  - Сломанная ссылка
created_at: 2026-10-23T17:55
updated_at: 2026-10-23T17:55
key: editor
label: Редактор
value_type: object_reference
cardinality: "1"
required: false
scope: specific
---

**Некорректный** экземпляр `property` (батч 6, D4). Разбор:

| Нарушение | Правило | Кто ловит |
|---|---|---|
| `object_reference` без `target_types` | обязательность для ссылок (04-attributes §4) | **схема** (if/then батча 1) |
| `object_reference` без `link_mode` | ADR-009 Р2: способ хранения объявляется в свойстве | **схема** (if/then) |
| `cardinality: "1"` + `required: false` | `property.required.cardinality_consistency` | **схема** (4 ветки согласованности) |
| Целевой тип не существует (когда будет указан) | `value.reference.target_type` | runner (межобъектное) |

Схема: `schema/metamodel/property.schema.json`.
