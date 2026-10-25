/**
 * Юнит-тесты object-service (B1.2 часть 1, DL-268): модель формы, проверка
 * уровня 1 (ADR-011), преобразование ввода, сериализация и видимость условных
 * полей (М1). Интеграция с FakeVault (запись, И4, updated_at) — form-flow.test.ts.
 */

import { describe, expect, it } from 'vitest';
import {
	coerceFormInput,
	computeVisibleKeys,
	initialEditRows,
	normalizeValues,
	serializeFieldValues,
	validateFieldValues,
	type FormField,
	type FormModel,
} from '../../src/core/object-service';
import type { PropertyDef } from '../../src/core/registry';

function makeDef(partial: Partial<PropertyDef> & { key: string }): PropertyDef {
	return {
		id: '01J8Z6M4K2Q7V9X3N5B0C1D2P1',
		label: partial.key,
		valueType: 'text',
		cardinality: '0..1',
		required: false,
		scope: 'specific',
		path: `Metamodel/Properties/PROPERTY-01J8Z6M4K2Q7V9X3N5B0C1D2P1.md`,
		title: partial.key,
		lifecycle: null,
		objectTypes: [],
		allowedValues: [],
		targetTypeIds: [],
		targetTypeKeys: [],
		targetFacetId: null,
		mediaTarget: null,
		createFromLink: null,
		appliesWhen: null,
		service: false,
		display: null,
		...partial,
	};
}

function makeField(def: PropertyDef, values: unknown[] = []): FormField {
	return { def, label: def.label, multiple: def.cardinality === '0..N' || def.cardinality === '1..N', values };
}

function makeModel(fields: FormField[]): FormModel {
	return {
		path: 'Books/BOOK-01J8Z6M4K2Q7V9X3N5B0C1D2B1.md',
		typeKey: 'book',
		typeLabel: 'Книга',
		title: 'Тест',
		fields,
		hasConditional: fields.some((f) => f.def.appliesWhen !== null),
	};
}

describe('object-service — normalizeValues', () => {
	it('undefined/null/[] → пусто; скаляр → список; список как есть', () => {
		expect(normalizeValues(undefined)).toEqual([]);
		expect(normalizeValues(null)).toEqual([]);
		expect(normalizeValues([])).toEqual([]);
		expect(normalizeValues('текст')).toEqual(['текст']);
		expect(normalizeValues(7)).toEqual([7]);
		expect(normalizeValues(['a', 'b'])).toEqual(['a', 'b']);
	});
});

describe('object-service — coerceFormInput (строка контрола → типизированное значение)', () => {
	it('number: число, дробь с запятой/точкой, пустая строка, мусор', () => {
		const def = makeDef({ key: 'rating', valueType: 'number' });
		expect(coerceFormInput(def, '7')).toEqual({ ok: true, value: 7 });
		expect(coerceFormInput(def, '7.5')).toEqual({ ok: true, value: 7.5 });
		expect(coerceFormInput(def, '7,5')).toEqual({ ok: true, value: 7.5 });
		expect(coerceFormInput(def, '  ')).toEqual({ ok: true, value: '' });
		expect(coerceFormInput(def, 'много').ok).toBe(false);
	});

	it('boolean: true/false/да/нет', () => {
		const def = makeDef({ key: 'fav', valueType: 'boolean' });
		expect(coerceFormInput(def, 'true')).toEqual({ ok: true, value: true });
		expect(coerceFormInput(def, 'да')).toEqual({ ok: true, value: true });
		expect(coerceFormInput(def, 'false')).toEqual({ ok: true, value: false });
		expect(coerceFormInput(def, 'может быть').ok).toBe(false);
	});

	it('text/date/reference — строка как есть (формат проверяет validateFieldValues)', () => {
		expect(coerceFormInput(makeDef({ key: 't', valueType: 'date' }), ' 2020-01-01 ')).toEqual({ ok: true, value: ' 2020-01-01 ' });
	});
});

describe('object-service — validateFieldValues (уровень 1, ADR-011)', () => {
	it('text с перечислением: in_set, format, кириллица', () => {
		const def = makeDef({ key: 'format', allowedValues: ['file', 'web_novel'] });
		expect(validateFieldValues(def, ['file'])).toBeNull();
		expect(validateFieldValues(def, ['audio'])).toMatch(/не входит в перечисление/);
		expect(validateFieldValues(def, ['File'])).toMatch(/строчная латиница/);
		expect(validateFieldValues(def, ['файл'])).toMatch(/кириллица/i);
	});

	it('number/boolean/date/datetime: типы и форматы', () => {
		expect(validateFieldValues(makeDef({ key: 'n', valueType: 'number' }), [7])).toBeNull();
		expect(validateFieldValues(makeDef({ key: 'n', valueType: 'number' }), ['7'])).toMatch(/число/);
		expect(validateFieldValues(makeDef({ key: 'b', valueType: 'boolean' }), [true])).toBeNull();
		expect(validateFieldValues(makeDef({ key: 'b', valueType: 'boolean' }), ['да'])).toMatch(/да.*нет|«да»/);
		expect(validateFieldValues(makeDef({ key: 'd', valueType: 'date' }), ['2020-02-30'])).toMatch(/Дата/);
		expect(validateFieldValues(makeDef({ key: 'd', valueType: 'date' }), ['1928-00-00'])).toBeNull(); // частичная — валидна
		expect(validateFieldValues(makeDef({ key: 'dt', valueType: 'datetime' }), ['2020-01-01T10:00'])).toBeNull();
		expect(validateFieldValues(makeDef({ key: 'dt', valueType: 'datetime' }), ['2020-01-01 10:00'])).toMatch(/Дата и время/);
	});

	it('ссылка: непустая строка (существование цели — уровень 3, не форма)', () => {
		const def = makeDef({ key: 'author', valueType: 'object_reference' });
		expect(validateFieldValues(def, ['[[PERSON-01J8Z6M4K2Q7V9X3N5B0C1D2PP.md|Автор]]'])).toBeNull();
		expect(validateFieldValues(def, ['  '])).toMatch(/ссылк/i);
	});

	it('кардинальность: одиночное поле не принимает два значения', () => {
		const def = makeDef({ key: 'x', cardinality: '0..1' });
		expect(validateFieldValues(def, ['a', 'b'])).toMatch(/одно значение/);
	});

	it('обязательность НЕ проверяется (DL-183: сохранить неполный объект можно)', () => {
		const def = makeDef({ key: 'x', cardinality: '1', required: true });
		expect(validateFieldValues(def, [])).toBeNull();
	});
});

describe('object-service — serializeFieldValues', () => {
	it('пусто → undefined (ключ удаляется); одиночное → скаляр; множественное → список', () => {
		expect(serializeFieldValues(makeDef({ key: 'x' }), [])).toBeUndefined();
		expect(serializeFieldValues(makeDef({ key: 'x' }), ['  '])).toBeUndefined();
		expect(serializeFieldValues(makeDef({ key: 'x' }), [' значение '])).toBe('значение');
		expect(serializeFieldValues(makeDef({ key: 'x', cardinality: '0..N' }), ['a', '', 'b'])).toEqual(['a', 'b']);
		expect(serializeFieldValues(makeDef({ key: 'n', valueType: 'number' }), [7])).toBe(7);
	});
});

describe('object-service — initialEditRows (фикс 0.8.1, DL-270: контрол одиночного поля рисуется всегда)', () => {
	it('одиночное поле без значения — РОВНО ОДНА пустая строка (иначе контрол не отрисуется)', () => {
		expect(initialEditRows([], false)).toEqual(['']);
	});

	it('одиночное поле со значением — одна строка со значением', () => {
		expect(initialEditRows(['web_novel'], false)).toEqual(['web_novel']);
		expect(initialEditRows([7], false)).toEqual(['7']);
		expect(initialEditRows([true], false)).toEqual(['true']);
		expect(initialEditRows([false], false)).toEqual(['false']);
	});

	it('множественное поле без значений — ноль строк (кнопка «+ добавить» в компоненте)', () => {
		expect(initialEditRows([], true)).toEqual([]);
	});

	it('множественное поле со значениями — строки по значениям', () => {
		expect(initialEditRows(['a', 'b'], true)).toEqual(['a', 'b']);
		expect(initialEditRows([true, 7], true)).toEqual(['true', '7']);
	});
});

describe('object-service — computeVisibleKeys (М1: живой пересчёт видимости)', () => {
	const formatDef = makeDef({ key: 'format', allowedValues: ['file', 'web_novel'] });
	const fileSizeDef = makeDef({
		key: 'file_size',
		valueType: 'number',
		appliesWhen: { property: 'format', operation: 'equals', value: ['file'] },
	});
	const platformDef = makeDef({
		key: 'platform',
		appliesWhen: { property: 'format', operation: 'equals', value: ['web_novel'] },
	});
	const model = makeModel([makeField(formatDef), makeField(fileSizeDef), makeField(platformDef)]);

	it('format: file → file_size видно, platform скрыто', () => {
		const visible = computeVisibleKeys(model, { format: ['file'], file_size: [], platform: [] }, []);
		expect(visible.has('format')).toBe(true);
		expect(visible.has('file_size')).toBe(true);
		expect(visible.has('platform')).toBe(false);
	});

	it('format: web_novel → platform видно, file_size скрыто', () => {
		const visible = computeVisibleKeys(model, { format: ['web_novel'], file_size: [], platform: [] }, []);
		expect(visible.has('platform')).toBe(true);
		expect(visible.has('file_size')).toBe(false);
	});

	it('format не задан → оба условных скрыты; безусловные видны всегда', () => {
		const visible = computeVisibleKeys(model, { format: [], file_size: [], platform: [] }, []);
		expect(visible.has('format')).toBe(true);
		expect(visible.has('file_size')).toBe(false);
		expect(visible.has('platform')).toBe(false);
	});

	it('in_category: видимость по назначенным категориям (ULID из wikilink-ов)', () => {
		const catDef = makeDef({
			key: 'theme',
			appliesWhen: { property: 'categories', operation: 'in_category', value: ['01J8Z6M4K2Q7V9X3N5B0C1D2CT'] },
		});
		const catModel = makeModel([makeField(catDef)]);
		expect(computeVisibleKeys(catModel, {}, ['[[CATEGORY-01J8Z6M4K2Q7V9X3N5B0C1D2CT.md|Тема]]']).has('theme')).toBe(true);
		expect(computeVisibleKeys(catModel, {}, []).has('theme')).toBe(false);
	});
});
