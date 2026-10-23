---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2TZ
type: taxonomy
title: Сломанная таксономия
aliases:
  - Сломанная таксономия
created_at: 2026-10-23T18:13
updated_at: 2026-10-23T18:13
facets: []
hierarchy_mode: free
---

**Некорректный** экземпляр `taxonomy` (батч 6, D4). Разбор:

| Нарушение | Правило | Кто ловит |
|---|---|---|
| `facets: []` — пустой список | `taxonomy.facets.min_one` | **схема** (`minItems: 1`) |
| `hierarchy_mode: free` — нет в 2 значениях | `value.allowed_values` | **схема** (`enum`, §3.5) |
| Фасет, объявленный здесь, не ссылается обратно | согласованность `taxonomy.facets` ↔ `facet.taxonomy` | runner (межобъектное) |

Схема: `schema/metamodel/taxonomy.schema.json`.
