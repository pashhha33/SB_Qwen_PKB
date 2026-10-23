---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2FX
type: project
title: Разобрать архив фотографий
aliases:
  - Разобрать архив фотографий
created_at: 2026-08-02T10:00
updated_at: 2026-10-15T20:10
status: done
owner: "[[PERSON-01J8Z6M4K2Q7V9X3N5B0C1D2EF.md|Михаил Булгаков]]"
goal: Все фото 2019–2024 годов разложены по годам и событиям, дубли удалены
started_on: "2026-08-02"
due_on: "2026-10-31"
done_on: "2026-10-15"
progress: 100
links:
  - "https://example.org/photo-organization-guide"
---

Итог: 12 400 файлов → 9 800; создано 23 обёртки `media` для памятных фото.

Корректный экземпляр `project`, статус `done` (батч 4, D3). Что демонстрирует:

- `owner` **строкой** (не списком): кардинальность `1` допускает и строку, и список
  из одного элемента — конвенция «строка или список» (как у `facet.taxonomy` батча 1);
- статус `done` с заполненной `done_on` — правило `project.done_date.required`
  (warning) соблюдено; `done_on ≥ started_on` проверит runner (`project.done_date.order`);
- `progress: 100` согласован со статусом `done` (`project.progress.done_consistency`,
  warning — runner);
- условных полей чужих статусов нет (`paused_reason`, `abandoned_reason`, `next_action`
  не заполнены) — но если бы проект был снят с паузы, «погасший» `paused_reason`
  остался бы законным значением (М1/М2);
- `links` — внешняя ссылка с двоеточием, в кавычках (конвенция батча 1);
- срок не нарушен: `done_on` раньше `due_on` — проект закрыт с опережением;
  при просрочке активного проекта runner выдал бы `project.overdue` (warning).

- Схема: `schema/entities/project.schema.json`.
