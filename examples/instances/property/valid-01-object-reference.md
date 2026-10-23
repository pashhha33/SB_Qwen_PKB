---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2PA
type: property
title: Author
aliases:
  - Author
created_at: 2026-10-23T17:50
updated_at: 2026-10-23T17:50
key: author
label: Автор
value_type: object_reference
target_types:
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2WP.md|Человек]]"
link_mode: direct
cardinality: 1..N
required: true
scope: specific
create_from_link: ask
definition: "Автор(ы) произведения: ссылка хранится в поле объекта (direct), связь authorship."
---

Корректный экземпляр `property`: объектная ссылка (батч 6, D3).

- `value_type: object_reference` → схема требует `target_types` **и** `link_mode`
  (условный блок батча 1); `link_mode: direct` — ссылка живёт в frontmatter книги,
  в `.sb/relations/` записи нет (ADR-009 Р1);
- `cardinality: 1..N` ↔ `required: true` — согласованность зашита в схему
  (`property.required.cardinality_consistency`);
- `target_types` ведёт на **определение** типа `person` (`OBJECT_TYPE-….md`);
  фактический тип цели ссылки в данных — runner (`value.reference.target_type`);
- `create_from_link: ask` — клик по пустой ссылке `[[Автор]]` предложит создать
  `person` (раздел 12, DL-180).

Схема: `schema/metamodel/property.schema.json`.
