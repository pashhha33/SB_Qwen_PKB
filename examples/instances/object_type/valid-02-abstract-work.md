---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2WA
type: object_type
title: Work
aliases:
  - Work
created_at: 2026-10-23T17:45
updated_at: 2026-10-23T17:45
type_key: work
label: Произведение
type_prefix: WORK
abstract: true
lifecycle: standard
description: "Абстрактный корень творческой ветви: book, chapter, poem, video_game, audiovisual_work, music_work. Свойств не объявляет (DL-214)."
---

Корректный экземпляр `object_type`: абстрактный корень (батч 6, D3).

- `abstract: true` — **экземпляров типа не существует** (И3: `type` объекта указывает
  только на неабстрактный тип); префикс `WORK-` у экземпляров не встречается;
- `parent_type` отсутствует — корень ветви (`07-hierarchy` §4);
- в `allowed_subject_types`/`allowed_object_types` связей и фасетов означает
  «любой неабстрактный потомок» (DL-209): `authorship → work` покрывает книгу,
  главу, стихотворение…;
- свойств не объявляет — общность поднимается сюда только через миграцию (раздел 10),
  когда у второго потомка появится то же поле (DL-214);
- схема у `work` **отсутствует осознанно**: нечего описывать — экземпляров нет
  (сноска D1 чек-листа, DL-236).

Схема: `schema/metamodel/object_type.schema.json`.
