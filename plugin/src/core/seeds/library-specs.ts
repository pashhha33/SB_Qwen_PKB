/**
 * Семенные определения базовой библиотеки (B1.3 часть 1 «библиотека», DL-276/277).
 *
 * СТАТИЧЕСКИЕ ДАННЫЕ плагина (B1-4 = А): состав и содержание сидов зафиксированы здесь,
 * ULID — фиксированные системные константы по рецепту SHA-256 (seeds/seed-ulids.ts,
 * генератор scripts/generate-seed-ulids.mjs). Согласованность со схемами — тест
 * seed-consistency.test.ts (машиночитаемый эталон: schema/**, принцип F5-7).
 *
 * Источники норм:
 *   - OBJECT_TYPE book/person/work — карточки docs/metamodel/entities/{book,person,work}.md,
 *     реестр 02-entities §6 (префиксы), иерархия 07-hierarchy (book → work);
 *   - PROPERTY book/person — карточки §4 (подписи, кардинальности, applies_when) +
 *     schema/entities/{book,person}.schema.json (состав, enum-ы, required);
 *   - PROPERTY системных типов — schema/metamodel/*.schema.json + карточки системных типов
 *     (подписи полей: 01-classification §2, 04-attributes §7/§10, 03-relations, шаблоны D5);
 *   - FACET genre/literary_form/country/language/sport — 01-classification §2.2 (формат
 *     примера valid-01-genre), карточки book §4 (categories) и person §4.1/§4.2 (словарные
 *     свойства), правила facet.genre.* (rules.md). Категории НЕ сеются (Ч3-3 = Б, DL-276):
 *     CATEGORY — содержимое хранилища, создаётся пользователем (create-object).
 *
 * Границы части 1 (architecture §5, B1.3-1…B1.3-6):
 *   - relation: PROPERTY-сиды не создаются (экземпляры — строки JSONL, ADR-010; определения
 *     востребуются модулями этапа C);
 *   - book.publisher: не сеется (цель — тип organization, этап 2; schema допускает общий
 *     wikilink — заполнять в MVP нечем, карточка book §4);
 *   - related_to (book/person): этап C (реестр отношений);
 *   - cover_file / portrait_file: теневые свойства — пишет плагин (этап D, DL-144);
 *   - categories / tags: системные атрибуты И6 — определениями свойств не объявляются;
 *   - chapter_count: вычисляемое (не хранится, DL-118);
 *   - media: OBJECT_TYPE-заметка сеется как СТРУКТУРНАЯ (без PROPERTY-сидов — этап D):
 *     без неё target_types свойств cover/file_path/portrait были бы висячими ссылками
 *     (value.reference.exists, error). Этап D ОБЯЗАН использовать тот же ULID
 *     (рецепт system-type/media) — тогда ссылки разрешатся без правок.
 *   - display / applies_when как ПОЛЯ типа property: не сеются (составные структуры вне
 *     семи типов значений — определение value_type: text вызвало бы ошибку проверки типа
 *     у самих PROPERTY-заметок; поля остаются под контролем property.schema.json).
 */

import { SEED_ULIDS } from './seed-ulids';

// ---------------------------------------------------------------------------
// Спецификации
// ---------------------------------------------------------------------------

/** Семя OBJECT_TYPE-определения. */
export interface TypeSeedSpec {
	/** Рецепт ULID: system-type/{type_key}. */
	readonly recipe: string;
	readonly typeKey: string;
	/** Русская подпись (02-entities §3). */
	readonly label: string;
	/** TYPE_PREFIX (02-entities §6). */
	readonly typePrefix: string;
	readonly abstract: boolean;
	/** Ключ родительского типа (07-hierarchy) или null. */
	readonly parentKey: string | null;
	readonly description: string;
	/** Текст тела заметки. */
	readonly body: string;
	/**
	 * true для структурных заметок (work — родитель book; media — цель ссылок
	 * media_reference): устанавливаются вместе с библиотекой, но не являются
	 * «основными типами» (охват Б — book+person, DL-261/276).
	 */
	readonly structural?: boolean;
}

/** Семя FACET-определения (категории не сеются — Ч3-3 = Б). */
export interface FacetSeedSpec {
	/** Рецепт ULID: system-facet/{facet_key}. */
	readonly recipe: string;
	/** Ключ фасета (для рецепта и разрешений target_facet). */
	readonly facetKey: string;
	/** title заметки (английский, ADR-003; образец — examples/instances/facet/valid-01-genre.md). */
	readonly title: string;
	/** Русская подпись (поле label; 01-classification §2.2 — схема его не запрещает). */
	readonly label: string;
	/** Ключи типов для allowed_object_types (пусто = без ограничений). */
	readonly allowedObjectTypeKeys: readonly string[];
	readonly hierarchyMode: 'strict' | 'polyhierarchical';
	readonly assignmentCardinality: '0..1' | '1' | '0..N' | '1..N';
	readonly rootRequirementMin: number;
	readonly description: string;
}

/** Семя PROPERTY-определения. */
export interface PropertySeedSpec {
	/** Рецепт ULID: system-property/{owner}.{key}. */
	readonly recipe: string;
	/** Ключ типа-владельца (scope: specific, object_types: [owner]). */
	readonly owner: string;
	readonly key: string;
	/** Русская подпись (ADR-003: label свободен). */
	readonly label: string;
	readonly valueType: 'text' | 'number' | 'date' | 'datetime' | 'boolean' | 'object_reference' | 'media_reference';
	readonly cardinality: '1' | '0..1' | '0..N' | '1..N';
	/** Ключи целевых типов (object_reference / media_reference). */
	readonly targetTypes?: readonly string[];
	/** Ключ фасета значений (словарное свойство, 04-attributes §5). */
	readonly targetFacet?: string;
	readonly linkMode?: 'direct' | 'reified';
	readonly mediaTarget?: 'object' | 'file' | 'both';
	readonly mediaKinds?: readonly string[];
	readonly mediaRoles?: readonly string[];
	readonly allowedValues?: readonly string[];
	readonly defaultValue?: string;
	readonly appliesWhen?: { readonly property: string; readonly operation: 'equals' | 'includes_any' | 'in_category'; readonly value: readonly string[] };
	readonly display?: { readonly renderer: 'plain' | 'stars' | 'progress'; readonly scaleMax?: number; readonly unit?: string };
	readonly definition: string;
}

// ---------------------------------------------------------------------------
// OBJECT_TYPE-сиды: book + person (охват Б, DL-261/276) + структурные work, media
// ---------------------------------------------------------------------------

export const TYPE_SEED_SPECS: readonly TypeSeedSpec[] = [
	{
		recipe: 'system-type/work',
		typeKey: 'work',
		label: 'Произведение',
		typePrefix: 'WORK',
		abstract: true,
		parentKey: null,
		description: 'Произведение — абстрактный корень предметной ветви (book, chapter, poem и др.).',
		body: 'Абстрактный тип: экземпляры не создаются (object_type.abstract.no_instance), свойств не объявляет (DL-214 — общие свойства принадлежат конкретным потомкам). Потомки включаются в allowed_* автоматически (DL-208/209).',
		structural: true,
	},
	{
		recipe: 'system-type/book',
		typeKey: 'book',
		label: 'Книга',
		typePrefix: 'BOOK',
		abstract: false,
		parentKey: 'work',
		description: 'Книга: художественное или документальное произведение — издание, файл, веб-новела, карточка или аудиокнига.',
		body: 'Экземпляр — учётная запись произведения, которое вы читаете/собираетесь прочитать. `format` (обязательное перечисление) — триггер 10 условных свойств (DL-122/128): веб-новела, файл, карточка и аудиокнига добавляют свои поля. `author` обязателен (ссылка на `person`); жанр — минимум одна категория фасета «Жанр» (facet.genre.required_for_book, DL-119/126). Главы — тип `chapter` через отношение `contains` (этап C). Нормы: карточка `book`, схема `schema/entities/book.schema.json`.',
	},
	{
		recipe: 'system-type/person',
		typeKey: 'person',
		label: 'Человек',
		typePrefix: 'PERSON',
		abstract: false,
		parentKey: null,
		description: 'Человек: автор, художник, учёный, спортсмен — любой род занятий (перечисление person_role, 40 значений).',
		body: 'Экземпляр — запись о человеке. `role` обязателен (решение пользователя, DL-156): мультивыбор из 40 значений — триггер 27 условных свойств (9 групп + сквозные, М7/DL-139); для неизвестного рода занятий — `other_occupation`. Предметных обязательных полей нет: тип используется как «якорь» ссылок (карточка `person`). Псевдонимы: `birth_name`, `pen_name`, `also_known_as`, `original_name` (DL-151). Нормы: карточка `person`, схема `schema/entities/person.schema.json`.',
	},
	{
		recipe: 'system-type/media',
		typeKey: 'media',
		label: 'Медиа',
		typePrefix: 'MEDIA',
		abstract: false,
		parentKey: null,
		description: 'Медиа-обёртка: запись о файле (изображение, аудио, видео, документ) и его семантике (ADR-006/008).',
		body: 'СТРУКТУРНАЯ заметка базовой библиотеки: цель ссылок `media_reference` (book.cover, book.file_path, person.portrait). Свойства типа `media` (file, media_kind, role, ai_* и др.), мастер `sb-create-media`, индекс и теневые свойства — этап D (карточка `media`, 16 + 19 свойств). До этапа D экземпляры не создаются. ULID зафиксирован рецептом system-type/media — этап D обязан использовать его же.',
		structural: true,
	},
];

// ---------------------------------------------------------------------------
// FACET-сиды (категории — содержимое хранилища, Ч3-3 = Б)
// ---------------------------------------------------------------------------

export const FACET_SEED_SPECS: readonly FacetSeedSpec[] = [
	{
		recipe: 'system-facet/genre',
		facetKey: 'genre',
		title: 'Genre',
		label: 'Жанр',
		allowedObjectTypeKeys: ['book'],
		hierarchyMode: 'strict',
		assignmentCardinality: '1..N',
		rootRequirementMin: 1,
		description: 'Жанр произведения — единственное обязательное назначение у книги (DL-119/126: facet.genre.required_for_book). Категории создаёт пользователь (create-object); «детектив» — жанр, «роман» — форма (граница DL-126, фасет literary_form).',
	},
	{
		recipe: 'system-facet/literary_form',
		facetKey: 'literary_form',
		title: 'Literary form',
		label: 'Литературная форма',
		allowedObjectTypeKeys: ['book'],
		hierarchyMode: 'strict',
		assignmentCardinality: '0..N',
		rootRequirementMin: 0,
		description: 'Форма произведения («роман», «повесть», «рассказ»): независимое измерение классификации (ADR-007). Категория формы не должна быть одновременно категорией жанра (facet.genre.not_form, warning — граница DL-126).',
	},
	{
		recipe: 'system-facet/country',
		facetKey: 'country',
		title: 'Country',
		label: 'Страна',
		allowedObjectTypeKeys: [],
		hierarchyMode: 'strict',
		assignmentCardinality: '0..N',
		rootRequirementMin: 0,
		description: 'Страна: значения словарных свойств person.nationality (гражданство) и person.country_of_residence (место проживания) — два разных поля (карточка person §4.1).',
	},
	{
		recipe: 'system-facet/language',
		facetKey: 'language',
		title: 'Language',
		label: 'Язык',
		allowedObjectTypeKeys: [],
		hierarchyMode: 'strict',
		assignmentCardinality: '0..N',
		rootRequirementMin: 0,
		description: 'Язык: значения book.original_language (язык оригинала), person.languages_spoken и person.writing_languages (карточки book §4, person §4.1/§4.2).',
	},
	{
		recipe: 'system-facet/sport',
		facetKey: 'sport',
		title: 'Sport',
		label: 'Спорт',
		allowedObjectTypeKeys: [],
		hierarchyMode: 'strict',
		assignmentCardinality: '0..N',
		rootRequirementMin: 0,
		description: 'Вид спорта: значения условного свойства person.sport (группа ролей «Спорт», карточка person §4.2).',
	},
];

// ---------------------------------------------------------------------------
// Группы значений person_role (05-enumerations §3.17.5, 40 значений; М7 — свойство
// объявляется один раз на группу). Расхождение карточки person §4.2 (writing_genres:
// 4 значения) с группой «Литература и текст» (7) закрыто решением B1.3-4 = Б (DL-278):
// группа важнее — все свойства группы объявляются на её полном составе, карточка
// person §4.2 приведена к группе.
// ---------------------------------------------------------------------------

const ROLES_LITERATURE = ['author', 'novelist', 'poet', 'screenwriter', 'translator', 'editor', 'blogger'] as const;
const ROLES_ART = ['artist', 'illustrator', 'photographer', 'sculptor', 'designer'] as const;
const ROLES_PERFORMANCE = ['actor', 'director', 'musician', 'composer', 'singer', 'dancer', 'voice_actor'] as const;
const ROLES_SPORT = ['athlete', 'coach', 'esport_player'] as const;
const ROLES_SCIENCE = ['scientist', 'academic', 'teacher', 'engineer', 'inventor'] as const;
const ROLES_IT = ['programmer', 'game_developer', 'data_scientist'] as const;
const ROLES_BUSINESS = ['entrepreneur', 'executive', 'investor'] as const;
const ROLES_SERVICE = ['politician', 'military', 'civil_servant', 'diplomat', 'jurist'] as const;

/** Все 40 значений person_role (машиночитаемый эталон — person.schema.json $defs.person_role_value). */
export const PERSON_ROLE_VALUES = [
	'author', 'novelist', 'poet', 'screenwriter', 'translator', 'editor', 'blogger',
	'artist', 'illustrator', 'photographer', 'sculptor', 'designer',
	'actor', 'director', 'musician', 'composer', 'singer', 'dancer', 'voice_actor',
	'athlete', 'coach', 'esport_player',
	'scientist', 'academic', 'teacher', 'engineer', 'inventor',
	'physician',
	'programmer', 'game_developer', 'data_scientist',
	'entrepreneur', 'executive', 'investor',
	'politician', 'military', 'civil_servant', 'diplomat', 'jurist',
	'other_occupation',
] as const;

const LIFECYCLE_VALUES = ['experimental', 'standard', 'deprecated', 'archived'] as const;
const VALUE_TYPE_VALUES = ['text', 'number', 'date', 'datetime', 'boolean', 'object_reference', 'media_reference'] as const;
const SCOPE_VALUES = ['universal', 'family', 'specific'] as const;

// ---------------------------------------------------------------------------
// PROPERTY-сиды системных типов (65; долг F5-10 = Б; relation — этап C, граница B1.3-1;
// +label у taxonomy/facet/category — B1.3-6 = А, DL-278)
// ---------------------------------------------------------------------------

type SpecExtra = Omit<Partial<PropertySeedSpec>, 'recipe' | 'owner' | 'key' | 'label'>;

function sys(owner: string, key: string, label: string, valueType: PropertySeedSpec['valueType'], cardinality: PropertySeedSpec['cardinality'], definition: string, extra: SpecExtra = {}): PropertySeedSpec {
	return { recipe: `system-property/${owner}.${key}`, owner, key, label, valueType, cardinality, definition, ...extra };
}

const SYSTEM_PROPERTY_SEEDS: readonly PropertySeedSpec[] = [
	// --- object_type (8) ---
	sys('object_type', 'type_key', 'Ключ типа', 'text', '1', 'Английский snake_case, уникален (ADR-003): ^[a-z][a-z0-9_]*$. Ключ стабилен — подпись (label) свободна.'),
	sys('object_type', 'label', 'Подпись', 'text', '1', 'Русское название типа для интерфейса (ADR-003: идентификаторы английские, подписи русские).'),
	sys('object_type', 'type_prefix', 'Префикс типа', 'text', '1', 'Технический код для имён файлов {TYPE_PREFIX}-{ULID}.md (ADR-001): UPPER_SNAKE_CASE, 3–20 символов, A–Z/0–9/дефис/подчёркивание (F5-7 = А), уникален как целая строка (02-entities §6).'),
	sys('object_type', 'abstract', 'Абстрактный тип', 'boolean', '1', 'true — экземпляры не создаются (object_type.abstract.no_instance); потомки включаются в allowed_* автоматически (DL-208/209).'),
	sys('object_type', 'parent_type', 'Родительский тип', 'object_reference', '0..N', 'Непосредственный родитель в дереве типов (07-hierarchy); наследование свойств без дублирования. Циклы запрещены (object_type.parent.no_cycle).', { targetTypes: ['object_type'], linkMode: 'direct' }),
	sys('object_type', 'lifecycle', 'Жизненный цикл', 'text', '0..1', 'Стадия жизни определения (ADR-011, 05-enumerations §3.4): experimental, standard, deprecated, archived. При deprecated обязателен superseded_by.', { allowedValues: LIFECYCLE_VALUES }),
	sys('object_type', 'superseded_by', 'Заменён на', 'object_reference', '0..1', 'Определение-замена для lifecycle: deprecated (правило object_type.superseded.required).', { targetTypes: ['object_type'], linkMode: 'direct' }),
	sys('object_type', 'description', 'Описание', 'text', '0..1', 'Назначение типа — простыми словами.'),

	// --- property (24; display/applies_when — составные структуры, граница B1.3-2) ---
	sys('property', 'key', 'Ключ', 'text', '1', 'Английский snake_case (ADR-003): ^[a-z][a-z0-9_]*$; не совпадает с системными атрибутами И6; уникален с учётом покрытия типов (property.key.unique_in_type, F5-8).'),
	sys('property', 'label', 'Подпись', 'text', '1', 'Русская подпись поля в формах и представлениях (LabelResolver; ADR-003).'),
	sys('property', 'value_type', 'Тип значения', 'text', '1', 'Один из семи закрытого набора (ADR-006): text, number, date, datetime, boolean, object_reference, media_reference.', { allowedValues: VALUE_TYPE_VALUES }),
	sys('property', 'cardinality', 'Кардинальность', 'text', '1', 'Единственный механизм множественности (ADR-006): закрытый набор 1, 0..1, 0..N, 1..N (схема defs#cardinality; НЕ перечисление в смысле 05-enumerations — значения не snake_case, enum.value.format). required выводится из неё (04-attributes §4).'),
	sys('property', 'required', 'Обязательность', 'boolean', '1', 'Производно от cardinality (1 и 1..N → true): не вводится вручную — рассогласование невозможно (property.required.consistency, группа B).'),
	sys('property', 'scope', 'Область применения', 'text', '1', 'universal — всем типам; family — одному абстрактному предку (потомки включаются, DL-208); specific — конкретным типам (04-attributes §4/§4.1, F5-8 = А).', { allowedValues: SCOPE_VALUES }),
	sys('property', 'object_types', 'Типы-владельцы', 'object_reference', '0..N', 'Привязка к типам (F5-8 = А): universal — пусто; family — ровно один абстрактный предок; specific — минимум один конкретный тип (property.object_types.scope_consistency).', { targetTypes: ['object_type'], linkMode: 'direct' }),
	sys('property', 'target_types', 'Допустимые типы цели', 'object_reference', '0..N', 'Обязательно для object_reference и media_reference (property.target_types.for_reference): типы, на которые может ссылаться значение.', { targetTypes: ['object_type'], linkMode: 'direct' }),
	sys('property', 'target_facet', 'Фасет значений', 'object_reference', '0..1', 'Для свойства-словаря (04-attributes §5): значения — категории указанного фасета (property.target_facet.is_facet).', { targetTypes: ['facet'], linkMode: 'direct' }),
	sys('property', 'link_mode', 'Способ хранения связи', 'text', '0..1', 'Обязателен для object_reference (ADR-009/010): direct — значение-ссылка в поле; reified — отношение-объект в .sb/relations/.', { allowedValues: ['direct', 'reified'] }),
	sys('property', 'media_target', 'Цель ссылки', 'text', '0..1', 'Обязателен для media_reference (ADR-008): object — обёртки media, file — вложения, both — и то и другое.', { allowedValues: ['object', 'file', 'both'] }),
	sys('property', 'media_kinds', 'Допустимые виды медиа', 'text', '0..N', 'Подмножество media_kind (ADR-006/008): image, audio, video, document, other. Пусто — все.', { allowedValues: ['image', 'audio', 'video', 'document', 'other'] }),
	sys('property', 'media_folders', 'Папки для поиска', 'text', '0..N', 'Пути в хранилище — где искать файлы для подбора (ADR-008). Пусто — всё хранилище.'),
	sys('property', 'media_extensions', 'Допустимые расширения', 'text', '0..N', 'jpg, png, mp3, … (ADR-008). Пусто — все.'),
	sys('property', 'media_display', 'Способ показа медиа', 'text', '0..1', 'gallery — карточки с миниатюрами, list — список (ADR-008). По умолчанию gallery.', { allowedValues: ['gallery', 'list'] }),
	sys('property', 'media_thumbnail_size', 'Размер миниатюры', 'text', '0..1', 'small, medium, large (ADR-008). По умолчанию medium.', { allowedValues: ['small', 'medium', 'large'] }),
	sys('property', 'media_roles', 'Допустимые роли', 'text', '0..N', 'Подмножество закрытого перечня ролей media (property.schema, ADR-006 §5): cover, banner, logo, portrait, avatar, preview, background, illustration, photo, screenshot, diagram, attachment, other. Пусто — все.', { allowedValues: ['cover', 'banner', 'logo', 'portrait', 'avatar', 'preview', 'background', 'other', 'illustration', 'photo', 'screenshot', 'diagram', 'attachment'] }),
	sys('property', 'lifecycle', 'Жизненный цикл', 'text', '0..1', 'Стадия жизни определения (ADR-011): experimental, standard, deprecated, archived; при deprecated обязателен superseded_by.', { allowedValues: LIFECYCLE_VALUES }),
	sys('property', 'superseded_by', 'Заменён на', 'object_reference', '0..1', 'Определение-замена для lifecycle: deprecated.', { targetTypes: ['property'], linkMode: 'direct' }),
	sys('property', 'default_value', 'Значение по умолчанию', 'text', '0..1', 'Подставляется при создании объекта (04-attributes §4); например read_status: planned (05-enumerations §3.17.9).'),
	sys('property', 'allowed_values', 'Допустимые значения', 'text', '0..N', 'Закрытое перечисление (ADR-011, 05-enumerations §5): английский snake_case, значения уникальны;adding значения = изменение метамодели.'),
	sys('property', 'definition', 'Определение', 'text', '0..1', 'Смысл свойства, правила заполнения, источник нормы.'),
	sys('property', 'service', 'Служебное свойство', 'boolean', '0..1', 'true — значение ведёт плагин, в формы не предлагается (08-views §7, DL-168); в MVP одно — sb_issues.'),
	sys('property', 'create_from_link', 'Создание из ссылки', 'text', '0..1', 'Только для ссылок (раздел 12 §5.4, DL-187): ask — спрашивать тип при клике по пустой ссылке, forbid — не создавать, auto — создавать без вопроса (жёсткий контекст К1). По умолчанию ask.', { allowedValues: ['ask', 'forbid', 'auto'] }),

	// --- relation_type (13) ---
	sys('relation_type', 'key', 'Ключ', 'text', '1', 'Английский snake_case, уникален (ADR-003/009): authorship, contains, related_to, …'),
	sys('relation_type', 'label', 'Название', 'text', '1', 'Русское название типа отношения (ADR-003).'),
	sys('relation_type', 'forward_label', 'Подпись вперёд', 'text', '1', 'Как связь подписана от субъекта к объекту («содержит», «автор — …»).'),
	sys('relation_type', 'reverse_label', 'Подпись обратно', 'text', '1', 'Как вычисляемая обратная сторона подписана от объекта к субъекту («часть от», «произведение автора»). Обратная сторона не хранится (ADR-009 Р11).'),
	sys('relation_type', 'direction', 'Направление', 'text', '1', 'directed — направленное; symmetric — симметричное (related_to): хранится один раз, обратная сторона вычисляется (ADR-009 Р1/Р6).', { allowedValues: ['directed', 'symmetric'] }),
	sys('relation_type', 'subject_to_object', 'Кардинальность субъект→объект', 'text', '1', 'Сколько объектов у одного субъекта: закрытый набор 1, 0..1, 0..N, 1..N (ADR-009 — двусторонняя кардинальность; схема defs#cardinality, не перечисление 05-enumerations).'),
	sys('relation_type', 'object_to_subject', 'Кардинальность объект→субъект', 'text', '1', 'Сколько субъектов у одного объекта: закрытый набор 1, 0..1, 0..N, 1..N (ADR-009; схема defs#cardinality, не перечисление 05-enumerations).'),
	sys('relation_type', 'uniqueness_rule', 'Правило уникальности', 'text', '1', 'pair — одна связь на пару (subject, object); triple — с учётом локальных свойств/роли; none — без ограничения (ADR-009).', { allowedValues: ['pair', 'triple', 'none'] }),
	sys('relation_type', 'allowed_subject_types', 'Допустимые типы субъектов', 'object_reference', '0..N', 'Ограничение концов (ADR-009): пусто — любой тип; потомки включаются автоматически (DL-208/209).', { targetTypes: ['object_type'], linkMode: 'direct' }),
	sys('relation_type', 'allowed_object_types', 'Допустимые типы объектов', 'object_reference', '0..N', 'Ограничение концов (ADR-009); потомки включаются автоматически (DL-208/209).', { targetTypes: ['object_type'], linkMode: 'direct' }),
	sys('relation_type', 'suggested_subject_types', 'Рекомендуемые типы субъектов', 'object_reference', '0..N', 'Подсказки в формах (не ограничение, ADR-009).', { targetTypes: ['object_type'], linkMode: 'direct' }),
	sys('relation_type', 'suggested_object_types', 'Рекомендуемые типы объектов', 'object_reference', '0..N', 'Подсказки в формах (не ограничение, ADR-009).', { targetTypes: ['object_type'], linkMode: 'direct' }),
	sys('relation_type', 'definition', 'Описание', 'text', '0..1', 'Семантика отношения и правила заполнения.'),

	// --- taxonomy (8) ---
	sys('taxonomy', 'label', 'Подпись', 'text', '0..1', 'Русское название таксономии для интерфейса (ADR-003: title — технический слой, label — подписи). Необязательно: title может быть русским.'),
	sys('taxonomy', 'facets', 'Фасеты', 'object_reference', '1..N', 'Фасеты, входящие в таксономию (минимум один — taxonomy.facets.min_one); фасет принадлежит максимум одной таксономии (ADR-007).', { targetTypes: ['facet'], linkMode: 'direct' }),
	sys('taxonomy', 'allowed_object_types', 'Допустимые типы объектов', 'object_reference', '0..N', 'Область применения; пусто — без ограничений; служит значением по умолчанию для входящих фасетов; потомки включаются (DL-208/209).', { targetTypes: ['object_type'], linkMode: 'direct' }),
	sys('taxonomy', 'hierarchy_mode', 'Режим иерархии', 'text', '0..1', 'Значение по умолчанию для фасетов: strict — дерево, polyhierarchical — сеть (01-classification §2.1, 05-enumerations §3.5).', { allowedValues: ['strict', 'polyhierarchical'] }),
	sys('taxonomy', 'assignment_cardinality', 'Кардинальность назначения', 'text', '0..1', 'Значение по умолчанию для фасетов: закрытый набор 0..1, 1, 0..N, 1..N (01-classification §2.1; схема defs#cardinality, не перечисление 05-enumerations).'),
	sys('taxonomy', 'root_requirement_min', 'Минимум корней', 'number', '0..1', 'Сколько минимум корневых категорий должно быть назначено (значение по умолчанию для фасетов).'),
	sys('taxonomy', 'root_requirement_max', 'Максимум корней', 'number', '0..1', 'Сколько максимум корневых категорий можно назначить; пусто/null — без ограничения.'),
	sys('taxonomy', 'description', 'Описание', 'text', '0..1', 'Назначение классификации.'),

	// --- facet (8) ---
	sys('facet', 'label', 'Подпись', 'text', '0..1', 'Русское название фасета для интерфейса (ADR-003); например title: Genre, label: Жанр. Необязательно.'),
	sys('facet', 'taxonomy', 'Таксономия', 'object_reference', '0..1', 'Принадлежность таксономии (ADR-007): максимум одна; независимый фасет — пустой список (01-classification §2.2).', { targetTypes: ['taxonomy'], linkMode: 'direct' }),
	sys('facet', 'allowed_object_types', 'Допустимые типы объектов', 'object_reference', '0..N', 'Область применения фасета; пусто — наследуется от таксономии, иначе без ограничений (assignment.type_allowed, DL-208/209).', { targetTypes: ['object_type'], linkMode: 'direct' }),
	sys('facet', 'hierarchy_mode', 'Режим иерархии', 'text', '0..1', 'strict (по умолчанию) — у категории один родитель; polyhierarchical — несколько (01-classification §2.2).', { allowedValues: ['strict', 'polyhierarchical'] }),
	sys('facet', 'assignment_cardinality', 'Кардинальность назначения', 'text', '0..1', 'Сколько категорий фасета можно назначить объекту: закрытый набор 0..1, 1, 0..N, 1..N; по умолчанию 0..N; 1..N — минимум одна (жанр у книги, DL-126). Схема defs#cardinality, не перечисление 05-enumerations.'),
	sys('facet', 'root_requirement_min', 'Минимум корней', 'number', '0..1', 'Минимум КОРНЕВЫХ категорий в фасете (по умолчанию 0; у жанра — 1, DL-126). Проверка — facet.root_requirement (warning, уровень 4): считается состав фасета, а не назначения объекта.'),
	sys('facet', 'root_requirement_max', 'Максимум корней', 'number', '0..1', 'Максимум корневых категорий; пусто/null — без ограничения.'),
	sys('facet', 'description', 'Описание', 'text', '0..1', 'Что классифицирует фасет.'),

	// --- category (4) ---
	sys('category', 'label', 'Подпись', 'text', '0..1', 'Русское название категории для интерфейса (ADR-003); например title: Science fiction, label: Научная фантастика. Необязательно.'),
	sys('category', 'facet', 'Фасет', 'object_reference', '1', 'Категория принадлежит ровно одному фасету (category.facet.required, category.facet.single; правило П8, ADR-007).', { targetTypes: ['facet'], linkMode: 'direct' }),
	sys('category', 'parent', 'Родительские категории', 'object_reference', '0..N', 'Непосредственные родители ТОГО ЖЕ фасета; корень — пустой список; в strict-фасете родитель максимум один (01-classification §2.3).', { targetTypes: ['category'], linkMode: 'direct' }),
	sys('category', 'description', 'Описание', 'text', '0..1', 'Смысл категории.'),
];

// ---------------------------------------------------------------------------
// PROPERTY-сиды book (22: 12 базовых + 10 условных; карточка book §4, DL-122/128)
// ---------------------------------------------------------------------------

function book(key: string, label: string, valueType: PropertySeedSpec['valueType'], cardinality: PropertySeedSpec['cardinality'], definition: string, extra: SpecExtra = {}): PropertySeedSpec {
	return sys('book', key, label, valueType, cardinality, definition, extra);
}

const BOOK_PROPERTY_SEEDS: readonly PropertySeedSpec[] = [
	book('author', 'Автор', 'object_reference', '1..N', 'Автор(ы) книги — ссылка на person (book.author.required, error). Совместное авторство — несколько значений.', { targetTypes: ['person'], linkMode: 'direct' }),
	book('publication_year', 'Год издания', 'number', '0..1', 'Год издания (1–2100, book.publication_year.range).'),
	book('first_published_on', 'Дата первой публикации', 'date', '0..1', 'Дата первой публикации; частичные даты допустимы («1966-00-00», П1).'),
	book('isbn', 'ISBN', 'text', '0..1', 'ISBN — 10 или 13 символов (book.isbn.format, warning).'),
	book('pages', 'Объём в страницах', 'number', '0..1', 'Число страниц (> 0).'),
	book('original_language', 'Язык оригинала', 'object_reference', '0..1', 'Язык оригинала — категория фасета «Язык» (словарное свойство, 04-attributes §5).', { targetTypes: ['category'], targetFacet: 'language', linkMode: 'direct' }),
	book('cover', 'Обложка', 'media_reference', '0..1', 'Обложка — обёртка media вида image роли cover (ADR-008; book.cover.role, warning). Теневое свойство cover_file — этап D (DL-144).', { targetTypes: ['media'], mediaTarget: 'object', mediaKinds: ['image'], mediaRoles: ['cover'] }),
	book('read_status', 'Статус прочтения', 'text', '1', 'Личный статус прочтения (05-enumerations §3.17.9); по умолчанию planned. finished_on ожидает read/abandoned (book.finished_requires_status, warning).', { allowedValues: ['planned', 'reading', 'read', 'abandoned', 'not_planned'], defaultValue: 'planned' }),
	book('rating', 'Оценка', 'number', '0..1', 'Личная оценка — целое 1–10 (DL-113); показ звёздами (display.renderer: stars — только отображение, DL-117/123).', { display: { renderer: 'stars', scaleMax: 10 } }),
	book('format', 'Формат', 'text', '1', 'Формат книги (05-enumerations §3.17.1, DL-121/127); обязательное — триггер 10 условных свойств (applies_when, DL-128). print условных свойств не имеет (DL-228).', { allowedValues: ['file', 'card', 'web_novel', 'print', 'audio'] }),
	book('finished_on', 'Дата окончания чтения', 'date', '0..1', 'Когда дочитали/бросили; частичные даты допустимы.'),
	book('description', 'Описание', 'text', '0..1', 'Аннотация или личное описание.'),
	// условные: format = web_novel (4)
	book('platform', 'Площадка публикации', 'text', '0..1', 'Площадка, на которой выходит веб-новела (DL-122/128).', { appliesWhen: { property: 'format', operation: 'equals', value: ['web_novel'] } }),
	book('publication_status', 'Статус публикации', 'text', '0..1', 'Статус публикации веб-новелы (05-enumerations §3.17.2, DL-127).', { allowedValues: ['ongoing', 'hiatus', 'completed', 'cancelled', 'unknown'], appliesWhen: { property: 'format', operation: 'equals', value: ['web_novel'] } }),
	book('release_cadence', 'Периодичность выхода глав', 'text', '0..1', 'Как часто выходят главы («еженедельно», «по вторникам»).', { appliesWhen: { property: 'format', operation: 'equals', value: ['web_novel'] } }),
	book('last_chapter_on', 'Дата последней главы', 'date', '0..1', 'Дата выхода последней известной главы.', { appliesWhen: { property: 'format', operation: 'equals', value: ['web_novel'] } }),
	// условные: format = file (2)
	book('file_path', 'Путь к файлу', 'media_reference', '0..1', 'Wikilink на файл книги в хранилище (media_target: file — значение ссылка на вложение, НЕ объект; существование файла — value.media.file_exists, этап D).', { targetTypes: ['media'], mediaTarget: 'file', appliesWhen: { property: 'format', operation: 'equals', value: ['file'] } }),
	book('file_format', 'Формат файла', 'text', '0..1', 'Формат файла книги (05-enumerations §3.17.4, 9 значений — DL-127/228).', { allowedValues: ['epub', 'fb2', 'pdf', 'mobi', 'azw3', 'txt', 'djvu', 'cbr', 'cbz'], appliesWhen: { property: 'format', operation: 'equals', value: ['file'] } }),
	// условные: format = card (2)
	book('card_series', 'Серия карточек', 'text', '0..1', 'Серия/картотечный набор бумажной карточки.', { appliesWhen: { property: 'format', operation: 'equals', value: ['card'] } }),
	book('card_count', 'Число карточек', 'number', '0..1', 'Сколько карточек в серии (> 0).', { appliesWhen: { property: 'format', operation: 'equals', value: ['card'] } }),
	// условные: format = audio (2)
	book('audio_duration', 'Длительность', 'number', '0..1', 'Длительность аудиокниги в минутах (> 0).', { display: { renderer: 'plain', unit: 'мин.' }, appliesWhen: { property: 'format', operation: 'equals', value: ['audio'] } }),
	book('narrator', 'Чтец', 'object_reference', '0..1', 'Чтец аудиокниги — ссылка на person.', { targetTypes: ['person'], linkMode: 'direct', appliesWhen: { property: 'format', operation: 'equals', value: ['audio'] } }),
];

// ---------------------------------------------------------------------------
// PROPERTY-сиды person (42: 15 базовых + 27 условных; карточка person §4.1/§4.2)
// ---------------------------------------------------------------------------

function person(key: string, label: string, valueType: PropertySeedSpec['valueType'], cardinality: PropertySeedSpec['cardinality'], definition: string, extra: SpecExtra = {}): PropertySeedSpec {
	return sys('person', key, label, valueType, cardinality, definition, extra);
}

/** Условное свойство person: триггер role, операция includes_any (М7/DL-139). */
function personIf(key: string, label: string, valueType: PropertySeedSpec['valueType'], cardinality: PropertySeedSpec['cardinality'], roles: readonly string[], definition: string, extra: SpecExtra = {}): PropertySeedSpec {
	return person(key, label, valueType, cardinality, definition, { ...extra, appliesWhen: { property: 'role', operation: 'includes_any', value: roles } });
}

const PERSON_PROPERTY_SEEDS: readonly PropertySeedSpec[] = [
	// базовые (15)
	person('role', 'Род занятий', 'text', '1..N', 'Обязательный мультивыбор из 40 значений person_role (05-enumerations §3.17.5; DL-138/156/157) — триггер 27 условных свойств (includes_any, М7). Неизвестен — other_occupation.', { allowedValues: PERSON_ROLE_VALUES }),
	person('birth_date', 'Дата рождения', 'date', '0..1', 'Частичные даты допустимы («1891-00-00», П1). birth_date ≤ death_date (person.dates.order, error). Обязательность НЕ вводится (карточка person §4).'),
	person('death_date', 'Дата смерти', 'date', '0..1', 'Частичные даты допустимы; только для умерших (person.death.living, warning).'),
	person('birth_name', 'Имя при рождении', 'text', '0..1', 'Псевдонимное поле 1 из 4 (DL-151); совпадение с title — person.name.conflict, warning.'),
	person('original_name', 'Имя на языке оригинала', 'text', '0..1', 'Имя в оригинальном написании (латиница/иероглифы…); псевдонимное поле (DL-151).'),
	person('pen_name', 'Псевдоним', 'text', '0..N', 'Литературный псевдоним; БАЗОВОЕ свойство — не условное (DL-151/228).'),
	person('also_known_as', 'Также известен как', 'text', '0..N', 'Прочие варианты имени (прозвища, сценические имена); псевдонимное поле (DL-151).'),
	person('sort_name', 'Сортировочное имя', 'text', '0..1', 'Формат «Фамилия, Имя» (person.sort_name.format, warning).'),
	person('gender', 'Пол', 'text', '0..1', 'Закрытое перечисление (05-enumerations §3.17.10, DL-226).', { allowedValues: ['male', 'female', 'other'] }),
	person('nationality', 'Гражданство', 'object_reference', '0..N', 'Категории фасета «Страна»; гражданство ≠ место проживания (карточка person §4.3).', { targetTypes: ['category'], targetFacet: 'country', linkMode: 'direct' }),
	person('country_of_residence', 'Страна проживания', 'object_reference', '0..1', 'Категория фасета «Страна» (карточка person §4.1).', { targetTypes: ['category'], targetFacet: 'country', linkMode: 'direct' }),
	person('languages_spoken', 'Языки', 'object_reference', '0..N', 'Категории фасета «Язык» — на каких языках говорит человек.', { targetTypes: ['category'], targetFacet: 'language', linkMode: 'direct' }),
	person('links', 'Внешние ссылки', 'text', '0..N', 'URL профилей и страниц; префикс http(s) (person.links.format, warning). Структура «название + адрес + тип» — открытый вопрос 9.5 (этап 2).'),
	person('description', 'Описание', 'text', '0..1', 'Свободный текст о человеке.'),
	person('portrait', 'Портрет', 'media_reference', '0..1', 'Портрет/аватар — обёртка media вида image ролей portrait/avatar (ADR-008; person.portrait.role, warning). Теневое portrait_file — этап D.', { targetTypes: ['media'], mediaTarget: 'object', mediaKinds: ['image'], mediaRoles: ['portrait', 'avatar'] }),
	// сквозные (3)
	personIf('known_for', 'Известен за', 'text', '0..N', ['author', 'novelist', 'poet', 'screenwriter', 'artist', 'illustrator', 'photographer', 'sculptor', 'designer', 'actor', 'director', 'musician', 'composer', 'singer', 'athlete', 'scientist', 'academic', 'engineer', 'inventor', 'politician', 'entrepreneur'], 'Главное, чем человек известен (сквозное свойство 21 роли, карточка person §4.2).'),
	personIf('field_of_work', 'Область деятельности', 'text', '0..N', ['scientist', 'academic', 'engineer', 'inventor', 'teacher', 'jurist', 'data_scientist'], 'Профессиональная область (сквозное свойство, карточка person §4.2).'),
	personIf('active_years', 'Годы активности', 'text', '0..1', ['actor', 'director', 'musician', 'composer', 'singer', 'dancer', 'athlete', 'coach', 'esport_player', 'voice_actor'], 'Период активной карьеры, текст вида «1995–2020» (дедупликация years_active/serviceyears — DL-152).'),
	// Литература и текст
	personIf('writing_genres', 'Жанры работ', 'object_reference', '0..N', ROLES_LITERATURE, 'Категории фасета «Жанр», в которых пишет/переводит/редактирует автор — все 7 ролей группы «Литература и текст» (05-enumerations §3.17.5; М7 — свойство объявляется один раз на группу; B1.3-4 = Б, DL-278).', { targetTypes: ['category'], targetFacet: 'genre', linkMode: 'direct' }),
	personIf('writing_languages', 'Языки работ', 'object_reference', '0..N', ROLES_LITERATURE, 'Категории фасета «Язык», на которых пишет автор (группа «Литература и текст»).', { targetTypes: ['category'], targetFacet: 'language', linkMode: 'direct' }),
	personIf('published_works', 'Основные работы', 'text', '0..N', [...ROLES_LITERATURE, ...ROLES_ART], 'Главные произведения; перевод на object_reference — этап 2 (вопрос 9.4: типа work-экземпляры).'),
	// Изобразительное искусство
	personIf('art_movement', 'Художественное направление', 'text', '0..N', ROLES_ART, 'Направление/школа («импрессионизм», «соцреализм»).'),
	personIf('art_training', 'Обучение, школа', 'text', '0..N', ROLES_ART, 'Где и у кого учился.'),
	personIf('art_mediums', 'Материалы и техника', 'text', '0..N', ROLES_ART, 'Масло, акварель, цифровая живопись…'),
	// Исполнительские искусства
	personIf('instruments', 'Инструменты', 'text', '0..N', ROLES_PERFORMANCE, 'Музыкальные инструменты.'),
	personIf('performance_genres', 'Жанры выступлений', 'object_reference', '0..N', ROLES_PERFORMANCE, 'Категории-жанры выступлений (дедупликация жанров музыканта/танцовщика/актёра — DL-152); фасет карточкой не задан.', { targetTypes: ['category'], linkMode: 'direct' }),
	personIf('ensembles', 'Коллективы', 'text', '0..N', ROLES_PERFORMANCE, 'Группы/труппы/оркестры; текст до появления типа organization (этап 2, вопрос 9.4).'),
	// Спорт
	personIf('sport', 'Вид спорта', 'object_reference', '0..1', ROLES_SPORT, 'Категория фасета «Спорт».', { targetTypes: ['category'], targetFacet: 'sport', linkMode: 'direct' }),
	personIf('sport_position', 'Позиция / амплуа', 'text', '0..1', ROLES_SPORT, 'Игровая позиция («вратарь», «разыгрывающий»).'),
	personIf('sport_teams', 'Команды', 'text', '0..N', ROLES_SPORT, 'Клубы и команды; текст до появления типа organization (этап 2).'),
	// Наука и образование
	personIf('academic_degree', 'Учёная степень, квалификация', 'text', '0..N', ROLES_SCIENCE, 'Степени и звания («к.ф.-м.н.», «профессор»).'),
	personIf('academic_institutions', 'Учебные и научные заведения', 'text', '0..N', ROLES_SCIENCE, 'Вузы, институты, лаборатории; текст до появления типа organization (этап 2).'),
	personIf('doctoral_advisor', 'Научный руководитель', 'object_reference', '0..1', ROLES_SCIENCE, 'Ссылка на person; не указывает на себя (person.doctoral_advisor.not_self, error).', { targetTypes: ['person'], linkMode: 'direct' }),
	personIf('thesis_title', 'Название диссертации', 'text', '0..1', ROLES_SCIENCE, 'Название диссертационной работы.'),
	// Медицина
	personIf('medical_specialty', 'Медицинская специальность', 'text', '0..N', ['physician'], 'Специализация врача («кардиолог»).'),
	personIf('medical_institution', 'Клиника, учреждение', 'text', '0..1', ['physician'], 'Место практики; текст до появления типа organization (этап 2).'),
	// IT и разработка
	personIf('programming_languages', 'Языки программирования', 'text', '0..N', ROLES_IT, 'Основные языки («TypeScript», «Python»).'),
	personIf('software_projects', 'Проекты', 'text', '0..N', ROLES_IT, 'Известные проекты/продукты.'),
	// Бизнес
	personIf('business_positions', 'Должности и компании', 'text', '0..N', ROLES_BUSINESS, 'Позиции в компаниях; текст до появления типа organization (этап 2).'),
	// Служба и государство
	personIf('office_held', 'Занимаемые должности', 'text', '0..N', ROLES_SERVICE, 'Выборные и назначаемые должности.'),
	personIf('military_rank', 'Звание, род войск', 'text', '0..1', ROLES_SERVICE, 'Воинское звание и род войск.'),
	personIf('conflicts', 'Участие в конфликтах', 'text', '0..N', ROLES_SERVICE, 'Войны и кампании.'),
];

/** Все PROPERTY-сиды библиотеки: системные (65) + book (22) + person (42) = 129. */
export const PROPERTY_SEED_SPECS: readonly PropertySeedSpec[] = [
	...SYSTEM_PROPERTY_SEEDS,
	...BOOK_PROPERTY_SEEDS,
	...PERSON_PROPERTY_SEEDS,
];

/** Все семена библиотеки (порядок установки: типы → фасеты → свойства). */
export const LIBRARY_SEED_COUNTS = {
	types: TYPE_SEED_SPECS.length,
	facets: FACET_SEED_SPECS.length,
	properties: PROPERTY_SEED_SPECS.length,
} as const;

/** ULID зарезервированного типа media (структурная заметка; этап D обязан его использовать). */
export const MEDIA_RESERVED_ULID = SEED_ULIDS['system-type/media'];
