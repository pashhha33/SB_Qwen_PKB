/**
 * СГЕНЕРИРОВАНО — не править руками (D2, конструкция DL-222).
 *
 * Источник (единственная истина): schema/metamodel/category.schema.json
 * Корневой тип: CategoryNote. Перегенерация: npm run generate:types (в plugin/).
 * Свежесть контролирует тест tests/unit/generated-freshness.test.ts.
 *
 * Ограничения (честно, мера M6): if/then/else-блоки схемы уплощены — типы являются
 * приближением; норма — сама схема и рантайм-валидация плагина. Общие $defs
 * (SystemCore и др.) инлайнятся в каждый файл — дубли типов между файлами нормальны.
 */
/**
 * Конкретное значение внутри ровно одного фасета («Научная фантастика», «Космическая опера»). Иерархия — через непосредственного родителя; корень: parent: [].
 */
export type CategoryNote = SystemCore & {
  type?: 'category';
  facet: string | [string];
  parent?: string[];
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
