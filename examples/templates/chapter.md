---
id: "{PREFIX}{ULID}"          # CHP-
type: chapter
title: "{TITLE}"              # И7: title = chapter_title; для нумерованных — «Глава {N}»
aliases:
  - "{TITLE}"
created_at: {NOW}
updated_at: {NOW}
is_front_matter: false        # true → chapter_number НЕ нужен (пролог/эпилог/предисловие, DL-230)
chapter_number: 1             # условно обязательно; дробные допустимы (7.5 — интерлюдия)
chapter_title: ""             # свободный текст; title пересобирается при изменении (И7)
draft_status: draft           # draft | revised | final | published (§3.17.11)
# word_count: 0               # number ≥ 0
# published_on: ""            # "YYYY-MM-DD"
---

```sb-chapter-nav
```

<!-- Текст главы. Блок навигации заполняет плагин (Фаза 5): «◀ Глава N-1 | ↑ Книга | Глава N+1 ▶» -->
