---
doc_type: relation
relation_id: rel_part_of
title: "Часть целого"
status: actual
version: 0.1.0
created: 2026-10-22
updated: 2026-10-22
metamodel_version: 0.4.0
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

`origin_property` пустое: это свободно стоящая связь, потому что тип `chapter` появится на этапе 2
и свойство для неё ещё не объявлено.

## Правила валидации, применимые к этой связи

`relation.subject.exists`, `relation.object.exists`, `relation.subject_not_object`,
`relation.allowed_subject_type`, `relation.allowed_object_type`,
`relation.cardinality.subject_to_object` (не более одного целого), `relation.uniqueness`.
Дополнительно на этапе 2: правило отсутствия цикла в цепочке «часть — целое».

## Открытые вопросы

- [ ] Проверка отсутствия цикла в цепочке частей — правило появится на шаге 7 вместе с прочими
      структурными проверками.
- [ ] Дублирование `order` и номера в названии главы: что первично. Решается при описании типа `chapter`.

## История изменений

| Дата | Версия | Что изменилось | Ссылка |
|---|---|---|---|
| 2026-10-22 | 0.4.0 | Карточка создана | [[../../adr/ADR-009-relations-model\|ADR-009]] |
