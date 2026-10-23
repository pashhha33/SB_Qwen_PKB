---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2TC
type: taxonomy
title: Knowledge
aliases:
  - Knowledge
created_at: 2026-10-23T18:12
updated_at: 2026-10-23T18:12
facets:
  - "[[FACET-01J8Z6M4K2Q7V9X3N5B0C1D2FE.md|Вид знания]]"
allowed_object_types:
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2WR.md|Знание]]"
assignment_cardinality: 0..1
description: "Единственный фасет знаний: hypothesis/finding/argument/example/summary/conclusion (DL-194)."
---

Корректный экземпляр `taxonomy` (батч 6, D3).

- один фасет — минимальная законная таксономия (`minItems: 1`);
- `assignment_cardinality: 0..1` — знание **может остаться без вида** (ДЗ1:
  «пустое значение легально, фасет 0..1»; `assignment.cardinality` при 0 назначений
  молчит, `required` — только когда свойство `required: true`);
- при назначении нескольких категорий в фасете `0..1` — error
  `assignment.cardinality` (runner).

Схема: `schema/metamodel/taxonomy.schema.json`.
