---
id: "{PREFIX}{ULID}"          # {PREFIX} = BOOK- (из определения object_type)
type: book
title: "{TITLE}"
aliases:
  - "{TITLE}"
created_at: {NOW}
updated_at: {NOW}
author: []                    # 1..N, обязательно: ссылки [[PERSON-….md|Имя]]
read_status: planned          # file | card | web_novel | print | audio — нет: planned ставится само
format: file                  # file | card | web_novel | print | audio
categories: []                # минимум одна КОРНЕВАЯ категория фасета «Жанр» (DL-126)
# --- условные поля (раскомментировать по формату, DL-122) ---
# file_format: epub           # format: file → epub|fb2|mobi|pdf|djvu|txt|docx|html|azw3
# file: "[[Attachments/books/….epub]]"
# publication_status: ""      # format: card → ongoing|completed|abandoned|hiatus
# platform: ""                # format: web_novel
# publication_year: 0         # базовое: integer 1–2100
# pages: 0
# isbn: ""                    # формат ISBN-10/13 — warning runner'а
# first_published_on: ""      # "YYYY-MM-DD" в кавычках; частичные "YYYY-00-00" допустимы
# rating: 0                   # 1–10; display.renderer: stars (§3.18)
# cover: "[[MEDIA-….md|Обложка]]"   # обёртка media (роль cover), не голый файл
# related_to: []              # только person | project | knowledge (DL-234)
---

## Содержание

<!-- Краткое описание, впечатления, цитаты -->
