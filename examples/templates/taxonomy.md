---
id: "{PREFIX}{ULID}"          # TAXONOMY-
type: taxonomy
title: "{TITLE}"
aliases:
  - "{TITLE}"
created_at: {NOW}
updated_at: {NOW}
facets: []                    # обязательно ≥ 1: FACET-….md (min_one)
# allowed_object_types: []    # пусто = без ограничений; OBJECT_TYPE-….md
# hierarchy_mode: strict      # strict | polyhierarchical (§3.5) — значение по умолчанию для фасетов
# assignment_cardinality: 0..N
# root_requirement_min: 0
# root_requirement_max: null  # null = без ограничения
# description: ""
---

<!-- Область применения таксономии; категории на неё НЕ ссылаются (П8) -->
