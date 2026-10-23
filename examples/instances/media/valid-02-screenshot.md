---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2F7
type: media
title: Скриншот таблицы книг в Bases
aliases:
  - Скриншот таблицы книг в Bases
created_at: 2026-10-23T12:15
updated_at: 2026-10-23T12:15
file: "[[Attachments/screenshots/2026-10-23-books-table.png]]"
media_kind: image
role:
  - screenshot
creation_method:
  - screenshot
origin: clipboard
width_px: 1440
height_px: 900
file_size: 208771
captured_at: 2026-10-23T12:14
screenshot_of: "Представление В1 «Таблица книг»: колонки Название, Автор, Год, Статус, Оценка"
tags:
  - инструкция
---

![[Attachments/screenshots/2026-10-23-books-table.png|Скриншот таблицы книг в Bases]]

Корректный экземпляр `media`: свободный скриншот (батч 3, D3).

Что демонстрирует:

- **обёртка существует сама по себе** (карточка §5): в MVP у `media` нет обязательных
  исходящих связей — ни один объект на эту обёртку пока не ссылается; она нужна,
  чтобы встроить её в заметку-инструкцию и знать, что на снимке;
- граница `media_kind` / `creation_method` (DL-135/141): скриншот — это
  `media_kind: image` («что за файл») и `creation_method: screenshot` («как появился»);
- `origin: clipboard` (§3.17.7, предварительно): мастер создания запомнил источник —
  файл попал в хранилище из буфера обмена (тот самый случай, когда
  `navigator.clipboard.read()` сработал, а `paste`-область не понадобилась — §7.4);
- условные свойства группы `screenshot`: `screenshot_of` и `captured_at`
  (значение с двоеточием — в кавычках);
- `role: [screenshot]` — роль «скриншот» из 13 значений `media_role`;
- свободная метка `инструкция` в `tags` — неформальный признак (категории у обёртки
  необязательны: фасет ей не назначен);
- И8 соблюдён: встраивание файла — первая строка тела.

- Схема: `schema/entities/media.schema.json`.
