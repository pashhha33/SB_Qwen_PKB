---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2RA
type: relation_type
title: Contains
aliases:
  - Contains
created_at: 2026-10-23T18:00
updated_at: 2026-10-23T18:00
key: contains
label: Содержит
forward_label: содержит
reverse_label: входит в
direction: directed
subject_to_object: 0..N
object_to_subject: 0..1
uniqueness_rule: triple
allowed_subject_types:
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2EK.md|Книга]]"
allowed_object_types:
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2WC.md|Глава]]"
definition: "Целое содержит часть (DL-125): reified — связи нужны собственные данные (order, role)."
---

Корректный экземпляр `relation_type`: `contains` (батч 6, D3).

- 8 обязательных полей заполнены (схема батча 1): `key`, `label`, обе метки сторон,
  `direction`, две кардинальности, `uniqueness_rule`;
- `subject_to_object: 0..N` (книга содержит много глав), `object_to_subject: 0..1`
  (глава входит ровно в одно произведение — двусторонняя кардинальность, DL-079);
- `allowed_*` ведут на **определения** типов (`OBJECT_TYPE-….md`); нарушение = error,
  `suggested_*` (здесь не заданы) — только подсказки (DL-083);
- `link_mode` здесь **не объявляется** — он живёт в определении свойства (Р2):
  свойство `part_of_work` главы объявляет `link_mode: reified` + `origin_property`;
- роли `forward_label`/`reverse_label` — свободный русский текст, **оба обязательны**
  (Р8: автообразование отклонено).

Схема: `schema/metamodel/relation_type.schema.json`.
