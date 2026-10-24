/**
 * СГЕНЕРИРОВАНО — не править руками (D2, конструкция DL-222).
 *
 * Источник (единственная истина): schema/entities/person.schema.json
 * Корневой тип: PersonNote. Перегенерация: npm run generate:types (в plugin/).
 * Свежесть контролирует тест tests/unit/generated-freshness.test.ts.
 *
 * Ограничения (честно, мера M6): if/then/else-блоки схемы уплощены — типы являются
 * приближением; норма — сама схема и рантайм-валидация плагина. Общие $defs
 * (SystemCore и др.) инлайнятся в каждый файл — дубли типов между файлами нормальны.
 */
/**
 * Frontmatter заметки PERSON-{ULID}.md: конкретное лицо (автор, владелец проекта, контакт). Обязательны системная шапка и role (1..N, закрытое перечисление person_role).
 */
export type PersonNote = SystemCore &
  ServiceProps & {
    type?: 'person';
    role: PersonRoleValue | [PersonRoleValue, ...PersonRoleValue[]];
    birth_date?: string;
    death_date?: string;
    birth_name?: string;
    original_name?: string;
    pen_name?: string[];
    also_known_as?: string[];
    sort_name?: string;
    gender?: 'male' | 'female' | 'other';
    nationality?: string[];
    country_of_residence?: string | [] | [string];
    languages_spoken?: string[];
    links?: string[];
    description?: string;
    portrait?: string | [] | [string];
    related_to?: string[];
    known_for?: string[];
    field_of_work?: string[];
    active_years?: string | [] | [string];
    writing_genres?: string[];
    writing_languages?: string[];
    published_works?: string[];
    art_movement?: string[];
    art_training?: string[];
    art_mediums?: string[];
    instruments?: string[];
    performance_genres?: string[];
    ensembles?: string[];
    sport?: string | [] | [string];
    sport_position?: string;
    sport_teams?: string[];
    academic_degree?: string[];
    academic_institutions?: string[];
    doctoral_advisor?: string | [] | [string];
    thesis_title?: string;
    medical_specialty?: string[];
    medical_institution?: string;
    programming_languages?: string[];
    software_projects?: string[];
    business_positions?: string[];
    office_held?: string[];
    military_rank?: string;
    conflicts?: string[];
    portrait_file?: string;
    [k: string]: unknown;
  };
export type PersonRoleValue =
  | 'author'
  | 'novelist'
  | 'poet'
  | 'screenwriter'
  | 'translator'
  | 'editor'
  | 'blogger'
  | 'artist'
  | 'illustrator'
  | 'photographer'
  | 'sculptor'
  | 'designer'
  | 'actor'
  | 'director'
  | 'musician'
  | 'composer'
  | 'singer'
  | 'dancer'
  | 'voice_actor'
  | 'athlete'
  | 'coach'
  | 'esport_player'
  | 'scientist'
  | 'academic'
  | 'teacher'
  | 'engineer'
  | 'inventor'
  | 'physician'
  | 'programmer'
  | 'game_developer'
  | 'data_scientist'
  | 'entrepreneur'
  | 'executive'
  | 'investor'
  | 'politician'
  | 'military'
  | 'civil_servant'
  | 'diplomat'
  | 'jurist'
  | 'other_occupation';

export interface SystemCore {
  id: string;
  type: string;
  title: string;
  aliases?: string[];
  created_at: string;
  updated_at: string;
  categories?: string[];
  tags?: string[];
  [k: string]: unknown;
}
export interface ServiceProps {
  sb_issues?: string[];
  [k: string]: unknown;
}
