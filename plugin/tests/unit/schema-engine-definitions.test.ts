/**
 * Тесты группы B реестра правил — определения свойств (B1.1 часть 1, DL-263).
 * 16 правил: key.format, key.no_system_conflict, key.unique_in_type, label.required,
 * value_type.closed, required.cardinality_consistency, target_types.for_reference,
 * target_facet.is_facet, applies_when ×5, create_from_link.auto_needs_single_target,
 * object_types.scope_consistency, object_types.exists.
 *
 * Определения раскладываются в FakeVault, реестр их читает, затем каждая заметка
 * прогоняется через validatePropertyDefinition (так же её вызывает validateObject).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LabelResolver } from '../../src/core/label-resolver';
import { parseNote } from '../../src/core/markdown-parser';
import { METAMODEL_SUBFOLDERS, TypeRegistry } from '../../src/core/registry';
import { buildVaultIndex, validatePropertyDefinition } from '../../src/core/schema-engine';
import { FakeVault } from '../support/fake-vault';

// Фиксированные ULID фикстур (Crockford, валидны по И1).
const UL = {
	bookType: '01J8Z6M4K2Q7V9X3N5B0C1D2BK',
	workType: '01J8Z6M4K2Q7V9X3N5B0C1D2WA',
	personType: '01J8Z6M4K2Q7V9X3N5B0C1D2PE',
	genreFacet: '01J8Z6M4K2Q7V9X3N5B0C1D2FC',
	propA: '01J8Z6M4K2Q7V9X3N5B0C1D2PA',
	propB: '01J8Z6M4K2Q7V9X3N5B0C1D2PB',
	propC: '01J8Z6M4K2Q7V9X3N5B0C1D2PC',
	propD: '01J8Z6M4K2Q7V9X3N5B0C1D2PD',
	propE: '01J8Z6M4K2Q7V9X3N5B0C1D2PE',
	propF: '01J8Z6M4K2Q7V9X3N5B0C1D2PF',
	propG: '01J8Z6M4K2Q7V9X3N5B0C1D2PG',
	propH: '01J8Z6M4K2Q7V9X3N5B0C1D2PH',
};

function objectTypeNote(ulid: string, typeKey: string, label: string, opts: { abstract?: boolean; parentUlid?: string } = {}): string {
	const lines = [
		'---',
		`id: ${ulid}`,
		'type: object_type',
		`title: ${typeKey}`,
		'created_at: "2026-10-25T10:00"',
		'updated_at: "2026-10-25T10:00"',
		`type_key: ${typeKey}`,
		`label: ${label}`,
		`type_prefix: ${typeKey.toUpperCase()}`,
		`abstract: ${opts.abstract === true}`,
		'lifecycle: standard',
	];
	if (opts.parentUlid) {
		lines.push('parent_type:', `  - "[[OBJECT_TYPE-${opts.parentUlid}.md|Родитель]]"`);
	}
	lines.push('---', '');
	return lines.join('\n');
}

/** Заметка-определение свойства; overrides подмешиваются в frontmatter «как есть». */
function propertyNote(ulid: string, fields: Record<string, string>): string {
	const lines = ['---', `id: ${ulid}`, 'type: property', `title: ${fields.key ?? 'prop'}`, 'created_at: "2026-10-25T10:00"', 'updated_at: "2026-10-25T10:00"'];
	for (const [key, value] of Object.entries(fields)) {
		lines.push(`${key}: ${value}`);
	}
	lines.push('---', '');
	return lines.join('\n');
}

const BASE_FIELDS = {
	key: 'sample_key',
	label: 'Пример',
	value_type: 'text',
	cardinality: '"0..1"',
	required: 'false',
	scope: 'universal',
};

describe('schema-engine — группа B: определения свойств', () => {
	let vault: FakeVault;

	beforeEach(async () => {
		vault = await FakeVault.create();
		// Типы-фикстуры: work (абстрактный) → book; person.
		await vault.put(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${UL.workType}.md`, objectTypeNote(UL.workType, 'work', 'Произведение', { abstract: true }));
		await vault.put(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${UL.bookType}.md`, objectTypeNote(UL.bookType, 'book', 'Книга', { parentUlid: UL.workType }));
		await vault.put(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${UL.personType}.md`, objectTypeNote(UL.personType, 'person', 'Человек'));
		// Фасет-фикстура (для target_facet).
		await vault.put(
			`${METAMODEL_SUBFOLDERS.facets}/FACET-${UL.genreFacet}.md`,
			['---', `id: ${UL.genreFacet}`, 'type: facet', 'title: genre', 'created_at: "2026-10-25T10:00"', 'updated_at: "2026-10-25T10:00"', 'key: genre', 'label: Жанр', '---', ''].join('\n'),
		);
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	/** Кладёт определения свойств, перечитывает реестр, возвращает rule_id для указанной заметки. */
	async function ruleIdsFor(props: Record<string, string>[], targetIndex: number): Promise<string[]> {
		const paths: string[] = [];
		const ulids = [UL.propA, UL.propB, UL.propC, UL.propD, UL.propE, UL.propF, UL.propG, UL.propH];
		for (let i = 0; i < props.length; i++) {
			const path = `${METAMODEL_SUBFOLDERS.properties}/PROPERTY-${ulids[i]}.md`;
			paths.push(path);
			await vault.put(path, propertyNote(ulids[i], props[i]));
		}
		const registry = await TypeRegistry.load(vault);
		const labels = new LabelResolver(registry);
		const index = await buildVaultIndex(vault);
		const path = paths[targetIndex];
		const note = parseNote({ path, content: await vault.read(path) }, vault);
		return validatePropertyDefinition(note, { registry, labels, index }).map((d) => d.rule_id);
	}

	it('корректное определение — ни одного нарушения группы B', async () => {
		const ids = await ruleIdsFor([{ ...BASE_FIELDS }], 0);
		expect(ids).toEqual([]);
	});

	it('property.key.format: ключ вне ^[a-z][a-z0-9_]*$', async () => {
		const ids = await ruleIdsFor([{ ...BASE_FIELDS, key: 'НеверныйКлюч' }], 0);
		expect(ids).toContain('property.key.format');
	});

	it('property.key.no_system_conflict: системный атрибут не переопределяется (И6)', async () => {
		const ids = await ruleIdsFor([{ ...BASE_FIELDS, key: 'title' }], 0);
		expect(ids).toContain('property.key.no_system_conflict');
	});

	it('property.label.required: пустая подпись', async () => {
		const ids = await ruleIdsFor([{ ...BASE_FIELDS, label: '"   "' }], 0);
		expect(ids).toContain('property.label.required');
	});

	it('property.value_type.closed: восьмой тип значения отклоняется', async () => {
		const ids = await ruleIdsFor([{ ...BASE_FIELDS, value_type: 'list' }], 0);
		expect(ids).toContain('property.value_type.closed');
	});

	it('property.required.cardinality_consistency: противоречивые пары', async () => {
		// 1 ⇒ required true; 0..N ⇒ required false
		const a = await ruleIdsFor([{ ...BASE_FIELDS, cardinality: '"1"', required: 'false' }], 0);
		expect(a).toContain('property.required.cardinality_consistency');
		const b = await ruleIdsFor([{ ...BASE_FIELDS, cardinality: '"0..N"', required: 'true' }], 0);
		expect(b).toContain('property.required.cardinality_consistency');
		// согласованная пара — чисто
		const c = await ruleIdsFor([{ ...BASE_FIELDS, cardinality: '"1"', required: 'true' }], 0);
		expect(c).not.toContain('property.required.cardinality_consistency');
	});

	it('property.target_types.for_reference: у object_reference и media_reference цели обязательны', async () => {
		const a = await ruleIdsFor([{ ...BASE_FIELDS, value_type: 'object_reference' }], 0);
		expect(a).toContain('property.target_types.for_reference');
		const b = await ruleIdsFor([{ ...BASE_FIELDS, value_type: 'media_reference', media_target: 'object' }], 0);
		expect(b).toContain('property.target_types.for_reference');
		// с целями — чисто
		const c = await ruleIdsFor([
			{ ...BASE_FIELDS, value_type: 'object_reference', target_types: `\n  - "[[OBJECT_TYPE-${UL.personType}.md|Человек]]"` },
		], 0);
		expect(c).not.toContain('property.target_types.for_reference');
	});

	it('property.target_facet.is_facet: цель — не фасет или не найдена', async () => {
		// цель — OBJECT_TYPE, не FACET
		const a = await ruleIdsFor([{ ...BASE_FIELDS, target_facet: `"[[FACET-${UL.bookType}.md|Не фасет]]"` }], 0);
		expect(a).toContain('property.target_facet.is_facet');
		// корректный фасет — чисто
		const b = await ruleIdsFor([{ ...BASE_FIELDS, target_facet: `"[[FACET-${UL.genreFacet}.md|Жанр]]"` }], 0);
		expect(b).not.toContain('property.target_facet.is_facet');
	});

	it('property.key.unique_in_type: одинаковый ключ с пересекающимся покрытием', async () => {
		const ids = await ruleIdsFor(
			[
				{ ...BASE_FIELDS, key: 'author' }, // universal — все типы
				{ ...BASE_FIELDS, key: 'author', label: 'Автор (дубль)', scope: 'specific', object_types: `\n  - "[[OBJECT_TYPE-${UL.bookType}.md|Книга]]"` },
			],
			1,
		);
		expect(ids).toContain('property.key.unique_in_type');
	});

	it('property.key.unique_in_type: непересекающиеся покрытия — конфликта нет', async () => {
		const ids = await ruleIdsFor(
			[
				{ ...BASE_FIELDS, key: 'name', scope: 'specific', object_types: `\n  - "[[OBJECT_TYPE-${UL.bookType}.md|Книга]]"` },
				{ ...BASE_FIELDS, key: 'name', label: 'Имя (у человека)', scope: 'specific', object_types: `\n  - "[[OBJECT_TYPE-${UL.personType}.md|Человек]]"` },
			],
			1,
		);
		expect(ids).not.toContain('property.key.unique_in_type');
	});

	it('applies_when: value_present, operation_closed', async () => {
		const noValue = await ruleIdsFor([{ ...BASE_FIELDS, applies_when: '\n  property: format\n  operation: equals' }], 0);
		expect(noValue).toContain('property.applies_when.value_present');
		const badOp = await ruleIdsFor([{ ...BASE_FIELDS, applies_when: '\n  property: format\n  operation: matches\n  value: file' }], 0);
		expect(badOp).toContain('property.applies_when.operation_closed');
	});

	it('applies_when: property_exists (триггер не объявлен) и корректный случай', async () => {
		const missing = await ruleIdsFor([{ ...BASE_FIELDS, applies_when: '\n  property: format\n  operation: equals\n  value: file' }], 0);
		expect(missing).toContain('property.applies_when.property_exists');

		const ok = await ruleIdsFor(
			[
				{ ...BASE_FIELDS, key: 'format', label: 'Формат' },
				{ ...BASE_FIELDS, key: 'file_size', label: 'Размер файла', applies_when: '\n  property: format\n  operation: equals\n  value: file' },
			],
			1,
		);
		expect(ok).not.toContain('property.applies_when.property_exists');
		expect(ok).not.toContain('property.applies_when.no_chain');
	});

	it('applies_when: no_chain — условный триггер запрещён (М3)', async () => {
		const ids = await ruleIdsFor(
			[
				{ ...BASE_FIELDS, key: 'format', label: 'Формат', applies_when: '\n  property: edition\n  operation: equals\n  value: special' },
				{ ...BASE_FIELDS, key: 'file_size', label: 'Размер', applies_when: '\n  property: format\n  operation: equals\n  value: file' },
			],
			1,
		);
		expect(ids).toContain('property.applies_when.no_chain');
	});

	it('applies_when: operation_matches_cardinality — includes_any при одиночном триггере (warning)', async () => {
		const ids = await ruleIdsFor(
			[
				{ ...BASE_FIELDS, key: 'role', label: 'Роль', cardinality: '"0..1"' },
				{ ...BASE_FIELDS, key: 'role_details', label: 'Детали роли', applies_when: '\n  property: role\n  operation: includes_any\n  value:\n    - writer' },
			],
			1,
		);
		expect(ids).toContain('property.applies_when.operation_matches_cardinality');
		// множественный триггер — чисто
		const ok = await ruleIdsFor(
			[
				{ ...BASE_FIELDS, key: 'role', label: 'Роль', cardinality: '"0..N"' },
				{ ...BASE_FIELDS, key: 'role_details', label: 'Детали роли', applies_when: '\n  property: role\n  operation: includes_any\n  value:\n    - writer' },
			],
			1,
		);
		expect(ok).not.toContain('property.applies_when.operation_matches_cardinality');
	});

	it('create_from_link.auto_needs_single_target: auto при двух целях', async () => {
		const ids = await ruleIdsFor([
			{
				...BASE_FIELDS,
				value_type: 'object_reference',
				create_from_link: 'auto',
				target_types: `\n  - "[[OBJECT_TYPE-${UL.personType}.md|Человек]]"\n  - "[[OBJECT_TYPE-${UL.bookType}.md|Книга]]"`,
			},
		], 0);
		expect(ids).toContain('property.create_from_link.auto_needs_single_target');
	});

	it('object_types.scope_consistency: universal со ссылками, family с двумя, family на неабстрактный, specific на абстрактный', async () => {
		const universal = await ruleIdsFor([{ ...BASE_FIELDS, object_types: `\n  - "[[OBJECT_TYPE-${UL.bookType}.md|Книга]]"` }], 0);
		expect(universal).toContain('property.object_types.scope_consistency');

		const familyTwo = await ruleIdsFor([
			{ ...BASE_FIELDS, scope: 'family', object_types: `\n  - "[[OBJECT_TYPE-${UL.workType}.md|Произведение]]"\n  - "[[OBJECT_TYPE-${UL.bookType}.md|Книга]]"` },
		], 0);
		expect(familyTwo).toContain('property.object_types.scope_consistency');

		const familyConcrete = await ruleIdsFor([{ ...BASE_FIELDS, scope: 'family', object_types: `\n  - "[[OBJECT_TYPE-${UL.bookType}.md|Книга]]"` }], 0);
		expect(familyConcrete).toContain('property.object_types.scope_consistency');

		const familyAbstract = await ruleIdsFor([{ ...BASE_FIELDS, scope: 'family', object_types: `\n  - "[[OBJECT_TYPE-${UL.workType}.md|Произведение]]"` }], 0);
		expect(familyAbstract).not.toContain('property.object_types.scope_consistency');

		const specificAbstract = await ruleIdsFor([{ ...BASE_FIELDS, scope: 'specific', object_types: `\n  - "[[OBJECT_TYPE-${UL.workType}.md|Произведение]]"` }], 0);
		expect(specificAbstract).toContain('property.object_types.scope_consistency');

		const specificEmpty = await ruleIdsFor([{ ...BASE_FIELDS, scope: 'specific' }], 0);
		expect(specificEmpty).toContain('property.object_types.scope_consistency');
	});

	it('object_types.exists: висячая ссылка на определение типа', async () => {
		const ids = await ruleIdsFor([{ ...BASE_FIELDS, scope: 'specific', object_types: '\n  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2ZZ.md|Нет такого]]"' }], 0);
		expect(ids).toContain('property.object_types.exists');
	});
});
