/**
 * СГЕНЕРИРОВАНО — не править руками (D2, конструкция DL-222).
 *
 * Источник (единственная истина): schema/entities/knowledge.schema.json
 * Корневой тип: KnowledgeNote. Перегенерация: npm run generate:types (в plugin/).
 * Свежесть контролирует тест tests/unit/generated-freshness.test.ts.
 *
 * Ограничения (честно, мера M6): if/then/else-блоки схемы уплощены — типы являются
 * приближением; норма — сама схема и рантайм-валидация плагина. Общие $defs
 * (SystemCore и др.) инлайнятся в каждый файл — дубли типов между файлами нормальны.
 */
/**
 * Frontmatter заметки KNOWLEDGE-{ULID}.md: атомарная заметка — одна мысль (концепция, идея, гипотеза, вывод, решение). Сам тезис живёт в теле заметки; обязательных предметных свойств нет.
 */
export type KnowledgeNote = SystemCore &
  ServiceProps & {
    type?: 'knowledge';
    source?: string;
    related_to?: string[];
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
