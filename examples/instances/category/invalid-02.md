---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2CY
type: category
title: Ещё одна сломанная категория
aliases:
  - Ещё одна сломанная категория
created_at: 2026-10-23T18:34
updated_at: 2026-10-23T18:34
facet:
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2FA.md|Не фасет]]"
parent: "[[CATEGORY-01J8Z6M4K2Q7V9X3N5B0C1D2EN.md|Фантастика]]"
---

**Некорректный** экземпляр `category` (батч 6, D4). Разбор:

| Нарушение | Правило | Кто ловит |
|---|---|---|
| `facet` → `OBJECT_TYPE-….md` (определение типа, не фасет) | `category.facet.required` по цели | **схема** (`link_facet`: только `FACET-….md`) |
| `parent` — скаляр вместо списка | «непосредственные родители — список» (01-classification §6) | **схема** (`type: array`) |
| Родитель из другого фасета (когда будет ссылкой) | `category.parent.same_facet` | runner (межобъектное) |
| Цикл в иерархии (гипотетически) | `category.cycle.forbidden` | runner (error) |

Схема: `schema/metamodel/category.schema.json`.
