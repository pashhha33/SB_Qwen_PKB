---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2PD
type: property
title: Rating
aliases:
  - Rating
created_at: 2026-10-23T17:53
updated_at: 2026-10-23T17:53
key: rating
label: Оценка
value_type: number
cardinality: 0..1
required: false
scope: universal
display:
  renderer: stars
  scale_max: 10
definition: "Личная оценка 1–10; в файле хранится число, звёзды рисует display.renderer (DL-115/116/117/123)."
---

Корректный экземпляр `property`: число с настройками показа (батч 6, D3).

- `display.*` (§12 `04-attributes`, DL-123) — **только отображение, никогда хранение**:
  в файле книги лежит `rating: 7`, в режиме `view` рисуется `★★★★★★★☆☆☆ 7/10`;
- `display.renderer: stars` — значение зарегистрированного перечисления
  (§3.18, 3 значения: `plain`/`stars`/`progress`); `scale_max: 10` — предел шкалы;
- схема (правка батча 6, DL-237): `display` допустим **только** у `value_type: number`
  (11-й условный блок); `additionalProperties: false` отклоняет незадокументированные
  ключи вроде `precision` (его §12 не определяет — находка батча 6);
- символы ⭐/★ в данных запрещены (DL-117): их нельзя сортировать и усреднять,
  у «звёздочки» две кодировки;
- диапазон 1–10 здесь не объявлен: границы значения — правило `book.rating.range`
  (error) и/или `allowed_values` у перечислений; у чисел диапазон задаёт валидация.

Схема: `schema/metamodel/property.schema.json`.
