---
doc_type: relation
relation_id: rel_related_to
title: "Связано с"
status: actual
version: 0.2.0
created: 2026-10-22
updated: 2026-10-23
metamodel_version: 0.27.0
source_entity: [book, person, project, knowledge]
target_entity: [book, person, project, knowledge]
direction: symmetric
link_mode: direct
storage: frontmatter_wikilink
phase: 1
governing_adr: docs/adr/ADR-009-relations-model.md
tags: [metamodel/relation]
---

# rel_related_to. Связано с

## Смысл связи
Два объекта связаны по смыслу, и направление не важно. Проверяется фразой: «А связано
с Б» — и она читается одинаково с обеих сторон. В MVP — четыре предметных типа ядра
(DL-234, вопрос 9-10 ответ А); изначально карточка ограничивала связь `knowledge` —
расширение принято, потому что четыре более новые карточки сущностей уже перечисляли
широкие пары.

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
| `allowed_subject_types` | `book`, `person`, `project`, `knowledge` (DL-234). На этапе 2 — любой тип: связь «связано с» полезна везде |
| `allowed_object_types` | то же |

Свойство `related_to` каждого типа **сужает** цели по своим карточкам (§5): `book` →
knowledge/book, `person` → person/knowledge, `project` → project/knowledge/book,
`knowledge` → все четыре. Это штатный механизм ADR-009: `allowed_*` — ограничение типа
отношения (нарушение = error), `target_types` свойства — уточнение на месте.

## Прочее

| Параметр | Значение |
|---|---|
| `direction` | **`symmetric`** |
| `uniqueness_rule` | `pair` — две записи не должны быть связаны дважды одним и тем же смыслом |
| `link_mode` | `direct` |
| Хранение | Список wikilink-ов в поле **`related_to`** (ключ подтверждён DL-234, вопрос 9-11 ответ А: совпадает с `key` типа отношения; прежнее упоминание `related` устарело — схемы батчей 2–4 зашили `related_to`) |

## Как хранится симметричная связь

Связь записывается **один раз**, в одном из двух объектов. Обратная сторона вычисляется:

```yaml
# файл знания А
---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2J0
type: knowledge
title: Second Brain
related_to:
  - "[[KNOWLEDGE-01J8Z6M4K2Q7V9X3N5B0C1D2J1.md|Zettelkasten]]"
---
```

В форме знания «Zettelkasten» блок «Связан с этим объектом» покажет знание «Second Brain» —
хотя в его собственном поле `related_to` этой записи нет.

> [!important] Правило для плагина
> При проверке кардинальности и уникальности симметричной связи плагин учитывает **обе** стороны:
> запись в поле `related_to` объекта А и вычисленную обратную связь в объекте Б считаются одной связью.
> Иначе правило `relation.uniqueness` сработает ложно.

## Правила валидации, применимые к этой связи

`relation.subject.exists`, `relation.object.exists`, `relation.subject_not_object`
(запись не может быть связана сама с собой), `relation.allowed_subject_type`,
`relation.allowed_object_type`, `relation.uniqueness` с учётом обеих сторон,
`relation_type.symmetric.labels_equal`.

## Открытые вопросы

- [x] ~~Нужна ли симметричная связь «связано с» для произвольных типов, а не только для `knowledge`~~
      → **решено 2026-10-23 (DL-234, вопрос 9-10 ответ А):** в MVP — четыре предметных типа
      ядра (`book`, `person`, `project`, `knowledge`); произвольные типы — этап 2.

## История изменений

| Дата | Версия | Что изменилось | Ссылка |
|---|---|---|---|
| 2026-10-23 | 0.2.0 | DL-234 (ответы А/А/А на вопросы 9-9…9-11): допустимые типы расширены до четырёх предметных типов ядра (вопрос закрыт); ключ поля хранения — `related_to` (прежнее `related` устарело); `uniqueness_rule` — `pair` (опечатка `triple` в `03-relations` исправлена DL-233) | DL-233, DL-234, [[../../adr/ADR-009-relations-model\|ADR-009]] |
| 2026-10-22 | 0.4.0 | Карточка создана | [[../../adr/ADR-009-relations-model\|ADR-009]] |
