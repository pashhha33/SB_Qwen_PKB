---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2PF
type: property
title: Subtitle
aliases:
  - Subtitle
created_at: 2026-10-24T15:20
updated_at: 2026-10-24T15:20
key: subtitle
label: Подзаголовок
value_type: text
cardinality: 0..1
required: false
scope: family
object_types:
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2WA.md|Произведение]]"
definition: "Подзаголовок произведения; доступен всем потомкам абстрактного типа work (F5-8 = А: family — ссылка на абстрактного предка, потомки включаются автоматически — DL-208)."
---

Корректный экземпляр `property`: свойство **семейства** (F5-8 = А, DL-250/252).

- `scope: family` + `object_types` — ровно одна ссылка на **абстрактного предка**
  (`work` из `object_type/valid-02-abstract-work.md`): свойство доступно всем
  неабстрактным потомкам — `book`, `chapter`, `poem`, `video_game`… (семантика
  «потомки включаются автоматически» — DL-208);
- согласованность «family = одна ссылка на абстрактный тип» проверяет runner
  (`property.object_types.scope_consistency`, error); схема ловит только формат
  ссылок (`link_object_type` — префикс `OBJECT_TYPE-`);
- существование определений по ссылкам — runner (`property.object_types.exists`).

Схема: `schema/metamodel/property.schema.json` (`object_types`, добавлено в 1.1.0).
Норма: `04-attributes` §4.1 (привязка свойства к типу).
