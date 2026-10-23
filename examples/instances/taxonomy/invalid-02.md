---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2TY
type: taxonomy
title: Таксономия без фасетов
aliases:
  - Таксономия без фасетов
created_at: 2026-10-23T18:14
updated_at: 2026-10-23T18:14
assignment_cardinality: many
root_requirement_min: -1
---

**Некорректный** экземпляр `taxonomy` (батч 6, D4). Разбор:

| Нарушение | Правило | Кто ловит |
|---|---|---|
| Нет `facets` | обязательность (`min_one`) | **схема** (`required`) |
| `assignment_cardinality: many` | `value.allowed_values` | **схема** (`cardinality`) |
| `root_requirement_min: -1` | неотрицательность | **схема** (`minimum: 0`) |

Схема: `schema/metamodel/taxonomy.schema.json`.
