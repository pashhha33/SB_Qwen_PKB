---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2PC
type: property
title: Format
aliases:
  - Format
created_at: 2026-10-23T17:52
updated_at: 2026-10-23T17:52
key: format
label: Формат
value_type: text
allowed_values:
  - file
  - card
  - web_novel
  - print
  - audio
cardinality: "1"
required: true
scope: specific
default_value: file
definition: "Формат книги — закрытое перечисление (DL-120/121); триггер 10 условных свойств (DL-122)."
---

Корректный экземпляр `property`: перечисление в определении (батч 6, D3).

- `allowed_values` — закрытый список значений **прямо в определении свойства**
  (`04-attributes` §5): значений мало, они стабильны, меняются только вместе
  с метамоделью (критерий «перечисление или словарь»);
- схема (правка батча 6, DL-237) проверяет: непустой список, уникальность
  (`property.allowed_values.unique`), формат каждого значения `^[a-z][a-z0-9_]*$`
  (`property.allowed_values.format`, ADR-011) — все три error-правила зашиты;
- проверку значений **экземпляров** по списку делает runner (`value.allowed_values`);
- `cardinality: "1"` ↔ `required: true`; `default_value: file` подставляется при создании;
- это свойство — **триггер**: 10 условных свойств книги объявляют
  `applies_when: {property: format, operation: equals, …}` (см. `valid-05`).

Схема: `schema/metamodel/property.schema.json`.
