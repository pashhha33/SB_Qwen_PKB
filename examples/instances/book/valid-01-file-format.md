---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2F3
type: book
title: The Master and Margarita
aliases:
  - The Master and Margarita
  - Мастер и Маргарита
created_at: 2026-10-22T14:35
updated_at: 2026-10-23T11:20
author:
  - "[[PERSON-01J8Z6M4K2Q7V9X3N5B0C1D2EF.md|Михаил Булгаков]]"
first_published_on: "1966-00-00"
publication_year: 1967
pages: 480
read_status: read
rating: 7
format: file
finished_on: "2026-09-14"
file_format: epub
categories:
  - "[[CATEGORY-01J8Z6M4K2Q7V9X3N5B0C1D2EN.md|Фантастика]]"
tags:
  - перечитать
---

Корректный экземпляр `book`, формат `file` (батч 2, D3).

Что демонстрирует:

- обязательные поля: системная шапка, `author` (1..N), `read_status`, `format`;
- условное свойство формата `file`: `file_format` (`file_path` не заполнен — свойство
  необязательное; значение законно и при другом `format` — меры М1/М2, схема не гейтит);
- частичная дата: `first_published_on: "1966-00-00"` — известен только год
  (`06-time-and-intervals` §2);
- `rating: 7` — целое 1–10; в режиме `view` рисуется `★★★★★★★☆☆☆ 7/10`
  (`display.renderer: stars`, DL-115/116/123); сами символы ⭐ в данных не хранятся (DL-117);
- `categories` — минимум одна категория (жанровый фасет обязателен, DL-119/126);
  принадлежность категории фасету `genre` проверит runner (`book.genre.cardinality`).

**Конвенция батча 2:** значения-даты (`"1966-00-00"`, `"2026-09-14"`) заключены в кавычки —
YAML-разбор (js-yaml, как и metadataCache Obsidian) превращает дату без кавычек в объект `Date`,
а норма хранения — строка `YYYY-MM-DD`. `created_at`/`updated_at` без секунд (`T14:35`)
остаются строкой и без кавычек (метка времени YAML требует секунд) — конвенция батча 1.

Имя файла примера — демонстрационное; инвариант И2 (`id` ↔ имя файла) применяется
к реальным заметкам хранилища, а не к папке `examples/`.

- Схема: `schema/entities/book.schema.json`.
- Карточка типа: `docs/metamodel/entities/book.md`.
