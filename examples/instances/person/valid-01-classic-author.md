---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2EF
type: person
title: Михаил Булгаков
aliases:
  - Михаил Булгаков
  - Mikhail Bulgakov
  - М. Булгаков
created_at: 2026-10-22T14:35
updated_at: 2026-10-23T11:20
birth_date: "1891-05-15"
death_date: "1940-03-10"
sort_name: Булгаков, Михаил
gender: male
role:
  - author
  - physician
nationality:
  - "[[CATEGORY-01J8Z6M4K2Q7V9X3N5B0C1D2E1.md|Российская империя]]"
languages_spoken:
  - "[[CATEGORY-01J8Z6M4K2Q7V9X3N5B0C1D2E2.md|русский]]"
known_for:
  - Мастер и Маргарита
  - Собачье сердце
field_of_work:
  - медицина
writing_genres:
  - "[[CATEGORY-01J8Z6M4K2Q7V9X3N5B0C1D2E3.md|Фантастика]]"
writing_languages:
  - "[[CATEGORY-01J8Z6M4K2Q7V9X3N5B0C1D2E2.md|русский]]"
medical_specialty:
  - врач-венеролог
links:
  - "https://ru.wikipedia.org/wiki/Булгаков,_Михаил_Афанасьевич"
portrait: "[[MEDIA-01J8Z6M4K2Q7V9X3N5B0C1D2E9.md|Портрет Булгакова]]"
---

Корректный экземпляр `person`: классический автор (батч 2, D3).

Что демонстрирует:

- `role` — обязательный мультивыбор (`1..N`, DL-156): значения `author` (Литература)
  и `physician` (Медицина) — оба из закрытого перечисления `person_role`
  (40 значений, 05-enumerations §3.17.5; зашиты в схему — DL-224);
- условные свойства двух групп сразу: `known_for`/`writing_genres`/`writing_languages`
  (Литература) и `medical_specialty` (Медицина); `field_of_work` — сквозное (М7);
  в форме плагина поля спортсмена или программиста у этого человека скрыты;
- `portrait` — ссылка на **обёртку** `media` (не на голый файл); роль `portrait`/`avatar`
  проверит runner (`person.portrait.role`, warning);
- `gender` — закрытое перечисление из 3 значений (§3.17.10, DL-226 — вопрос 9.6 закрыт);
- `sort_name` без кавычек допустим (запятая в блоковом скаляре не специальная),
  формат «Фамилия, Имя» — warning runner'а;
- значение `links` с двоеточием (`https://…`) — **в кавычках** (конвенция батча 1);
- даты — в кавычках (конвенция батча 2: `Date`-объект вместо строки).

- Схема: `schema/entities/person.schema.json`.
- Карточка типа: `docs/metamodel/entities/person.md`.
