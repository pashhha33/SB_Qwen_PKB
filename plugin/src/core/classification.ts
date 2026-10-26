/**
 * classification-service (модуль этапа B1.3 часть 2, 09-modules слой 3): снимок
 * классификации — таксономии, фасеты, категории; наследование умолчаний;
 * предки категории; разбор назначений (`categories`) по фасетам.
 *
 * Нормы: ADR-005 (три уровня: taxonomy → facet → category → назначение),
 * ADR-007 (фасет — самостоятельный объект; П8 — категория не ссылается на
 * таксономию напрямую), `01-classification.md` §2.1–§2.4 (наследование умолчаний
 * «фасет → таксономия → таблица §2.2»), `04-attributes.md` §2 (системное поле
 * `categories`), DL-208/209 (семантика потомков в `allowed_*`).
 *
 * Границы модуля (честно, architecture.md §5):
 *   - снимок строится по заметкам определений (Metamodel/Taxonomies|Facets|Categories
 *     + канонические имена TAXONOMY-/FACET-/CATEGORY- в любом месте хранилища);
 *     экземпляры предметных типов не читаются — назначения передаёт вызывающий;
 *   - правила валидации группы E — в classification-engine (тот же модуль реестра);
 *   - команда `assign-category` (запись назначений) — часть 2b;
 *   - кэш `.sb/cache/classification.json` — производные данные (ADR-002): источник
 *     истины всегда заметки, кэш пересоздаётся полностью и служит наблюдаемости
 *     и будущему ускорению (как кэш реестра).
 */

import type { VaultAdapter } from '../adapter/vault-adapter';
import { nowStamp } from './datetime';
import { parseFileName } from './identity';
import { parseNote } from './markdown-parser';
import type { SbNote } from './model';
import { linkIdList } from './registry';
import { SEED_ULIDS } from './seeds/seed-ulids';

/** Путь кэша снимка классификации (ADR-002: `.sb/` — технические данные). */
export const CLASSIFICATION_CACHE_PATH = '.sb/cache/classification.json';

/** Закрытый набор режимов иерархии (`05-enumerations` §3.5). */
export const HIERARCHY_MODES = ['strict', 'polyhierarchical'] as const;
export type HierarchyMode = (typeof HIERARCHY_MODES)[number];

/** Значения по умолчанию (`01-classification` §2.2, таблица умолчаний). */
export const DEFAULT_HIERARCHY_MODE: HierarchyMode = 'strict';
export const DEFAULT_ASSIGNMENT_CARDINALITY = '0..N';
export const DEFAULT_ROOT_REQUIREMENT_MIN = 0;
export const DEFAULT_ROOT_REQUIREMENT_MAX: number | null = null;

/**
 * Системные фасеты базовой библиотеки: рецепт фиксированного ULID (B1-4 = А) и
 * названия, по которым фасет узнаётся в пользовательском хранилище (та же
 * конвенция, что в установщике: пропуск по title/label — DL-277).
 */
const SYSTEM_FACETS: Record<string, { recipe: string; names: string[] }> = {
	genre: { recipe: 'system-facet/genre', names: ['genre', 'жанр'] },
	literary_form: { recipe: 'system-facet/literary_form', names: ['literary form', 'литературная форма'] },
};

export type SystemFacetKey = keyof typeof SYSTEM_FACETS;

// ---------------------------------------------------------------------------
// Структуры снимка
// ---------------------------------------------------------------------------

export interface TaxonomyInfo {
	id: string;
	path: string;
	title: string;
	label: string | null;
	/** Фасеты, объявленные в поле `facets` (ULID). */
	facetIds: string[];
	allowedObjectTypeIds: string[];
	/** Значения как записаны (null — не заданы: действуют умолчания). */
	hierarchyMode: string | null;
	assignmentCardinality: string | null;
	rootRequirementMin: number | null;
	rootRequirementMax: number | null;
}

export interface FacetInfo {
	id: string;
	path: string;
	title: string;
	label: string | null;
	/** 0..1 по норме; список — как записано (две таксономии ловит схема/проверка). */
	taxonomyIds: string[];
	allowedObjectTypeIds: string[];
	hierarchyMode: string | null;
	assignmentCardinality: string | null;
	rootRequirementMin: number | null;
	rootRequirementMax: number | null;
}

export interface CategoryInfo {
	id: string;
	path: string;
	title: string;
	label: string | null;
	/** Ровно один по норме; 0 или >1 — нарушения `category.facet.required/single`. */
	facetIds: string[];
	/** Непосредственные родители (предки вычисляются). */
	parentIds: string[];
	/** П8 (ADR-007): у категории не должно быть ссылок на таксономию. */
	taxonomyIds: string[];
}

export interface ClassificationIssue {
	code: 'frontmatter_broken' | 'missing_id';
	path: string;
	message: string;
}

/** Сериализуемая часть снимка (кэш `.sb/cache/classification.json`). */
export interface ClassificationData {
	format: 1;
	builtAt: string;
	taxonomies: TaxonomyInfo[];
	facets: FacetInfo[];
	categories: CategoryInfo[];
	issues: ClassificationIssue[];
}

/** Снимок с индексами (в кэш не пишется — индексы строятся заново). */
export interface ClassificationSnapshot extends ClassificationData {
	taxonomyById: Map<string, TaxonomyInfo>;
	facetById: Map<string, FacetInfo>;
	categoryById: Map<string, CategoryInfo>;
	/** Категории фасета (в порядке обхода хранилища). */
	categoriesByFacet: Map<string, CategoryInfo[]>;
	/** Непосредственные дети категории. */
	childrenByParent: Map<string, CategoryInfo[]>;
}

/** Действующие настройки фасета после наследования (фасет → таксономия → умолчания). */
export interface EffectiveFacetSettings {
	hierarchyMode: HierarchyMode;
	assignmentCardinality: string;
	rootRequirementMin: number;
	rootRequirementMax: number | null;
	/** Пусто = ограничений по типам нет. */
	allowedObjectTypeIds: string[];
}

// ---------------------------------------------------------------------------
// Разбор значений
// ---------------------------------------------------------------------------

function asString(value: unknown): string | null {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return null;
	}
	return value;
}

/** ULID категории из значения системного поля `categories` (wikilink или голый ULID). */
function categoryIdOf(entry: unknown): string | null {
	if (typeof entry !== 'string') {
		return null;
	}
	const wiki = /\[\[([^\]|#^]+)/.exec(entry);
	const target = (wiki ? wiki[1] : entry).trim();
	if (target === '') {
		return null;
	}
	const fileName = target.slice(target.lastIndexOf('/') + 1);
	const identity = parseFileName(fileName.endsWith('.md') ? fileName : `${fileName}.md`);
	if (identity !== null) {
		return identity.ulid;
	}
	return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(target) ? target : null;
}

/**
 * ULID категорий, назначенных объекту (системный атрибут `categories`,
 * `04-attributes` §2). Принимаются канонические wikilink-и [[CATEGORY-{ULID}.md|…]]
 * и голые ULID; прочее (произвольные имена заметок) не разрешается — разрешение
 * неканонических ссылок по псевдонимам/именам — B2 (alias-index), как и в schema-engine.
 */
export function assignedCategoryIds(note: Pick<SbNote, 'system'>): string[] {
	const ids: string[] = [];
	for (const entry of note.system.categories ?? []) {
		const id = categoryIdOf(entry);
		if (id !== null) {
			ids.push(id);
		}
	}
	return ids;
}

// ---------------------------------------------------------------------------
// Построение снимка
// ---------------------------------------------------------------------------

/** Заметки-определения классификации: подпапки Metamodel/ или каноническое имя файла. */
export function isClassificationPath(path: string): boolean {
	return (
		path.startsWith('Metamodel/Taxonomies/') ||
		path.startsWith('Metamodel/Facets/') ||
		path.startsWith('Metamodel/Categories/') ||
		/(^|\/)(TAXONOMY|FACET|CATEGORY)-[0-9A-HJKMNP-TV-Z]{26}\.md$/.test(path)
	);
}

function ingestTaxonomy(note: SbNote, data: ClassificationData): void {
	const id = asString(note.system.id);
	if (id === null) {
		data.issues.push({ code: 'missing_id', path: note.path, message: 'Таксономия не применена: нет id' });
		return;
	}
	data.taxonomies.push({
		id,
		path: note.path,
		title: asString(note.system.title) ?? id,
		label: asString(note.properties.label),
		facetIds: linkIdList(note.properties.facets),
		allowedObjectTypeIds: linkIdList(note.properties.allowed_object_types),
		hierarchyMode: asString(note.properties.hierarchy_mode),
		assignmentCardinality: asString(note.properties.assignment_cardinality),
		rootRequirementMin: asNumber(note.properties.root_requirement_min),
		rootRequirementMax: note.properties.root_requirement_max === null ? null : asNumber(note.properties.root_requirement_max),
	});
}

function ingestFacet(note: SbNote, data: ClassificationData): void {
	const id = asString(note.system.id);
	if (id === null) {
		data.issues.push({ code: 'missing_id', path: note.path, message: 'Фасет не применён: нет id' });
		return;
	}
	data.facets.push({
		id,
		path: note.path,
		title: asString(note.system.title) ?? id,
		label: asString(note.properties.label),
		taxonomyIds: linkIdList(note.properties.taxonomy),
		allowedObjectTypeIds: linkIdList(note.properties.allowed_object_types),
		hierarchyMode: asString(note.properties.hierarchy_mode),
		assignmentCardinality: asString(note.properties.assignment_cardinality),
		rootRequirementMin: asNumber(note.properties.root_requirement_min),
		rootRequirementMax: note.properties.root_requirement_max === null ? null : asNumber(note.properties.root_requirement_max),
	});
}

function ingestCategory(note: SbNote, data: ClassificationData): void {
	const id = asString(note.system.id);
	if (id === null) {
		data.issues.push({ code: 'missing_id', path: note.path, message: 'Категория не применена: нет id' });
		return;
	}
	data.categories.push({
		id,
		path: note.path,
		title: asString(note.system.title) ?? id,
		label: asString(note.properties.label),
		facetIds: linkIdList(note.properties.facet),
		parentIds: linkIdList(note.properties.parent),
		taxonomyIds: linkIdList(note.properties.taxonomy),
	});
}

/** Разбирает одну заметку определения классификации (используется и в тестах). */
export function ingestClassificationNote(note: SbNote, data: ClassificationData): void {
	if (note.frontmatterBroken) {
		data.issues.push({
			code: 'frontmatter_broken',
			path: note.path,
			message: 'Определение классификации не применено: frontmatter не разбирается (ADR-002)',
		});
		return;
	}
	switch (note.system.type) {
		case 'taxonomy':
			ingestTaxonomy(note, data);
			return;
		case 'facet':
			ingestFacet(note, data);
			return;
		case 'category':
			ingestCategory(note, data);
			return;
		default:
			return; // прочие виды определений индексирует type-registry
	}
}

function emptyData(builtAt: string): ClassificationData {
	return { format: 1, builtAt, taxonomies: [], facets: [], categories: [], issues: [] };
}

/** Строит снимок с индексами из сериализуемых данных. */
export function indexClassification(data: ClassificationData): ClassificationSnapshot {
	const snapshot: ClassificationSnapshot = {
		...data,
		taxonomyById: new Map(),
		facetById: new Map(),
		categoryById: new Map(),
		categoriesByFacet: new Map(),
		childrenByParent: new Map(),
	};
	for (const taxonomy of snapshot.taxonomies) {
		if (!snapshot.taxonomyById.has(taxonomy.id)) {
			snapshot.taxonomyById.set(taxonomy.id, taxonomy);
		}
	}
	for (const facet of snapshot.facets) {
		if (!snapshot.facetById.has(facet.id)) {
			snapshot.facetById.set(facet.id, facet);
		}
	}
	for (const category of snapshot.categories) {
		if (!snapshot.categoryById.has(category.id)) {
			snapshot.categoryById.set(category.id, category);
		}
		const facetId = category.facetIds[0] ?? null;
		if (facetId !== null) {
			const list = snapshot.categoriesByFacet.get(facetId) ?? [];
			list.push(category);
			snapshot.categoriesByFacet.set(facetId, list);
		}
		for (const parentId of category.parentIds) {
			const list = snapshot.childrenByParent.get(parentId) ?? [];
			list.push(category);
			snapshot.childrenByParent.set(parentId, list);
		}
	}
	return snapshot;
}

/** Строит снимок из уже разобранных заметок (тесты, повторное использование). */
export function buildClassificationFromNotes(notes: SbNote[], builtAt = nowStamp()): ClassificationSnapshot {
	const data = emptyData(builtAt);
	for (const note of notes) {
		ingestClassificationNote(note, data);
	}
	return indexClassification(data);
}

/**
 * Читает определения классификации из хранилища и строит снимок.
 * Область — заметки классификации (см. `isClassificationPath`): полный обход
 * хранилища не нужен, поэтому снимок дёшев и пригоден для однократного построения
 * на прогон проверок (урок DL-255/259 — никаких повторных сканов в цикле).
 */
export async function loadClassification(adapter: VaultAdapter, builtAt = nowStamp()): Promise<ClassificationSnapshot> {
	const data = emptyData(builtAt);
	// ВАЖНО (фикс 0.11.1, урок DL-255/259/281): читаются ТОЛЬКО заметки классификации —
	// три подпапки Metamodel/ и канонические имена TAXONOMY-/FACET-/CATEGORY- где угодно
	// (та же область, что у scanExistingFacets в seed-library). Прежний фильтр
	// `path.startsWith('Metamodel/')` тянул ВСЕ определения метамодели (~146 заметок в
	// хранилище с базовой библиотекой) на каждый вызов — в цикле проверок это сотни
	// повторных чтений и таймауты на медленных дисках (Windows + антивирус).
	const paths = (await adapter.listMarkdown()).filter(isClassificationPath);
	for (const path of paths) {
		try {
			const content = await adapter.read(path);
			ingestClassificationNote(parseNote({ path, content }, adapter), data);
		} catch {
			// файл не читается — проверка заметки пожалуется отдельно (object.frontmatter.broken)
		}
	}
	return indexClassification(data);
}

// ---------------------------------------------------------------------------
// Запросы к снимку
// ---------------------------------------------------------------------------

/** Отображаемое имя определения классификации (ADR-003: label, резерв — title). */
export function classificationName(item: { label: string | null; title: string }): string {
	return item.label !== null && item.label !== '' ? item.label : item.title;
}

/** Таксономии фасета (пусто — независимый фасет, ADR-007). */
export function taxonomiesOfFacet(snapshot: ClassificationSnapshot, facet: FacetInfo): TaxonomyInfo[] {
	return facet.taxonomyIds.map((id) => snapshot.taxonomyById.get(id)).filter((t): t is TaxonomyInfo => t !== undefined);
}

/**
 * Действующие настройки фасета: значение фасета → значение таксономии →
 * умолчание таблицы `01-classification` §2.2 (наследование — норма ADR-005/007).
 */
export function effectiveSettings(snapshot: ClassificationSnapshot, facet: FacetInfo): EffectiveFacetSettings {
	const taxonomies = taxonomiesOfFacet(snapshot, facet);
	const fromTaxonomy = <T>(pick: (t: TaxonomyInfo) => T | null): T | null => {
		for (const taxonomy of taxonomies) {
			const value = pick(taxonomy);
			if (value !== null && value !== undefined) {
				return value;
			}
		}
		return null;
	};
	const mode = facet.hierarchyMode ?? fromTaxonomy((t) => t.hierarchyMode);
	const cardinality = facet.assignmentCardinality ?? fromTaxonomy((t) => t.assignmentCardinality);
	const min = facet.rootRequirementMin ?? fromTaxonomy((t) => t.rootRequirementMin);
	const max = facet.rootRequirementMax ?? fromTaxonomy((t) => t.rootRequirementMax);
	const allowed = facet.allowedObjectTypeIds.length > 0 ? facet.allowedObjectTypeIds : (fromTaxonomy((t) => (t.allowedObjectTypeIds.length > 0 ? t.allowedObjectTypeIds : null)) ?? []);
	return {
		hierarchyMode: mode === 'polyhierarchical' ? 'polyhierarchical' : DEFAULT_HIERARCHY_MODE,
		assignmentCardinality: cardinality ?? DEFAULT_ASSIGNMENT_CARDINALITY,
		rootRequirementMin: min ?? DEFAULT_ROOT_REQUIREMENT_MIN,
		rootRequirementMax: max ?? DEFAULT_ROOT_REQUIREMENT_MAX,
		allowedObjectTypeIds: allowed,
	};
}

/**
 * Предки категории (транзитивное замыкание по `parent`), без самой категории.
 * Цикл обрывается безопасно: `category.parent.no_cycle` сообщает о нём отдельно,
 * запрос не зацикливается (защита — множество посещённых).
 */
export function ancestorsOfCategory(snapshot: ClassificationSnapshot, categoryId: string): string[] {
	const seen = new Set<string>([categoryId]);
	const out: string[] = [];
	const queue = [...(snapshot.categoryById.get(categoryId)?.parentIds ?? [])];
	while (queue.length > 0) {
		const id = queue.shift() as string;
		if (seen.has(id)) {
			continue;
		}
		seen.add(id);
		out.push(id);
		const parent = snapshot.categoryById.get(id);
		if (parent !== undefined) {
			queue.push(...parent.parentIds);
		}
	}
	return out;
}

/** Назначенные категории + их предки (для `in_category`: назначен потомок — условие по предку истинно). */
export function expandWithAncestors(snapshot: ClassificationSnapshot, categoryIds: string[]): string[] {
	const out = new Set<string>(categoryIds);
	for (const id of categoryIds) {
		for (const ancestor of ancestorsOfCategory(snapshot, id)) {
			out.add(ancestor);
		}
	}
	return [...out];
}

/** Корневые категории фасета (`parent: []` или висячие родители — корень по данным). */
export function rootCategoriesOfFacet(snapshot: ClassificationSnapshot, facetId: string): CategoryInfo[] {
	return (snapshot.categoriesByFacet.get(facetId) ?? []).filter((category) => category.parentIds.length === 0);
}

/** Категории фасета (все, включая потомков). */
export function categoriesOfFacet(snapshot: ClassificationSnapshot, facetId: string): CategoryInfo[] {
	return snapshot.categoriesByFacet.get(facetId) ?? [];
}

/**
 * Системный фасет базовой библиотеки: сначала по фиксированному ULID рецепта
 * (B1-4 = А), затем по названию/подписи — пользовательский фасет «Жанр», созданный
 * командами до установки библиотеки, узнаётся так же, как в установщике (DL-277).
 */
export function findSystemFacet(snapshot: ClassificationSnapshot, key: SystemFacetKey): FacetInfo | null {
	const spec = SYSTEM_FACETS[key];
	const seeded = SEED_ULIDS[spec.recipe];
	const byUlid = seeded === undefined ? undefined : snapshot.facetById.get(seeded);
	if (byUlid !== undefined) {
		return byUlid;
	}
	for (const facet of snapshot.facets) {
		const names = [facet.title, facet.label].filter((n): n is string => typeof n === 'string').map((n) => n.trim().toLowerCase());
		if (spec.names.some((name) => names.includes(name))) {
			return facet;
		}
	}
	return null;
}

/** Назначения объекта, сгруппированные по фасетам (только известные категории). */
export function assignmentsByFacet(snapshot: ClassificationSnapshot, note: Pick<SbNote, 'system'>): Map<string, string[]> {
	const out = new Map<string, string[]>();
	for (const id of assignedCategoryIds(note)) {
		const category = snapshot.categoryById.get(id);
		const facetId = category?.facetIds[0];
		if (facetId === undefined) {
			continue; // неизвестная категория — сообщает value.reference.exists
		}
		const list = out.get(facetId) ?? [];
		list.push(id);
		out.set(facetId, list);
	}
	return out;
}

// ---------------------------------------------------------------------------
// Кэш (ADR-002: производные данные; источник истины — заметки)
// ---------------------------------------------------------------------------

/** Пишет снимок в `.sb/cache/classification.json` (наблюдаемость и задел ускорения). */
export async function saveClassificationCache(adapter: VaultAdapter, snapshot: ClassificationSnapshot): Promise<void> {
	const data: ClassificationData = {
		format: 1,
		builtAt: snapshot.builtAt,
		taxonomies: snapshot.taxonomies,
		facets: snapshot.facets,
		categories: snapshot.categories,
		issues: snapshot.issues,
	};
	await adapter.dataWrite(CLASSIFICATION_CACHE_PATH, `${JSON.stringify(data, null, 2)}\n`);
}

/** Читает кэш снимка (повреждённый или чужого формата — игнорируется: перестроится из заметок). */
export async function loadClassificationCache(adapter: VaultAdapter): Promise<ClassificationData | null> {
	if (!(await adapter.dataExists(CLASSIFICATION_CACHE_PATH))) {
		return null;
	}
	try {
		const parsed = JSON.parse(await adapter.dataRead(CLASSIFICATION_CACHE_PATH)) as ClassificationData;
		return parsed.format === 1 && Array.isArray(parsed.facets) && Array.isArray(parsed.categories) ? parsed : null;
	} catch {
		return null;
	}
}
