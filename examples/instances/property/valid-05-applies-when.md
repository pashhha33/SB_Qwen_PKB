---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2PE
type: property
title: Platform
aliases:
  - Platform
created_at: 2026-10-23T17:54
updated_at: 2026-10-23T17:54
key: platform
label: Площадка публикации
value_type: text
cardinality: 0..1
required: false
scope: specific
applies_when:
  property: format
  operation: equals
  value: web_novel
definition: "Площадка, на которой выходит веб-новела; показывается только при format = web_novel (DL-122/128)."
---

Корректный экземпляр `property`: условное свойство (батч 6, D3).

- `applies_when` (§11 `04-attributes`, DL-128) — **одно** условие (составные и/или —
  этап 2): `equals` для одиночного триггера; для мультивыбора (`person.role`,
  `media.creation_method`) — операция `includes_any` (DL-139);
- условие влияет **только на показ и проверку обязательности**, никогда на хранение
  (М1/М2): при смене `format` значение `platform` не удаляется, а «гаснет»;
- `property: format` — key свойства-триггера **того же типа** (или унаследованного);
  существование триггера — runner (`applies_when.property_exists`);
- значение условия для `in_category` — ULID категорий (проверка в `$defs.applies_when`);
  для `equals`/`includes_any` — строка или список строк.

Схема: `schema/metamodel/property.schema.json`.
