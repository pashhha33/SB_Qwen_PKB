/**
 * СГЕНЕРИРОВАНО — не править руками (D2, конструкция DL-222).
 *
 * Источник (единственная истина): schema/entities/chapter.schema.json
 * Корневой тип: ChapterNote. Перегенерация: npm run generate:types (в plugin/).
 * Свежесть контролирует тест tests/unit/generated-freshness.test.ts.
 *
 * Ограничения (честно, мера M6): if/then/else-блоки схемы уплощены — типы являются
 * приближением; норма — сама схема и рантайм-валидация плагина. Общие $defs
 * (SystemCore и др.) инлайнятся в каждый файл — дубли типов между файлами нормальны.
 */
/**
 * Frontmatter заметки CHP-{ULID}.md: отдельная часть произведения (глава, пролог, эпилог, приложение). Обязательны системная шапка и — при is_front_matter ≠ true — chapter_number (DL-230, ответ А на вопрос 9-8).
 */
export type ChapterNote = SystemCore &
  ServiceProps & {
    type?: 'chapter';
    chapter_number?: number;
    chapter_title?: string;
    is_front_matter?: boolean;
    published_on?: string;
    word_count?: number;
    draft_status?: 'outline' | 'draft' | 'revised' | 'final';
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
