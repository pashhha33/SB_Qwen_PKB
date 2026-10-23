---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2TB
type: taxonomy
title: Context
aliases:
  - Context
created_at: 2026-10-23T18:11
updated_at: 2026-10-23T18:11
facets:
  - "[[FACET-01J8Z6M4K2Q7V9X3N5B0C1D2FC.md|Страна]]"
  - "[[FACET-01J8Z6M4K2Q7V9X3N5B0C1D2FG.md|Язык]]"
  - "[[FACET-01J8Z6M4K2Q7V9X3N5B0C1D2FS.md|Спорт]]"
allowed_object_types:
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2WP.md|Человек]]"
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2EK.md|Книга]]"
assignment_cardinality: 0..N
description: "Контекст людей и произведений: страна, язык, спорт (условные свойства DL-155/159)."
---

Корректный экземпляр `taxonomy` (батч 6, D3).

- фасеты, на которые ссылаются **условные свойства** `person` (`country` →
  `country_of_birth`/`country_of_publication`, `language` → `languages_spoken`,
  `sport` → `sport_kind`) и `book` (`country` → `country_of_publication`);
- `allowed_object_types` — два типа: фасет наследует пересечение ограничений
  таксономии и своего `facet.allowed_object_types` (runner);
- `hierarchy_mode` не задан — фасеты объявляют свой (страна/язык — `strict`,
  спорт — `polyhierarchical` по АИ-5 «Боевое самбо ⊂ Самбо»).

Схема: `schema/metamodel/taxonomy.schema.json`.
