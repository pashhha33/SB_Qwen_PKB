---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2TA
type: taxonomy
title: Classification of Books
aliases:
  - Classification of Books
created_at: 2026-10-23T18:10
updated_at: 2026-10-23T18:10
facets:
  - "[[FACET-01J8Z6M4K2Q7V9X3N5B0C1D2FA.md|Жанр]]"
  - "[[FACET-01J8Z6M4K2Q7V9X3N5B0C1D2FB.md|Литературная форма]]"
allowed_object_types:
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2EK.md|Книга]]"
hierarchy_mode: strict
assignment_cardinality: 0..N
root_requirement_min: 1
description: "Классификация произведений: жанр (DL-119/126) и форма (DL-127)."
---

Корректный экземпляр `taxonomy` (батч 6, D3).

- таксономия — **необязательная** группировка фасетов (ADR-007): область применения
  и значения по умолчанию для входящих фасетов (`allowed_object_types`,
  `hierarchy_mode`, `assignment_cardinality`, `root_requirement_*`);
- `facets` ≥ 1 (minItems — дублирует `taxonomy.facets.min_one`), ссылки на **определения**
  фасетов (`FACET-….md`); принадлежность хранится и на фасете (`facet.taxonomy`) —
  согласованность проверяет runner;
- **П8**: категории ссылаются на фасет, а не на таксономию;
- `hierarchy_mode: strict` — у категории один родитель (множественное родство —
  warning runner'а `category.parent.strict_mode`).

Схема: `schema/metamodel/taxonomy.schema.json`.
