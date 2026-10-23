# Примеры строк `.sb/relations/relations.jsonl` (батч 5, D3/D4)

Реифицированные связи хранятся в JSON Lines (ADR-010): **одна строка JSON на связь**.
Схема: `schema/relations/relation-line.schema.json`. В MVP единственный реифицированный
тип отношения — `contains` (`authorship`, `ownership`, `related_to` — `direct`, живут
во frontmatter объектов; `part_of` — вычисляемая обратная сторона `contains` и отдельной
записью **не хранится**, Р11 + `relation.contains.single_record`).

## Файлы

| Файл | Ожидание прогонщика |
|---|---|
| `valid-01-contains.jsonl` | **все 3 строки валидны**: глава (`role: chapter`, `order: 7`), интерлюдия (`order: 7.5` — дробный порядок без перенумерации хвоста), пролог (`order: null` — часть вне нумерации, Н2) |
| `valid-02-free-standing.jsonl` | **строка валидна**: свободно стоящая связь (`origin_property: null` — создана из общего блока связей, а не из свойства; Р3/DL-090) |
| `invalid-01.jsonl` | **все 6 строк невалидны** — разбор ниже |

## Разбор `invalid-01.jsonl` (строка → нарушение → кто ловит)

| Строка | Нарушение | Правило реестра | Кто ловит |
|---|---|---|---|
| 1 | Нет ключа `subject` | `relation.subject.exists` / формат строки | **схема** (`required`) |
| 2 | `relation_type` — wikilink `[[RELATION_TYPE-….md\|…]]` вместо голого ULID | формат ADR-010 («ссылки — голые `id`») | **схема** (паттерн `ulid`) |
| 3 | `type: "contains"` вместо `"relation"` | 03-relations §4: `type` у экземпляра связи всегда `relation`, конкретный тип — в `relation_type` | **схема** (`const`) |
| 4 | `starts_on: "2019-13-01"` — месяц 13 | `date.format` / `date.range.valid` | **схема** (паттерн `date`) |
| 5 | `order: "11"` — строка вместо числа | `value.type_conformance` | **схема** (`type: number\|null`) |
| 6 | Ключ `description` **пропущен** вместо `null` | ADR-010: «пустые значения — `null`, а не пропуск ключа» | **схема** (`required`) — каноническая строка обязана содержать все 14 полей ядра |

## Что схема НЕ ловит (остаётся у `validation-runner`)

| Проверка | Правила |
|---|---|
| `subject`/`object`/`relation_type`/`origin_property` — голые ULID **без префикса**: существование и тип объекта-цели схема не определит | `relation.subject.exists`, `relation.allowed_subject_type`, `relation.origin_property.*` (error) |
| Уникальность (тройка «субъект — тип — объект» или пара) с учётом обеих сторон симметричной связи | `relation.uniqueness` (error) |
| Кардинальности (`object_to_subject: 0..1` у contains — часть не входит в два произведения) | `relation.cardinality.*` (error) |
| Специфика `contains`: `order` нужен у нумерованных частей; `role` — значение `chapter_role`; уникальность `order` в пределах `subject`; разрывы нумерации | `relation.order.unique_per_subject` (error), `relation.order.no_gap` (warning) — схема не может ветвиться по `relation_type`, потому что там ULID, а не key |
| `starts_on ≤ ends_on`; `ends_on: null` = «по настоящее время» | `relation.period.order` (error), `relation.period.open` (info) |
| Файловые правила: UTF-8 без BOM, LF (прогонщик проверяет BOM у примеров) | уровень 2 (техническая проверка) |

## Конвенции примеров

- ULID иллюстративные (DL-019); строки согласованы с примерами сущностей: книга
  `01J8Z6M4K2Q7V9X3N5B0C1D2G4` («Путь Восхождения», `examples/instances/book/valid-02-web-novel.md`),
  главы `…F8` (глава 7) и `…F9` (пролог) из `examples/instances/chapter/`.
- `order: null` у пролога — **предложение DL-236** по Н2 (часть вне нумерации в порядке
  не участвует); кнопка «предыдущая» у главы 1 создаёт пролог именно так (Н5).
- Все ключи ядра присутствуют в каждой строке; `null` — для пустых значений (ADR-010).
