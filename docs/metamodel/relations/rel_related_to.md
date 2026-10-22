---
doc_type: relation
relation_id: rel_related_to
title: "Связано с"
status: actual
version: 0.1.0
created: 2026-10-22
updated: 2026-10-22
metamodel_version: 0.4.0
source_entity: knowledge
target_entity: knowledge
direction: symmetric
link_mode: direct
storage: frontmatter_wikilink
phase: 1
governing_adr: docs/adr/ADR-009-relations-model.md
tags: [metamodel/relation]
---

# rel_related_to. Связано с

## Смысл связи
Две записи знания связаны по смыслу, и направление не важно. Проверяется фразой: «Знание А связано
с знанием Б» — и она читается одинаково с обеих сторон.

## Роли

| Конец связи | Поле | Значение |
|---|---|---|
| source | `forward_label` | `связано с` |
| target | `reverse_label` | `связано с` |

> [!warning] Роли обязаны совпадать
> У типа отношения с `direction: symmetric` значения `forward_label` и `reverse_label` должны быть
> одинаковыми. Правило `relation_type.symmetric.labels_equal`, уровень `warning`.

## Кардинальность

| Сторона | Поле | Значение | Формулировка |
|---|---|---|---|
| От А к Б | `subject_to_object` | `0..N` | Может не быть связанных записей или быть много |
| От Б к А | `object_to_subject` | `0..N` | Симметрично |

## Допустимые типы

| Поле | Значение |
|---|---|
| `allowed_subject_types` | `knowledge`. На этапе 2 — любой тип: связь «связано с» полезна везде |
| `allowed_object_types` | то же |

## Прочее

| Параметр | Значение |
|---|---|
| `direction` | **`symmetric`** |
| `uniqueness_rule` | `pair` — две записи не должны быть связаны дважды одним и тем же смыслом |
| `link_mode` | `direct` |
| Хранение | Список wikilink-ов в поле `related` |

## Как хранится симметричная связь

Связь записывается **один раз**, в одном из двух объектов. Обратная сторона вычисляется:

```yaml
# файл знания А
---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2J0
type: knowledge
title: Second Brain
related:
  - "[[KNOWLEDGE-01J8Z6M4K2Q7V9X3N5B0C1D2J1.md|Zettelkasten]]"
---
```

В форме знания «Zettelkasten» блок «Связан с этим объектом» покажет знание «Second Brain» —
хотя в его собственном поле `related` этой записи нет.

> [!important] Правило для плагина
> При проверке кардинальности и уникальности симметричной связи плагин учитывает **обе** стороны:
> запись в поле `related` объекта А и вычисленную обратную связь в объекте Б считаются одной связью.
> Иначе правило `relation.uniqueness` сработает ложно.

## Правила валидации, применимые к этой связи

`relation.subject.exists`, `relation.object.exists`, `relation.subject_not_object`
(запись не может быть связана сама с собой), `relation.allowed_subject_type`,
`relation.allowed_object_type`, `relation.uniqueness` с учётом обеих сторон,
`relation_type.symmetric.labels_equal`.

## Открытые вопросы

- [ ] Нужна ли симметричная связь «связано с» для произвольных типов, а не только для `knowledge`.
      Предлагаю расширить на этапе 2, когда появится больше типов.

## История изменений

| Дата | Версия | Что изменилось | Ссылка |
|---|---|---|---|
| 2026-10-22 | 0.4.0 | Карточка создана | [[../../adr/ADR-009-relations-model\|ADR-009]] |
