---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2BZ
type: book
title: Сломанная карточка
aliases:
  - Сломанная карточка
created_at: 2026-10-23T17:35
updated_at: 2026-10-23T17:35
author: []
read_status: read
rating: 0
format: file
file_format: docx
publication_year: 2200
cover: "[[PERSON-01J8Z6M4K2Q7V9X3N5B0C1D2EF.md|Не обложка]]"
categories:
  - "[[CATEGORY-01J8Z6M4K2Q7V9X3N5B0C1D2EN.md|Фантастика]]"
---

**Некорректный** экземпляр `book` (батч 6, D4). Разбор:

| Нарушение | Правило | Кто ловит |
|---|---|---|
| `author: []` — пустой список | `book.author.required` | **схема** (`minItems: 1`) |
| `rating: 0` — вне диапазона | `book.rating.range` | **схема** (`integer 1–10`) |
| `file_format: docx` — нет в 9 значениях | `value.allowed_values` | **схема** (`enum`, §3.17.4) |
| `publication_year: 2200` | диапазон 1–2100 | **схема** (`maximum`) |
| `cover` → PERSON (не обёртка media) | `value.reference.target_type` | **схема** (`link_media`) + runner |
| Категория не из фасета `genre` (гипотетически) | `book.genre.cardinality` | runner (межобъектное) |

Схема: `schema/entities/book.schema.json`.
