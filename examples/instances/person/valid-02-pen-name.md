---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2EG
type: person
title: Макс Фрай
aliases:
  - Макс Фрай
  - Светлана Мартынчик
  - С. Мартынчик
created_at: 2026-10-22T15:10
updated_at: 2026-10-23T11:25
birth_name: Светлана Мартынчик
birth_date: "1965-05-04"
sort_name: Фрай, Макс
role:
  - author
  - blogger
pen_name:
  - Макс Фрай
also_known_as:
  - С. Мартынчик
writing_languages:
  - "[[CATEGORY-01J8Z6M4K2Q7V9X3N5B0C1D2E2.md|русский]]"
---

Корректный экземпляр `person`: современный автор под псевдонимом (батч 2, D3).

Что демонстрирует:

- **одно лицо — одна запись** (контрпример карточки §3): `title` — псевдоним (под ним
  выходят книги, его ищет пользователь), `birth_name` — имя при рождении,
  `pen_name` — творческий псевдоним, `also_known_as` — варианты и прозвища
  (три поля вместо одного «настоящего имени», DL-151);
- все варианты имени продублированы в `aliases` — иначе поиск Obsidian их не найдёт
  (`person.pseudonym.in_aliases`, warning — runner); движение одностороннее:
  из полей в `aliases`, собранные псевдонимы раздела 12 в `birth_name`/`pen_name` не попадают;
- `role: [author, blogger]` — оба значения группы «Литература и текст»;
  условные свойства группы: `writing_genres`, `writing_languages`, `published_works`
  (`pen_name` — **базовое** свойство, а не условное: DL-151; устаревшая строка §3.17.5
  исправлена в батче 2);
- `aliases[0] == title` (И4) соблюдён.

- Схема: `schema/entities/person.schema.json`.
