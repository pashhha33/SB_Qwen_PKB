/**
 * СГЕНЕРИРОВАНО — не править руками (D2, конструкция DL-222).
 *
 * Источник (единственная истина): schema/entities/project.schema.json
 * Корневой тип: ProjectNote. Перегенерация: npm run generate:types (в plugin/).
 * Свежесть контролирует тест tests/unit/generated-freshness.test.ts.
 *
 * Ограничения (честно, мера M6): if/then/else-блоки схемы уплощены — типы являются
 * приближением; норма — сама схема и рантайм-валидация плагина. Общие $defs
 * (SystemCore и др.) инлайнятся в каждый файл — дубли типов между файлами нормальны.
 */
/**
 * Frontmatter заметки PROJECT-{ULID}.md: ограниченное по времени намерение с результатом. Обязательны системная шапка, status (закрытое перечисление) и owner (ссылка на person).
 */
export type ProjectNote = SystemCore &
  ServiceProps & {
    type?: 'project';
    status: 'idea' | 'active' | 'paused' | 'done' | 'dropped';
    owner: string | [string];
    description?: string;
    goal?: string;
    started_on?: string;
    due_on?: string;
    progress?: number;
    links?: string[];
    related_to?: string[];
    done_on?: string;
    paused_reason?: string;
    abandoned_reason?: string;
    next_action?: string;
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
