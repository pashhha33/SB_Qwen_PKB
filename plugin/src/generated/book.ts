/**
 * СГЕНЕРИРОВАНО — не править руками (D2, конструкция DL-222).
 *
 * Источник (единственная истина): schema/entities/book.schema.json
 * Корневой тип: BookNote. Перегенерация: npm run generate:types (в plugin/).
 * Свежесть контролирует тест tests/unit/generated-freshness.test.ts.
 *
 * Ограничения (честно, мера M6): if/then/else-блоки схемы уплощены — типы являются
 * приближением; норма — сама схема и рантайм-валидация плагина. Общие $defs
 * (SystemCore и др.) инлайнятся в каждый файл — дубли типов между файлами нормальны.
 */
/**
 * Frontmatter заметки BOOK-{ULID}.md: законченное письменное произведение. Обязательны системная шапка, author (1..N), read_status и format (закрытые перечисления).
 */
export type BookNote = SystemCore &
  ServiceProps & {
    type?: 'book';
    /**
     * @minItems 1
     */
    author: [string, ...string[]];
    publication_year?: number;
    first_published_on?: string;
    publisher?: string | [] | [string];
    isbn?: string;
    pages?: number;
    original_language?: string | [] | [string];
    cover?: string | [] | [string];
    read_status: 'planned' | 'reading' | 'read' | 'abandoned' | 'not_planned';
    rating?: number;
    format: 'file' | 'card' | 'web_novel' | 'print' | 'audio';
    finished_on?: string;
    description?: string;
    /**
     * @minItems 1
     */
    categories?: [string, ...string[]];
    related_to?: string[];
    platform?: string;
    publication_status?: 'ongoing' | 'hiatus' | 'completed' | 'cancelled' | 'unknown';
    release_cadence?: string;
    last_chapter_on?: string;
    file_path?: string;
    file_format?: 'epub' | 'fb2' | 'pdf' | 'mobi' | 'azw3' | 'txt' | 'djvu' | 'cbr' | 'cbz';
    card_series?: string;
    card_count?: number;
    audio_duration?: number;
    narrator?: string | [] | [string];
    cover_file?: string;
    [k: string]: unknown;
  };

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
