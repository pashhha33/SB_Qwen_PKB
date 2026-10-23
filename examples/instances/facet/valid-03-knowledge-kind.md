---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2FE
type: facet
title: Knowledge type
aliases:
  - Knowledge type
created_at: 2026-10-23T18:22
updated_at: 2026-10-23T18:22
taxonomy:
  - "[[TAXONOMY-01J8Z6M4K2Q7V9X3N5B0C1D2TC.md|Знания]]"
allowed_object_types:
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2WR.md|Знание]]"
hierarchy_mode: strict
assignment_cardinality: 0..1
description: "Вид знания: hypothesis/finding/argument/example/summary/conclusion (DL-194; пример — knowledge/valid-02)."
---

Корректный экземпляр `facet` (батч 6, D3).

- `assignment_cardinality: 0..1` — знание может остаться **без вида** (ДЗ1) и не
  может иметь два вида;
- категории фасета назначаются свойством `categories` знания (примеры:
  «Вывод» — `knowledge/valid-02`, «Гипотеза» — `project`-связка в `knowledge/valid-01`);
- `strict` — у вида знания один родитель (иерархия видов проста).

Схема: `schema/metamodel/facet.schema.json`.
