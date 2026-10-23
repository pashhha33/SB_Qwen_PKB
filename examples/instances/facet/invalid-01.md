---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2FZ
type: facet
title: Сломанный фасет
aliases:
  - Сломанный фасет
created_at: 2026-10-23T18:23
updated_at: 2026-10-23T18:23
taxonomy:
  - "[[TAXONOMY-01J8Z6M4K2Q7V9X3N5B0C1D2TA.md|Классификация книг]]"
  - "[[TAXONOMY-01J8Z6M4K2Q7V9X3N5B0C1D2TB.md|Контекст]]"
assignment_cardinality: 0..M
---

**Некорректный** экземпляр `facet` (батч 6, D4). Разбор:

| Нарушение | Правило | Кто ловит |
|---|---|---|
| `taxonomy` — две таксономии (0..1) | «принадлежность максимум одной» (ADR-007) | **схема** (`maxItems: 1`) |
| `assignment_cardinality: 0..M` | `value.allowed_values` | **схема** (`cardinality`) |

Схема: `schema/metamodel/facet.schema.json`.
