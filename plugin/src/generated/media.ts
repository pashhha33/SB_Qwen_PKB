/**
 * СГЕНЕРИРОВАНО — не править руками (D2, конструкция DL-222).
 *
 * Источник (единственная истина): schema/entities/media.schema.json
 * Корневой тип: MediaNote. Перегенерация: npm run generate:types (в plugin/).
 * Свежесть контролирует тест tests/unit/generated-freshness.test.ts.
 *
 * Ограничения (честно, мера M6): if/then/else-блоки схемы уплощены — типы являются
 * приближением; норма — сама схема и рантайм-валидация плагина. Общие $defs
 * (SystemCore и др.) инлайнятся в каждый файл — дубли типов между файлами нормальны.
 */
/**
 * Frontmatter заметки MEDIA-{ULID}.md: запись о файле-вложении (что это, зачем, как появилось). Обязательны системная шапка, file и media_kind.
 */
export type MediaNote = SystemCore &
  ServiceProps & {
    type?: 'media';
    file: string;
    media_kind: 'image' | 'audio' | 'video' | 'document' | 'other';
    role?: (
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
    creation_method?: (
      'photo' | 'drawing' | 'digital_art' | 'collage' | 'ai_generated' | 'scan' | 'screenshot' | 'render'
    )[];
    origin?:
      | ('clipboard' | 'vault' | 'local_disk' | 'downloaded' | 'generated' | 'camera' | 'unknown')
      | []
      | ['clipboard' | 'vault' | 'local_disk' | 'downloaded' | 'generated' | 'camera' | 'unknown'];
    width_px?: number;
    height_px?: number;
    file_size?: number;
    file_hash?: string;
    source_url?: string;
    license?: string;
    copyright_holder?: string;
    credit?: string;
    description?: string;
    ai_model?: string;
    ai_prompt?: string;
    ai_negative_prompt?: string;
    ai_seed?: string;
    ai_sampler?: string;
    ai_steps?: number;
    ai_base_image?: string | [] | [string];
    ai_generated_on?: string;
    captured_at?: string;
    capture_device?: string;
    capture_location?: string;
    art_tool?: string[];
    art_medium?: string[];
    software_used?: string[];
    render_engine?: string;
    source_materials?: string[];
    scan_source?: string;
    scan_dpi?: number;
    screenshot_of?: string;
    ai_base_image_file?: string;
    source_materials_file?: string[];
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
