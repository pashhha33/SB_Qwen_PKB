/**
 * СГЕНЕРИРОВАНО — не править руками (D2, конструкция DL-222).
 *
 * Источник (единственная истина): schema/relations/relation-line.schema.json
 * Корневой тип: RelationLine. Перегенерация: npm run generate:types (в plugin/).
 * Свежесть контролирует тест tests/unit/generated-freshness.test.ts.
 *
 * Ограничения (честно, мера M6): if/then/else-блоки схемы уплощены — типы являются
 * приближением; норма — сама схема и рантайм-валидация плагина. Общие $defs
 * (SystemCore и др.) инлайнятся в каждый файл — дубли типов между файлами нормальны.
 */
/**
 * Одна строка JSON на связь (ADR-010): сокращённая системная шапка (Р10) + subject/relation_type/object/origin_property (голые ULID) + локальные свойства role/order/starts_on/ends_on/description. Все поля ядра ОБЯЗАТЕЛЬНО присутствуют; необязательные допускают null («пустые значения — null, а не пропуск ключа»).
 */
export interface RelationLine {
  id: string;
  type: 'relation';
  title: string;
  subject: string;
  relation_type: string;
  object: string;
  origin_property: string | null;
  role: string | null;
  order: number | null;
  starts_on: string | null;
  ends_on: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  [k: string]: unknown;
}
