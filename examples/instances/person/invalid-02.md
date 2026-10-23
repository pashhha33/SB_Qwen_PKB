---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2BY
type: person
title: Сломанная анкета
aliases:
  - Сломанная анкета
created_at: 2026-10-23T17:36
updated_at: 2026-10-23T17:36
role: []
gender: unknown
links: "https://example.org"
also_known_as: С. Мартынчик
portrait: "[[BOOK-01J8Z6M4K2Q7V9X3N5B0C1D2F3.md|Не портрет]]"
---

**Некорректный** экземпляр `person` (батч 6, D4). Разбор:

| Нарушение | Правило | Кто ловит |
|---|---|---|
| `role: []` — пусто при обязательном мультивыборе | `person.role.required` | **схема** (`minItems: 1`) |
| `gender: unknown` — нет в 3 значениях | `value.allowed_values` | **схема** (`enum`, §3.17.10) |
| `links` скаляром вместо списка (0..N) | `value.cardinality` | **схема** (`type: array`) |
| `also_known_as` скаляром (0..N) | `value.cardinality` | **схема** (`type: array`) |
| `portrait` → книга (не обёртка media) | `value.reference.target_type` | **схема** (`link_media`) + runner |
| `links` без http(s)-проверки прошла бы схему | `person.links.format` | runner (warning) |

Схема: `schema/entities/person.schema.json`.
