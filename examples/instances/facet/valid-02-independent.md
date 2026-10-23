---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2FD
type: facet
title: Topic
aliases:
  - Topic
created_at: 2026-10-23T18:21
updated_at: 2026-10-23T18:21
taxonomy: []
hierarchy_mode: polyhierarchical
assignment_cardinality: 0..N
description: "Независимый фасет тем (ADR-007): вне таксономий, назначается любым типам."
---

Корректный экземпляр `facet`: независимый фасет (батч 6, D3).

- `taxonomy: []` — **пустой список**: фасет не входит ни в одну таксономию
  (ADR-007); отсутствие `allowed_object_types` — ограничений нет, фасет доступен
  всем типам;
- `polyhierarchical` — категория может иметь несколько родителей
  («Городская фэнтези» ⊂ и «Фэнтези», и «Городское»); множественное родство
  в `strict`-фасете — warning runner'а;
- `assignment_cardinality: 0..N` — назначение полностью добровольное;
- `root_requirement_min` не задан → 0 (корни не обязательны при назначении).

Схема: `schema/metamodel/facet.schema.json`.
