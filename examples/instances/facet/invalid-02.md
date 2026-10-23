---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2FY
type: facet
title: Ещё один сломанный фасет
aliases:
  - Ещё один сломанный фасет
created_at: 2026-10-23T18:24
updated_at: 2026-10-23T18:24
hierarchy_mode: free
root_requirement_min: -1
allowed_object_types:
  - "[[PERSON-01J8Z6M4K2Q7V9X3N5B0C1D2EF.md|Михаил Булгаков]]"
---

**Некорректный** экземпляр `facet` (батч 6, D4). Разбор:

| Нарушение | Правило | Кто ловит |
|---|---|---|
| `hierarchy_mode: free` — нет в 2 значениях | `value.allowed_values` | **схема** (`enum`, §3.5) |
| `root_requirement_min: -1` | неотрицательность | **схема** (`minimum: 0`) |
| `allowed_object_types` → **экземпляр** человека | ссылка ведёт на **определение** типа (`OBJECT_TYPE-….md`) — находка батча 1 | **схема** (`link_object_type`) |
| `root_requirement_max` < `min` (если бы задано) | `facet.root_requirement.max_gte_min` | runner (сравнение двух полей) |

Схема: `schema/metamodel/facet.schema.json`.
