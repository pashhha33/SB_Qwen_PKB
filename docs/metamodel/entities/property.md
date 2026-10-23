---
doc_type: entity
entity_id: property
title: "Свойство"
type_key: property
type_prefix: PROPERTY
aliases: [Свойства, property]
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
  - docs/adr/ADR-003-bilingual-keys-and-label-layer.md
  - docs/adr/ADR-006-system-attributes-value-types-media.md
governing_documents:
  - docs/metamodel/04-attributes.md
  - docs/metamodel/12-links-and-aliases.md
tags: [metamodel, entity, core, system]
---

# Property (Свойство) — системный тип

> **Группа:** ядро, системные (метамодель) · **Префикс:** `PROPERTY` · **`abstract`:** нет
> Карточка **сокращённая** (мера M1 ADR-006): состав полей — `04-attributes` §4, §10, §11.

## 1. Назначение

Описание поля объекта: экземпляр `property` — это определение «Автор», «Год издания»,
«Обложка»… Принадлежит типу объекта (`object_type`) или применяется через `applies_when`.

## 2. Состав полей (норма — `04-attributes`)

| Поле | Норма |
|---|---|
| `key` (англ., `snake_case`), `label` (русский) | ADR-003, §4, §7 |
| `value_type` — один из **7** (набор закрыт кодом, слой 1) | ADR-006, §2 |
| `cardinality` — единственный механизм множественности (`0..1`, `1`, `0..N`, `1..N`) | ADR-006, §4 («Про `required` и `cardinality`») |
| `required` | §4 |
| `applies_when` — условные свойства (триггеры, `includes_any`, правила М1–М7) | §11 |
| `create_from_link` (`allow` / `forbid` / `auto`) | `12-links-and-aliases` §5–§6 |
| `target_types` — для `object_reference` / `media_reference` | §4, §10 |
| Значения-перечисления | `05-enumerations` |

## 3. Где живёт и как создаётся

Markdown-заметка в `Metamodel/**` (ADR-002); создание — команда `create-property`
(8 шагов §15.4; удаление свойства у родителя затрагивает потомков — `07-hierarchy` §6 п.5).

## 4. Связи с другими типами метамодели

Принадлежность `object_type`; `target_types` → экземпляры `object_type`; перечисления →
`05-enumerations`; `create_from_link: auto` → правила создания объекта из пустой ссылки
(раздел 12, контексты К1–К5).

## 5. Валидация

Группы реестра: **B** (определения свойств — 14 правил), **C** (значения), **G** (перечисления),
**D** (медиа, для `media_reference`), **M** (`create_from_link`). Новых правил карточка не добавляет.

## 6. Открытые вопросы

Нет.

## 7. Этап реализации и модуль

Этап **B**; модули: `property-definitions` (чтение определений), `schema-engine` (проверка
значений), `applies-when` (условные свойства), `property-editor` (контролы по типам значений,
слой 5).

## 8. История изменений

| Дата | Версия метамодели | Что изменилось | Причина | Ссылка |
|---|---|---|---|---|
| 2026-10-23 | 0.22.0 | Сокращённая карточка создана: систематизация норм ADR-003/006, `04-attributes` §4/§10/§11, раздела 12; новых норм не вводит | Вторая партия карточек ядра (DL-213/216) | [[../04-attributes]], [[../12-links-and-aliases]] |
