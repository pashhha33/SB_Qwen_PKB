/**
 * СГЕНЕРИРОВАНО — не править руками (D2, конструкция DL-222).
 *
 * Источник (единственная истина): schema/metamodel/taxonomy.schema.json
 * Корневой тип: TaxonomyNote. Перегенерация: npm run generate:types (в plugin/).
 * Свежесть контролирует тест tests/unit/generated-freshness.test.ts.
 *
 * Ограничения (честно, мера M6): if/then/else-блоки схемы уплощены — типы являются
 * приближением; норма — сама схема и рантайм-валидация плагина. Общие $defs
 * (SystemCore и др.) инлайнятся в каждый файл — дубли типов между файлами нормальны.
 */
/**
 * Необязательная группировка фасетов в согласованную систему классификации (ADR-007): область применения и значения по умолчанию для входящих фасетов.
 */
export type TaxonomyNote = SystemCore & {
  type?: 'taxonomy';
  /**
   * @minItems 1
   */
  facets: [string, ...string[]];
  allowed_object_types?: string[];
  hierarchy_mode?: 'strict' | 'polyhierarchical';
  assignment_cardinality?: '0..1' | '1' | '0..N' | '1..N';
  root_requirement_min?: number;
  root_requirement_max?: number | null;
  label?: string;
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
