---
id: "{PREFIX}{ULID}"          # PROPERTY-
type: property
title: "{TITLE}"              # key (English)
aliases:
  - "{TITLE}"
created_at: {NOW}
updated_at: {NOW}
key: ""                       # snake_case
label: ""                     # подпись по-русски
value_type: text              # text | number | boolean | date | datetime | object_reference | media_reference | category_reference (§3.1)
cardinality: "1"              # "1" | 0..1 | 0..N | 1..N (§3.2)
required: true                # согласованность с cardinality зашита в схему
scope: specific               # specific | universal (§3.3)
# target_types: []            # обязательно для object_reference / media_reference → OBJECT_TYPE-….md
# link_mode: direct           # обязательно для object_reference: direct | reified (Р2)
# media_target: object        # обязательно для media_reference: object | file
# media_kinds: []             # настройки медиа (§10): kinds/roles/display/thumbnail_size
# allowed_values: []          # перечисление (§5): snake_case, уникальные; закрытый список
# default_value: ""           # подставляется при создании
# applies_when: {property: "", operation: equals, value: ""}   # условность (§11); operations: equals | includes_any | in_category
# create_from_link: ask       # только у ссылок: none | ask | auto (§12/DL-180)
# display: {renderer: plain, scale_max: 10, unit: ""}   # только у number (§12/§3.18)
# definition: ""
# lifecycle: standard
# superseded_by: "[[PROPERTY-….md|Замена]]"       # ОБЯЗАТЕЛЕН при deprecated
---

<!-- Смысл свойства, правила заполнения, примеры значений -->
