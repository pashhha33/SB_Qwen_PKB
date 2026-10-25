/**
 * Юнит-тесты движка условных свойств applies-when (B1.1 часть 2, DL-266).
 * Нормы: 04-attributes §11 (операции, М1–М7); правила М3/М4/М5 — группа B
 * (проверяются schema-engine-definitions.test.ts), здесь — ВЫЧИСЛЕНИЕ условия.
 */

import { describe, expect, it } from 'vitest';
import { assignedCategoryIds, isPropertyVisible, triggerValues } from '../../src/core/applies-when';
import type { SbNote } from '../../src/core/model';
import type { PropertyDef } from '../../src/core/registry';

function makeNote(properties: Record<string, unknown>, categories: string[] = []): SbNote {
	return {
		path: 'Books/BOOK-01J8Z6M4K2Q7V9X3N5B0C1D2B1.md',
		fileName: 'BOOK-01J8Z6M4K2Q7V9X3N5B0C1D2B1.md',
		fileNameIdentity: null,
		frontmatterPresent: true,
		system: { id: '01J8Z6M4K2Q7V9X3N5B0C1D2B1', type: 'book', categories },
		properties,
		body: '',
		wikilinks: [],
		issues: [],
		frontmatterBroken: false,
	};
}

function makeDef(appliesWhen: PropertyDef['appliesWhen']): PropertyDef {
	return {
		id: '01J8Z6M4K2Q7V9X3N5B0C1D2P9',
		key: 'file_size',
		label: 'Размер файла',
		valueType: 'number',
		cardinality: '0..1',
		required: false,
		scope: 'specific',
		path: 'Metamodel/Properties/PROPERTY-01J8Z6M4K2Q7V9X3N5B0C1D2P9.md',
		title: 'file_size',
		lifecycle: null,
		objectTypes: [],
		allowedValues: [],
		targetTypeIds: [],
		targetTypeKeys: [],
		targetFacetId: null,
		mediaTarget: null,
		createFromLink: null,
		appliesWhen,
		service: false,
	};
}

describe('applies-when — вычисление условия (04-attributes §11)', () => {
	it('свойство без applies_when видимо всегда', () => {
		expect(isPropertyVisible(makeDef(null), makeNote({}))).toBe(true);
	});

	it('equals: одиночный триггер совпал / не совпал', () => {
		const def = makeDef({ property: 'format', operation: 'equals', value: ['file'] });
		expect(isPropertyVisible(def, makeNote({ format: 'file' }))).toBe(true);
		expect(isPropertyVisible(def, makeNote({ format: 'web_novel' }))).toBe(false);
	});

	it('equals: триггер 0..N — хотя бы один элемент равен (§11.1)', () => {
		const def = makeDef({ property: 'format', operation: 'equals', value: ['file'] });
		expect(isPropertyVisible(def, makeNote({ format: ['web_novel', 'file'] }))).toBe(true);
		expect(isPropertyVisible(def, makeNote({ format: ['web_novel', 'audio'] }))).toBe(false);
	});

	it('М7: несколько групп значений в списке value (equals и includes_any)', () => {
		const equals = makeDef({ property: 'role', operation: 'equals', value: ['athlete', 'scientist'] });
		expect(isPropertyVisible(equals, makeNote({ role: 'scientist' }))).toBe(true);
		const includes = makeDef({ property: 'role', operation: 'includes_any', value: ['athlete', 'scientist'] });
		expect(isPropertyVisible(includes, makeNote({ role: ['writer', 'athlete'] }))).toBe(true);
		expect(isPropertyVisible(includes, makeNote({ role: ['writer', 'artist'] }))).toBe(false);
	});

	it('includes_any: пересечение со списком-триггером (person.role — мультивыбор)', () => {
		const def = makeDef({ property: 'role', operation: 'includes_any', value: ['athlete'] });
		expect(isPropertyVisible(def, makeNote({ role: 'athlete' }))).toBe(true); // одиночное значение — тоже работает
		expect(isPropertyVisible(def, makeNote({}))).toBe(false);
	});

	it('in_category: категория назначена (канонический wikilink, голый ULID)', () => {
		const categoryId = '01J8Z6M4K2Q7V9X3N5B0C1D2CT';
		const def = makeDef({ property: 'categories', operation: 'in_category', value: [categoryId] });
		expect(isPropertyVisible(def, makeNote({}, [`[[CATEGORY-${categoryId}.md|Фантастика]]`]))).toBe(true);
		expect(isPropertyVisible(def, makeNote({}, [categoryId]))).toBe(true);
		expect(isPropertyVisible(def, makeNote({}, [`[[CATEGORY-01J8Z6M4K2Q7V9X3N5B0C1D2CX.md|Другая]]`]))).toBe(false);
		expect(isPropertyVisible(def, makeNote({}))).toBe(false);
	});

	it('триггер отсутствует или пуст — условие не выполнено (свойство скрыто)', () => {
		const def = makeDef({ property: 'format', operation: 'equals', value: ['file'] });
		expect(isPropertyVisible(def, makeNote({}))).toBe(false);
		expect(isPropertyVisible(def, makeNote({ format: null }))).toBe(false);
		expect(isPropertyVisible(def, makeNote({ format: [] }))).toBe(false);
	});

	it('безопасные отказы: пустое value условия и операция вне набора — свойство скрыто (М4)', () => {
		expect(isPropertyVisible(makeDef({ property: 'format', operation: 'equals', value: [] }), makeNote({ format: 'file' }))).toBe(false);
		expect(isPropertyVisible(makeDef({ property: 'format', operation: 'equals_all', value: ['file'] }), makeNote({ format: 'file' }))).toBe(false);
	});

	it('нестроковые значения триггера не матчатся (без падений)', () => {
		const def = makeDef({ property: 'rating', operation: 'equals', value: ['7'] });
		expect(isPropertyVisible(def, makeNote({ rating: 7 }))).toBe(false); // число ≠ строка перечисления
	});

	it('triggerValues: нормализация одиночного значения и списка', () => {
		expect(triggerValues(makeNote({ format: 'file' }), 'format')).toEqual(['file']);
		expect(triggerValues(makeNote({ role: ['a', 'b'] }), 'role')).toEqual(['a', 'b']);
		expect(triggerValues(makeNote({ role: [1, 'b', null] }), 'role')).toEqual(['b']);
		expect(triggerValues(makeNote({}), 'role')).toEqual([]);
	});

	it('assignedCategoryIds: мусор в categories игнорируется', () => {
		const note = makeNote({}, ['[[CATEGORY-01J8Z6M4K2Q7V9X3N5B0C1D2CT.md|Жанр]]', 'произвольная строка', '']);
		expect(assignedCategoryIds(note)).toEqual(['01J8Z6M4K2Q7V9X3N5B0C1D2CT']);
	});
});
