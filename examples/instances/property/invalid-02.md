---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2PY
type: property
title: Сломанное медиа-свойство
aliases:
  - Сломанное медиа-свойство
created_at: 2026-10-23T17:56
updated_at: 2026-10-23T17:56
key: thumbnail
label: Миниатюра
value_type: text
media_target: object
create_from_link: auto
display:
  renderer: stars
cardinality: 0..N
required: true
scope: specific
allowed_values:
  - Да
  - да
---

**Некорректный** экземпляр `property` (батч 6, D4). Разбор:

| Нарушение | Правило | Кто ловит |
|---|---|---|
| `media_target` у свойства `text` | медиа-настройки только у `media_reference` (§10) | **схема** (гейтинг батча 1) |
| `create_from_link` у свойства `text` | только у ссылок (раздел 12 §5.4) | **схема** (гейтинг) |
| `display` у свойства `text` | §12: только у `number` | **схема** (11-й условный блок, DL-237) |
| `cardinality: 0..N` + `required: true` | `property.required.cardinality_consistency` | **схема** |
| `allowed_values: [Да, да]` — кириллица + дубль регистра | `property.allowed_values.format` (snake_case латиница), `.unique` | **схема** (паттерн `^[a-z][a-z0-9_]*$`; уникальность — точное совпадение, «Да»≠«да» отклоняется паттерном оба) |

Схема: `schema/metamodel/property.schema.json`.
