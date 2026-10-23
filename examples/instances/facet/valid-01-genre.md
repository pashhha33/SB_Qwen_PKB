---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2FA
type: facet
title: Genre
aliases:
  - Genre
created_at: 2026-10-23T18:20
updated_at: 2026-10-23T18:20
taxonomy:
  - "[[TAXONOMY-01J8Z6M4K2Q7V9X3N5B0C1D2TA.md|Классификация книг]]"
allowed_object_types:
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2EK.md|Книга]]"
hierarchy_mode: strict
assignment_cardinality: 1..N
root_requirement_min: 1
description: "Жанр произведения — единственное обязательное назначение у книги (DL-119/126)."
---

Корректный экземпляр `facet` (батч 6, D3).

- `taxonomy` — **0..1, строго список**: ровно одна таксономия или пустой список
  (независимый фасет); `maxItems: 1`;
- `assignment_cardinality: 1..N` + `root_requirement_min: 1` — у каждой книги
  минимум одна **корневая** категория жанра; `book.genre.cardinality` (error)
  реализуется этим объявлением (DL-126);
- `hierarchy_mode: strict` — один родитель у категории («Космоопера ⊂ Фантастика»);
- `allowed_object_types` → определение типа `book` — категории этого фасета
  назначаются только книгам (`assignment.type_allowed`, error, runner).

Схема: `schema/metamodel/facet.schema.json`.
