---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2W2
type: object_type
title: Ещё одно сломанное определение
aliases:
  - Ещё одно сломанное определение
created_at: 2026-10-23T17:48
updated_at: 2026-10-23T17:48
type_key: episode
label: Эпизод
type_prefix: episode
abstract: false
lifecycle: deprecated
parent_type:
  - "[[WORK-01J8Z6M4K2Q7V9X3N5B0C1D2WA.md|Произведение]]"
---

**Некорректный** экземпляр `object_type` (батч 6, D4). Разбор:

| Нарушение | Правило | Кто ловит |
|---|---|---|
| `lifecycle: deprecated` без `superseded_by` | ADR-011/DL-107 | **схема** (if/then: required `superseded_by`) |
| `type_prefix: episode` — строчные | формат префикса (A–Z, 0–9, дефис) | **схема** (паттерн `type_prefix`) |
| `parent_type` → `[[WORK-….md]]` — ссылка на ЭКЗЕМПЛЯРНЫЙ префикс | находка батча 1: ссылка ведёт на файл **определения** типа (`OBJECT_TYPE-….md`); экземпляров у абстрактного `work` нет (И3) | **схема** (`link_object_type`) |

Схема: `schema/metamodel/object_type.schema.json`.
