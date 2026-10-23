---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2BA
type: book
title: Бумажное сердце
aliases:
  - Бумажное сердце
created_at: 2026-10-23T17:05
updated_at: 2026-10-23T17:05
author:
  - "[[PERSON-01J8Z6M4K2Q7V9X3N5B0C1D2EF.md|Михаил Булгаков]]"
first_published_on: "1840-00-00"
publication_year: 1840
pages: 312
isbn: 978-5-17-087438-1
read_status: planned
format: print
categories:
  - "[[CATEGORY-01J8Z6M4K2Q7V9X3N5B0C1D2EN.md|Фантастика]]"
---

Корректный экземпляр `book`, формат `print` (батч 6, D3).

- у `print` **нет условных свойств** (DL-122/228: `pages`/`isbn`/`publisher` — базовые);
- частичная дата `"1840-00-00"` — известен только год (06-time-and-intervals §2);
- `read_status: planned` — значение по умолчанию (подставляется при создании);
- `isbn` схема не проверяет (формат ISBN-10/13 — warning `book.isbn.format`, runner);
- жанровая категория обязательна (`categories` minItems 1; принадлежность фасету `genre` — runner).

Схема: `schema/entities/book.schema.json`.
