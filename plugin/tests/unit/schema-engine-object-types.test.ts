/**
 * Тесты правил группы E для определений типов (object_type.*) и правила П2
 * (date.all_unknown.optional_only) — B1.1 часть 2 (DL-265/266).
 *
 * Группа E (rules.md): parent.exists (error, 3), parent.no_cycle (error, 3),
 * type_prefix.unique (error, 2), abstract.no_instance (error, 4 — правило
 * масштаба хранилища: работает при индексе с readTypes, т.е. в validate-vault;
 * одиночный validate-object без типов в индексе его пропускает — граница B1.1-7).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bootstrapMetamodel } from '../../src/core/bootstrap';
import { validateObject } from '../../src/core/validation';
import { LabelResolver } from '../../src/core/label-resolver';
import { METAMODEL_SUBFOLDERS, TypeRegistry } from '../../src/core/registry';
import { buildVaultIndex } from '../../src/core/schema-engine';
import { FakeVault } from '../support/fake-vault';

const UL = {
	work: '01J8Z6M4K2Q7V9X3N5B0C1D2W1',
	book: '01J8Z6M4K2Q7V9X3N5B0C1D2BK',
	novel: '01J8Z6M4K2Q7V9X3N5B0C1D2NV',
	orphan: '01J8Z6M4K2Q7V9X3N5B0C1D2OR',
	propPub: '01J8Z6M4K2Q7V9X3N5B0C1D2P1',
	propSince: '01J8Z6M4K2Q7V9X3N5B0C1D2P2',
};

function typeNote(ulid: string, typeKey: string, label: string, opts: { prefix?: string; abstract?: boolean; parentId?: string | null } = {}): string {
	const lines = [
		'---',
		`id: ${ulid}`,
		'type: object_type',
		`title: ${typeKey}`,
		'aliases:',
		`  - ${typeKey}`,
		'created_at: "2026-10-25T10:00"',
		'updated_at: "2026-10-25T10:00"',
		`type_key: ${typeKey}`,
		`label: ${label}`,
		`type_prefix: ${opts.prefix ?? typeKey.toUpperCase()}`,
		`abstract: ${opts.abstract ?? false}`,
		'lifecycle: standard',
		...(opts.parentId ? ['parent_type:', `  - "[[OBJECT_TYPE-${opts.parentId}.md|${label}]]"`] : []),
		'---',
		'',
	];
	return lines.join('\n');
}

describe('группа E — определения типов (object_type.*)', () => {
	let vault: FakeVault;

	async function validate(path: string, shared?: Awaited<ReturnType<typeof buildVaultIndex>> | null) {
		const registry = await TypeRegistry.load(vault);
		const labels = new LabelResolver(registry);
		return validateObject(vault, registry, labels, path, undefined, false, shared);
	}

	beforeEach(async () => {
		vault = await FakeVault.create();
		// Реалистичное хранилище: бутстрап сеет 7 системных типов и sb_issues.
		await bootstrapMetamodel(vault);
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	it('корректное дерево типов: чистые определения — 0 диагностик', async () => {
		await vault.put(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${UL.work}.md`, typeNote(UL.work, 'work', 'Произведение', { abstract: true }));
		await vault.put(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${UL.book}.md`, typeNote(UL.book, 'book', 'Книга', { parentId: UL.work }));
		for (const ulid of [UL.work, UL.book]) {
			const result = await validate(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${ulid}.md`);
			expect(result.diagnostics, `определение ${ulid}`).toEqual([]);
		}
	});

	it('object_type.parent.exists: висячая ссылка на родителя', async () => {
		await vault.put(
			`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${UL.orphan}.md`,
			[
				'---',
				`id: ${UL.orphan}`,
				'type: object_type',
				'title: orphan',
				'created_at: "2026-10-25T10:00"',
				'updated_at: "2026-10-25T10:00"',
				'type_key: orphan',
				'label: Сирота',
				'type_prefix: ORPHAN',
				'abstract: false',
				'lifecycle: standard',
				'parent_type:',
				'  - "[[OBJECT_TYPE-01J8Z6M4K2Q7V9X3N5B0C1D2ZZ.md|Нет такого]]"',
				'---',
				'',
			].join('\n'),
		);
		const result = await validate(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${UL.orphan}.md`);
		expect(result.diagnostics.map((d) => d.rule_id)).toContain('object_type.parent.exists');
	});

	it('object_type.parent.no_cycle: цикл из двух определений ловится на проверяемом', async () => {
		// Реестр такое дерево не применяет целиком (ancestorsOf обрывает циклы),
		// но оба определения остаются в types — правило должно сработать.
		await vault.put(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${UL.book}.md`, typeNote(UL.book, 'book', 'Книга', { parentId: UL.novel }));
		await vault.put(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${UL.novel}.md`, typeNote(UL.novel, 'novel', 'Роман', { parentId: UL.book }));
		const result = await validate(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${UL.book}.md`);
		expect(result.diagnostics.map((d) => d.rule_id)).toContain('object_type.parent.no_cycle');
	});

	it('object_type.type_prefix.unique: два типа с одним префиксом', async () => {
		await vault.put(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${UL.book}.md`, typeNote(UL.book, 'book', 'Книга', { prefix: 'WORK' }));
		await vault.put(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${UL.work}.md`, typeNote(UL.work, 'work', 'Произведение', { prefix: 'WORK' }));
		const result = await validate(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${UL.book}.md`);
		const dupes = result.diagnostics.filter((d) => d.rule_id === 'object_type.type_prefix.unique');
		expect(dupes).toHaveLength(1);
		expect(dupes[0].message).toContain('work');
	});

	it('object_type.abstract.no_instance: экземпляр абстрактного типа виден при индексе с типами', async () => {
		await vault.put(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${UL.work}.md`, typeNote(UL.work, 'work', 'Произведение', { abstract: true }));
		await vault.put(
			`Works/WORK-01J8Z6M4K2Q7V9X3N5B0C1D2I1.md`,
			[
				'---',
				'id: 01J8Z6M4K2Q7V9X3N5B0C1D2I1',
				'type: work',
				'title: Нечто',
				'aliases:',
				'  - Нечто',
				'created_at: "2026-10-25T10:00"',
				'updated_at: "2026-10-25T10:00"',
				'---',
				'',
			].join('\n'),
		);
		const path = `${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${UL.work}.md`;

		// Одиночный режим (индекс без типов) — правило пропускается (граница B1.1-7)...
		const single = await validate(path);
		expect(single.diagnostics.map((d) => d.rule_id)).not.toContain('object_type.abstract.no_instance');

		// ...а с общим индексом validate-vault (readTypes) — срабатывает.
		const index = await buildVaultIndex(vault, { readTypes: true });
		const full = await validate(path, index);
		const diags = full.diagnostics.filter((d) => d.rule_id === 'object_type.abstract.no_instance');
		expect(diags).toHaveLength(1);
		expect(diags[0].message).toContain('Works/WORK-01J8Z6M4K2Q7V9X3N5B0C1D2I1.md');
	});

	it('readTypes-индекс: noteTypes и sbObjectPaths заполняются, заметки без frontmatter не входят', async () => {
		await vault.put(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${UL.book}.md`, typeNote(UL.book, 'book', 'Книга'));
		await vault.put('Обычная.md', 'Заметка без frontmatter');
		const index = await buildVaultIndex(vault, { readTypes: true });
		expect(index.noteTypes?.get(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${UL.book}.md`)).toBe('object_type');
		expect(index.sbObjectPaths?.has('Обычная.md')).toBe(false);
		// 7 системных типов + sb_issues (бутстрап) + определение book.
		expect(index.sbObjectPaths?.size).toBe(9);
		// B1.2 часть 2 (DL-273): titleByPath — system.title, резерв имя файла без расширения.
		expect(index.titleByPath?.get(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${UL.book}.md`)).toBe('book');
		expect(index.titleByPath?.get('Обычная.md')).toBe('Обычная');
	});
});

describe('правило П2 — date.all_unknown.optional_only (06-time-and-intervals §2)', () => {
	let vault: FakeVault;

	const BOOK_PATH = 'Books/BOOK-01J8Z6M4K2Q7V9X3N5B0C1D2B1.md';

	function propNote(ulid: string, key: string, cardinality: string, required: boolean, extra: string[] = []): string {
		return [
			'---',
			`id: ${ulid}`,
			'type: property',
			`title: ${key}`,
			'created_at: "2026-10-25T10:00"',
			'updated_at: "2026-10-25T10:00"',
			`key: ${key}`,
			`label: ${key}`,
			'value_type: date',
			`cardinality: "${cardinality}"`,
			`required: ${required}`,
			'scope: specific',
			'object_types:',
			`  - "[[OBJECT_TYPE-${UL.book}.md|Книга]]"`,
			...extra,
			'---',
			'',
		].join('\n');
	}

	function bookNote(fields: string[]): string {
		return [
			'---',
			'id: 01J8Z6M4K2Q7V9X3N5B0C1D2B1',
			'type: book',
			'title: Книга',
			'aliases:',
			'  - Книга',
			'created_at: "2026-10-25T10:00"',
			'updated_at: "2026-10-25T10:00"',
			...fields,
			'---',
			'',
		].join('\n');
	}

	async function validate(path: string) {
		const registry = await TypeRegistry.load(vault);
		expect(registry.issues, 'определения без проблем').toEqual([]);
		const labels = new LabelResolver(registry);
		return validateObject(vault, registry, labels, path, undefined, false);
	}

	beforeEach(async () => {
		vault = await FakeVault.create();
		await bootstrapMetamodel(vault); // системные типы + sb_issues
		await vault.put(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${UL.book}.md`, typeNote(UL.book, 'book', 'Книга'));
		// Необязательная дата (pub_date) и обязательная (since).
		await vault.put(`${METAMODEL_SUBFOLDERS.properties}/PROPERTY-${UL.propPub}.md`, propNote(UL.propPub, 'pub_date', '0..1', false));
		await vault.put(`${METAMODEL_SUBFOLDERS.properties}/PROPERTY-${UL.propSince}.md`, propNote(UL.propSince, 'since', '1', true));
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	it('0000-00-00 в необязательном поле — допустимо молча (П2)', async () => {
		await vault.put(BOOK_PATH, bookNote(['since: "2020-01-01"', 'pub_date: "0000-00-00"']));
		const result = await validate(BOOK_PATH);
		expect(result.diagnostics).toEqual([]);
	});

	it('0000-00-00 в обязательном поле — warning date.all_unknown.optional_only', async () => {
		await vault.put(BOOK_PATH, bookNote(['since: "0000-00-00"']));
		const result = await validate(BOOK_PATH);
		const diags = result.diagnostics.filter((d) => d.rule_id === 'date.all_unknown.optional_only');
		expect(diags).toHaveLength(1);
		expect(diags[0].severity).toBe('warning');
	});

	it('частично известная дата в обязательном поле (1928-00-00) — без предупреждения П2', async () => {
		await vault.put(BOOK_PATH, bookNote(['since: "1928-00-00"']));
		const result = await validate(BOOK_PATH);
		expect(result.diagnostics.map((d) => d.rule_id)).not.toContain('date.all_unknown.optional_only');
	});

	it('М6: скрытое обязательное условное свойство с 0000-00-00 — П2 не срабатывает', async () => {
		// since становится условным (триггер format: web_novel); формат не задан → скрыто.
		await vault.put(
			`${METAMODEL_SUBFOLDERS.properties}/PROPERTY-${UL.propSince}.md`,
			propNote(UL.propSince, 'since', '1', true, ['applies_when:', '  property: format', '  operation: equals', '  value: web_novel']),
		);
		await vault.put(`${METAMODEL_SUBFOLDERS.properties}/PROPERTY-01J8Z6M4K2Q7V9X3N5B0C1D2PF.md`, propNote('01J8Z6M4K2Q7V9X3N5B0C1D2PF', 'format', '0..1', false).replace('value_type: date', 'value_type: text'));
		await vault.put(BOOK_PATH, bookNote(['since: "0000-00-00"']));
		const result = await validate(BOOK_PATH);
		expect(result.diagnostics.map((d) => d.rule_id)).not.toContain('date.all_unknown.optional_only');
		expect(result.diagnostics.map((d) => d.rule_id)).not.toContain('value.cardinality');
	});
});
