---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2WD
type: object_type
title: Image wrapper (устаревший)
aliases:
  - Image wrapper (устаревший)
created_at: 2026-10-23T17:46
updated_at: 2026-10-23T17:46
type_key: image_wrapper
label: Обёртка изображения (устарела)
type_prefix: IMGWRAP
abstract: false
lifecycle: deprecated
superseded_by: "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2WM.md|Медиа (обёртка файла)]]"
description: "Исторический тип из черновика v1.0; заменён типом media (ADR-006)."
---

Корректный экземпляр `object_type`: устаревший тип (батч 6, D3).

- `lifecycle: deprecated` → **обязательно** `superseded_by` (ADR-011/DL-107;
  условный блок схемы if/then) — цель ведет на определение замещающего типа
  (`OBJECT_TYPE-….md`, сужено до `link_object_type` в батче 6 — DL-237);
- поведение `deprecated`: валидация даёт `warning`, команды создания тип не предлагают
  (ADR-011/DL-107); существующие экземпляры архивируются миграцией (раздел 10),
  а не удаляются молча;
- пример отражает реальную историю модели: `image_wrapper` из спецификации v1.0
  заменён типом `media` (ADR-006);
- `type_prefix: IMGWRAP` — 3–12 символов, только A–Z/0–9/дефис (без подчёркивания!).

Схема: `schema/metamodel/object_type.schema.json`.
