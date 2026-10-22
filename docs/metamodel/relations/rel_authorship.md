---
doc_type: relation
relation_id: rel_authorship
title: "Авторство"
status: actual
version: 0.1.0
created: 2026-10-22
updated: 2026-10-22
metamodel_version: 0.4.0
source_entity: book
target_entity: person
direction: directed
link_mode: direct
storage: frontmatter_wikilink
phase: 1
governing_adr: docs/adr/ADR-009-relations-model.md
tags: [metamodel/relation]
---

# rel_authorship. Авторство

## Смысл связи
Книга написана человеком. Проверяется фразами: «Книга — автор → Человек» и «Человек — автор произведения → Книга».

## Роли

| Конец связи | Поле | Значение | Как читается |
|---|---|---|---|
| source: `book` | `forward_label` | `автор` | «Книга — автор → Человек» |
| target: `person` | `reverse_label` | `автор произведения` | «Человек — автор произведения → Книга» |

## Кардинальность

| Сторона | Поле | Значение | Формулировка |
|---|---|---|---|
| От `book` к `person` | `subject_to_object` | `1..N` | У книги минимум один автор, может быть несколько |
| От `person` к `book` | `object_to_subject` | `0..N` | У человека может не быть книг или быть много |

## Допустимые и предпочтительные типы

| Поле | Значение |
|---|---|
| `allowed_subject_types` | `book`. На этапе 2 — наследники `work` |
| `allowed_object_types` | `person`. На этапе 2 — также `organization` |
| `suggested_subject_types` | пусто |
| `suggested_object_types` | пусто |

## Прочее

| Параметр | Значение |
|---|---|
| `direction` | `directed` |
| `uniqueness_rule` | `triple` |
| `link_mode` у свойства `author` | `direct` — у авторства нет собственных данных |
| Хранение | `"[[PERSON-….md|Михаил Булгаков]]"` в поле `author` книги |

> [!note] Почему `direct`, а не `reified`
> У авторства книги нет периода, порядка или источника. Порядок соавторов при необходимости задаётся
> порядком элементов списка во frontmatter (уточняется на шаге 7). Если понадобится роль «соавтор»
> или «редактор» с датами — это отдельное свойство с `link_mode: reified` на том же типе отношения
> «Участие», и конфликт исключается полем `origin_property`.

## Пример

```yaml
---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2F3
type: book
title: The Master and Margarita
aliases:
  - Мастер и Маргарита
author:
  - "[[PERSON-01J8Z6M4K2Q7V9X3N5B0C1D2EF.md|Михаил Булгаков]]"
---
```

## Правила валидации, применимые к этой связи

`relation.subject.exists`, `relation.object.exists`, `relation.allowed_subject_type`,
`relation.allowed_object_type`, `relation.cardinality.subject_to_object`,
`relation.cardinality.object_to_subject`, `relation.uniqueness`, `relation.no_duplicate_link`.

## История изменений

| Дата | Версия | Что изменилось | Ссылка |
|---|---|---|---|
| 2026-10-22 | 0.4.0 | Карточка создана | [[../../adr/ADR-009-relations-model\|ADR-009]] |
