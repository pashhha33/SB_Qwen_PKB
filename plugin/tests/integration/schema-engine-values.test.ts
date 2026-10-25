/**
 * Интеграционные тесты schema-engine на значениях экземпляров (B1.1 часть 1, DL-263):
 * группы C (type_conformance, cardinality, reference.exists/target_type),
 * G (enum.value.format / no_mixed_script / in_set), H (даты — через date-engine).
 *
 * Сценарий: в FakeVault строятся тип `book` + `person`, определения свойств книги
 * и экземпляры; validate-object прогоняется целиком (группа A + schema-engine).
 * Часть 2 (DL-266): условные свойства (applies_when) проверяются движком applies-when
 * (М1–М7): скрытое свойство не проверяется на обязательность (М6), сохранённые
 * значения скрытых свойств проверяются (М2). В фикстуру добавлено объявление
 * служебного свойства sb_issues (в реальном хранилище его сеет бутстрап).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateObject } from '../../src/core/validation';
import { LabelResolver } from '../../src/core/label-resolver';
import { METAMODEL_SUBFOLDERS, TypeRegistry } from '../../src/core/registry';
import { buildVaultIndex } from '../../src/core/schema-engine';
import { FakeVault } from '../support/fake-vault';

const UL = {
	bookType: '01J8Z6M4K2Q7V9X3N5B0C1D2BK',
	personType: '01J8Z6M4K2Q7V9X3N5B0C1D2PT',
	person: '01J8Z6M4K2Q7V9X3N5B0C1D2PP',
	bookOk: '01J8Z6M4K2Q7V9X3N5B0C1D2B1',
	bookBad: '01J8Z6M4K2Q7V9X3N5B0C1D2B2',
	propAuthor: '01J8Z6M4K2Q7V9X3N5B0C1D2P1',
	propStatus: '01J8Z6M4K2Q7V9X3N5B0C1D2P2',
	propRating: '01J8Z6M4K2Q7V9X3N5B0C1D2P3',
	propPubDate: '01J8Z6M4K2Q7V9X3N5B0C1D2P4',
	propPublishedAt: '01J8Z6M4K2Q7V9X3N5B0C1D2P5',
	propFavorite: '01J8Z6M4K2Q7V9X3N5B0C1D2P6',
	propSummary: '01J8Z6M4K2Q7V9X3N5B0C1D2P7',
	propFormat: '01J8Z6M4K2Q7V9X3N5B0C1D2P8',
	propFileSize: '01J8Z6M4K2Q7V9X3N5B0C1D2P9',
	propPlatform: '01J8Z6M4K2Q7V9X3N5B0C1D2PA',
	propSbIssues: '01J8Z6M4K2Q7V9X3N5B0C1D2SB',
};

const objectTypeNote = (ulid: string, typeKey: string, label: string): string =>
	[
		'---',
		`id: ${ulid}`,
		'type: object_type',
		`title: ${typeKey}`,
		'created_at: "2026-10-25T10:00"',
		'updated_at: "2026-10-25T10:00"',
		`type_key: ${typeKey}`,
		`label: ${label}`,
		`type_prefix: ${typeKey.toUpperCase()}`,
		'abstract: false',
		'lifecycle: standard',
		'---',
		'',
	].join('\n');

interface PropSpec {
	ulid: string;
	key: string;
	label: string;
	value_type: string;
	cardinality: string;
	required: boolean;
	extra?: string[];
}

function propertyDefinitionNote(spec: PropSpec): string {
	const lines = [
		'---',
		`id: ${spec.ulid}`,
		'type: property',
		`title: ${spec.key}`,
		'created_at: "2026-10-25T10:00"',
		'updated_at: "2026-10-25T10:00"',
		`key: ${spec.key}`,
		`label: ${spec.label}`,
		`value_type: ${spec.value_type}`,
		`cardinality: "${spec.cardinality}"`,
		`required: ${spec.required}`,
		'scope: specific',
		'object_types:',
		`  - "[[OBJECT_TYPE-${UL.bookType}.md|Книга]]"`,
		...(spec.extra ?? []),
		'---',
		'',
	];
	return lines.join('\n');
}

const PROPS: PropSpec[] = [
	{
		ulid: UL.propAuthor,
		key: 'author',
		label: 'Автор',
		value_type: 'object_reference',
		cardinality: '1',
		required: true,
		extra: ['target_types:', `  - "[[OBJECT_TYPE-${UL.personType}.md|Человек]]"`, 'link_mode: direct'],
	},
	{
		ulid: UL.propStatus,
		key: 'read_status',
		label: 'Статус чтения',
		value_type: 'text',
		cardinality: '1',
		required: true,
		extra: ['allowed_values:', '  - reading', '  - finished', '  - abandoned', '  - planned'],
	},
	{ ulid: UL.propRating, key: 'rating', label: 'Оценка', value_type: 'number', cardinality: '0..1', required: false },
	{ ulid: UL.propPubDate, key: 'pub_date', label: 'Дата публикации', value_type: 'date', cardinality: '0..1', required: false },
	{ ulid: UL.propPublishedAt, key: 'published_at', label: 'Опубликовано (точно)', value_type: 'datetime', cardinality: '0..1', required: false },
	{ ulid: UL.propFavorite, key: 'is_favorite', label: 'Любимая', value_type: 'boolean', cardinality: '0..1', required: false },
	{ ulid: UL.propSummary, key: 'summary', label: 'Резюме', value_type: 'text', cardinality: '0..N', required: false },
	{ ulid: UL.propFormat, key: 'format', label: 'Формат', value_type: 'text', cardinality: '0..1', required: false },
	{
		ulid: UL.propFileSize,
		key: 'file_size',
		label: 'Размер файла',
		value_type: 'number',
		cardinality: '0..1',
		required: false,
		extra: ['applies_when:', '  property: format', '  operation: equals', '  value: file'],
	},
	{
		// Обязательное УСЛОВНОЕ свойство (М6): обязательность проверяется, только
		// когда условие выполнено (format: web_novel).
		ulid: UL.propPlatform,
		key: 'platform',
		label: 'Площадка',
		value_type: 'text',
		cardinality: '1',
		required: true,
		extra: ['applies_when:', '  property: format', '  operation: equals', '  value: web_novel'],
	},
];

/** Объявление служебного свойства sb_issues — в реальном хранилище его сеет бутстрап (часть 2). */
function sbIssuesDefinitionNote(): string {
	return [
		'---',
		`id: ${UL.propSbIssues}`,
		'type: property',
		'title: sb_issues',
		'created_at: "2026-10-25T10:00"',
		'updated_at: "2026-10-25T10:00"',
		'key: sb_issues',
		'label: Проблемы',
		'value_type: text',
		'cardinality: "0..N"',
		'required: false',
		'scope: universal',
		'service: true',
		'---',
		'',
	].join('\n');
}

function bookNote(ulid: string, fields: string[]): string {
	return [
		'---',
		`id: ${ulid}`,
		'type: book',
		'title: Тестовая книга',
		'aliases:',
		'  - Тестовая книга',
		'created_at: "2026-10-25T10:00"',
		'updated_at: "2026-10-25T11:00"',
		...fields,
		'---',
		'',
		'Тело заметки свободно.',
		'',
	].join('\n');
}

describe('schema-engine — значения экземпляров (группы C/G/H) через validate-object', () => {
	let vault: FakeVault;

	const BOOK_PATH = `Books/BOOK-${UL.bookOk}.md`;

	beforeEach(async () => {
		vault = await FakeVault.create();
		await vault.put(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${UL.bookType}.md`, objectTypeNote(UL.bookType, 'book', 'Книга'));
		await vault.put(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${UL.personType}.md`, objectTypeNote(UL.personType, 'person', 'Человек'));
		for (const spec of PROPS) {
			await vault.put(`${METAMODEL_SUBFOLDERS.properties}/PROPERTY-${spec.ulid}.md`, propertyDefinitionNote(spec));
		}
		await vault.put(`${METAMODEL_SUBFOLDERS.properties}/PROPERTY-${UL.propSbIssues}.md`, sbIssuesDefinitionNote());
		// Экземпляр person — цель ссылки author.
		await vault.put(
			`Persons/PERSON-${UL.person}.md`,
			[
				'---',
				`id: ${UL.person}`,
				'type: person',
				'title: Михаил Булгаков',
				'aliases:',
				'  - Михаил Булгаков',
				'created_at: "2026-10-25T10:00"',
				'updated_at: "2026-10-25T10:00"',
				'---',
				'',
			].join('\n'),
		);
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	async function validate(path: string, shared?: null) {
		const registry = await TypeRegistry.load(vault);
		expect(registry.issues, 'определения без проблем').toEqual([]);
		const labels = new LabelResolver(registry);
		return validateObject(vault, registry, labels, path, undefined, false, shared);
	}

	async function ruleIds(path: string): Promise<string[]> {
		const result = await validate(path);
		return result.diagnostics.map((d) => d.rule_id);
	}

	it('корректный экземпляр — 0 ошибок и 0 предупреждений', async () => {
		await vault.put(
			BOOK_PATH,
			bookNote(UL.bookOk, [
				`author: "[[PERSON-${UL.person}.md|Михаил Булгаков]]"`,
				'read_status: finished',
				'rating: 9',
				'pub_date: "1928-05-00"',
				'published_at: "1928-05-15T10:30"',
				'is_favorite: true',
				'summary:',
				'  - Первое резюме',
				'  - Второе резюме',
			]),
		);
		const result = await validate(BOOK_PATH);
		expect(result.diagnostics).toEqual([]);
		expect(result.errors).toBe(0);
	});

	it('value.cardinality: обязательные свойства не заполнены (author, read_status)', async () => {
		await vault.put(BOOK_PATH, bookNote(UL.bookOk, ['rating: 5']));
		const ids = await ruleIds(BOOK_PATH);
		const cardinality = ids.filter((id) => id === 'value.cardinality');
		expect(cardinality).toHaveLength(2);
	});

	it('value.cardinality: два значения при одиночной кардинальности', async () => {
		await vault.put(
			BOOK_PATH,
			bookNote(UL.bookOk, [
				`author: "[[PERSON-${UL.person}.md|Автор]]"`,
				'read_status: reading',
				'rating:',
				'  - 5',
				'  - 7',
			]),
		);
		expect(await ruleIds(BOOK_PATH)).toContain('value.cardinality');
	});

	it('value.type_conformance: текст/число/логическое не своего типа', async () => {
		await vault.put(
			BOOK_PATH,
			bookNote(UL.bookOk, [
				`author: "[[PERSON-${UL.person}.md|Автор]]"`,
				'read_status: reading',
				'rating: отлично',
				'is_favorite: "yes"',
			]),
		);
		const result = await validate(BOOK_PATH);
		const mismatches = result.diagnostics.filter((d) => d.rule_id === 'value.type_conformance');
		expect(mismatches.map((d) => d.property_key).sort()).toEqual(['is_favorite', 'rating']);
	});

	it('value.reference.exists: висячая ссылка', async () => {
		await vault.put(
			BOOK_PATH,
			bookNote(UL.bookOk, ['author: "[[PERSON-01J8Z6M4K2Q7V9X3N5B0C1D2ZZ.md|Нет такого]]"', 'read_status: reading']),
		);
		expect(await ruleIds(BOOK_PATH)).toContain('value.reference.exists');
	});

	it('value.reference.target_type: цель допустимого типа проходит, чужого — отклоняется', async () => {
		// Вторая книга ссылается на первую (book вместо person).
		const otherPath = `Books/BOOK-${UL.bookBad}.md`;
		await vault.put(
			otherPath,
			bookNote(UL.bookBad, [`author: "[[BOOK-${UL.bookOk}.md|Другая книга]]"`, 'read_status: reading']),
		);
		await vault.put(BOOK_PATH, bookNote(UL.bookOk, ['read_status: reading'])); // цель существует
		expect(await ruleIds(otherPath)).toContain('value.reference.target_type');
	});

	it('enum: in_set, format, no_mixed_script', async () => {
		await vault.put(BOOK_PATH, bookNote(UL.bookOk, [`author: "[[PERSON-${UL.person}.md|Автор]]"`, 'read_status: paused']));
		expect(await ruleIds(BOOK_PATH)).toContain('enum.value.in_set');

		await vault.put(BOOK_PATH, bookNote(UL.bookOk, [`author: "[[PERSON-${UL.person}.md|Автор]]"`, 'read_status: Reading']));
		expect(await ruleIds(BOOK_PATH)).toContain('enum.value.format');

		await vault.put(BOOK_PATH, bookNote(UL.bookOk, [`author: "[[PERSON-${UL.person}.md|Автор]]"`, 'read_status: читаю']));
		expect(await ruleIds(BOOK_PATH)).toContain('enum.value.no_mixed_script');
	});

	it('группа H: частичная дата с пробелом, недопустимый день, произвольный формат', async () => {
		await vault.put(BOOK_PATH, bookNote(UL.bookOk, [`author: "[[PERSON-${UL.person}.md|Автор]]"`, 'read_status: reading', 'pub_date: "1928-00-15"']));
		expect(await ruleIds(BOOK_PATH)).toContain('date.partial.no_gap');

		await vault.put(BOOK_PATH, bookNote(UL.bookOk, [`author: "[[PERSON-${UL.person}.md|Автор]]"`, 'read_status: reading', 'pub_date: "2026-02-30"']));
		expect(await ruleIds(BOOK_PATH)).toContain('date.range.valid');

		await vault.put(BOOK_PATH, bookNote(UL.bookOk, [`author: "[[PERSON-${UL.person}.md|Автор]]"`, 'read_status: reading', 'pub_date: "15.05.1928"']));
		expect(await ruleIds(BOOK_PATH)).toContain('date.format');
	});

	it('datetime.no_seconds: секунды — предупреждение, не ошибка', async () => {
		await vault.put(BOOK_PATH, bookNote(UL.bookOk, [`author: "[[PERSON-${UL.person}.md|Автор]]"`, 'read_status: reading', 'published_at: "2026-10-22T14:35:59"']));
		const result = await validate(BOOK_PATH);
		const seconds = result.diagnostics.find((d) => d.rule_id === 'datetime.no_seconds');
		expect(seconds).toBeDefined();
		expect(seconds?.severity).toBe('warning');
		expect(result.diagnostics.filter((d) => d.rule_id === 'datetime.format')).toEqual([]);
	});

	it('условное свойство ВИДИМО (условие выполнено): значения проверяются полностью', async () => {
		// format: file → file_size видно; строка вместо числа — value.type_conformance.
		await vault.put(
			BOOK_PATH,
			bookNote(UL.bookOk, [`author: "[[PERSON-${UL.person}.md|Автор]]"`, 'read_status: reading', 'format: file', 'file_size: много']),
		);
		const result = await validate(BOOK_PATH);
		const fileSize = result.diagnostics.filter((d) => d.property_key === 'file_size');
		expect(fileSize.map((d) => d.rule_id)).toEqual(['value.type_conformance']);
	});

	it('условное свойство СКРЫТО (М6): обязательность не проверяется — platform не заполнен, формат не web_novel', async () => {
		// platform обязательно при format: web_novel; здесь format: file — свойство скрыто,
		// value.cardinality не применяется (rules.md «Перекрывающиеся правила», М6).
		await vault.put(
			BOOK_PATH,
			bookNote(UL.bookOk, [`author: "[[PERSON-${UL.person}.md|Автор]]"`, 'read_status: reading', 'format: file']),
		);
		const result = await validate(BOOK_PATH);
		expect(result.diagnostics.filter((d) => d.property_key === 'platform')).toEqual([]);
	});

	it('условие выполнено: обязательное условное свойство проверяется (М6 — вторая половина)', async () => {
		// format: web_novel → platform видно и обязательно: не заполнено — value.cardinality.
		await vault.put(
			BOOK_PATH,
			bookNote(UL.bookOk, [`author: "[[PERSON-${UL.person}.md|Автор]]"`, 'read_status: reading', 'format: web_novel']),
		);
		const ids = await ruleIds(BOOK_PATH);
		expect(ids).toContain('value.cardinality');
		const result = await validate(BOOK_PATH);
		const platform = result.diagnostics.filter((d) => d.property_key === 'platform');
		expect(platform).toHaveLength(1);
	});

	it('скрытое свойство с СОХРАНЁННЫМ значением: качество данных проверяется (М2 — значения не удаляются)', async () => {
		// format: web_novel → file_size скрыто, но испорченное сохранённое значение видно проверке.
		await vault.put(
			BOOK_PATH,
			bookNote(UL.bookOk, [
				`author: "[[PERSON-${UL.person}.md|Автор]]"`,
				'read_status: reading',
				'format: web_novel',
				'platform: author.today',
				'file_size: много',
			]),
		);
		const result = await validate(BOOK_PATH);
		const fileSize = result.diagnostics.filter((d) => d.property_key === 'file_size');
		expect(fileSize.map((d) => d.rule_id)).toEqual(['value.type_conformance']);
	});

	it('неизвестные поля игнорируются (схема не ограничивает состав frontmatter)', async () => {
		await vault.put(
			BOOK_PATH,
			bookNote(UL.bookOk, [`author: "[[PERSON-${UL.person}.md|Автор]]"`, 'read_status: reading', 'unknown_field: что угодно']),
		);
		const result = await validate(BOOK_PATH);
		expect(result.diagnostics).toEqual([]);
	});

	it('sharedIndex: null отключает структурные проверки уровня 3 (ссылки не проверяются)', async () => {
		await vault.put(BOOK_PATH, bookNote(UL.bookOk, ['author: "[[PERSON-01J8Z6M4K2Q7V9X3N5B0C1D2ZZ.md|Нет такого]]"', 'read_status: reading']));
		const registry = await TypeRegistry.load(vault);
		const labels = new LabelResolver(registry);
		const result = await validateObject(vault, registry, labels, BOOK_PATH, undefined, false, null);
		expect(result.diagnostics.map((d) => d.rule_id)).not.toContain('value.reference.exists');
	});

	it('общий индекс на прогон: validate-object с sharedIndex даёт тот же результат', async () => {
		await vault.put(BOOK_PATH, bookNote(UL.bookOk, ['author: "[[PERSON-01J8Z6M4K2Q7V9X3N5B0C1D2ZZ.md|Нет такого]]"', 'read_status: reading']));
		const registry = await TypeRegistry.load(vault);
		const labels = new LabelResolver(registry);
		const index = await buildVaultIndex(vault);
		const result = await validateObject(vault, registry, labels, BOOK_PATH, undefined, false, index);
		expect(result.diagnostics.map((d) => d.rule_id)).toContain('value.reference.exists');
	});
});
