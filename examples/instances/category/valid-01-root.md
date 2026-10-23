---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2EN
type: category
title: Sci-fi
aliases:
  - Sci-fi
created_at: 2026-10-23T18:30
updated_at: 2026-10-23T18:30
facet:
  - "[[FACET-01J8Z6M4K2Q7V9X3N5B0C1D2FA.md|Жанр]]"
parent: []
description: "Корневая категория жанра."
---

Корректный экземпляр `category`: корень иерархии (батч 6, D3).

- `facet` — **обязателен** (`category.facet.required`), строго список из одного
  (`category.facet.single`, `maxItems: 1`);
- `parent: []` — корень: предков нет; при `root_requirement_min: 1` фасета «Жанр»
  корневые категории обязательны для назначения книгам (DL-126);
- **П8**: ключа `taxonomy` нет и быть не должно — категории ссылаются на фасет,
  таксономию схема отклоняет (`not: required [taxonomy]`);
- русское имя живёт в `aliases`/`title`; `key` категории метамодель не объявляет —
  категория не механизм (DL-165): поиск идёт по `title`/`aliases`.

Схема: `schema/metamodel/category.schema.json`.
