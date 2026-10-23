---
doc_type: entity
entity_id: object_type
title: "Тип объекта"
type_key: object_type
type_prefix: OBJECT_TYPE
aliases: [Типы объекта, object_type]
status: actual
metamodel_version: 0.22.0
created: 2026-10-23
updated: 2026-10-23
classification: core
group: Системные (метамодель)
abstract: false
inherits_from: []
phase: 1
governing_adr:
  - docs/adr/ADR-004-first-pass-scope-and-command-driven-authoring.md
  - docs/adr/ADR-006-system-attributes-value-types-media.md
governing_documents:
  - docs/metamodel/02-entities.md
  - docs/metamodel/07-hierarchy.md
tags: [metamodel, entity, core, system]
---

# Object_type (Тип объекта) — системный тип

> **Группа:** ядро, системные (метамодель) · **Префикс:** `OBJECT_TYPE` · **`abstract`:** нет —
> экземпляры создаются (экземпляр `object_type` — это конкретный тип объекта)
> Карточка **сокращённая** (мера M1 ADR-006): состав полей задан нормативными разделами,
> карточка систематизирует и ссылается, не дублируя.

## 1. Назначение

Основа **самоопределяемости** модели (ADR-004): описание типа — такой же объект базы, как книга
или человек. Экземпляр `object_type` — это определение «Книга», «Человек», «Знание»… со своими
`id` и `type: object_type`.

## 2. Состав полей (норма — не дублируется)

| Поле | Норма |
|---|---|
| `type_key` (англ., `snake_case`, уникален), `label` (русский, свободный) | ADR-003, `04-attributes` §7 |
| `TYPE_PREFIX` (верхний регистр, уникален **как целая строка**) | `02-entities` (реестр префиксов; оговорка про `RELATION`/`RELATION_TYPE`) |
| `abstract` (признак), `parent_type` (**только непосредственный родитель**) | `01-classification` §4–§5, `07-hierarchy` |
| `lifecycle` (`standard` / `simplified` / `none`) | ADR-011 |
| Свойства типа | Экземпляры `property`, связанные с этим типом |

## 3. Где живёт и как создаётся

Markdown-заметка в `Metamodel/**` (ADR-002). Создание и правка — **только командами**
(`create-type` и др., ADR-004, П1–П6) с прохождением 8-шаговой последовательности
(черновик v1.1 §15.4): проверка совместимости обязательна.

## 4. Связи с другими типами метамодели

- `property` — свойства типа (обратная сторона — принадлежность);
- `relation_type` — `allowed_subject_types` / `allowed_object_types` ссылаются на экземпляры
  `object_type` (семантика потомков — `07-hierarchy` §7, DL-208/209);
- `taxonomy` / `facet` — `allowed_object_types` (та же семантика).

## 5. Валидация

Группы реестра: **A** (системные атрибуты, `object.type.not_abstract`), **B**
(`object_type.parent.exists`, `object_type.parent.no_cycle`, `object_type.abstract.no_instance`,
уникальность ключей и префиксов). Новых правил карточка не добавляет.

## 6. Открытые вопросы

Нет. Реестр `TYPE_PREFIX` и состав типов — `02-entities` (пересчёт сводки — пункт A9).

## 7. Этап реализации и модуль

Этап **B**; модули: `schema-engine`, `type-registry`, команда `create-type` (`mvp-scope` §2).

## 8. История изменений

| Дата | Версия метамодели | Что изменилось | Причина | Ссылка |
|---|---|---|---|---|
| 2026-10-23 | 0.22.0 | Сокращённая карточка создана: систематизация норм ADR-003/004/006/011, `01-classification` §4–§5, `07-hierarchy`; новых норм не вводит | Вторая партия карточек ядра (DL-213/216) — 12 из 15 | [[../02-entities]], [[../07-hierarchy]] |
