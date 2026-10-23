---
id: "{PREFIX}{ULID}"          # MEDIA-
type: media
title: "{TITLE}"
aliases:
  - "{TITLE}"
created_at: {NOW}
updated_at: {NOW}
file: "[[Attachments/….png]]" # обязательно: wikilink на файл в хранилище (не голый путь)
media_kind: image             # image | video | audio | document | archive | font | 3d_model | … (16, §3.17.5)
role: []                      # 0..N из 13: cover | portrait | illustration | screenshot | … (§3.9)
# creation_method: []         # 1..N из 19 (§3.17.6): photo | collage | ai_generated | …
# origin: vault               # 0..1 из 16 (§3.17.7)
# width_px: 0
# height_px: 0
# duration_sec: 0
# file_size: 0
# mime_type: ""
# --- условные поля по creation_method (includes_any, DL-139/141) ---
# ai_model: ""                # ai_generated
# ai_prompt: ""
# ai_steps: 0
# ai_seed: ""                 # текст в кавычках
# captured_at: {NOW}          # photo | video
# source_materials: []        # collage → обёртки MEDIA (не голые файлы)
# description: ""
---

![[Attachments/….png|{TITLE}]]

<!-- И8: встраивание файла — первая строка тела. Теневые свойства (media_file_*) ведёт плагин -->
