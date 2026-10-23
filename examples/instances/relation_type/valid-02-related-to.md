---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2RB
type: relation_type
title: Related to
aliases:
  - Related to
created_at: 2026-10-23T18:01
updated_at: 2026-10-23T18:01
key: related_to
label: Связано с
forward_label: связано с
reverse_label: связано с
direction: symmetric
subject_to_object: 0..N
object_to_subject: 0..N
uniqueness_rule: pair
allowed_subject_types:
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2EK.md|Книга]]"
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2WP.md|Человек]]"
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2WQ.md|Проект]]"
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2WR.md|Знание]]"
allowed_object_types:
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2EK.md|Книга]]"
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2WP.md|Человек]]"
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2WQ.md|Проект]]"
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2WR.md|Знание]]"
definition: "Симметричная связь по смыслу (DL-234): stored once, обратная сторона вычисляется."
---

Корректный экземпляр `relation_type`: `related_to` (батч 6, D3).

- `direction: symmetric` — связь хранится **один раз**, обратная сторона вычисляется
  (Р6/Р11); `forward_label` и `reverse_label` **совпадают** — для симметричных типов
  это норма (`relation_type.symmetric.labels_equal`, warning при расхождении — runner);
- `uniqueness_rule: pair` — дубль определяется парой объектов (DL-080/233);
- `allowed_*` — объединение четырёх предметных типов ядра (DL-234, вопрос 9-10
  ответ А); свойства типов **сужают** цели по карточкам §5 (механизм `target_types`);
- `link_mode: direct` — объявляется в свойствах `related_to` шести типов, не здесь (Р2).

Схема: `schema/metamodel/relation_type.schema.json`.
