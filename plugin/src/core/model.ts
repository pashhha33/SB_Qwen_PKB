/**
 * Модель разобранный заметки — результат работы универсального парсера
 * (модуль markdown-parser, норма: phases.md §4, ADR-002).
 *
 * Одна и та же структура описывает ЛЮБУю заметку: и экземпляр предметного типа
 * (book, person…), и определение метамодели (object_type, property…), потому что
 * модель самоопределяющаяся: определения — такие же объекты (ADR-004).
 *
 * Примечание: это РУКОПИСНЫЕ рантайм-типы парсера. Машиночитаемые типы из
 * JSON Schema будут СГЕНЕРИРОВАНЫ в под-батче A3 (пункт D2, конструкция DL-222:
 * json-schema-to-typescript, тест «сгенерированное == зафиксированное»).
 */

/** Закрытый набор из 8 системных атрибутов (ADR-006). */
export const SYSTEM_KEYS = [
	'id',
	'type',
	'title',
	'aliases',
	'created_at',
	'updated_at',
	'categories',
	'tags',
] as const;

export type SystemKey = (typeof SYSTEM_KEYS)[number];

/** Сокращённый набор системных атрибутов для экземпляров `relation` (ADR-009 Р10). */
export const RELATION_SYSTEM_KEYS: readonly SystemKey[] = [
	'id',
	'type',
	'title',
	'created_at',
	'updated_at',
];

/** Системные атрибуты в нормализованном виде (чего нет в заметке — того нет в модели). */
export interface SystemAttributes {
	id: string;
	type: string;
	title: string;
	aliases: string[];
	created_at: string;
	updated_at: string;
	categories: string[];
	tags: string[];
}

/** Идентичность, извлечённая из имени файла {TYPE_PREFIX}-{ULID}.md (ADR-001). */
export interface ObjectIdentity {
	typePrefix: string;
	ulid: string;
}

/** Wikilink-ссылка в теле заметки: [[цель#заголовок^блок|подпись]]. */
export interface WikilinkRef {
	/** Цель без #заголовка, ^блока и |подписи, обрезанная. */
	target: string;
	/** Отображаемый текст после '|' (null, если его нет). */
	displayText: string | null;
	/** Заголовок после '#' (null, если нет). Часть после # в title не попадает (раздел 12). */
	heading: string | null;
	/** Идентификатор блока после '^' (null, если нет). */
	blockId: string | null;
	/** true для встраиваний ![[...]]. */
	isEmbed: boolean;
}

/** Некритичное замечание парсера (не ошибка разбора, а сигнал для диагностики). */
export type ParseIssueCode =
	| 'bom_stripped'
	| 'yaml_error'
	| 'frontmatter_not_mapping'
	| 'date_normalized';

export interface ParseIssue {
	code: ParseIssueCode;
	message: string;
}

/** Результат разбора одной Markdown-заметки. */
export interface SbNote {
	/** Путь от корня хранилища (как его отдал adapter). */
	path: string;
	/** Имя файла с расширением. */
	fileName: string;
	/** Идентичность из имени файла, если имя имеет формат {TYPE_PREFIX}-{ULID}.md. */
	fileNameIdentity: ObjectIdentity | null;
	/** Есть ли в файле блок frontmatter. */
	frontmatterPresent: boolean;
	/** Системные атрибуты (только присутствующие; нормализованы: списки, даты-строки). */
	system: Partial<SystemAttributes>;
	/** Предметные (несистемные) поля frontmatter — как есть после YAML-разбора. */
	properties: Record<string, unknown>;
	/** Тело заметки (всё, что после frontmatter). */
	body: string;
	/** Wikilink-и тела (код-блоки и инлайн-код пропускаются). */
	wikilinks: WikilinkRef[];
	/** Замечания парсера (BOM, нормализация дат, ошибка YAML…). */
	issues: ParseIssue[];
	/**
	 * true, если frontmatter заявлен, но не применим (ошибка YAML или это не
	 * «словарь»). По ADR-002 некорректное определение не применяется: парсер
	 * не бросает исключение, а возвращает заметку без полей + issue 'yaml_error' —
	 * решение, что делать (последняя корректная версия + ошибка пользователю),
	 * принимает validation-runner (этап A2/B).
	 */
	frontmatterBroken: boolean;
}
