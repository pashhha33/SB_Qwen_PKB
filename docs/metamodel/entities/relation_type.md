---
doc_type: entity
entity_id: relation_type
title: "Тип отношения"
type_key: relation_type
type_prefix: RELATION_TYPE
aliases: [Типы отношений, relation_type]
status: actual
metamodel_version: 1.0.1
created: 2026-10-23
updated: 2026-10-23
classification: core
group: Системные (метамодель)
abstract: false
inherits_from: []
phase: 1
governing_adr:
  - docs/adr/ADR-009-relations-model.md
governing_documents:
  - docs/metamodel/03-relations.md
  - docs/metamodel/07-hierarchy.md
tags: [metamodel, entity, core, system]
---

# Relation_type (Тип отношения) — системный тип

> **Группа:** ядро, системные (метамодель) · **Префикс:** `RELATION_TYPE` (осторожно в коде:
> строка `RELATION` — начало `RELATION_TYPE`, сравнение префиксов только целыми строками,
> `02-entities`) · **`abstract`:** нет
> Карточка **сокращённая** (мера M1 ADR-006): состав полей — `03-relations` §3, реестр — §8.

## 1. Назначение

Задаёт семантику и правила связи: экземпляр `relation_type` — это определение «авторство»,
«владение», «часть — целое», «связано с», «содержит». Экземпляры связей (`relation`) типизируются
им.

## 2. Состав полей (норма — `03-relations` §3)

`forward_label` / `reverse_label` (как связь читается в обе стороны), `uniqueness_rule`,
`allowed_subject_types` / `allowed_object_types` (жёсткое ограничение, `error`; **семантика
потомков и абстрактных типов** — `07-hierarchy` §5, §7, DL-208/209), `suggested_subject_types` /
`suggested_object_types` (порядок и предвыбор; подмножество `allowed_*`), `definition`, признак
симметричности (`related_to` — симметричное).

Реестр: **5 типов ядра** (`authorship`, `ownership`, `part_of`, `related_to`, `contains`)
и 6 типов этапа 2 — `03-relations` §8, карточки в `relations/`.

## 3. Где живёт и как создаётся

Markdown-заметка в `Metamodel/**`; создание — командами (ADR-004). `link_mode` связи объявляется
не здесь, а в **свойстве** (`03-relations` §1–§2, ADR-009) — тип отношения задаёт семантику,
свойство — способ хранения (`direct` / `reified`) и привязку (`origin_property`).

## 4. Валидация

Группа **F** реестра (связи и типы отношений — 33 правила): `relation.type.exists`,
`relation.allowed_subject_type`, `relation.allowed_object_type`, подмножество `suggested ⊆ allowed`
и др. Новых правил карточка не добавляет.

## 5. Открытые вопросы

Открытых вопросов нет. ~~DL-101 (итоговое подтверждение реестра типов отношений) и DL-103
(состав команд по связям)~~ → **закрыты 2026-10-23 (ответ F5-2 = А, DL-243)**: реестр
ядра подтверждён в актуальном составе — **5 типов** (`authorship`, `ownership`, `part_of`,
`related_to` + `contains`, DL-125); команды по связям — `create-relation-type`,
`create-relation`, `show-object-relations` (MVP), `show-typed-graph`, `export-relations`
(этап 2). Статусы DL-101/DL-103: `предложено` → `принято`.

## 6. Этап реализации и модуль

Этапы **B–C**; модули: `relation-service`, `relation-index`, `type-registry`.

## 7. История изменений

| Дата | Версия метамодели | Что изменилось | Причина | Ссылка |
|---|---|---|---|---|
| 2026-10-23 | 1.0.1 | §5 закрыт: DL-101 (реестр ядра — 5 типов с `contains`) и DL-103 (команды по связям) подтверждены пользователем — статусы `предложено` → `принято` | Ответ F5-2 = А (пакет старта Фазы 5) | DL-243; [[../../decisions/decision-log\|decision log]] |
| 2026-10-23 | 0.22.0 | Сокращённая карточка создана: систематизация норм `03-relations` §3/§8, ADR-009, семантики потомков (DL-208/209); новых норм не вводит | Вторая партия карточек ядра (DL-213/216) | [[../03-relations]], [[../07-hierarchy]] |
