---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2W1
type: object_type
title: Сломанное определение типа
aliases:
  - Сломанное определение типа
created_at: 2026-10-23T17:47
updated_at: 2026-10-23T17:47
type_key: Book
abstract: "да"
lifecycle: active
parent_type:
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2WA.md|Произведение]]"
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2WB.md|Деятельность]]"
---

**Некорректный** экземпляр `object_type` (батч 6, D4). Разбор:

| Нарушение | Правило | Кто ловит |
|---|---|---|
| `type_key: Book` — заглавные | `enum.value.format` / ADR-003 (snake_case) | **схема** (паттерн `type_key`) |
| Нет `type_prefix` | обязательность | **схема** (`required`) |
| `abstract: "да"` — строка | `value.type_conformance` | **схема** (`type: boolean`) |
| `lifecycle: active` — нет в 4 | `value.allowed_values` | **схема** (`enum`, §3.4) |
| `parent_type` — два родителя | «только непосредственный родитель» (01-classification §5) | **схема** (`maxItems: 1`) |
| Коллизия `type_prefix` с существующим | уникальность префикса как целой строки | runner (межобъектное) |

Схема: `schema/metamodel/object_type.schema.json`.
