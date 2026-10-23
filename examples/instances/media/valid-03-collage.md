---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2BC
type: media
title: Коллаж «Перевал в грозу»
aliases:
  - Коллаж «Перевал в грозу»
created_at: 2026-10-23T17:15
updated_at: 2026-10-23T17:15
file: "[[Attachments/collages/pereval-groza.png]]"
media_kind: image
role:
  - illustration
creation_method:
  - collage
  - photo
  - ai_generated
origin: vault
width_px: 2048
height_px: 1152
file_size: 3145728
source_materials:
  - "[[MEDIA-01J8Z6M4K2Q7V9X3N5B0C1D2E9.md|Обложка «Мастер и Маргарита»]]"
  - "[[MEDIA-01J8Z6M4K2Q7V9X3N5B0C1D2F7.md|Скриншот таблицы книг в Bases]]"
ai_model: SDXL 1.0
ai_prompt: mountain pass storm collage, dramatic light
ai_seed: "42"
captured_at: 2026-10-21T18:02
description: Коллаж из двух обёрток, доработанный нейросетью.
---

![[Attachments/collages/pereval-groza.png|Коллаж «Перевал в грозу»]]

Корректный экземпляр `media`: три способа создания сразу (батч 6, D3).

- `creation_method: [collage, photo, ai_generated]` — мультивыбор законен (DL-141):
  «коллаж из фотографии, обработанной нейросетью»; включены свойства всех трёх групп
  (`source_materials`, `captured_at`, `ai_*`) — `includes_any`;
- `source_materials` → **обёртки**, а не голые файлы (карточка §4.3): у исходников своя
  история — получается цепочка происхождения (коллаж → его элементы);
- `ai_seed: "42"` — текст в кавычках (сиды хранят как выдал инструмент);
- И8 соблюдён: встраивание файла — первая строка тела;
- теневое свойство `source_materials_file` здесь не заполнено — его ведёт плагин
  (shadow-sync), ручное заполнение не требуется (DL-144/153).

Схема: `schema/entities/media.schema.json`.
