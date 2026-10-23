---
id: 01J8Z6M4K2Q7V9X3N5B0C1D2E9
type: media
title: Обложка «Мастер и Маргарита»
aliases:
  - Обложка «Мастер и Маргарита»
created_at: 2026-10-22T16:05
updated_at: 2026-10-23T12:40
file: "[[Attachments/covers/master-and-margarita.jpg]]"
media_kind: image
role:
  - cover
creation_method:
  - photo
  - ai_generated
origin: local_disk
width_px: 1200
height_px: 1800
file_size: 482113
captured_at: 2019-07-14T18:40
capture_device: Canon EOS R
ai_model: SDXL 1.0
ai_prompt: book cover, dark fantasy, cat with monocle, oil painting texture
ai_seed: "778213"
ai_steps: 32
ai_generated_on: 2026-10-22T16:00
license: CC BY-NC 4.0
credit: "Фото: Иван Петров; обработка: автор базы"
description: Исходное фото сделано в Кисловодске, доработано нейросетью.
---

![[Attachments/covers/master-and-margarita.jpg|Обложка «Мастер и Маргарита»]]

Корректный экземпляр `media`: обложка книги (батч 3, D3).

Что демонстрирует:

- **инвариант И8**: первый элемент тела — встраивание того же файла, что и в `file`.
  Именно эта строка показывает изображение, когда книга вставляет `![[MEDIA-01J8Z6M4K2Q7V9X3N5B0C1D2E9.md]]`,
  **даже с отключённым плагином** (постпроцессор лишь улучшает вывод — подпись и кнопки);
- `creation_method: [photo, ai_generated]` — мультивыбор (DL-141): коллаж/доработка законно
  содержит несколько способов; включены свойства обеих групп (`captured_at`/`capture_device`
  и `ai_*`);
- **воспроизводимость генерации**: `ai_model`, `ai_prompt`, `ai_seed`, `ai_steps` (8 полей
  `ai_*` подтверждены DL-155); `ai_seed` — текст в кавычках (ведущие нули и «как выдал инструмент»);
- `role: [cover]` — роль из 13 значений (§3.10); та же обёртка могла бы иметь
  `role: [cover, illustration]` — одна запись, две роли (вместо второй обёртки —
  `media.file.single_wrapper`, error, DL-154);
- три отдельных поля авторства: `license` (чем разрешено пользоваться), `credit`
  (требуемая подпись), `copyright_holder` (не заполнен — кому принадлежит);
- кэш `width_px`/`height_px`/`file_size` — не источник истины: сверка по команде,
  расхождение — warning `media.dimensions.stale`;
- `datetime` без секунд (`2019-07-14T18:40`) остаётся строкой без кавычек — конвенция батча 1;
  значение с двоеточием внутри текста (`credit`) — в кавычках.

- Схема: `schema/entities/media.schema.json`.
- Карточка типа: `docs/metamodel/entities/media.md`.
