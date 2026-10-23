---
id: "{PREFIX}{ULID}"          # PERSON-
type: person
title: "{TITLE}"
aliases:
  - "{TITLE}"
created_at: {NOW}
updated_at: {NOW}
role: []                      # 1..N, обязательно: значения из 40 (§3.17.9); неизвестен → other_occupation
# sort_name: ""               # "Фамилия, Имя" — для сортировки
# gender: ""                  # male | female | other (§3.17.10)
# birth_date: ""              # "YYYY-MM-DD" в кавычках; частичные допустимы
# death_date: ""
# --- условные поля по группам роли (DL-156/224) ---
# country_of_birth: "[[CATEGORY-….md|Страна]]"   # role ∩ {author, writer, poet}
# languages_spoken: []                            # role ∩ группы «язык»
# sport_kind: "[[CATEGORY-….md|Спорт]]"           # role ∩ {athlete, coach}
# occupation: ""                                  # role ∩ {scientist, engineer, …}
# also_known_as: []                               # 0..N: псевдонимы
# links: []                                       # 0..N: http(s) — формат проверяет runner (warning)
# portrait: "[[MEDIA-….md|Портрет]]"              # обёртка media
# related_to: []                                  # только book | project | knowledge (DL-234)
---

## Биография

<!-- Факты, ссылки на источники -->
