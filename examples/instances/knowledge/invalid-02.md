---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2BT
type: knowledge
title: Сломанное знание
aliases:
  - Сломанное знание
created_at: 2026-10-23T17:40
updated_at: 2026-10-23T17:40
source:
  - Статья А
  - Статья Б
tags: нейронауки
related_to:
  - "[[CHP-01J8Z6M4K2Q7V9X3N5B0C1D2F8.md|Глава 7]]"
---

Тезис есть, но frontmatter сломан.

**Некорректный** экземпляр `knowledge` (батч 6, D4). Разбор:

| Нарушение | Правило | Кто ловит |
|---|---|---|
| `source` — список при `0..1` | `value.cardinality` | **схема** (`type: string`) |
| `tags` — скаляр вместо списка | формат системного атрибута | **схема** (`system_core`: array) |
| `related_to` → глава (`CHP-`) — не в 4 целях | `value.reference.target_type` | **схема** (anyOf knowledge/book/person/project) + runner |
| Пустое тело? (здесь непустое) | `knowledge.body.not_empty` | runner (warning) — схема тело не видит |

Схема: `schema/entities/knowledge.schema.json`.
