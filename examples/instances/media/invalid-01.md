---
type: media
title: cover
file: "[[Attachments/несуществующий.jpg]]"
media_kind: видео
role:
  - обложка
creation_method:
  - ai_generated
origin: из буфера
width_px: очень широкая
scan_dpi: -300
---

Обычный текст без встраивания файла — инвариант И8 нарушен.

**Некорректный** экземпляр `media` (батч 3, D4) — файл намеренно не проходит проверку.
Разбор нарушений:

| Нарушение | Правило реестра | Кто ловит | Сообщение пользователю |
|---|---|---|---|
| Нет `id` | `object.id.format` (И1) | **схема** (`system_core.required`) | «У записи нет идентификатора. Создайте её командой плагина» |
| Нет `created_at` / `updated_at` | `object.created_at.required` | **схема** | «Дата создания будет добавлена при сохранении через плагин» |
| `media_kind: видео` — кириллица | `media.kind.enum`, `enum.value.no_mixed_script` | **схема** (`enum` 5 значений) | «Вид медиа задаётся ключом: image, audio, video, document, other» |
| `role: обложка` — кириллица | `media.roles.enum` | **схема** (`enum` 13 значений) | «Роль задаётся ключом из списка: cover, banner, logo…» |
| `origin: из буфера` | `media.origin.enum` | **схема** (`enum` 7 значений) | «Происхождение — одно из: clipboard, vault, local_disk, downloaded, generated, camera, unknown» |
| `width_px: очень широкая` | `value.type_conformance` | **схема** (`type: number`) | «Ширина — число (пиксели)» |
| `scan_dpi: -300` | `media.scan.dpi_positive` | **схема** (`exclusiveMinimum: 0`). Обратите внимание: `scan_dpi` при `creation_method: ai_generated` — «неродное» значение, но схема его не гейтит (М1/М2): условие влияет на показ, а не на хранение | «Разрешение сканирования должно быть больше нуля» |
| Файла `Attachments/несуществующий.jpg` нет в хранилище | `media.file.exists` | runner (error, межобъектное) | «Файл не найден. Укажите другой или восстановите файл» |
| Выбран `ai_generated`, но нет `ai_model` | `media.ai.model_required` | runner (warning) | «Указан способ „Генерация ИИ“, но не заполнено поле „Модель“» |
| В теле нет встраивания файла | `media.body.embed_synced` (И8) | runner (warning) — схема описывает только frontmatter и тело не видит | «В заметке нет встраивания изображения. Плагин может добавить его автоматически» |
| Этот же файл уже обёрнут другой обёрткой | `media.file.single_wrapper` | runner (error, межобъектное; DL-154) | «На этот файл уже есть обёртка MEDIA-…. Открыть её?» |

- Схема: `schema/entities/media.schema.json`.
