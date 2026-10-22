---
doc_type: index
title: Шаблоны документов
status: draft
version: 0.1.0
created: 2026-10-22
updated: 2026-10-22
---

# Шаблоны документов

> [!info] Правило
> Все артефакты создаются из этих шаблонов. Если шаблон не подходит — сначала правим шаблон
> (с записью в decision log), потом создаём документ. Иначе документы разъезжаются по форме.

| Шаблон | Для чего | Куда кладём результат |
|---|---|---|
| [[adr-template]] | Важное и трудноотменяемое решение с разбором вариантов | `docs/adr/ADR-NNN-<slug>.md` |
| [[decision-log-template]] | Строка журнала договорённостей | `docs/decisions/decision-log.md` |
| [[changelog-template]] | Запись версии и изменений | `docs/changelog/CHANGELOG.md` |
| [[glossary-template]] | Строка словаря терминов | `docs/glossary/glossary.md` |
| [[entity-template]] | Описание типа сущности | `docs/metamodel/entities/<entity_id>.md` |
| [[relation-template]] | Описание связи между типами | `docs/metamodel/relations/rel_<a>_<b>.md` |
| [[validation-rule-template]] | Правило проверки данных | `docs/validation/rules.md` (раздел) |
| [[integration-template]] | Оценка стороннего плагина или возможности Obsidian | `docs/integrations/<имя>.md` |

## Шаблоны, которых пока нет (создадим по потребности)

- описание enum-а / справочника — когда дойдём до `05-enumerations.md`;
- описание этапа реализации — когда дойдём до `docs/roadmap/phases.md`;
- описание модуля — когда дойдём до `docs/metamodel/09-modules.md`;
- шаблон заметки-экземпляра — когда появится первый согласованный тип.
