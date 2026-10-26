/**
 * Тест согласованности семенных определений с машиночитаемыми схемами (B1-4 = А,
 * DL-261/276): «сиды == schema/**». Машиночитаемая схема — эталон (принцип F5-7):
 * расхождение состава полей, перечислений или обязательности = красный тест.
 *
 * Границы части 1 (исключения задокументированы — architecture §5 B1.3-1…B1.3-3):
 *   - системные атрибуты И6 (id, type, title, aliases, created_at, updated_at,
 *     categories, tags) определениями свойств не объявляются;
 *   - relation — PROPERTY-сидов нет (этап C, JSONL);
 *   - book: publisher (organization — этап 2), related_to (C), cover_file (теневое, D);
 *   - person: related_to (C), portrait_file (теневое, D);
 *   - property: display, applies_when (составные структуры вне семи типов значений).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	FACET_SEED_SPECS,
	PERSON_ROLE_VALUES,
	PROPERTY_SEED_SPECS,
	TYPE_SEED_SPECS,
	type PropertySeedSpec,
} from '../../src/core/seeds/library-specs';
import { SEED_ULIDS } from '../../src/core/seeds/seed-ulids';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO_ROOT = path.resolve(PLUGIN_ROOT, '..');

const SYSTEM_KEYS = new Set(['id', 'type', 'title', 'aliases', 'created_at', 'updated_at', 'categories', 'tags']);

interface JsonSchema {
	properties?: Record<string, unknown>;
	required?: string[];
	$defs?: Record<string, JsonSchema>;
	[key: string]: unknown;
}

function loadSchema(relative: string): JsonSchema {
	return JSON.parse(readFileSync(path.join(REPO_ROOT, relative), 'utf8')) as JsonSchema;
}

const DEFS = loadSchema('schema/common/defs.json');

function resolveRef(ref: string, root: JsonSchema): JsonSchema | null {
	if (ref.startsWith('#/')) {
		const parts = ref.slice(2).split('/');
		let node: unknown = root;
		for (const part of parts) {
			if (node === null || typeof node !== 'object') return null;
			node = (node as Record<string, unknown>)[part];
		}
		return (node as JsonSchema) ?? null;
	}
	if (ref.startsWith('../common/defs.json#/')) {
		return resolveRef('#/' + ref.slice('../common/defs.json#/'.length), DEFS);
	}
	return null;
}

/** Собирает все enum-списки, достижимые из определения поля (oneOf/items/$ref). */
function collectEnums(node: JsonSchema | null, root: JsonSchema, depth = 0): string[][] {
	if (node === null || depth > 6) return [];
	const found: string[][] = [];
	if (Array.isArray(node.enum)) found.push(node.enum as string[]);
	for (const key of ['items', 'oneOf', 'anyOf'] as const) {
		const child = node[key];
		if (Array.isArray(child)) {
			for (const item of child as JsonSchema[]) found.push(...collectEnums(resolveRef(String(item.$ref ?? ''), root) ?? item, root, depth + 1));
		} else if (child !== undefined && typeof child === 'object') {
			found.push(...collectEnums(resolveRef(String((child as JsonSchema).$ref ?? ''), root) ?? (child as JsonSchema), root, depth + 1));
		}
	}
	if (typeof node.$ref === 'string') {
		found.push(...collectEnums(resolveRef(node.$ref, root), root, depth + 1));
	}
	return found;
}

/** Ключи свойств схемы без системных атрибутов. */
function schemaFieldKeys(schema: JsonSchema): Set<string> {
	return new Set(Object.keys(schema.properties ?? {}).filter((key) => !SYSTEM_KEYS.has(key)));
}

function seedsOf(owner: string): PropertySeedSpec[] {
	return PROPERTY_SEED_SPECS.filter((spec) => spec.owner === owner);
}

/** Проверяет один тип: состав полей, перечисления, обязательность. */
function expectConsistent(owner: string, schemaPath: string, exclusions: string[]): void {
	const schema = loadSchema(schemaPath);
	const schemaKeys = schemaFieldKeys(schema);
	for (const excluded of exclusions) schemaKeys.delete(excluded);
	const seeds = seedsOf(owner);
	const seedKeys = new Set(seeds.map((spec) => spec.key));
	expect(seedKeys.size, `дубли ключей у ${owner}`).toBe(seeds.length);
	expect([...seedKeys].sort(), `состав полей ${owner} (сиды == схема ${schemaPath} за вычетом границ)`).toEqual([...schemaKeys].sort());

	const required = new Set(schema.required ?? []);
	for (const spec of seeds) {
		const propSchema = (schema.properties ?? {})[spec.key] as JsonSchema | undefined;
		expect(propSchema, `${owner}.${spec.key} — поле есть в схеме`).toBeDefined();

		// обязательность: schema.required ⟺ cardinality 1/1..N
		const seedRequired = spec.cardinality === '1' || spec.cardinality === '1..N';
		expect(seedRequired, `${owner}.${spec.key} — required ⟺ cardinality`).toBe(required.has(spec.key));

		// перечисления: snake_case-enum схемы ОБЯЗАНЫ быть в allowed_values (контроль
		// экземпляров value.allowed_values); enum со значениями вне формата ^[a-z][a-z0-9_]*$
		// (cardinality, assignment_cardinality…) НЕ МОГУТ быть allowed_values — правило
		// enum.value.format (05-enumerations §5), их контролирует схема (граница B1.3-3).
		const enums = propSchema !== undefined ? collectEnums(propSchema, schema) : [];
		const snakePattern = /^[a-z][a-z0-9_]*$/;
		for (const list of enums) {
			const allSnake = list.every((v) => snakePattern.test(v));
			if (allSnake) {
				expect(spec.allowedValues, `${owner}.${spec.key} — snake-enum схемы объявлен в allowed_values`).toBeDefined();
				expect(spec.allowedValues!.length, `${owner}.${spec.key} — состав enum`).toBe(list.length);
				for (const value of list) {
					expect(spec.allowedValues!.includes(value), `${owner}.${spec.key} — «${value}» в allowed_values`).toBe(true);
				}
			} else {
				expect(spec.allowedValues, `${owner}.${spec.key} — не-snake enum (${list.join(',')}) не объявляется перечислением (enum.value.format)`).toBeUndefined();
			}
		}
		if (enums.length === 0 && spec.allowedValues !== undefined) {
			// allowed_values без enum схемы — только если enum недостижим (не встречается в сидах)
			expect.unreachable(`${owner}.${spec.key}: allowed_values без enum в схеме`);
		}


		// ссылки: target_types обязателен; object_reference — link_mode direct
		if (spec.valueType === 'object_reference' || spec.valueType === 'media_reference') {
			expect(spec.targetTypes?.length ?? 0, `${owner}.${spec.key} — target_types заполнен`).toBeGreaterThan(0);
			if (spec.valueType === 'object_reference') {
				expect(spec.linkMode, `${owner}.${spec.key} — link_mode у object_reference`).toBe('direct');
			}
		} else {
			expect(spec.targetTypes ?? [], `${owner}.${spec.key} — target_types только у ссылок`).toEqual([]);
			expect(spec.linkMode, `${owner}.${spec.key} — link_mode только у ссылок`).toBeUndefined();
		}
		if (spec.mediaTarget !== undefined) {
			expect(spec.valueType, `${owner}.${spec.key} — media_target только у media_reference`).toBe('media_reference');
		}
		if (spec.targetFacet !== undefined) {
			expect(FACET_SEED_SPECS.some((f) => f.facetKey === spec.targetFacet), `${owner}.${spec.key} — target_facet ссылается на семенной фасет`).toBe(true);
		}

		// applies_when: триггер объявлен у того же владельца; значения — из enum триггера
		if (spec.appliesWhen !== undefined) {
			const trigger = seeds.find((t) => t.key === spec.appliesWhen!.property);
			expect(trigger, `${owner}.${spec.key} — триггер ${spec.appliesWhen.property} объявлен`).toBeDefined();
			expect(trigger!.appliesWhen, `${owner}.${spec.key} — у триггера нет своего applies_when (М3)`).toBeUndefined();
			expect(['equals', 'includes_any', 'in_category']).toContain(spec.appliesWhen.operation);
			const triggerEnums = collectEnums((schema.properties ?? {})[trigger!.key] as JsonSchema, schema);
			if (triggerEnums.length > 0) {
				const allowed = new Set(triggerEnums.flat());
				for (const value of spec.appliesWhen.value) {
					expect(allowed.has(value), `${owner}.${spec.key} — значение условия «${value}» есть в enum триггера`).toBe(true);
				}
			}
		}

		// display — только у number
		if (spec.display !== undefined && spec.display.renderer !== 'plain') {
			expect(spec.valueType, `${owner}.${spec.key} — stars/progress только у number`).toBe('number');
		}
	}
}

describe('seed-consistency — системные типы (сиды == schema/metamodel/**)', () => {
	it('object_type: 8 полей', () => expectConsistent('object_type', 'schema/metamodel/object_type.schema.json', []));
	it('property: 24 поля (display/applies_when — граница B1.3-2)', () => expectConsistent('property', 'schema/metamodel/property.schema.json', ['display', 'applies_when']));
	it('relation_type: 13 полей', () => expectConsistent('relation_type', 'schema/metamodel/relation_type.schema.json', []));
	it('taxonomy: 8 полей (label — B1.3-6 = А)', () => expectConsistent('taxonomy', 'schema/metamodel/taxonomy.schema.json', []));
	it('facet: 8 полей (label — B1.3-6 = А)', () => expectConsistent('facet', 'schema/metamodel/facet.schema.json', []));
	it('category: 4 поля (label — B1.3-6 = А)', () => expectConsistent('category', 'schema/metamodel/category.schema.json', []));
	it('relation: PROPERTY-сидов нет (этап C — граница B1.3-1)', () => {
		expect(seedsOf('relation')).toEqual([]);
	});
});

describe('seed-consistency — book (сиды == schema/entities/book.schema.json)', () => {
	it('22 поля: 12 базовых + 10 условных (границы: publisher, related_to, cover_file)', () => {
		expectConsistent('book', 'schema/entities/book.schema.json', ['publisher', 'related_to', 'cover_file']);
		expect(seedsOf('book').length).toBe(22);
	});

	it('chapter_count не хранится (DL-118) — его нет ни в схеме, ни в сидах', () => {
		const schema = loadSchema('schema/entities/book.schema.json');
		expect(schemaFieldKeys(schema).has('chapter_count')).toBe(false);
		expect(seedsOf('book').some((s) => s.key === 'chapter_count')).toBe(false);
	});

	it('критерий B1: format — триггер; web_novel → 4 условных, file → 2, card → 2, audio → 2; print → 0 (DL-228)', () => {
		const conditional = seedsOf('book').filter((s) => s.appliesWhen !== undefined);
		expect(conditional.length).toBe(10);
		const byFormat = (format: string): string[] => conditional
			.filter((s) => s.appliesWhen!.property === 'format' && s.appliesWhen!.operation === 'equals' && s.appliesWhen!.value.includes(format))
			.map((s) => s.key)
			.sort();
		expect(byFormat('web_novel')).toEqual(['last_chapter_on', 'platform', 'publication_status', 'release_cadence']);
		expect(byFormat('file')).toEqual(['file_format', 'file_path']);
		expect(byFormat('card')).toEqual(['card_count', 'card_series']);
		expect(byFormat('audio')).toEqual(['audio_duration', 'narrator']);
		expect(byFormat('print')).toEqual([]);
	});

	it('обязательные: author (1..N), read_status, format; rating — звёзды 1–10; read_status — default planned', () => {
		const seeds = seedsOf('book');
		expect(seeds.find((s) => s.key === 'author')!.cardinality).toBe('1..N');
		expect(seeds.find((s) => s.key === 'read_status')!.cardinality).toBe('1');
		expect(seeds.find((s) => s.key === 'read_status')!.defaultValue).toBe('planned');
		expect(seeds.find((s) => s.key === 'format')!.cardinality).toBe('1');
		const rating = seeds.find((s) => s.key === 'rating')!;
		expect(rating.display).toEqual({ renderer: 'stars', scaleMax: 10 });
	});
});

describe('seed-consistency — person (сиды == schema/entities/person.schema.json)', () => {
	it('42 поля: 15 базовых + 27 условных (границы: related_to, portrait_file)', () => {
		expectConsistent('person', 'schema/entities/person.schema.json', ['related_to', 'portrait_file']);
		expect(seedsOf('person').length).toBe(42);
	});

	it('role — обязательный мультивыбор (1..N) из 40 значений person_role (DL-156/228)', () => {
		const role = seedsOf('person').find((s) => s.key === 'role')!;
		expect(role.cardinality).toBe('1..N');
		expect(role.allowedValues).toBeDefined();
		expect([...role.allowedValues!].sort()).toEqual([...PERSON_ROLE_VALUES].sort());
		expect(role.allowedValues!.length).toBe(40);
	});

	it('27 условных: триггер role, операция includes_any (М7/DL-139); значения — подмножество person_role', () => {
		const conditional = seedsOf('person').filter((s) => s.appliesWhen !== undefined);
		expect(conditional.length).toBe(27);
		const roles = new Set<string>(PERSON_ROLE_VALUES);
		for (const spec of conditional) {
			expect(spec.appliesWhen!.property).toBe('role');
			expect(spec.appliesWhen!.operation).toBe('includes_any');
			expect(spec.appliesWhen!.value.length).toBeGreaterThan(0);
			for (const value of spec.appliesWhen!.value) {
				expect(roles.has(value), `${spec.key}: «${value}» ∈ person_role`).toBe(true);
			}
			// ни одно условное свойство не обязательно (карточка person §4.2)
			expect(['0..1', '0..N'], `${spec.key} — необязательное`).toContain(spec.cardinality);
		}
	});

	it('словарные свойства: nationality/country_of_residence → Страна; languages_spoken/writing_languages → Язык; writing_genres → genre; sport → Спорт', () => {
		const byKey = new Map(seedsOf('person').map((s) => [s.key, s]));
		expect(byKey.get('nationality')!.targetFacet).toBe('country');
		expect(byKey.get('country_of_residence')!.targetFacet).toBe('country');
		expect(byKey.get('languages_spoken')!.targetFacet).toBe('language');
		expect(byKey.get('writing_languages')!.targetFacet).toBe('language');
		expect(byKey.get('writing_genres')!.targetFacet).toBe('genre');
		expect(byKey.get('sport')!.targetFacet).toBe('sport');
		for (const key of ['nationality', 'country_of_residence', 'languages_spoken', 'writing_languages', 'writing_genres', 'sport']) {
			expect(byKey.get(key)!.valueType).toBe('object_reference');
			expect(byKey.get(key)!.targetTypes).toEqual(['category']);
		}
	});
});

describe('seed-consistency — типы и фасеты', () => {
	it('4 OBJECT_TYPE-сида: book (BOOK, parent work), person (PERSON), work (WORK, abstract), media (MEDIA, структурная)', () => {
		const byKey = new Map(TYPE_SEED_SPECS.map((s) => [s.typeKey, s]));
		expect([...byKey.keys()].sort()).toEqual(['book', 'media', 'person', 'work']);
		expect(byKey.get('book')!.typePrefix).toBe('BOOK');
		expect(byKey.get('book')!.parentKey).toBe('work');
		expect(byKey.get('book')!.abstract).toBe(false);
		expect(byKey.get('person')!.typePrefix).toBe('PERSON');
		expect(byKey.get('person')!.parentKey).toBeNull();
		expect(byKey.get('work')!.abstract).toBe(true);
		expect(byKey.get('work')!.structural).toBe(true);
		expect(byKey.get('media')!.structural).toBe(true);
		for (const spec of TYPE_SEED_SPECS) {
			expect(SEED_ULIDS[spec.recipe]).toBeDefined();
		}
	});

	it('5 фасетов: genre (1..N, min 1, allowed book — DL-126), literary_form (0..N, allowed book), country/language/sport (без ограничений)', () => {
		const byKey = new Map(FACET_SEED_SPECS.map((s) => [s.facetKey, s]));
		expect([...byKey.keys()].sort()).toEqual(['country', 'genre', 'language', 'literary_form', 'sport']);
		const genre = byKey.get('genre')!;
		expect(genre.assignmentCardinality).toBe('1..N');
		expect(genre.rootRequirementMin).toBe(1);
		expect(genre.allowedObjectTypeKeys).toEqual(['book']);
		expect(byKey.get('literary_form')!.assignmentCardinality).toBe('0..N');
		for (const key of ['country', 'language', 'sport']) {
			expect(byKey.get(key)!.allowedObjectTypeKeys).toEqual([]);
		}
	});

	it('media_reference-свойства (cover, file_path, portrait) целятся в зарезервированный media', () => {
		const mediaRefs = PROPERTY_SEED_SPECS.filter((s) => s.valueType === 'media_reference');
		expect(mediaRefs.map((s) => s.key).sort()).toEqual(['cover', 'file_path', 'portrait']);
		for (const spec of mediaRefs) {
			expect(spec.targetTypes).toEqual(['media']);
			expect(spec.mediaTarget, spec.key).toBeDefined();
		}
		expect(mediaRefs.find((s) => s.key === 'file_path')!.mediaTarget).toBe('file');
	});
});
