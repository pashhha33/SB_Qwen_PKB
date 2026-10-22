---
doc_type: research
title: "Свойства профессий в вики-инфобоксах и Wikidata: материал для `person_role`"
status: actual
<<<<<<< HEAD
version: 0.2.0
created: 2026-10-22
updated: 2026-10-22
metamodel_version: 0.9.0
=======
version: 0.1.0
created: 2026-10-22
updated: 2026-10-22
metamodel_version: 0.8.0
>>>>>>> 834900587491c69294ffbde9efd5362b23d2873b
relates_to:
  - docs/metamodel/entities/person.md
  - docs/metamodel/05-enumerations.md
decision_refs: [DL-137, DL-138]
tags: [research, person, classification]
---

# Свойства профессий: что используют вики и что из этого взяли мы

> [!info] Назначение документа
> Обоснование состава перечисления `person_role` и условных свойств типа `person`.
> Материал прикладной: это **не** нормативный документ. Норма — в
> [[../entities/person|карточке типа `person`]] и [[../05-enumerations|перечислениях §3.17.5]].

## 1. Зачем вообще смотреть на вики

Задача пользователя: «подобрать свойства для ролей, посмотри в разных вики какие свойства
используют для разных профессий, если свойства дублируются — объединять или замещать».

Вики-инфобоксы — это **готовые, годами отшлифованные карточки типов**. Тысячи редакторов уже решили,
какие поля нужны актёру, а какие — учёному. Брать их как образец дешевле, чем
придумывать список с нуля, и безопаснее: поля, которых нет ни в одном инфобоксе, скорее всего
не понадобятся и нам.

**Бытовая аналогия.** Мы не изобретаем анкету — мы берём чужой проверенный бланк и вычёркиваем
то, что не подходит личной базе знаний.

## 2. Что мы посмотрели

| Источник | Шаблоны и сущности | Что дали |
|---|---|---|
| **Wikipedia (en/ru)** | `Template:Infobox person`, `writer`, `scientist`, `athlete`, `football biography`, `musician`, `artist`, `actor`, `military person`, `officeholder`, `chess player`, `go player`, `darts player`, `snooker player` | Основной набор полей по профессиям; идею «одна профессия — свой инфобокс» |
| **Wikidata** | Свойства P106, P101, P108, P39, P69, P184, P185, P800, P1477, P742, P1559, P463, P136, P1303, P54, P413, P641, P485, P512, P856, P2650, P569, P570, P19, P20, P27, P1412, P26, P40, P451, P166, P272, P740, P1441, P2048 | Универсальный список свойств, не привязанный к одной профессии; разделение «имя при рождении / псевдоним / сценическое имя» |
| **Профильные базы** | IMDb (Name: birth name, nickname, known for), Discogs (Profile: Name Variations / ANV, Real Name), Goodreads (Author: born, died, genre), MyAnimeList (Person: given name, family name), LibraryThing (Author: disambiguation) | Практика псевдонимов и «также известен как»; практика «известен за» |
| **Фандомные вики** | `Infobox character` (portrayed by, first appearance, series), `Infobox author` (pen name, fandoms) | Поля для вымышленных персонажей — у нас это тип `character` (этап 2), не `person` |

## 3. Сводка полей по профессиям (как есть в источниках)

### 3.1. Писатель, сценарист, переводчик, редактор

| Источник | Поля |
|---|---|
| `Infobox writer` | name, **pseud**, **birth_name**, birth_date/place, death_date/place, **occupation**, **language**, **nationality**, **alma_mater**, **genre**, **subject**, **notableworks**, **awards**, spouse, partner, children, signature, website, **portaldisp** |
| Wikidata | P1477 birth name, **P742 pseudonym**, P106 occupation, **P136 genre**, P1412 languages spoken/written, P800 notable work, P69 educated at, P166 award received |
| IMDb / LibraryThing | birth name, nickname, known for; disambiguation |

**Что взяли:** `pen_name` (= `pseud` / P742), `writing_genres` (= `genre` / P136),
`writing_languages` (= `language` / P1412), `published_works` (= `notableworks` / P800).

### 3.2. Учёный, преподаватель вуза

| Источник | Поля |
|---|---|
| `Infobox scientist` | name, birth/death, **field** (fields), **workplaces**, **education**, **alma_mater`, **doctoral_advisor**, **doctoral_students**, **thesis_title**, **thesis_year**, **thesis_url**, known_for, awards, spouse, children, signature |
| Wikidata | **P101 field of work**, **P108 employer**, **P184 doctoral advisor**, **P185 doctoral student**, P800 notable work, **P69 educated at**, **P512 academic degree**, **P1026 academic degree thesis title**, P485 archives at, P1153 Scopus, P496 ORCID |

**Что взяли:** `field_of_work` (сквозное, объединяет `field` и `subject` писателя),
`academic_degree`, `academic_institutions` (объединяет `workplaces` и `alma_mater`),
`doctoral_advisor`, `thesis_title`.
**Что не взяли:** `doctoral_students` (это обратная сторона `doctoral_advisor` — у нас будет
отношение на этапе 2), идентификаторы Scopus/ORCID (в MVP нет типа `identifier`), `archives_at`.

### 3.3. Актёр, режиссёр, актёр озвучивания

| Источник | Поля |
|---|---|
| `Infobox actor` / person | name, **birth_name**, **other_names**, birth/death, **occupation**, **years_active**, **agent**, **known_for**, **notable_works**, spouse, children, awards, website |
| IMDb | Birth Name, Nicknames, Known For, height, biography |
| Wikidata | **P1477**, **P742**, **P1559 name in native language**, P2048 height, P175 performer, P1441 present in work, P463 member of, P106 |
| Фандомные вики | portrayed by, first appearance, series — **это про персонажа, не про человека** |

**Что взяли:** `birth_name`, `also_known_as`, `active_years`, `known_for` (сквозное).
**Что не взяли:** `agent` (агент — это отношение `representation`, этап 2), `height`
(не используется для поиска и сортировки в личной базе; при желании — пользовательское свойство),
`name_in_native_language` (у нас это `original_name`, покрывает тот же смысл без привязки к языку).

### 3.4. Музыкант, композитор, вокалист

| Источник | Поля |
|---|---|
| `Infobox musical artist` | name, **background** (solo_singer / non_vocal_instrumentalist / …), **origin**, **genres**, **instruments**, **years_active**, **labels**, **associated_acts**, **occupation**, website |
| Discogs | **Real Name**, **Name Variations (ANV)**, **Aliases**, Profile, Groups |
| Wikidata | **P1303 instrument**, **P136 genre**, **P463 member of**, P264 record label, P175 performer, P345 IMDb |

**Что взяли:** `instruments` (P1303), `performance_genres` (объединяет `genres` музыканта,
танцовщика и актёра — одно свойство на три профессии), `ensembles` (объединяет
`associated_acts`, `member of`, группы Discogs).
**Что не взяли:** `labels` (лейбл — отношение `published_by`/`signed_to`, этап 2),
`background` из Discogs — это способ классификации самого артиста, у нас он покрывается
значениями `role` (`musician` / `singer` / `composer`).

### 3.5. Спортсмен, тренер, киберспортсмен

| Источник | Поля |
|---|---|
| `Infobox football biography` | name, **position**, **currentclub**, **clubnumber**, youthclubs, **clubs** + years, **nationalteam** + years, **caps**, **goals**, managerclubs, height, weight |
| `Infobox sportsperson` / esports | **sport**, **team**, **handle**, achievements, earnings, coach |
| Wikidata | **P641 sport**, **P413 position played on team**, **P54 member of sports team**, P118 league, P1532 country for sport |

**Что взяли:** `sport`, `sport_position`, `sport_teams`.
**Что не взяли:** статистику (`caps`, `goals`, `earnings`) — это **отдельные объекты**
(сезон, матч, контракт), для личной базы избыточно; `handle` — покрывается `also_known_as`;
`height`/`weight` — по той же причине, что у актёра.

### 3.6. Художник, иллюстратор, фотограф, скульптор, дизайнер

| Источник | Поля |
|---|---|
| `Infobox artist` | name, birth/death, **nationality**, **education**, **movement**, **genre/field**, **notableworks**, awards, elected |
| `Infobox photographer` | **type** (war/street/fashion…), **equipment**, **major exhibitions**, publications |
| Wikidata | **P135 movement**, **P195 collection**, P170 creator, P106, P1472 CommonCreator |

**Что взяли:** `art_movement` (P135), `art_training` (объединяет `education` художника и
`alma_mater` учёного **внутри этой группы** — сквозным `academic_institutions` не делаем,
потому что у художника речь о мастерской и школе, а не о степени), `art_mediums`
(объединяет `equipment` фотографа и технику живописца).
**Что не взяли:** `major_exhibitions`, `publications` — события и произведения, у нас это
отдельные типы (`event` — этап 2, `book` — ядро).

### 3.7. Врач

| Источник | Поля |
|---|---|
| `Infobox scientist` (применяется к медикам) + медицинские справочники | field/specialty, institution, education, license |
| Wikidata | P101, P108, P69, P512; отдельного «медицинского» инфобокса нет |

**Что взяли:** `medical_specialty` (= `field`, но с медицинской семантикой: кардиолог, психиатр),
`medical_institution` (клиника, больница).
**Почему не объединили с `field_of_work`:** у врача «специальность» — это лицензируемая
квалификация, а не область интереса; смешение дало бы мусор в отборах («кардиология» рядом
с «историей искусства»).

### 3.8. Инженер, программист, геймдевелопер, дата-сайентист

| Источник | Поля |
|---|---|
| `Infobox scientist` / `engineer` | discipline, projects, employer, awards |
| GitHub / проф. базы | **languages**, **projects**, **organizations**, contributions |
| Wikidata | P101, P108, P800 notable work, P1049 (для продуктов — не для людей) |

**Что взяли:** `programming_languages`, `software_projects`.
**Почему не объединили с `art_mediums`:** «инструмент» художника и «язык программирования» —
разные справочники; объединение привело бы к одному полю со смешанным содержимым.

### 3.9. Военный, политик, госслужащий, дипломат, юрист

| Источник | Поля |
|---|---|
| `Infobox military person` | **allegiance**, **branch**, **serviceyears**, **rank**, **unit**, **commands**, **battles**, awards |
| `Infobox officeholder` | **office**, **term_start**, **term_end**, **predecessor**, **successor**, party, president/monarch |
| Wikidata | **P39 position held** (+ P580/P582 квалификаторы срока), P410 military rank, P607 conflict, P102 member of political party, P463 member of |

**Что взяли:** `office_held`, `military_rank`, `conflicts`.
**Что не взяли:** `predecessor`/`successor` (это отношения, этап 2), `allegiance`, `unit`,
`commands` (детализация, не нужная в личной базе), `term_start`/`term_end` — сроки у нас
появятся вместе с отношением `employment`/`position_held` в reified-форме (этап 2),
хранить их текстом в свойстве значит дублировать.

### 3.10. Предприниматель, руководитель, инвестор

| Источник | Поля |
|---|---|
| `Infobox person` (бизнес) | **known_for** (основатель X), net_worth, **boards**, occupation |
| Forbes-подобные карточки | founded, CEO of, investments |
| Wikidata | **P1026 founder of** (через P800), P108 employer, P39 position held, **P112 founder** (у организации, не у человека) |

**Что взяли:** `business_positions` (текст вида «основатель и CEO, N Inc., 2001–2015») —
одно поле вместо трёх (`founded`, `ceo_of`, `boards`), потому что все три описывают
один и тот же факт «должность в организации», а структурно он относится к отношению этапа 2.
**Что не взяли:** `net_worth` — данные, которые устаревают быстрее, чем их успеваешь вносить,
и которые не участвуют ни в одном отборе личной базы.

## 4. Сквозные поля: что повторяется почти везде

Эти поля встречаются в большинстве инфобоксов независимо от профессии, поэтому объявлены
**один раз** и включаются для нескольких групп сразу (правило М7):

| Наше свойство | Аналоги в источниках | Комментарий |
|---|---|---|
| `known_for` | `known_for` (actor, scientist), `notableworks` (writer, artist), `notable_work` (P800), IMDb «Known For» | Объединяет три разных имени одного смысла |
| `field_of_work` | `field` / `fields` (scientist), `subject` (writer), `discipline` (engineer), P101 | Одно поле вместо четырёх |
| `active_years` | `years_active` (actor, musician), `serviceyears` (military) | Храним текстом `2001–2015`; структурный интервал — у отношения этапа 2 |

## 5. Правила дедупликации, которые мы применили

| Правило | Пример |
|---|---|
| **Один смысл — одно свойство**, даже если источники называют его по-разному | `notable_work` / `known_for` / `notableworks` → `known_for` |
| **Не создаём свойство под каждый источник** | Discogs «Aliases» + IMDb «Nicknames» + Wikidata P742 → одно `also_known_as` + `aliases` |
| **Если поле дублирует отношение — оставляем отношение** | `doctoral_students`, `predecessor`, `employer`, `team years` → этап 2 как `reified`-связи с периодом |
| **Если поле устаревает быстрее, чем используется — не вводим** | `net_worth`, `caps`, `goals`, `earnings`, `height` |
| **Свойство группы не повышаем до сквозного, если семантика расходится** | `medical_specialty` ≠ `field_of_work`; `programming_languages` ≠ `art_mediums` |

## 6. Псевдонимы: три разных смысла, которые нельзя сливать

Отдельный вывод исследования (требование пользователя: «у творческих профессий многие личности
известны под псевдонимом, добавить свойство реальное имя или имя с рождения»).

| Поле | Источник-образец | Смысл | Пример |
|---|---|---|---|
| `title` + `aliases` | P1559, `name` | Имя, под которым человек **известен в базе** | «Макс Фрай» |
| `birth_name` | **P1477 birth name**, IMDb «Birth Name» | Имя, данное **при рождении** | «Ирина Степанова» |
| `pen_name` | **P742 pseudonym**, `Infobox writer.pseud` | **Творческий** псевдоним, под которым публикуются работы | «Макс Фрай» |
| `also_known_as` | IMDb «Nicknames», Discogs «Name Variations» | Прочие варианты написания и прозвища | «Светлана Мартынчик» |

**Почему `birth_name` и `pen_name` — разные поля, а не одно «настоящее имя»:**
у Светланы Мартынчик псевдоним «Макс Фрай» — это не имя при рождении, а литературная маска;
у Льва Прыгунова имя при рождении совпадает с известным именем, но есть псевдоним в переводе.
Если слить поля в одно, теряется ответ на вопрос «под каким именем искать книги».

**Правило согласования (новое, `person.name.conflict`):** если `title` == `birth_name`
и псевдонимов нет — поле `birth_name` избыточно (warning: «совпадает с названием»).
Если псевдоним есть — все варианты **обязаны** попасть в `aliases`, иначе поиск Obsidian
их не найдёт (правило `person.pseudonym.in_aliases`).

## 7. Что осталось за бортом и почему

| Не взяли | Причина |
|---|---|
| Рост, вес, цвет глаз, знак зодиака | Есть в инфобоксах, но не участвуют в поиске и отборах личной базы |
| Net worth, статистика матчей, тиражи | Быстро устаревают; структурно это отдельные объекты |
| Супруг, дети, родители как поля | Это **отношения** (`related_to`, а позже `family`) со своим периодом и ролью; хранить текстом — значит потерять связь с объектами `person` |
| Идентификаторы (IMDb, ORCID, VIAF, ISNI, Wikidata QID) | Требуют отдельного типа свойства `identifier` с проверкой формата; в MVP — `links` как текст. Потребность зафиксирована: G-15 |
| Награды как список строк | Премия — объект (`award`, этап 2) с годом и произведением; текстом теряется связь |

## 8. Итог для метамодели

<<<<<<< HEAD
- **34 значения `person_role`, 9 групп + 1 служебное** (`other_occupation` — род занятий неизвестен) — см. [[../05-enumerations#3.17.5. person_role — род занятий человека (DL-137, DL-138)|§3.17.5]].
- **16 свойств для всех ролей** (включая обязательный `role`) + **27 условных свойств по группам** — см. [[../entities/person|карточку типа]].
=======
- **33 значения `person_role`, 9 групп** — см. [[../05-enumerations#3.17.5. person_role — род занятий человека (DL-137, DL-138)|§3.17.5]].
- **15 свойств для всех ролей** + **19 условных свойств по группам** — см. [[../entities/person|карточку типа]].
>>>>>>> 834900587491c69294ffbde9efd5362b23d2873b
- Новый механизм не понадобился: сработали `applies_when` (DL-128) и операция `includes_any` (DL-139).
- Фасет «Род занятий» **не вводится** — два механизма для одного смысла дали бы рассинхрон.

## 9. История изменений

| Дата | Версия | Что изменилось | Ссылка |
|---|---|---|---|
<<<<<<< HEAD
| 2026-10-22 | 0.2.0 | Итоги приведены в соответствие с решениями пользователя: `person_role` закрыто (34 значения), `role` обязателен, 27 условных свойств | Ответы пользователя от 2026-10-22 (DL-155…DL-157) |
=======
>>>>>>> 834900587491c69294ffbde9efd5362b23d2873b
| 2026-10-22 | 0.1.0 | Документ создан как обоснование состава `person_role` и условных свойств `person` | Требование пользователя от 2026-10-22, DL-137 |
