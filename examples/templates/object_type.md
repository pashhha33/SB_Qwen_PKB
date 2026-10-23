---
id: "{PREFIX}{ULID}"          # OBJECT_TYPE-
type: object_type
title: "{TITLE}"              # Type_key (English)
aliases:
  - "{TITLE}"
created_at: {NOW}
updated_at: {NOW}
type_key: ""                  # snake_case, ^[a-z][a-z0-9_]*$ (ADR-003)
label: ""                     # подпись по-русски
type_prefix: ""               # 3–12 символов: A–Z, 0–9, дефис; уникален (проверяет runner)
abstract: false               # true → экземпляров нет (И3); свойства не объявляются
lifecycle: standard           # standard | experimental | frozen | deprecated (§3.4)
# parent_type: ["[[OBJECT_TYPE-….md|Родитель]]"]   # 0..1: НЕПОСРЕДСТВЕНный родитель (определение типа)
# superseded_by: "[[OBJECT_TYPE-….md|Замена]]"     # ОБЯЗАТЕЛЕН при deprecated (DL-107)
# description: ""
---

<!-- Назначение типа, границы применимости, примеры объектов -->
