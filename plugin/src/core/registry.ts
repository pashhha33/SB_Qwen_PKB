/**
 * Реестр типов (модуль type-registry, этап A2) — память плагина о метамодели.
 *
 * Что делает: читает Markdown-определения из папки Metamodel/ (ADR-002, DL-029),
 * разбирает их универсальным парсером и строит индексы:
 *   - определения типов (заметки type: object_type) → TypeDef по type_key / id / prefix;
 *   - определения свойств (заметки type: property) → PropertyDef по key;
 *   - цепочки наследования (ancestorsOf) через parent_type;
 *   - проблемы определений (RegistryIssue) — некорректное определение НЕ применяется
 *     целиком, но и не мешает остальным (ADR-002: «плагин работает с последней
 *     корректной версией и показывает ошибку»).
 *
 * Кэш: сериализованный снимок пишется в .sb/cache/registry.json (модуль-владелец —
 * type-registry; мера М5 09-modules: кэш НЕ источник истины, перестраивается из заметок).
 *
 * Значения SYSTEM_TYPE_PREFIXES взяты из реестра 02-entities §6 (их же hardcoded-ом
 * содержат схемы ссылок link_object_type/link_property и примеры шага 9). Префиксы
 * с '_' легальны по схеме defs#type_prefix (F5-7 = А, DL-253) — таблица согласована
 * со схемой; при будущем переименовании префикса правится только она (плюс схемы).
 */

import type { VaultAdapter } from '../adapter/vault-adapter';
import { SbError } from './errors';
import { parseFileName } from './identity';
import { parseNote } from './markdown-parser';
import type { SbNote } from './model';
import { isValidUlid } from './ulid';

/** Корневая папка определений метамодели (DL-029, подтверждён DL-243). */
export const METAMODEL_FOLDER = 'Metamodel';

/** Подпапки определений по видам (DL-029). */
export const METAMODEL_SUBFOLDERS = {
	objectTypes: `${METAMODEL_FOLDER}/ObjectTypes`,
	properties: `${METAMODEL_FOLDER}/Properties`,
	propertyTypes: `${METAMODEL_FOLDER}/PropertyTypes`,
	relationTypes: `${METAMODEL_FOLDER}/RelationTypes`,
	relations: `${METAMODEL_FOLDER}/Relations`,
	taxonomies: `${METAMODEL_FOLDER}/Taxonomies`,
	facets: `${METAMODEL_FOLDER}/Facets`,
	categories: `${METAMODEL_FOLDER}/Categories`,
	views: `${METAMODEL_FOLDER}/Views`,
	automations: `${METAMODEL_FOLDER}/Automations`,
} as const;

/**
 * Префиксы 7 системных типов (реестр 02-entities §6). Изолированная таблица —
 * единственная точка правки в коде плагина при изменении системных префиксов.
 */
export const SYSTEM_TYPE_PREFIXES: Record<string, string> = {
	object_type: 'OBJECT_TYPE',
	property: 'PROPERTY',
	relation_type: 'RELATION_TYPE',
	relation: 'RELATION',
	taxonomy: 'TAXONOMY',
	facet: 'FACET',
	category: 'CATEGORY',
};

/** Ключи системных атрибутов закрытого набора (для справок; источник — model.ts). */
export interface TypeDef {
	id: string;
	typeKey: string;
	label: string;
	typePrefix: string;
	abstract: boolean;
	lifecycle: string;
	/** ULID определения родительского типа (из wikilink-а parent_type) или null. */
	parentId: string | null;
	/** ULID замещающего типа (superseded_by, для lifecycle: deprecated) или null. */
	supersededById: string | null;
	description: string | null;
	/** Путь к файлу определения. */
	path: string;
	/** Заголовок заметки-определения. */
	title: string;
}

export interface PropertyDef {
	id: string;
	key: string;
	label: string;
	valueType: string;
	cardinality: string;
	required: boolean;
	scope: string;
	path: string;
	title: string;
	lifecycle: string | null;
	/**
	 * Привязка свойства к типам (F5-8 = А, DL-250/252): ULID определений object_type
	 * из поля `object_types` (wikilink-и). Семантика: пусто при scope=universal —
	 * свойство для всех типов; ссылка на абстрактного предка при scope=family —
	 * покрытие всех потомков (DL-208); конкретные типы при scope=specific.
	 */
	objectTypes: string[];
	/** Допустимые значения перечисления (`allowed_values`, 05-enumerations; пусто = не перечисление). */
	allowedValues: string[];
	/** Цели `target_types`: ULID определений (как в заметке). */
	targetTypeIds: string[];
	/** Цели `target_types`: ключи типов, разрешённые по ULID в reindex (висячие не входят). */
	targetTypeKeys: string[];
	/** ULID фасета из `target_facet` (для свойств-классификаторов) или null. */
	targetFacetId: string | null;
	/** `media_target` у media_reference ('object' | 'file' | 'both') или null. */
	mediaTarget: string | null;
	/** `create_from_link` ('ask' | 'forbid' | 'auto') или null (раздел 12). */
	createFromLink: string | null;
	/** Условие показа `applies_when` (М1–М7, 04-attributes §11) или null. */
	appliesWhen: { property: string; operation: string; value: string[] } | null;
	/**
	 * Служебное свойство (`service: true`, 08-views §7, DL-168): значение ведёт
	 * плагин, в формы не предлагается. В MVP одно — `sb_issues` (сеется бутстрапом).
	 */
	service: boolean;
}

export type RegistryIssueCode =
	| 'frontmatter_broken'
	| 'missing_required_field'
	| 'dangling_parent'
	| 'dangling_superseded_by'
	| 'id_conflict';

export interface RegistryIssue {
	code: RegistryIssueCode;
	path: string;
	message: string;
}

/** Формат кэша .sb/cache/registry.json. */
export interface RegistrySnapshot {
	format: 1;
	builtAt: string;
	types: TypeDef[];
	properties: PropertyDef[];
	issues: RegistryIssue[];
}

export const REGISTRY_CACHE_PATH = '.sb/cache/registry.json';

/** Извлекает ULID цели из wikilink-а (каноническое имя {TYPE_PREFIX}-{ULID}.md). */
function extractLinkId(value: unknown): string | null {
	const text = typeof value === 'string' ? value : Array.isArray(value) && typeof value[0] === 'string' ? value[0] : null;
	if (text === null) {
		return null;
	}
	const match = /\[\[([^\]|#^]+)/.exec(text);
	if (!match) {
		return null;
	}
	const identity = parseFileName(match[1]);
	return identity ? identity.ulid : null;
}

function asString(value: unknown): string | null {
	return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** Список строк из YAML-значения (строка → [строка]; не-строки отбрасываются). */
function asStringList(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
	}
	const single = asString(value);
	return single === null ? [] : [single];
}

/** Список ULID-целей из поля-ссылки или списка ссылок (wikilink-и). */
export function linkIdList(value: unknown): string[] {
	if (Array.isArray(value)) {
		const ids: string[] = [];
		for (const item of value) {
			const linkId = extractLinkId(item);
			if (linkId !== null) {
				ids.push(linkId);
			}
		}
		return ids;
	}
	const linkId = extractLinkId(value);
	return linkId === null ? [] : [linkId];
}

/** Условие `applies_when` (04-attributes §11): property + operation + value (строка или список). */
function parseAppliesWhen(value: unknown): { property: string; operation: string; value: string[] } | null {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return null;
	}
	const record = value as Record<string, unknown>;
	const property = asString(record.property);
	const operation = asString(record.operation);
	if (property === null || operation === null) {
		return null;
	}
	return { property, operation, value: asStringList(record.value) };
}

export class TypeRegistry {
	readonly types: TypeDef[] = [];
	readonly properties: PropertyDef[] = [];
	readonly issues: RegistryIssue[] = [];

	private readonly byKey = new Map<string, TypeDef>();
	private readonly byId = new Map<string, TypeDef>();
	private readonly byPrefix = new Map<string, TypeDef>();
	private readonly propertiesByKey = new Map<string, PropertyDef[]>();
	private readonly typesById = new Map<string, TypeDef>();

	private constructor() {}

	/** Читает определения из Metamodel/ и строит индексы. */
	static async load(adapter: VaultAdapter): Promise<TypeRegistry> {
		const registry = new TypeRegistry();
		const paths = (await adapter.listMarkdown()).filter((path) =>
			path.startsWith(`${METAMODEL_FOLDER}/`),
		);
		for (const path of paths) {
			const content = await adapter.read(path);
			const note = parseNote({ path, content }, adapter);
			registry.ingest(note);
		}
		registry.reindex();
		return registry;
	}

	/** Разбирает одну заметку-определение (используется и в тестах, и при точечном обновлении). */
	ingest(note: SbNote): void {
		if (note.frontmatterBroken) {
			this.issues.push({
				code: 'frontmatter_broken',
				path: note.path,
				message: 'Определение не применено: frontmatter не разбирается (ADR-002 — работаем с последней корректной версией)',
			});
			return;
		}
		if (note.system.type === 'object_type') {
			this.ingestType(note);
		} else if (note.system.type === 'property') {
			this.ingestProperty(note);
		}
		// Определения других системных видов (taxonomy, facet, category, relation_type)
		// индексируются своими сервисами на этапах B/C — реестр типов их не теряет,
		// но и не разбирает (единый парсер уже прочитал их — ошибок нет).
	}

	private ingestType(note: SbNote): void {
		const id = note.system.id ?? null;
		const typeKey = asString(note.properties.type_key);
		const label = asString(note.properties.label);
		const typePrefix = asString(note.properties.type_prefix);
		const missing: string[] = [];
		if (!id || !isValidUlid(id)) missing.push('id');
		if (!typeKey) missing.push('type_key');
		if (!label) missing.push('label');
		if (!typePrefix) missing.push('type_prefix');
		if (typeof note.properties.abstract !== 'boolean') missing.push('abstract');
		if (missing.length > 0) {
			this.issues.push({
				code: 'missing_required_field',
				path: note.path,
				message: `Определение типа не применено: нет обязательных полей (${missing.join(', ')})`,
			});
			return;
		}
		const parentId = extractLinkId(note.properties.parent_type);
		const supersededById = extractLinkId(note.properties.superseded_by);
		this.types.push({
			id: id as string,
			typeKey: typeKey as string,
			label: label as string,
			typePrefix: typePrefix as string,
			abstract: note.properties.abstract as boolean,
			lifecycle: asString(note.properties.lifecycle) ?? 'standard',
			parentId,
			supersededById,
			description: asString(note.properties.description),
			path: note.path,
			title: note.system.title ?? (typeKey as string),
		});
	}

	private ingestProperty(note: SbNote): void {
		const id = note.system.id ?? null;
		const key = asString(note.properties.key);
		const label = asString(note.properties.label);
		const valueType = asString(note.properties.value_type);
		const cardinality = asString(note.properties.cardinality);
		const scope = asString(note.properties.scope);
		const missing: string[] = [];
		if (!id || !isValidUlid(id)) missing.push('id');
		if (!key) missing.push('key');
		if (!label) missing.push('label');
		if (!valueType) missing.push('value_type');
		if (!cardinality) missing.push('cardinality');
		if (typeof note.properties.required !== 'boolean') missing.push('required');
		if (!scope) missing.push('scope');
		if (missing.length > 0) {
			this.issues.push({
				code: 'missing_required_field',
				path: note.path,
				message: `Определение свойства не применено: нет обязательных полей (${missing.join(', ')})`,
			});
			return;
		}
		// object_types: список wikilink-ов на OBJECT_TYPE-определения (F5-8 = А).
		const objectTypesRaw = note.properties.object_types;
		const objectTypes: string[] = [];
		if (Array.isArray(objectTypesRaw)) {
			for (const item of objectTypesRaw) {
				const linkId = extractLinkId(item);
				if (linkId !== null) {
					objectTypes.push(linkId);
				}
			}
		} else if (typeof objectTypesRaw === 'string') {
			const linkId = extractLinkId(objectTypesRaw);
			if (linkId !== null) {
				objectTypes.push(linkId);
			}
		}
		this.properties.push({
			id: id as string,
			key: key as string,
			label: label as string,
			valueType: valueType as string,
			cardinality: cardinality as string,
			required: note.properties.required as boolean,
			scope: scope as string,
			path: note.path,
			title: note.system.title ?? (key as string),
			lifecycle: asString(note.properties.lifecycle),
			objectTypes,
			allowedValues: asStringList(note.properties.allowed_values),
			targetTypeIds: linkIdList(note.properties.target_types),
			targetTypeKeys: [], // разрешаются в reindex (после построения индекса типов)
			targetFacetId: extractLinkId(note.properties.target_facet),
			mediaTarget: asString(note.properties.media_target),
			createFromLink: asString(note.properties.create_from_link),
			appliesWhen: parseAppliesWhen(note.properties.applies_when),
			service: note.properties.service === true,
		});
	}

	private reindex(): void {
		this.byKey.clear();
		this.byId.clear();
		this.byPrefix.clear();
		this.typesById.clear();
		this.propertiesByKey.clear();
		for (const def of this.types) {
			if (this.byKey.has(def.typeKey)) {
				this.issues.push({
					code: 'id_conflict',
					path: def.path,
					message: `type_key «${def.typeKey}» объявлен повторно — применено первое определение (${this.byKey.get(def.typeKey)?.path})`,
				});
				continue;
			}
			this.byKey.set(def.typeKey, def);
			this.byId.set(def.id, def);
			this.typesById.set(def.id, def);
			if (this.byPrefix.has(def.typePrefix)) {
				this.issues.push({
					code: 'id_conflict',
					path: def.path,
					message: `TYPE_PREFIX «${def.typePrefix}» занят типом «${this.byPrefix.get(def.typePrefix)?.typeKey}»`,
				});
			} else {
				this.byPrefix.set(def.typePrefix, def);
			}
		}
		for (const def of this.properties) {
			const list = this.propertiesByKey.get(def.key) ?? [];
			list.push(def);
			this.propertiesByKey.set(def.key, list);
		}
		// target_types: ULID определений → ключи типов (висячие цели не входят —
		// проверяются отдельно правилами группы B при валидации определений).
		for (const def of this.properties) {
			def.targetTypeKeys = def.targetTypeIds
				.map((id) => this.byId.get(id)?.typeKey)
				.filter((key): key is string => key !== undefined);
		}
		// Висячие ссылки родителей/замен — после индексации.
		for (const def of this.types) {
			if (def.parentId !== null && !this.typesById.has(def.parentId)) {
				this.issues.push({
					code: 'dangling_parent',
					path: def.path,
					message: `Родительский тип по id ${def.parentId} не найден среди определений`,
				});
			}
			if (def.supersededById !== null && !this.typesById.has(def.supersededById)) {
				this.issues.push({
					code: 'dangling_superseded_by',
					path: def.path,
					message: `Замещающий тип по id ${def.supersededById} не найден среди определений`,
				});
			}
		}
	}

	// ---- Доступ ----

	getType(typeKey: string): TypeDef | null {
		return this.byKey.get(typeKey) ?? null;
	}

	getTypeById(id: string): TypeDef | null {
		return this.typesById.get(id) ?? null;
	}

	getTypeByPrefix(prefix: string): TypeDef | null {
		return this.byPrefix.get(prefix) ?? null;
	}

	getPropertiesByKey(key: string): PropertyDef[] {
		return this.propertiesByKey.get(key) ?? [];
	}

	/** Цепочка предков от непосредственного родителя к корню (циклы обрываются). */
	ancestorsOf(typeKey: string): TypeDef[] {
		const chain: TypeDef[] = [];
		const visited = new Set<string>([typeKey]);
		let current = this.byKey.get(typeKey);
		while (current && current.parentId !== null) {
			const parent = this.typesById.get(current.parentId);
			if (!parent || visited.has(parent.typeKey)) {
				break; // висячий родитель или цикл (object_type.parent.no_cycle — этап B)
			}
			chain.push(parent);
			visited.add(parent.typeKey);
			current = parent;
		}
		return chain;
	}

	/** Все неабстрактные типы (для окна создания объекта), сортировка по подписи. */
	instantiableTypes(): TypeDef[] {
		return this.types.filter((def) => !def.abstract).sort((a, b) => a.label.localeCompare(b.label, 'ru'));
	}

	/**
	 * Свойства, применимые к типу (F5-8 = А, DL-252): universal без привязки —
	 * всем; остальные — если `object_types` пересекается с {сам тип + его предки}
	 * (ссылка на абстрактного предка покрывает потомков — DL-208).
	 * Основа будущего schema-engine (этап B) и форм.
	 */
	getPropertiesForType(typeKey: string): PropertyDef[] {
		const def = this.byKey.get(typeKey);
		if (!def) {
			return [];
		}
		const covered = new Set<string>([def.id]);
		for (const ancestor of this.ancestorsOf(typeKey)) {
			covered.add(ancestor.id);
		}
		return this.properties.filter(
			(prop) =>
				(prop.scope === 'universal' && prop.objectTypes.length === 0) ||
				prop.objectTypes.some((id) => covered.has(id)),
		);
	}

	// ---- Кэш (.sb/cache/registry.json; М5 — не источник истины) ----

	toSnapshot(builtAt: string): RegistrySnapshot {
		return { format: 1, builtAt, types: this.types, properties: this.properties, issues: this.issues };
	}

	async saveCache(adapter: VaultAdapter, builtAt: string): Promise<void> {
		const snapshot = this.toSnapshot(builtAt);
		await adapter.dataWrite(REGISTRY_CACHE_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
	}

	/** Читает кэш (для диагностики/будущего ускорения); источник истины — заметки. */
	static async loadCache(adapter: VaultAdapter): Promise<RegistrySnapshot | null> {
		if (!(await adapter.dataExists(REGISTRY_CACHE_PATH))) {
			return null;
		}
		try {
			const parsed = JSON.parse(await adapter.dataRead(REGISTRY_CACHE_PATH)) as RegistrySnapshot;
			return parsed.format === 1 ? parsed : null;
		} catch {
			return null; // повреждённый кэш игнорируется — перестроится из заметок (М5)
		}
	}
}

/** Ошибки создания определений/экземпляров — коды для creation.ts. */
export function registryMissingTypeError(typeKey: string): SbError {
	return new SbError('not_supported', `Тип «${typeKey}» не найден в реестре определений (Metamodel/)`);
}
