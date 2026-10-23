---
doc_type: entity
entity_id: relation
title: "Отношение (экземпляр связи)"
type_key: relation
type_prefix: RELATION
aliases: [Отношения, Связи, relation]
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
  - docs/adr/ADR-009-relations-model.md
  - docs/adr/ADR-010-relation-storage.md
governing_documents:
  - docs/metamodel/03-relations.md
tags: [metamodel, entity, core, system]
---

# Relation (Отношение) — системный тип

> **Группа:** ядро, системные (метамодель) · **Префикс:** `RELATION` · **`abstract`:** нет
> Карточка **сокращённая** (мера M1 ADR-006): состав полей — `03-relations` §4, хранение — §5,
> ADR-010.

## 1. Назначение

**Реифицированная связь**: экземпляр `relation` — конкретный факт «субъект — тип отношения —
объект» с локальными свойствами. Реификация нужна, когда у самой связи есть данные
(порядок главы, роль, период) — `03-relations` §1.

## 2. Состав полей (норма — `03-relations` §4)

Тип отношения (ссылка на `relation_type`), субъект и объект (ссылки на объекты),
`origin_property` (по какому свойству связь объявлена), локальные свойства — `role`, `order`,
`starts_on`, `ends_on`, `description`; **сокращённый набор системных атрибутов** (§4: `id` —
ULID с префиксом `RELATION`, служебные поля; полной восьмёрки нет — связь не Markdown-заметка).

## 3. Хранение — `.sb/` (ADR-010)

Экземпляры `reified`-связей живут в `.sb/relations/*.jsonl` — **JSON Lines, по одному объекту
на строку**, а не в Markdown: граф Obsidian остаётся чистым. Это **основные данные** (не кэш):
изменения только через снимки (раздел 10), повреждённые строки изолируются модулем
`relation-store`. `direct`-связи экземпляров `relation` не имеют — они хранятся во frontmatter
объектов.

## 4. Каскады и обратная сторона

Каскадное поведение при удалении/изменении — `03-relations` §6; обратная сторона **вычисляется**
(§7, ADR-009) и отдельно не хранится.

## 5. Валидация

Группа **F** реестра: `relation.subject.exists`, `relation.object.exists`,
`relation.origin_property.exists`, `relation.period.order`, `relation.order.no_gap` (главы)
и др. Новых правил карточка не добавляет.

## 6. Открытые вопросы

Нет.

## 7. Этап реализации и модуль

Этап **C**; модули: `relation-store` (атомарная запись `.jsonl`), `relation-index`
(граф в памяти), `relation-service` (создание/удаление, локальные свойства, каскады),
`chapter-service` (нумерация глав, И7).

## 8. История изменений

| Дата | Версия метамодели | Что изменилось | Причина | Ссылка |
|---|---|---|---|---|
| 2026-10-23 | 0.22.0 | Сокращённая карточка создана: систематизация норм `03-relations` §4–§7, ADR-009/010 (`.sb/relations/*.jsonl`, сокращённый набор системных атрибутов, вычисляемая обратная сторона); новых норм не вводит | Вторая партия карточек ядра (DL-213/216) | [[../03-relations]] |
