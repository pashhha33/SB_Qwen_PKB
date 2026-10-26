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
import type { LogFn } from './activity-log';
import { nowStamp } from './datetime';
import { SbError } from './errors';
import { parseFileName } from './identity';
import { parseNote } from './markdown-parser';
import type { SbNote } from './model';
import { linkIdList, type TypeRegistry } from './registry';
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
export function categoryIdOf(entry: unknown): string | null {
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

// ---------------------------------------------------------------------------
// Назначение категорий (команда assign-category, mvp-scope §2.3 — этап B)
// ---------------------------------------------------------------------------

/** Тип покрыт областью применения фасета (сам тип или его предок — DL-208/209). */
export function isTypeAllowedForFacet(registry: TypeRegistry, settings: EffectiveFacetSettings, typeKey: string): boolean {
	if (settings.allowedObjectTypeIds.length === 0) {
		return true; // пусто = ограничений нет
	}
	const self = registry.getType(typeKey);
	if (self === null) {
		return true; // тип не зарегистрирован — об этом сообщил object.type.exists
	}
	const ids = new Set<string>([self.id, ...registry.ancestorsOf(typeKey).map((t) => t.id)]);
	return settings.allowedObjectTypeIds.some((id) => ids.has(id));
}

/** Фасеты, применимые к типу объекта (для списка выбора в команде assign-category). */
export function facetsForType(snapshot: ClassificationSnapshot, registry: TypeRegistry, typeKey: string): FacetInfo[] {
	return snapshot.facets.filter((facet) => isTypeAllowedForFacet(registry, effectiveSettings(snapshot, facet), typeKey));
}

/**
 * ПРЕВЫШЕНИЕ кардинальности назначения (отказ уровня 1 — ADR-011): столько категорий
 * фасет хранить не может. Аналог проверки формы `validateFieldValues` («свойство
 * допускает одно значение»). null — превышения нет.
 */
export function cardinalityOverflow(cardinality: string, count: number): string | null {
	switch (cardinality) {
		case '1':
			return count > 1 ? `фасет допускает ровно одну категорию, выбрано ${count}` : null;
		case '0..1':
			return count > 1 ? `фасет рассчитан на одну категорию (0..1), выбрано ${count}` : null;
		default:
			return null; // 0..N и 1..N — верхняя граница не задана
	}
}

/**
 * НЕДОБОР относительно требуемого минимума (не отказ, а предупреждение): сохранить
 * неполное назначение разрешено — норма DL-183 («сначала объект, потом поля»;
 *сохранение неполного объекта разрешено, недостающее покажет validate-object), то же
 * поведение, что у формы свойств (обязательность на уровне 1 не проверяется).
 * Ошибку выдаст проверка уровня 4: `assignment.cardinality` / `facet.genre.required_for_book`.
 */
export function cardinalityShortfall(cardinality: string, count: number): string | null {
	switch (cardinality) {
		case '1':
			return count === 0 ? 'фасет требует ровно одну категорию, не выбрано ни одной — проверка объекта выдаст ошибку (assignment.cardinality)' : null;
		case '1..N':
			return count === 0 ? 'фасет требует минимум одну категорию, не выбрано ни одной — проверка объекта выдаст ошибку (assignment.cardinality)' : null;
		default:
			return null;
	}
}

/**
 * Нарушение кардинальности назначения при `count` выбранных категориях
 * (норма — `assignment.cardinality`, rules.md §E): превышение ИЛИ недобор.
 * Используется для ЖИВОЙ ПОДСКАЗКИ в окне назначения; отказом уровня 1 является
 * только превышение (`cardinalityOverflow`).
 */
export function cardinalityViolation(cardinality: string, count: number): string | null {
	return cardinalityOverflow(cardinality, count) ?? cardinalityShortfall(cardinality, count);
}

/** Категории фасета в порядке «сверху вниз» (корни, затем потомки) с глубиной. */
export function categoriesInHierarchy(snapshot: ClassificationSnapshot, facetId: string): { category: CategoryInfo; depth: number }[] {
	const all = categoriesOfFacet(snapshot, facetId);
	const byId = new Map(all.map((c) => [c.id, c]));
	const childrenOf = (id: string) => all.filter((c) => c.parentIds.includes(id));
	const roots = all.filter((c) => c.parentIds.length === 0 || !c.parentIds.some((p) => byId.has(p)));
	const out: { category: CategoryInfo; depth: number }[] = [];
	const seen = new Set<string>();
	const walk = (category: CategoryInfo, depth: number): void => {
		if (seen.has(category.id)) {
			return; // защита от цикла в данных (о нём сообщает category.parent.no_cycle)
		}
		seen.add(category.id);
		out.push({ category, depth });
		for (const child of childrenOf(category.id)) {
			walk(child, depth + 1);
		}
	};
	for (const root of roots) {
		walk(root, 0);
	}
	for (const category of all) {
		walk(category, 0); // хвост: категории, не попавшие в обход (цикл в родителях)
	}
	return out;
}

export interface AssignCategoriesInput {
	facetId: string;
	/** Итоговый набор категорий ЭТОГО фасета (пусто — снять назначения фасета). */
	categoryIds: string[];
}

export interface AssignCategoriesReport {
	path: string;
	facetId: string;
	facetName: string;
	added: string[];
	removed: string[];
	/**
	 * Предупреждение о недоборе категорий (не отказ — DL-183): назначение сохранено,
	 * но проверка объекта выдаст ошибку `assignment.cardinality`/`facet.genre.*`.
	 */
	warning: string | null;
	/** Записи других фасетов и нераспознанные записи — сохранены как были (DL-184). */
	kept: string[];
	/** Итоговое содержимое поля `categories` (канонические ссылки и сохранённые записи). */
	categories: string[];
}

/**
 * Назначает категории одного фасета объекту (системное поле `categories`,
 * `04-attributes` §2; назначение всегда прямое — `01-classification` §2.4).
 *
 * Проверки уровня 1 (ADR-011): некорректное назначение НЕ записывается —
 * отказ исключением `SbError` с внятным сообщением и записью в журнал (урок DL-264).
 * Проверяются: существование фасета, принадлежность категорий этому фасету,
 * область применения (`assignment.type_allowed`) и кардинальность
 * (`assignment.cardinality`) — те же правила, что выдаёт проверка уровня 4.
 *
 * Записи ДРУГИХ фасетов и нераспознанные записи сохраняются как были: команда
 * отвечает только за свой фасет (и не переписывает авторский отображаемый текст
 * ссылок — DL-184).
 */
export async function assignCategories(
	adapter: VaultAdapter,
	note: SbNote,
	typeKey: string | null,
	snapshot: ClassificationSnapshot,
	registry: TypeRegistry,
	input: AssignCategoriesInput,
	log?: LogFn,
): Promise<AssignCategoriesReport> {
	const facet = snapshot.facetById.get(input.facetId);
	if (facet === undefined) {
		throw new SbError('not_supported', 'Фасет не найден среди определений классификации — выберите другой');
	}
	const facetName = classificationName(facet);
	const settings = effectiveSettings(snapshot, facet);

	if (typeKey !== null && !isTypeAllowedForFacet(registry, settings, typeKey)) {
		const allowed = settings.allowedObjectTypeIds
			.map((id) => registry.getTypeById(id)?.label ?? id)
			.join(', ');
		throw new SbError(
			'not_supported',
			`Фасет «${facetName}» не применяется к типу «${typeKey}» (допустимые типы: ${allowed}) — assignment.type_allowed`,
		);
	}

	// дедупликация с сохранением порядка
	const selected: string[] = [];
	for (const id of input.categoryIds) {
		if (!selected.includes(id)) {
			selected.push(id);
		}
	}
	for (const id of selected) {
		const category = snapshot.categoryById.get(id);
		if (category === undefined) {
			throw new SbError('not_supported', `Категория ${id} не найдена среди определений классификации`);
		}
		if (category.facetIds[0] !== facet.id) {
			throw new SbError(
				'not_supported',
				`Категория «${classificationName(category)}» принадлежит другому фасету — назначение возможно только в фасет «${facetName}»`,
			);
		}
	}
	// Отказ уровня 1 (ADR-011) — только ПРЕВЫШЕНИЕ кардинальности: такие данные фасет
	// хранить не может. Недобор (0 категорий при 1..N) сохраняется: неполный объект
	// допустим (DL-183), ошибку покажет validate-object (`facet.genre.required_for_book`).
	const overflow = cardinalityOverflow(settings.assignmentCardinality, selected.length);
	if (overflow !== null) {
		throw new SbError(
			'not_supported',
			`Назначение не сохранено: ${overflow} (кардинальность фасета «${facetName}» — ${settings.assignmentCardinality}) — assignment.cardinality`,
		);
	}
	const warning = cardinalityShortfall(settings.assignmentCardinality, selected.length);

	// разбор существующих записей: свои (этого фасета) заменяем, чужие и нераспознанные — сохраняем
	const kept: string[] = [];
	const removed: string[] = [];
	for (const entry of note.system.categories ?? []) {
		const id = typeof entry === 'string' ? categoryIdOf(entry) : null;
		const category = id === null ? undefined : snapshot.categoryById.get(id);
		if (category !== undefined && category.facetIds[0] === facet.id) {
			if (!selected.includes(category.id)) {
				removed.push(category.id);
			}
			continue; // запись этого фасета — пересобирается ниже
		}
		if (typeof entry === 'string') {
			kept.push(entry);
		}
	}
	const added = selected.filter((id) => !removed.includes(id) && !(note.system.categories ?? []).some((e) => categoryIdOf(e) === id));
	const links = selected.map((id) => {
		const category = snapshot.categoryById.get(id) as CategoryInfo;
		return `[[CATEGORY-${category.id}.md|${category.title}]]`;
	});
	const categories = [...kept, ...links];

	await adapter.processFrontMatter(note.path, (frontmatter) => {
		if (categories.length === 0) {
			delete frontmatter.categories;
		} else {
			frontmatter.categories = categories;
		}
		// И5: назначение категорий — изменение данных пользователя
		frontmatter.updated_at = nowStamp();
	});

	log?.(
		warning === null ? 'info' : 'warning',
		'classification',
		`Назначены категории фасета «${facetName}»: добавлено ${added.length}, снято ${removed.length} (${note.path})${warning === null ? '' : `; ${warning}`}`,
		{ object_path: note.path, facet: facet.id, added, removed },
	);
	return { path: note.path, facetId: facet.id, facetName, added, removed, kept, categories, warning };
}
