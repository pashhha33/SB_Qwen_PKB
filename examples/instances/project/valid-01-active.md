---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2FH
type: project
title: Перевести библиотеку на Second Brain
aliases:
  - Перевести библиотеку на Second Brain
created_at: 2026-10-22T18:40
updated_at: 2026-10-24T10:30
status: active
owner:
  - "[[PERSON-01J8Z6M4K2Q7V9X3N5B0C1D2EF.md|Михаил Булгаков]]"
goal: Все книги связаны с авторами, у половины есть обложки
description: Перенос карточек книг из старой системы в новую метамодель.
started_on: "2026-09-01"
due_on: "2026-12-31"
progress: 60
next_action: Разобрать папку «Веб-новелы» и проставить format
categories:
  - "[[CATEGORY-01J8Z6M4K2Q7V9X3N5B0C1D2E4.md|Second Brain]]"
related_to:
  - "[[KNOWLEDGE-01J8Z6M4K2Q7V9X3N5B0C1D2FV.md|Идея: галерея обложек в полке прочитанного]]"
tags:
  - основное
---

Заметки по ходу проекта: что сделано, что мешает.

Корректный экземпляр `project`, статус `active` (батч 4, D3). Что демонстрирует:

- обязательные `status` (закрытое перечисление из 5 значений — DL-234) и `owner`
  (ссылка на `person`, связь `ownership`, кардинальность `1`; **текст «Анна» вместо
  ссылки — ошибка схемы**);
- условное свойство статуса `active` — `next_action` (в форме видны только поля
  своего статуса; `done_on`/`abandoned_reason` скрыты, но если были введены при другом
  статусе — значения законны и не удаляются, М1/М2);
- `goal` и `description` — разные поля: что за проект и какой результат считается
  достижением (иначе «готово» нельзя проверить);
- `progress: 60` — **целое** 0–100 (схема); в режиме `view` рисуется
  `▓▓▓▓▓▓░░░░ 60 %` (`display.renderer: progress`, DL-123); символы шкалы в данных
  не хранятся (принцип DL-117);
- даты — в кавычках (конвенция батча 2); `started_on ≤ due_on` проверит runner
  (`project.dates.order`, error — схема две строки сравнить не может);
- `related_to` → знание: пара project↔knowledge по карточке §5; канбан В6 группирует
  проекты по `status` (порядок колонок `idea → active → paused → done → dropped`).

- Схема: `schema/entities/project.schema.json`.
- Карточка типа: `docs/metamodel/entities/project.md`.
