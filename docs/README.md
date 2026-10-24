---
doc_type: docs_index
title: Структура документации проекта
status: draft
version: 0.3.9
created: 2026-10-22
updated: 2026-10-23
---

# Документация проекта

> [!info] Этот файл — оглавление
> Здесь описано, что где лежит и почему именно так. Обновляется при добавлении нового типа документа.

## Дерево каталогов

```text
project-root/
├── README.md                     # что это за проект, как поставить плагин, как читать документы
├── docs/
│   ├── README.md                 # ← этот файл: навигация и правила ведения документации
│   ├── CHECKPOINT.md             # контрольная точка: состояние проекта для переноса в новую сессию
│   ├── inbox/                    # ИСХОДНЫЕ черновики пользователя: не редактируются никогда
│   │   └── README.md             # состав, актуальность версий, ссылки на анализ
│   ├── metamodel/                # ЧТО мы описываем: правила устройства базы знаний
│   │   ├── analysis-01-incoming-drafts.md  # диагноз исходных черновиков (Фаза 1)
│   │   ├── analysis-01-spec-relevance.md   # ✅ шаг 0: разметка актуальности 19 разделов спецификации 01 (закрывает C-09)
│   │   ├── analysis-contradictions.md      # реестр C/D/U/G с идентификаторами (A9: 51 из 52 решены, G-05 → шаг 9)
│   │   ├── 00-overview.md        # ✅ входная точка: общий вид, принципы, схема целиком (Mermaid); actual (DL-212)
│   │   ├── 01-classification.md  # ✅ классификация: taxonomy → facet → category, два теста, tags
│   │   ├── 02-entities.md        # ✅ реестр всех типов (53 записи, пересчёт A9) + реестр TYPE_PREFIX
│   │   ├── entities/             # ✅ по одному файлу на тип сущности (все 15 карточек ядра, DL-217)
│   │   │   ├── book.md           # ✅ образец формы
│   │   │   ├── person.md         # ✅ образец формы
│   │   │   ├── chapter.md        # ✅
│   │   │   ├── media.md          # ✅
│   │   │   ├── project.md        # ✅
│   │   │   └── …                 # ✅ ещё 10: knowledge, work, activity, object_type, property, relation_type, relation, taxonomy, facet, category
│   │   ├── 03-relations.md       # ✅ связи: два способа хранения, реестр типов отношений
│   │   ├── relations/            # ✅ по одному файлу на связь: authorship, ownership, part_of, related_to, contains
│   │   │   └── rel_<имя>.md
│   │   ├── 04-attributes.md      # ✅ системные и предметные поля, 7 типов значений, даты, applies_when
│   │   ├── 05-enumerations.md    # ✅ реестр 26 перечислений (25 закрыто), единый стиль значений
│   │   ├── 06-time-and-intervals.md   # ✅ даты, частичные даты, интервалы, шаблон вывода
│   │   ├── 07-hierarchy.md       # ✅ дерево типов, три уровня, абстрактные типы, смена типа (accepted, DL-212)
│   │   ├── 08-views.md           # ✅ представления: 12 штук, mechanism, .base в Views/
│   │   ├── 09-modules.md         # ✅ модули: 45 MVP / 12 отложенных / 12 нереализуемых, Svelte
│   │   ├── 10-migration-rules.md # ✅ правила миграций (accepted; движок — этап 2)
│   │   ├── 11-rdf-extension.md   # ✅ направление RDF: объяснительный минимум, сопоставление, границы (accepted, DL-211)
│   │   └── 12-links-and-aliases.md  # ✅ пустые ссылки и сбор aliases
│   ├── validation/
│   │   ├── rules.md              # ✅ единый реестр 167 правил с ID, уровнями и номером уровня контроля
│   │   └── severity-policy.md    # ✅ политика уровней, 6 уровней контроля, формат диагностики
│   ├── adr/                      # важные и трудноотменяемые решения (разбор вариантов)
│   │   ├── ADR-001-identity-and-file-naming.md          # ✅
│   │   ├── ADR-002-source-of-truth.md                   # ✅
│   │   ├── ADR-003-bilingual-keys-and-label-layer.md    # ✅
│   │   ├── ADR-004-first-pass-scope-and-command-driven-authoring.md  # ✅
│   │   ├── ADR-005-classification-model.md              # ✅
│   │   ├── ADR-006-system-attributes-value-types-media.md  # ✅
│   │   ├── ADR-007-facet-independence.md                # ✅
│   │   ├── ADR-008-media-property-type.md               # ✅
│   │   ├── ADR-009-relations-model.md                   # ✅
│   │   ├── ADR-010-relation-storage.md                  # ✅
│   │   ├── ADR-011-enumerations-dates-lifecycle.md      # ✅
│   │   └── ADR-NNN-<slug>.md                            # шаблон имени
│   ├── decisions/
│   │   └── decision-log.md       # журнал всех договорённостей одной строкой
│   ├── changelog/
│   │   └── CHANGELOG.md          # история изменений по версиям (semver)
│   ├── glossary/
│   │   └── glossary.md           # словарь терминов (обязателен к ведению)
│   ├── roadmap/
│   │   ├── phases.md             # этапы реализации: что в каждом, критерии готовности этапа
│   │   ├── mvp-scope.md          # границы MVP: что точно входит и что точно не входит
│   │   ├── readiness-checklist.md# чек-лист «метамодель готова к реализации»
│   │   └── readiness-report.md   # итоговый отчёт блока F: 32 пункта с доказательствами + отложенное
│   ├── integrations/
│   │   ├── research-front-matter-title-stability.md   # ✅ исследование стабильности
│   │   ├── obsidian-bases.md     # ✅ карточка: использовать (генерация .base)
│   │   ├── templater.md          # ✅ карточка: отклонён как зависимость, сосуществование совместимо
│   │   ├── front-matter-title.md # ✅ карточка: необязательный адаптер с мягким отказом
│   │   ├── dataview.md           # ✅ карточка: отклонён (DL-191/195)
│   │   ├── fileclass.md          # ✅ карточка: референс, не зависимость (плагин сменился в 2026!)
│   │   ├── metadata-menu.md      # ✅ карточка: референс, не зависимость
│   │   └── quickadd.md           # ✅ карточка: deferred — этап 2, «быстрый захват»
│   ├── plugin/                   # появляется в Фазе 5
│   │   ├── architecture.md       # устройство плагина: модули, поток данных
│   │   ├── user-guide.md         # руководство пользователя
│   │   ├── development.md        # как собрать и запустить локально, команды, тесты
│   │   └── testing.md            # что тестируем и как
│   ├── project-map/
│   │   └── PROJECT_MAP.md        # карта проекта: цель, фаза, решено, открыто, риски
│   └── templates/                # шаблоны документов (см. ниже)
│       ├── adr-template.md
│       ├── entity-template.md
│       ├── relation-template.md
│       ├── decision-log-template.md
│       ├── changelog-template.md
│       ├── glossary-template.md
│       ├── validation-rule-template.md
│       └── integration-template.md
├── schema/                       # машиночитаемые описания: JSON Schema, Draft 2020-12 (DL-222)
│   ├── common/defs.json          # ✅ общие $defs: ULID, системная шапка, ссылки, даты, enum-ы
│   ├── metamodel/                # ✅ схемы слоя 2 (6): object_type, property, relation_type, taxonomy, facet, category
│   ├── entities/                 # ✅ схемы слоя 3 (батчи 2–4): book, person, media, chapter, project, knowledge — все 6 предметных типов ядра
│   └── relations/                # ✅ relation-line.schema.json — строка .jsonl реифицированной связи (батч 5, ADR-010)
├── examples/                     # живые примеры: заметки в YAML/Markdown, заполненные по метамодели
│   ├── instances/                # ✅ примеры экземпляров (62 файла, 13 типов): минимумы D3/D4 выполнены — батчи 2–6 (DL-227…DL-237)
│   ├── relations/                # ✅ примеры строк .jsonl: valid/invalid + README с разбором (батч 5)
│   └── templates/                # ✅ шаблоны заметок для команд создания (D5 — батч 6): 12 Markdown-типов + relation-row.json + README
├── scripts/check-examples.cjs    # ✅ прогонщик примеров: npm run check (ajv + js-yaml, DL-227)
├── package.json / .gitignore     # ✅ dev-зависимости прогонщика (ajv, js-yaml)
└── src/                          # код плагина (Фаза 5)
```

## Почему такая структура

| Решение | Обоснование |
|---|---|
| Отдельная папка на тип документа | Легко найти и легко проверить полноту: видно, чего не хватает |
| `entities/` и `relations/` — по файлу на объект | Файлы остаются короткими. Правки не конфликтуют. Прямые ссылки `[[…]]` работают |
| Связь описывается один раз, а не в двух сущностях | Один источник правды. Иначе копии разъезжаются |
| Нумерация файлов `00-`, `01-`, … в `metamodel/` | Документы выстраиваются в порядок чтения сверху вниз: от общего к частному |
| `schema/` и `examples/` отдельно от `docs/` | Это не текст для чтения, а вход для программ: их использует код и тесты |
| `docs/project-map/` | Страховка от потери контекста: файл, который можно вставить в новую сессию |
| `docs/templates/` | Одинаковая форма документов = меньше ошибок и быстрее проверка полноты |

## Правила ведения

1. **Новое решение → артефакт сразу.** Не накапливаем «на потом».
2. **Новые файлы создаём, старые не удаляем.** Устаревшему ставим `status: deprecated` или
   `superseded` + `superseded_by: <путь>` и дату.
3. **Каждый артефакт имеет frontmatter** с полями: `doc_type`, `status`, `version`, `created`, `updated`.
4. **Русский язык в тексте, английский в идентификаторах.** Идентификатор при первом появлении объясняется.
5. **Термины** — в [[glossary|глоссарий]] сразу, в тексте даётся ссылка, а не повторное объяснение.
6. **Каждое изменение метамодели** сопровождается записью в changelog и, если решение важное, ADR.
7. **В Obsidian-синтаксисе**: внутренние ссылки `[[…]]`, предупреждения через callout `> [!warning]`,
   диаграммы — Mermaid.
8. **Git-коммиты** делает пользователь. Ассистент предлагает готовое сообщение коммита для каждого артефакта.

## Версионирование

| Что | Как версионируется | Где записано |
|---|---|---|
| Метамодель | semver: `MAJOR.MINOR.PATCH` | `docs/changelog/CHANGELOG.md`, поле `metamodel_version` в артефактах |
| Плагин | semver, отдельно от метамодели | `manifest.json`, `CHANGELOG.md` (с Фаза 5) |
| Документы | свой `version` в frontmatter + `status` | в самом документе |

До утверждения ядра метамодель имеет версию `0.x.y` — это сигнал «черновик, возможны ломающие изменения».
Версия `1.0.0` ставится только после явного подтверждения пользователя, что метамодель утверждена.

## Соглашение об именах (требует подтверждения — см. DL-010)

| Что | Формат | Пример |
|---|---|---|
| Имя типа сущности (`entity_id`) | `snake_case`, единственное число | `project`, `person`, `source` |
| Имена полей (`attribute`) | `snake_case` | `started_on`, `owner_id` |
| Имена связей (`relation_id`) | `rel_<source>_<target>` или `rel_<source>_<target>_<role>` | `rel_project_person_owner` |
| Имена правил валидации | `<entity>.<field>.<проверка>` | `project.status.required` |
| Имена файлов | латиница, дефисы, нижний регистр | `01-classification.md` |
| Значения enum | `snake_case`, латиница | `in_progress`, не `In Progress` |

> [!tip] Почему английский
> Идентификаторы попадают в код, в JSON Schema и в frontmatter заметок. Латиница без пробелов и
> без смены регистра избавляет от ошибок, которые трудно заметить глазами (например, `Status` и `status` —
> два разных имени для программы).
