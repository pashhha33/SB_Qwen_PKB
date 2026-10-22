---
doc_type: validation_registry
title: "Единый реестр правил валидации"
status: actual
version: 0.1.0
created: 2026-10-22
updated: 2026-10-22
metamodel_version: 0.5.0
governing_documents:
  - docs/metamodel/01-classification.md
  - docs/metamodel/04-attributes.md
  - docs/metamodel/03-relations.md
  - docs/metamodel/05-enumerations.md
  - docs/metamodel/06-time-and-intervals.md
  - docs/adr/ADR-009-relations-model.md
  - docs/adr/ADR-011-enumerations-dates-lifecycle.md
rule_count: 87
tags: [validation, registry]
---

# Реестр правил валидации

> [!info] Назначение документа
> Единый список **всех** правил проверки данных. Правила описаны один раз здесь; в разделах метамодели
> даются только ссылки на ID. Это единственный источник истины для движка валидации и для тестов.
>
> **Уровни** — см. [[severity-policy]]. **Когда запускается** — номер уровня контроля целостности
> из ADR-011 часть 6: 1 предварительная, 2 техническая, 3 структурная, 4 семантическая,
> 5 представлений, 6 постпроверка.

## Сводка

| Группа | Правил | Источник |
|---|---|---|
| A. Системные атрибуты объекта | 10 | `04-attributes` §3 |
| B. Определения свойств | 11 | `04-attributes` §4 |
| C. Значения свойств | 5 | `04-attributes` §9 |
| D. Медиа | 8 | `04-attributes` §11 |
| E. Классификация | 19 | `01-classification` §6, ADR-005, ADR-007 |
| F. Связи и типы отношений | 33 | `03-relations` §9, ADR-009 |
| G. Перечисления | 5 | `05-enumerations` §5 |
| H. Даты и интервалы | 11 | `06-time-and-intervals` §6 |
| **Всего** | **102** | |

---

## A. Системные атрибуты объекта

| ID | Формулировка | Уровень | Когда |
|---|---|---|---|
| `object.id.format` | `id` — 26 символов алфавита Crockford Base32 | error | 2 |
| `object.id.unique` | `id` уникален в хранилище | error | 2 |
| `object.id.filename_match` | ULID в имени файла совпадает с `id` | error | 2 |
| `object.type.exists` | `type` указывает на существующий тип объекта | error | 3 |
| `object.type.not_abstract` | `type` не является абстрактным типом | error | 4 |
| `object.title.required` | `title` заполнен и не состоит только из пробелов | error | 2 |
| `object.aliases.first_is_title` | `aliases[0] == title` | warning | 4 |
| `object.created_at.required` | `created_at` заполнен | warning | 2 |
| `object.created_at.immutable` | `created_at` не изменился относительно предыдущей версии | error | 4 |
| `object.updated_at.order` | `updated_at` ≥ `created_at` | error | 4 |

> [!note] Область действия
> Правила A1–A10 применяются к **экземплярам объектов в Markdown**. У экземпляра связи
> (`.sb/relations/`) действуют только `id`, `type`, `title`, `created_at`, `updated_at` —
> правила про `aliases`, `categories`, `tags` и имя файла к связям не применяются (Р10 ADR-009).

Инвариант **И7** (новый, DL-124): у `chapter` при пустом `chapter_title` системный `title`
равен «Глава {N}». Проверяется правилом `chapter.title.fallback`.

## B. Определения свойств

| ID | Формулировка | Уровень | Когда |
|---|---|---|---|
| `property.key.format` | `key` соответствует `^[a-z][a-z0-9_]*$` | error | 2 |
| `property.key.no_system_conflict` | `key` не совпадает с ключом системного атрибута | error | 4 |
| `property.key.unique_in_type` | В пределах типа и его предков `key` не повторяется | error | 3 |
| `property.label.required` | `label` заполнен | error | 2 |
| `property.value_type.closed` | `value_type` входит в закрытый набор из семи значений | error | 4 |
| `property.required.cardinality_consistency` | Пара `required` и `cardinality` согласована | error | 4 |
| `property.target_types.for_reference` | У свойства типа `object_reference` и `media_reference` заполнен `target_types` | error | 4 |
| `property.target_facet.is_facet` | `target_facet` указывает на объект типа `facet` | error | 3 |
| `property.applies_when.property_exists` | Свойство, на которое ссылается `applies_when`, существует в том же типе | error | 3 |
| `property.applies_when.no_chain` | У свойства-условия нет собственного `applies_when` (правило М3) | error | 4 |
| `property.applies_when.operation_closed` | Операция условия — `equals` или `in_category` (правило М4) | error | 4 |

## C. Значения свойств

| ID | Формулировка | Уровень | Когда |
|---|---|---|---|
| `value.type_conformance` | Значение соответствует объявленному типу значения | error | 1, 4 |
| `value.cardinality` | Количество значений соответствует `cardinality` | error | 1, 4 |
| `value.allowed_values` | Значение входит в `allowed_values`, если список задан | error | 1, 4 |
| `value.reference.exists` | Цель ссылки существует | error | 3 |
| `value.reference.target_type` | Цель ссылки относится к одному из `target_types` | error | 3 |

## D. Медиа

| ID | Формулировка | Уровень | Когда |
|---|---|---|---|
| `value.media.target_kind` | Значение соответствует `media_target` | error | 3 |
| `value.media.kind_allowed` | Вид медиа цели входит в `media_kinds` | error | 4 |
| `value.media.role_allowed` | Роль объекта `media` входит в `media_roles` | warning | 4 |
| `value.media.in_folders` | Файл находится в одной из папок `media_folders` | warning | 4 |
| `value.media.extension_allowed` | Расширение файла входит в `media_extensions` | error | 4 |
| `value.media.file_exists` | Файл существует в хранилище | error | 3 |
| `property.media.settings_required` | У свойства типа `media_reference` заполнено `media_target` | error | 2 |
| `property.media.settings_consistent` | Поля `media_*` присутствуют только там, где имеют смысл | warning | 4 |

## E. Классификация

| ID | Формулировка | Уровень | Когда |
|---|---|---|---|
| `category.facet.required` | У категории обязательно указан фасет | error | 2 |
| `category.facet.single` | Категория принадлежит ровно одному фасету | error | 4 |
| `category.parent.exists` | Родительская категория существует | error | 3 |
| `category.parent.same_facet` | Родительская категория принадлежит тому же фасету | error | 4 |
| `category.parent.no_cycle` | В цепочке родителей нет цикла | error | 3 |
| `category.parent.strict_mode` | В фасете с режимом `strict` у категории не более одного родителя | error | 4 |
| `category.taxonomy_direct.forbidden` | Категория не ссылается на таксономию напрямую (правило П8 ADR-007) | error | 4 |
| `facet.taxonomy.exists` | Если таксономия указана, она существует | error | 3 |
| `facet.allowed_types.conflict` | `allowed_object_types` фасета — подмножество значения таксономии, если заданы оба | warning | 4 |
| `facet.root_requirement` | Число корневых категорий соответствует `root_requirement_min` / `root_requirement_max` | warning | 4 |
| `taxonomy.facets.min_one` | У таксономии минимум один фасет | error | 2 |
| `assignment.type_allowed` | Тип объекта входит в `allowed_object_types` таксономии или фасета | error | 4 |
| `assignment.cardinality` | Число назначенных категорий фасета соответствует `assignment_cardinality` | error при `1` и `1..N`, warning при превышении `0..1` | 4 |
| `object_type.parent.exists` | Родительский тип существует | error | 3 |
| `object_type.parent.no_cycle` | В цепочке родителей типов нет цикла | error | 3 |
| `object_type.abstract.no_instance` | У абстрактного типа нет экземпляров | error | 4 |
| `object_type.type_prefix.unique` | `type_prefix` уникален в реестре | error | 2 |
| `facet.genre.required_for_book` | У `book` назначена минимум одна категория фасета `genre` | error | 4 |
| `facet.genre.not_form` | Категория фасета `genre` не является одновременно категорией `literary_form` (граница DL-126) | warning | 4 |

## F. Связи и типы отношений

| ID | Формулировка | Уровень | Когда |
|---|---|---|---|
| `relation.subject.exists` | Субъект существует | error | 3 |
| `relation.object.exists` | Объект существует | error | 3 |
| `relation.type.exists` | Тип отношения существует | error | 3 |
| `relation.subject_not_object` | Субъект и объект — разные записи | error | 3 |
| `relation.allowed_subject_type` | Тип субъекта входит в `allowed_subject_types` | error | 4 |
| `relation.allowed_object_type` | Тип объекта входит в `allowed_object_types` | error | 4 |
| `relation.cardinality.subject_to_object` | Число связей от субъекта не нарушает `subject_to_object` | error | 4 |
| `relation.cardinality.object_to_subject` | Число связей от объекта не нарушает `object_to_subject` | error | 4 |
| `relation.uniqueness` | Нет дубля по правилу `uniqueness_rule`; для симметричных связей учитываются обе стороны | error | 4 |
| `relation.origin_property.exists` | Если `origin_property` заполнено, оно указывает на существующее свойство | error | 3 |
| `relation.origin_property.type_match` | Тип субъекта соответствует типу, в котором объявлено свойство | error | 4 |
| `relation.origin_property.reified` | Свойство имеет `link_mode: reified` | error | 4 |
| `relation.no_duplicate_link` | Нет одновременно значения-ссылки в поле и объекта `relation` для одного свойства | error | 4 |
| `relation.free_standing.visible` | Свободно стоящая связь показана в общем блоке связей | info | 5 |
| `relation.period.order` | `starts_on` не позже `ends_on` | error | 4 |
| `relation.period.open` | `ends_on: null` означает «по настоящее время» | info | 4 |
| `relation_type.labels.required` | `forward_label` и `reverse_label` непустые | error | 2 |
| `relation_type.symmetric.labels_equal` | У типа с `direction: symmetric` роли совпадают | warning | 4 |
| `relation_type.suggested_subset_allowed` | `suggested_*` — подмножество `allowed_*`, если заданы оба | warning | 4 |
| `relation_type.direction.enum` | `direction` равен `directed` или `symmetric` | error | 4 |
| `relation_type.uniqueness.enum` | `uniqueness_rule` равен `pair`, `triple` или `none` | error | 4 |
| `property.link_mode.enum` | `link_mode` равен `direct` или `reified` | error | 4 |
| `property.link_mode.relation_type` | У свойства с `link_mode: reified` указан тип отношения | error | 4 |
| `relation.contains.single_record` | `contains` хранится один раз; отдельной записи `part_of` нет | error | 4 |
| `relation.order.unique_per_subject` | `order` уникален в пределах одного субъекта | error | 4 |
| `relation.order.no_gap` | В последовательности `order` нет разрывов | warning | 5 |
| `relation.subject.has_parts` | У произведения-агрегатора есть хотя бы одна часть | info | 5 |
| `chapter.contains.required` | У главы ровно одна связь `contains`, где она — объект | error | 4 |
| `chapter.number.positive` | `chapter_number` > 0, если `is_front_matter` не `true` | warning | 4 |
| `chapter.number.matches_order` | `chapter_number` совпадает с `order` связи `contains` | warning | 4 |
| `chapter.title.fallback` | При пустом `chapter_title` заголовок равен «Глава {N}» (инвариант И7) | error | 2 |
| `book.format.enum` | `format` входит в закрытый список из **пяти** значений | error | 4 |
| `book.rating.range` | `rating` — целое от 1 до 10 | error | 3 |

## G. Перечисления

| ID | Формулировка | Уровень | Когда |
|---|---|---|---|
| `enum.value.format` | Значение соответствует `^[a-z][a-z0-9_]*$` | error | 2 |
| `enum.value.in_set` | Значение входит в реестр `05-enumerations.md` | error | 4 |
| `enum.value.no_mixed_script` | В значении нет символов кириллицы | error | 2 |
| `property.allowed_values.format` | Все значения в `allowed_values` соответствуют `enum.value.format` | error | 2 |
| `property.allowed_values.unique` | В `allowed_values` нет повторов | error | 2 |

## H. Даты и интервалы

| ID | Формулировка | Уровень | Когда |
|---|---|---|---|
| `date.format` | Значение соответствует `YYYY-MM-DD` или частичному варианту с `00` | error | 2 |
| `datetime.format` | Значение соответствует `YYYY-MM-DDTHH:mm` | error | 2 |
| `date.partial.no_gap` | Неизвестный компонент не идёт после известного | error | 2 |
| `date.partial.unknown_only_zero` | Неизвестный компонент записан как `00` | error | 2 |
| `date.range.valid` | День и месяц допустимы для указанного года, с учётом високосных | error | 2 |
| `period.order` | `starts_on` не позже `ends_on` | error | 4 |
| `period.open_end` | `ends_on: null` трактуется как открытый период | info | 4 |
| `period.overlap` | При `forbid_overlap: true` интервалы не пересекаются | error | 4 |
| `datetime.no_seconds` | Время хранится с точностью до минут | warning | 2 |
| `display_template.tokens_known` | Все токены шаблона известны | warning | 5 |
| `display_template.not_empty_on_resolve` | Результат применения шаблона не пуст | warning | 5 |

---

## Перекрывающиеся правила

Некоторые правила частично дублируют друг друга. Это осознанно: общее правило даёт базовую защиту,
специальное — точное сообщение. При реализации **специальное правило имеет приоритет**, общее
запускается только если специальное не сработало.

| Общее правило | Специальные правила |
|---|---|
| `value.type_conformance` | `value.allowed_values`, `value.media.*`, `date.format`, `datetime.format`, `enum.value.in_set` |
| `value.reference.exists` | `category.parent.exists`, `facet.taxonomy.exists`, `relation.subject.exists`, `relation.object.exists`, `relation.type.exists`, `relation.origin_property.exists`, `value.media.file_exists` |
| `value.reference.target_type` | `category.parent.same_facet`, `relation.allowed_subject_type`, `relation.allowed_object_type`, `assignment.type_allowed` |
| `enum.value.format` | `property.key.format`, `date.format` |
| `period.order` | `relation.period.order`, `object.period.order` |

## Правила, которых пока нет (появятся позже)

| Правило | Когда появится | Почему сейчас нет |
|---|---|---|
| `relation.contains.no_cycle` | Этап 2 | Вложенность произведений (серия → книга) появится позже |
| `view.*` (группа правил представлений) | Шаг 8 | Представления ещё не описаны |
| `automation.*` | Шаг 8 | Автоматизации ещё не описаны |
| `object.status.*` (жизненный цикл данных из `01` §15) | Шаг 8 | Перечисление `object_status` не введено в ядро |
| `media.*` (правила обёртки) | После уточнений пользователя, DL-088 | Состав полей типа `media` предварительный |
| Миграционные проверки | Этап 2 | Миграции в MVP не реализуем |

## История изменений

| Дата | Версия | Что изменилось | Ссылка |
|---|---|---|---|
| 2026-10-22 | 0.2.0 | Добавлено 15 правил: 3 на `applies_when` (DL-128), 2 на фасет `genre` (DL-126), 10 на связи `contains`, главы и поля `book` (DL-123…DL-125). Итого **102** правила. Введён инвариант И7 |
| 2026-10-22 | 0.1.0 | Реестр создан: 85 правил в 8 группах, разметка по уровням контроля целостности и уровням сообщений, таблица перекрывающихся правил, список отсутствующих правил | [[../adr/ADR-011-enumerations-dates-lifecycle\|ADR-011]], шаг 7 |
