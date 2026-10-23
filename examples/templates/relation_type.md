---
id: "{PREFIX}{ULID}"          # RELATION_TYPE-
type: relation_type
title: "{TITLE}"              # key (English)
aliases:
  - "{TITLE}"
created_at: {NOW}
updated_at: {NOW}
key: ""                       # snake_case
label: ""                     # имя отношения по-русски
forward_label: ""             # как читается субъект → объект (свободный текст)
reverse_label: ""             # как читается объект → субъект; ОБА обязательны (Р8)
direction: directed           # directed | symmetric (§3.6); у symmetric метки обязаны совпадать (warning)
subject_to_object: 0..N       # двусторонняя кардинальность (§3.2, DL-079)
object_to_subject: 0..1
uniqueness_rule: triple       # pair | triple | none (§3.7, DL-080)
# allowed_subject_types: []   # 0..N → OBJECT_TYPE-….md; абстрактный = любой неабстрактный потомок (DL-209)
# allowed_object_types: []
# suggested_subject_types: [] # подмножество allowed (проверяет runner); подсказки UI
# suggested_object_types: []
# definition: ""
---

<!-- Семантика отношения; link_mode объявляется НЕ здесь, а в определении свойства (Р2) -->
