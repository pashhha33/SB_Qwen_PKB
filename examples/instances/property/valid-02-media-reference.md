---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2PB
type: property
title: Cover
aliases:
  - Cover
created_at: 2026-10-23T17:51
updated_at: 2026-10-23T17:51
key: cover
label: Обложка
value_type: media_reference
target_types:
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2WM.md|Медиа (обёртка файла)]]"
media_target: object
media_kinds:
  - image
media_roles:
  - cover
media_display: gallery
media_thumbnail_size: medium
cardinality: 0..1
required: false
scope: specific
create_from_link: ask
definition: "Обложка: только обёртки media вида image с ролью cover (ADR-008)."
---

Корректный экземпляр `property`: медиассылка (батч 6, D3).

- `value_type: media_reference` → схема требует `target_types` **и** `media_target`
  (условный блок батча 1); `media_target: object` — значением может быть только
  обёртка `media`, не голый файл (ADR-008);
- **семь настроек медиа** (§10 `04-attributes`): здесь заданы `media_kinds: [image]`,
  `media_roles: [cover]`, `media_display: gallery`, `media_thumbnail_size: medium` —
  контроль выбора в модалке и миниатюры через `getResourcePath()` (публичный API);
- `media_*`-поля у не-медиа-свойств схема отклоняет (гейтинг батча 1);
- теневое свойство `cover_file` ведёт плагин (DL-144/153) — в определении свойства
  оно не объявляется.

Схема: `schema/metamodel/property.schema.json`.
