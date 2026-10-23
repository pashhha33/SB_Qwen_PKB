---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2RC
type: relation_type
title: Authorship
aliases:
  - Authorship
created_at: 2026-10-23T18:02
updated_at: 2026-10-23T18:02
key: authorship
label: Авторство
forward_label: автор произведения
reverse_label: автор
direction: directed
subject_to_object: 1..N
object_to_subject: 0..N
uniqueness_rule: triple
allowed_subject_types:
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2WA.md|Произведение]]"
allowed_object_types:
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2WP.md|Человек]]"
definition: "Авторство: direct-связь, хранится в поле author произведения."
---

Корректный экземпляр `relation_type`: `authorship` (батч 6, D3).

- `allowed_subject_types` → **абстрактный** `work`: означает «любой неабстрактный
  потомок» (DL-209) — книга, глава, стихотворение, музыкальный трек…; перечислять
  потомков не нужно, `.base`-фильтры разворачивает `base-generator`;
- `subject_to_object: 1..N` — у произведения минимум один автор
  (`book.author.required`), `object_to_subject: 0..N` — у человека может не быть
  произведений в базе;
- `direct` — значение живёт в поле `author` объекта (свойство объявляет
  `link_mode: direct`, `target_types: [person]` — см. `property/valid-01`);
- `uniqueness_rule: triple` — дубль определяется тройкой
  «субъект — тип отношения — объект» (значение по умолчанию, DL-080).

Схема: `schema/metamodel/relation_type.schema.json`.
