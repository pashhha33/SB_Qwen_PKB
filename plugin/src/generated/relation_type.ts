/**
 * СГЕНЕРИРОВАНО — не править руками (D2, конструкция DL-222).
 *
 * Источник (единственная истина): schema/metamodel/relation_type.schema.json
 * Корневой тип: RelationTypeNote. Перегенерация: npm run generate:types (в plugin/).
 * Свежесть контролирует тест tests/unit/generated-freshness.test.ts.
 *
 * Ограничения (честно, мера M6): if/then/else-блоки схемы уплощены — типы являются
 * приближением; норма — сама схема и рантайм-валидация плагина. Общие $defs
 * (SystemCore и др.) инлайнятся в каждый файл — дубли типов между файлами нормальны.
 */
/**
 * Экземпляр relation_type — семантика связи («авторство», «владение», «содержит»): метки сторон, направление, двусторонняя кардинальность, правило уникальности, допустимые и предпочтительные типы сторон.
 */
export type RelationTypeNote = SystemCore & {
  type?: 'relation_type';
  key: string;
  label: string;
  forward_label: string;
  reverse_label: string;
  direction: 'directed' | 'symmetric';
  subject_to_object: '0..1' | '1' | '0..N' | '1..N';
  object_to_subject: '0..1' | '1' | '0..N' | '1..N';
  uniqueness_rule: 'pair' | 'triple' | 'none';
  allowed_subject_types?: string[];
  allowed_object_types?: string[];
  suggested_subject_types?: string[];
  suggested_object_types?: string[];
  definition?: string;
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
