---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2G4
type: book
title: Путь Восхождения
aliases:
  - Путь Восхождения
created_at: 2026-10-23T10:05
updated_at: 2026-10-23T10:05
author:
  - "[[PERSON-01J8Z6M4K2Q7V9X3N5B0C1D2ES.md|Аркадий Северов]]"
read_status: reading
format: web_novel
platform: Шёпот Гор
publication_status: ongoing
release_cadence: две главы в неделю
last_chapter_on: "2026-10-20"
categories:
  - "[[CATEGORY-01J8Z6M4K2Q7V9X3N5B0C1D2ET.md|Фантастика]]"
  - "[[CATEGORY-01J8Z6M4K2Q7V9X3N5B0C1D2EJ.md|Роман]]"
related_to:
  - "[[KNOWLEDGE-01J8Z6M4K2Q7V9X3N5B0C1D2E5.md|Заметка о системе магии]]"
tags:
  - следить-за-выходом
---

Корректный экземпляр `book`, формат `web_novel` (батч 2, D3).

Что демонстрирует:

- все четыре условных свойства формата `web_novel` (DL-122): `platform`,
  `publication_status` (перечисление §3.17.2), `release_cadence`, `last_chapter_on`;
- две категории из двух разных фасетов: `genre` («Фантастика», обязательный) и
  `literary_form` («Роман», необязательный) — форма и жанр ортогональны (DL-119/126);
- `related_to` — прямая симметричная связь (ADR-009 Р1/Р6): хранится один раз,
  обратная сторона вычисляется; цель — `knowledge` или `book` (карточка §5);
- веб-новела — это **книга с `format: web_novel`**, а не отдельный тип (контрпример
  карточки §3; `online_literature` не введено, DL-121);
- главы такой книги — объекты `chapter`, связанные реифицированной связью `contains`
  с `order` и `role` (`.sb/relations/*.jsonl`, ADR-010) — в frontmatter книги они не живут;
  `chapter_count` не хранится, вычисляется (DL-118).

Дата `last_chapter_on` — в кавычках (конвенция батча 2, см. `valid-01-file-format.md`).

- Схема: `schema/entities/book.schema.json`.
