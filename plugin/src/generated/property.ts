/**
 * СГЕНЕРИРОВАНО — не править руками (D2, конструкция DL-222).
 *
 * Источник (единственная истина): schema/metamodel/property.schema.json
 * Корневой тип: PropertyNote. Перегенерация: npm run generate:types (в plugin/).
 * Свежесть контролирует тест tests/unit/generated-freshness.test.ts.
 *
 * Ограничения (честно, мера M6): if/then/else-блоки схемы уплощены — типы являются
 * приближением; норма — сама схема и рантайм-валидация плагина. Общие $defs
 * (SystemCore и др.) инлайнятся в каждый файл — дубли типов между файлами нормальны.
 */
/**
 * Экземпляр property — описание поля («Автор», «Год издания»…): ключ, тип значения, кардинальность, область применения, условие applies_when.
 */
export type PropertyNote = SystemCore & {
  type?: 'property';
  key: string;
  label: string;
  value_type: 'text' | 'number' | 'date' | 'datetime' | 'boolean' | 'object_reference' | 'media_reference';
  /**
   * @minItems 1
   */
  target_types?: [string, ...string[]];
  target_facet?: string;
  object_types?: string[];
  link_mode?: 'direct' | 'reified';
  media_target?: 'object' | 'file' | 'both';
  media_kinds?: ('image' | 'audio' | 'video' | 'document' | 'other')[];
  media_folders?: string[];
  media_extensions?: string[];
  media_display?: 'gallery' | 'list';
  media_thumbnail_size?: 'small' | 'medium' | 'large';
  media_roles?: (
    | 'cover'
    | 'banner'
    | 'logo'
    | 'portrait'
    | 'avatar'
    | 'preview'
    | 'background'
    | 'other'
    | 'illustration'
    | 'photo'
    | 'screenshot'
    | 'diagram'
    | 'attachment'
  )[];
  cardinality: '0..1' | '1' | '0..N' | '1..N';
  required: boolean;
  scope: 'universal' | 'family' | 'specific';
  lifecycle?: 'experimental' | 'standard' | 'deprecated' | 'archived';
  superseded_by?: string;
  default_value?: {
    [k: string]: unknown;
  };
  /**
   * @minItems 1
   */
  allowed_values?: [string, ...string[]];
  display?: {
    renderer?: 'plain' | 'stars' | 'progress';
    scale_max?: number;
    unit?: string;
  };
  definition?: string;
  service?: boolean;
  create_from_link?: 'ask' | 'forbid' | 'auto';
  applies_when?: AppliesWhen;
  [k: string]: unknown;
};
export type AppliesWhen = {
  property: string;
  operation: 'equals' | 'in_category' | 'includes_any';
  value: string | [string, ...string[]];
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
