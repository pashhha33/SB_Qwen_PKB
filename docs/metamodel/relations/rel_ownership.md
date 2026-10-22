---
doc_type: relation
relation_id: rel_ownership
title: "Владение"
status: actual
version: 0.1.0
created: 2026-10-22
updated: 2026-10-22
metamodel_version: 0.4.0
source_entity: project
target_entity: person
direction: directed
link_mode: direct
storage: frontmatter_wikilink
phase: 1
governing_adr: docs/adr/ADR-009-relations-model.md
tags: [metamodel/relation]
---

# rel_ownership. Владение

## Смысл связи
У проекта есть владелец — человек, отвечающий за него. Проверяется фразами: «Проект — владелец → Человек»
и «Человек — владеет → Проект».

## Роли

| Конец связи | Поле | Значение |
|---|---|---|
| source: `project` | `forward_label` | `владелец` |
| target: `person` | `reverse_label` | `владеет` |

## Кардинальность

| Сторона | Поле | Значение | Формулировка |
|---|---|---|---|
| От `project` к `person` | `subject_to_object` | `1` | У проекта ровно один владелец |
| От `person` к `project` | `object_to_subject` | `0..N` | У человека может не быть проектов или быть много |

## Допустимые типы

| Поле | Значение |
|---|---|
| `allowed_subject_types` | `project`. На этапе 2 — наследники `activity` |
| `allowed_object_types` | `person`. На этапе 2 — также `organization` |

## Прочее

| Параметр | Значение |
|---|---|
| `direction` | `directed` |
| `uniqueness_rule` | `triple` |
| `link_mode` у свойства `owner` | `direct` |
| Хранение | `owner: "[[PERSON-….md|Анна]]"` |

> [!note] Кардинальность `1` делает поле обязательным
> Пара `subject_to_object: 1` у связи и `cardinality: 1` у свойства `owner` согласованы: правило
> `property.required.cardinality_consistency` требует `required: true`.

## Правила валидации, применимые к этой связи

`relation.subject.exists`, `relation.object.exists`, `relation.allowed_subject_type`,
`relation.allowed_object_type`, `relation.cardinality.subject_to_object` (ровно один владелец),
`relation.uniqueness`, `relation.no_duplicate_link`.

## История изменений

| Дата | Версия | Что изменилось | Ссылка |
|---|---|---|---|
| 2026-10-22 | 0.4.0 | Карточка создана | [[../../adr/ADR-009-relations-model\|ADR-009]] |
