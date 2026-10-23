---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2BD
type: project
title: Написать статью о Second Brain
aliases:
  - Написать статью о Second Brain
created_at: 2026-10-23T17:25
updated_at: 2026-10-23T17:25
status: paused
owner: "[[PERSON-01J8Z6M4K2Q7V9X3N5B0C1D2EF.md|Михаил Булгаков]]"
goal: Статья на 15 000 знаков принята редакцией
started_on: "2026-09-15"
due_on: "2027-03-01"
progress: 35
paused_reason: Жду ответа редактора по структуре
next_action: Написать напоминание редактору, если тишина до 1 ноября
related_to:
  - "[[KNOWLEDGE-01J8Z6M4K2Q7V9X3N5B0C1D2FR.md|Чтение замедляет снижение когнитивных функций]]"
---

Заметки: черновик на 5 000 знаков готов, план утверждён наполовину.

Корректный экземпляр `project`, статус `paused` (батч 6, D3).

- два условных свойства `paused`: `paused_reason` **и** `next_action`
  (включается при `active` и `paused` — одно свойство на два статуса, М7);
- «блокировка» отдельным статусом **не** заводится — это `paused` + `paused_reason`
  (DL-234, вопрос 9-9 ответ А: `blocked`/`backlog` не введены);
- `owner` строкой (кардинальность `1` — строка или список из одного);
- `progress: 35` заморозили вместе со статусом; `project.overdue` (warning) сработает
  только для `active` — пауза с просроченным сроком не «шумит»;
- `related_to` → знание: пара project↔knowledge (карточка §5, DL-234).

Схема: `schema/entities/project.schema.json`.
