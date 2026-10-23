---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2EK
type: object_type
title: Book
aliases:
  - Book
created_at: 2026-10-22T14:35
updated_at: 2026-10-23T09:10
type_key: book
label: Книга
type_prefix: BOOK
abstract: false
parent_type:
  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2EA.md|Произведение]]"
lifecycle: standard
description: "Письменное произведение: роман, повесть, нон-фикшн-книга."
---

Определение типа «Книга» — пример экземпляра слоя 2 (метамодель описывает сама себя).

- Схема: `schema/metamodel/object_type.schema.json` (Draft 2020-12).
- Норма: ADR-003/004/011, `01-classification` §4–§5, `07-hierarchy` §4; карточка
  `docs/metamodel/entities/book.md` описывает свойства экземпляров этого типа.
- Родитель — абстрактный `work`: экземпляры «книга» создают тип `book`, а не `work` (И3).
  Ссылка в `parent_type` ведёт на файл **определения** типа (`OBJECT_TYPE-….md`): определение
  типа `work` — это объект типа `object_type`, а префикс `WORK-` носили бы экземпляры, которых
  у абстрактного типа нет.
- Значения с двоеточиями и спецсимволами в frontmatter заключаются в кавычки (YAML).
