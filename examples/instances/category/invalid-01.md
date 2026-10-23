---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2CZ
type: category
title: Сломанная категория
aliases:
  - Сломанная категория
created_at: 2026-10-23T18:33
updated_at: 2026-10-23T18:33
taxonomy:
  - "[[TAXONOMY-01J8Z6M4K2Q7V9X3N5B0C1D2TA.md|Классификация книг]]"
---

**Некорректный** экземпляр `category` (батч 6, D4). Разбор:

| Нарушение | Правило | Кто ловит |
|---|---|---|
| Ключ `taxonomy` присутствует | **П8** (ADR-007): категория не ссылается на таксономию напрямую | **схема** (`not: required [taxonomy]` / `category.taxonomy_direct.forbidden`) |
| Нет `facet` | `category.facet.required` | **схема** (`required`) |
| Два фасета (если бы задано) | `category.facet.single` | **схема** (`maxItems: 1`) |

Схема: `schema/metamodel/category.schema.json`.
