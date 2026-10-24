---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2PG
type: property
title: Series number
aliases:
  - Series number
created_at: 2026-10-24T15:25
updated_at: 2026-10-24T15:25
key: series_number
label: Номер в серии
value_type: number
cardinality: 0..1
required: false
scope: family
object_types:
  - "[[BOOK-01J8Z6M4K2Q7V9X3N5B0C1D2EK.md|Книга]]"
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2WA.md|Произведение]]"
---

**Некорректный** экземпляр `property` (F5-8, DL-252) — файл намеренно не проходит проверку.
Разбор нарушений:

| Нарушение | Правило реестра | Кто ловит | Сообщение пользователю |
|---|---|---|---|
| Ссылка на экземплярный префикс `BOOK-` вместо `OBJECT_TYPE-` (привязка ведёт на определение типа, не на экземпляр) | формат `object_types` (`link_object_type`) | **схема** | «Привязка свойства ссылается не на определение типа: ожидается [[OBJECT_TYPE-….md…]]» |
| `scope: family` при двух ссылках и хотя бы одна — на конкретный тип | `property.object_types.scope_consistency` | runner (error) | «Для области „семейство“ нужна ровно одна ссылка на абстрактный тип-предок» |

Примечание: `cardinality: 0..1` + `required: false` — согласованы
(`property.required.cardinality_consistency` не срабатывает).
