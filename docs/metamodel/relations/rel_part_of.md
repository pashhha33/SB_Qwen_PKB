---
doc_type: relation
relation_id: rel_part_of
title: "Часть целого"
status: actual
inverse_of: contains
version: 0.2.1
created: 2026-10-22
updated: 2026-10-23
metamodel_version: 0.29.2
source_entity: chapter
target_entity: work
direction: directed
link_mode: reified
storage: .sb/relations/relations.jsonl
phase: 1 (схема), 2 (данные)
governing_adr: docs/adr/ADR-009-relations-model.md
tags: [metamodel/relation]
---

# rel_part_of. Часть целого

> [!warning] Изменение от 2026-10-22 (DL-125)
> Введён тип отношения **`contains`** («содержит»), и именно он хранится в
> `.sb/relations/relations.jsonl`. `part_of` объявлена его **вычисляемой обратной стороной**:
> отдельной записью она не хранится (правило `relation.contains.single_record`).
> Карточка остаётся в силе как **эталон описания `reified`-связи** и как источник
> имён свойств-перевёртышей (`part_of_work`). Подробности — [[rel_contains]].

## Смысл связи
Один объект является частью другого: глава — часть книги, эпизод — часть сериала, трек — часть альбома.
Проверяется фразами: «Глава — часть → Книга» и «Книга — содержит часть → Глава».

## Роли

| Конец связи | Поле | Значение |
|---|---|---|
| source | `forward_label` | `часть` |
| target | `reverse_label` | `содержит часть` |

## Кардинальность

| Сторона | Поле | Значение | Формулировка |
|---|---|---|---|
| От части к целому | `subject_to_object` | `0..1` | Часть входит не более чем в одно целое |
| От целого к частям | `object_to_subject` | `0..N` | У целого может не быть частей или быть много |

## Допустимые типы

| Поле | Значение |
|---|---|
| `allowed_subject_types` | `chapter`, `episode`, `music_track` — все на этапе 2 |
| `allowed_object_types` | `work`, `series`, `music_album` — наследники и конкретные типы |

## Прочее

| Параметр | Значение |
|---|---|
| `direction` | `directed` |
| `uniqueness_rule` | `triple` |
| `link_mode` | **`reified`** |
| Хранение | Строка JSON в `.sb/relations/relations.jsonl` |

> [!important] Почему `reified`
> У связи есть собственное данное — **порядок** (`order`). Глава 3 отличается от главы 7 именно номером
> в последовательности, и хранить его больше негде. Это эталонный пример применения критерия из Р1 ADR-009:
> «у связи нужны собственные данные → `reified`».

## Локальные свойства в этой связи

| Поле | Нужно? | Зачем |
|---|---|---|
| `order` | **да** | Номер главы, эпизода, трека |
| `starts_on`, `ends_on` | нет | Период у части целого обычно не имеет смысла |
| `description` | по ситуации | Краткое пояснение |
| `role` | нет | Роль одна — «часть» |

## Пример

```json
{"id":"01J8Z6M4K2Q7V9X3N5B0C1D2H0","type":"relation","title":"Chapter 3 of The Master and Margarita","subject":"01J8Z6M4K2Q7V9X3N5B0C1D2H1","relation_type":"01J8Z6M4K2Q7V9X3N5B0C1D2H2","object":"01J8Z6M4K2Q7V9X3N5B0C1D2F3","origin_property":null,"role":null,"order":3,"starts_on":null,"ends_on":null,"description":null,"created_at":"2026-10-22T14:35","updated_at":"2026-10-22T14:35"}
```

`origin_property` пустое: пример **свободно стоящей связи**. У реальных глав `contains`
порождён свойством произведения (`origin_property` заполнен) — см. [[rel_contains]] §«Локальные
свойства» и `examples/relations/valid-01-contains.jsonl` (батч 5, DL-236).

## Правила валидации, применимые к этой связи

`relation.subject.exists`, `relation.object.exists`, `relation.subject_not_object`,
`relation.allowed_subject_type`, `relation.allowed_object_type`,
`relation.cardinality.subject_to_object` (не более одного целого), `relation.uniqueness`.
Дополнительно на этапе 2: **`relation.contains.no_cycle`** — правило зарегистрировано
в [[../../validation/rules|rules.md]] («Правила, которых пока нет»); цикл проверяется
по хранимому `contains` (`part_of` отдельной записью не хранится — DL-125).

## Открытые вопросы

- [x] ~~Проверка отсутствия цикла в цепочке частей~~ → **решено**: правило
      `relation.contains.no_cycle` зарегистрировано в [[../../validation/rules|rules.md]]
      и отложено на этап 2 (вложенность произведений появится позже); структурные проверки
      шага 7 приняты (ADR-011). Закрыто в блоке F — DL-241.
- [x] ~~Дублирование `order` и номера в названии главы: что первично~~ → **решено** карточкой
      [[../entities/chapter|chapter]]: первичны данные связи — навигация Н1 идёт по
      `contains.order` (или `chapter_number`), `order` обычно равен номеру главы
      ([[rel_contains]] §«Локальные свойства»); заголовок — только представление.
      Закрыто в блоке F — DL-241.

## История изменений

| Дата | Версия | Что изменилось | Ссылка |
|---|---|---|---|
| 2026-10-23 | 0.2.1 | Блок F (DL-241): два устаревших открытых вопроса закрыты со ссылками (`relation.contains.no_cycle` — этап 2; приоритет `order` — Н1 карточки `chapter`); имя правила отсутствия цикла вписано явно; пояснение к примеру приведено к факту (`chapter` в ядре с 0.6.0, `origin_property` у реальных глав заполнен — DL-236). Нормы не менялись | DL-241; [[../../roadmap/readiness-report\|отчёт блока F]] |
| 2026-10-22 | 0.4.0 | Карточка создана | [[../../adr/ADR-009-relations-model\|ADR-009]] |
