/**
 * СГЕНЕРИРОВАНО — не править руками (D2, конструкция DL-222).
 *
 * Источник (единственная истина): schema/metamodel/object_type.schema.json
 * Корневой тип: ObjectTypeNote. Перегенерация: npm run generate:types (в plugin/).
 * Свежесть контролирует тест tests/unit/generated-freshness.test.ts.
 *
 * Ограничения (честно, мера M6): if/then/else-блоки схемы уплощены — типы являются
 * приближением; норма — сама схема и рантайм-валидация плагина. Общие $defs
 * (SystemCore и др.) инлайнятся в каждый файл — дубли типов между файлами нормальны.
 */
/**
 * Экземпляр object_type — описание типа («Книга», «Человек»…). Самоопределяемость модели: тип — такой же объект базы (ADR-004).
 */
export type ObjectTypeNote = SystemCore & {
  type?: 'object_type';
  type_key: string;
  label: string;
  type_prefix: string;
  abstract: boolean;
  /**
   * @maxItems 1
   */
  parent_type?: [] | [string];
  lifecycle?: 'experimental' | 'standard' | 'deprecated' | 'archived';
  superseded_by?: string;
  description?: string;
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
