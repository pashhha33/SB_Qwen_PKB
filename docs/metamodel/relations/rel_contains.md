# Тип отношения `contains` — «содержит»

> **Родитель:** `docs/metamodel/03-relations.md`
> **Дата:** 2026-10-22 · **Статус:** принят (DL-125)
> **Репозиторий:** https://github.com/pashhha33/SB_Qwen_PKB

| Поле | Значение |
| --- | --- |
| `relation_type` | `contains` |
| `label` / `label_plural` | Содержит / Содержат |
| `forward_label` | «содержит» |
| `reverse_label` | «входит в» |
| `direction` | `directed` |
| `link_mode` | **`reified`** |
| `subject_to_object` | `0..n` |
| `object_to_subject` | **`0..1`** |
| `uniqueness_rule` | `triple` |
| `allowed_subject_types` | `book`, `work`, `media`, `project`, `activity`, `collection` |
| `allowed_object_types` | `chapter`, `book`, `work`, `media`, `media_asset` |
| `suggested_object_types` | `chapter` |
| `required_for_types` | — (но для `chapter` фактически обязательна — правило **`chapter.contains.required`**) |

---

## 1. Зачем нужен

Произведение — **агрегатор** частей (требование пользователя, DL-124): книга
состоит из глав, сборник — из рассказов, проект — из задач. Без этого
отношения невозможны:

- навигация «предыдущая / следующая глава»;
- счётчик частей и их порядок;
- проверка полноты (разрывы нумерации, пустое произведение).

## 2. Почему `reified`, а не `direct`

Прямая ссылка `[[CHP-…]]` во frontmatter книги не может нести **порядок**.
Ядро связи даёт локальные свойства:

| Свойство | Тип | Назначение |
| --- | --- | --- |
| `order` | `number` | порядковый номер части (обычно равен `chapter_number`) |
| `role` | `text` | `chapter` / `prologue` / `epilogue` / `interlude` / `appendix` / `part` |
| `starts_on` / `ends_on` | `date` | не используются для глав |
| `description` | `text` | необязательное пояснение |

Хранение — `.sb/relations/relations.jsonl` (ADR-010).

## 3. Отношение к `part_of`

`contains` и `part_of` описывают одну и ту же пару объектов с двух сторон.
Чтобы не хранить одну связь дважды:

- **хранится только `contains`**;
- `part_of` объявлена **обратной стороной** `contains`;
- запрос «входит в» разрешается чтением той же записи в обратном направлении
  (правило **`relation.contains.single_record`**, ADR-009 Р9 — обратная сторона вычисляется).

Это значит: в карточке главы свойство называется `part_of_work`, но в
`.sb/relations/` лежит запись с `relation_type: contains` и
`origin_property: part_of_work`.

Карточка `relations/rel_part_of.md` остаётся в силе как **эталон `reified`-связи**, но её статус
изменён на `inverse_of: contains`: отдельной записью `part_of` не хранится.

## 4. Пример записи

```json
{"id":"01J9ZK3M4P5Q6R7S8T9V0W1X2Y","type":"relation","title":"«Произведение» содержит «Глава 7»","subject":"01J9ZH8A2B3C4D5E6F7G8H9J0K","relation_type":"01J9ZH8A2B3C4D5E6F7G8H9J0R","object":"01J9ZK3M4P5Q6R7S8T9V0W1X2Z","origin_property":"01J9ZK3M4P5Q6R7S8T9V0W1X2P","role":"chapter","order":7,"starts_on":null,"ends_on":null,"description":null,"created_at":"2026-10-22T14:05","updated_at":"2026-10-22T14:05"}
```

> [!note] Пример исправлен в батче 5 (DL-236)
> Приведён к норме `03-relations` §4 и ADR-010: `type` (always `relation`) и `title`
> обязательны; `relation_type` и `origin_property` — **голые ULID** определений
> (соответственно типа отношения `contains` и свойства `part_of_work`), а не key-строки.
> Машиночитаемая схема строки — `schema/relations/relation-line.schema.json`;
> живые примеры — `examples/relations/`.

## 5. Правила валидации

| Правило | Уровень | Смысл |
| --- | --- | --- |
| **`chapter.contains.required`** | error | у `chapter` ровно одна связь `contains`, где он — `object` |
| **`relation.contains.single_record`** | error | `part_of` не хранится отдельной записью alongside `contains` |
| **`relation.order.unique_per_subject`** | error | `order` (и `chapter_number`) уникальны в пределах одного `subject` |
| **`relation.order.no_gap`** | warning | разрыв нумерации частей |
| **`relation.subject.has_parts`** | info | у произведения нет частей |
| **`relation.cardinality.object_to_subject`** | error | `object_to_subject: 0..1` — часть не входит в два произведения |

## 6. Открытые вопросы

| # | Вопрос | Рекомендация |
| --- | --- | --- |
| 1 | Нужен ли `contains` для вложенности произведений (серия → книга)? | **Да**, типы уже допускают; но серия — этап 2 |
| 2 | Разрешить смешанный состав (главы + иллюстрации)? | **Да**, через `role` |
| 3 | Автоперенумерация `order` при удалении части? | **Нет** в MVP — разрыв виден как warning `relation.order.no_gap` |

## История изменений

- **2026-10-23:** батч 5 шага 9: пример строки `.jsonl` приведён к норме §4/ADR-010
  (голые ULID в `relation_type`/`origin_property`, добавлены `type`/`title`) — DL-236;
  создана схема `schema/relations/relation-line.schema.json`, примеры `examples/relations/`.
- **2026-10-22:** карточка создана (DL-125).
