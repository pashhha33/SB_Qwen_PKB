/**
 * validate-object (этап A2): матрица правил группы A реестра (rules.md) —
 * системные атрибуты и инварианты И1–И5 + И6 для определений свойств.
 * Пропуск A2 (осознанный): object.created_at.immutable — нужна история состояния
 * (backup-service, этап C).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createObjectInstance, createObjectTypeDefinition } from '../../src/core/creation';
import { LabelResolver } from '../../src/core/label-resolver';
import { METAMODEL_SUBFOLDERS, TypeRegistry } from '../../src/core/registry';
import { validateObject } from '../../src/core/validation';
import { FakeVault } from '../support/fake-vault';

const OTHER_ULID = '01J8Z6M4K2Q7V9X3N5B0C1D2EG';

describe('validate-object — правила группы A', () => {
	let vault: FakeVault;
	let registry: TypeRegistry;
	let labels: LabelResolver;
	let bookPath: string;

	/** Книга, созданная сервисом: заведомо чистая (0 диагностик). */
	async function seedCleanBook(title = 'Мастер и Маргарита'): Promise<string> {
		const result = await createObjectInstance(vault, registry, { typeKey: 'book', title });
		return result.path;
	}

	async function ruleIds(path: string): Promise<string[]> {
		const result = await validateObject(vault, registry, labels, path);
		return result.diagnostics.map((d) => d.rule_id);
	}

	beforeEach(async () => {
		vault = await FakeVault.create();
		await createObjectTypeDefinition(vault, await TypeRegistry.load(vault), {
			typeKey: 'work',
			label: 'Произведение',
			typePrefix: 'WORK',
			abstract: true,
		});
		registry = await TypeRegistry.load(vault);
		await createObjectTypeDefinition(vault, registry, {
			typeKey: 'book',
			label: 'Книга',
			typePrefix: 'BOOK',
			parentTypeId: registry.getType('work')?.id ?? null,
		});
		registry = await TypeRegistry.load(vault);
		labels = new LabelResolver(registry);
		bookPath = await seedCleanBook();
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	it('чистый объект, созданный командой: 0 диагностик', async () => {
		const result = await validateObject(vault, registry, labels, bookPath);
		expect(result.diagnostics).toEqual([]);
		expect(result.errors).toBe(0);
	});

	it('диагностика — структура из 11 полей (severity-policy §4)', async () => {
		await vault.modify(bookPath, '---\nid: не-ulid\n---\n');
		const result = await validateObject(vault, registry, labels, bookPath);
		const d = result.diagnostics[0];
		expect(Object.keys(d).sort()).toEqual(
			[
				'actual_value',
				'fix_available',
				'fix_description',
				'hint',
				'level',
				'message',
				'object_id',
				'object_path',
				'property_key',
				'rule_id',
				'severity',
			].sort(),
		);
	});

	it('object.id.format: нет id / id не ULID (error, уровень 2)', async () => {
		const content = await vault.read(bookPath);
		await vault.modify(bookPath, content.replace(/^id: .*$/m, 'id: not-a-ulid'));
		expect(await ruleIds(bookPath)).toContain('object.id.format');

		// удалить строку id целиком (не заменять на другой ключ — дубли ключей в YAML недопустимы)
		await vault.modify(bookPath, content.split('\n').filter((line) => !line.startsWith('id:')).join('\n'));
		const result = await validateObject(vault, registry, labels, bookPath);
		expect(result.diagnostics.some((d) => d.rule_id === 'object.id.format')).toBe(true);
	});

	it('object.id.unique: второй файл с тем же id (error, уровень 2)', async () => {
		const content = await vault.read(bookPath);
		await vault.put('Books/dup.md', content); // копия 1:1 — тот же id
		const ids = await ruleIds(bookPath);
		expect(ids).toContain('object.id.unique');
		// сообщение называет число затронутых файлов (правило М5 формирования сообщений)
		const result = await validateObject(vault, registry, labels, bookPath);
		const dup = result.diagnostics.find((d) => d.rule_id === 'object.id.unique');
		expect(dup?.message).toContain('1');
	});

	it('object.id.filename_match: ULID в имени ≠ id → error + автопочинка имени по id (И2/M5)', async () => {
		await vault.rename(bookPath, `BOOK-${OTHER_ULID}.md`);
		const result = await validateObject(vault, registry, labels, `BOOK-${OTHER_ULID}.md`);
		const diag = result.diagnostics.find((d) => d.rule_id === 'object.id.filename_match');
		expect(diag).toBeDefined();
		expect(diag?.severity).toBe('error');
		expect(diag?.fix_available).toBe(true);
		expect(diag?.fix_description).toContain(bookPath.split('/').pop());
	});

	it('object.id.filename_match: неканоническое имя — починка возможна, если тип известен', async () => {
		const content = await vault.read(bookPath);
		await vault.put('Заметка.md', content);
		const result = await validateObject(vault, registry, labels, 'Заметка.md');
		const diag = result.diagnostics.find((d) => d.rule_id === 'object.id.filename_match');
		expect(diag?.fix_available).toBe(true);
		expect(diag?.fix_description).toContain('BOOK-');
	});

	it('object.type.exists: неизвестный тип (error, уровень 3)', async () => {
		const content = await vault.read(bookPath);
		await vault.modify(bookPath, content.replace(/^type: book$/m, 'type: nosuchtype'));
		expect(await ruleIds(bookPath)).toContain('object.type.exists');
	});

	it('object.type.not_abstract: экземпляр абстрактного типа (И3, error, уровень 4)', async () => {
		const content = await vault.read(bookPath);
		await vault.modify(bookPath, content.replace(/^type: book$/m, 'type: work'));
		const result = await validateObject(vault, registry, labels, bookPath);
		const diag = result.diagnostics.find((d) => d.rule_id === 'object.type.not_abstract');
		expect(diag).toBeDefined();
		expect(diag?.message).toContain('Произведение'); // M1: подпись типа, не ключ
	});

	it('object.title.required: пустое название (error, уровень 2)', async () => {
		const content = await vault.read(bookPath);
		await vault.modify(bookPath, content.replace(/^title: .*$/m, "title: '   '"));
		expect(await ruleIds(bookPath)).toContain('object.title.required');
	});

	it('object.aliases.first_is_title: И4 нарушен (warning, уровень 4, автоисправление — случай 2)', async () => {
		const content = await vault.read(bookPath);
		await vault.modify(bookPath, content.replace(/^aliases:\n  - .*$/m, 'aliases:\n  - Другое имя'));
		const result = await validateObject(vault, registry, labels, bookPath);
		const diag = result.diagnostics.find((d) => d.rule_id === 'object.aliases.first_is_title');
		expect(diag?.severity).toBe('warning');
		expect(diag?.fix_available).toBe(true);
	});

	it('object.created_at.required: нет даты создания (warning, уровень 2, автоисправление — случай 1)', async () => {
		const content = await vault.read(bookPath);
		await vault.modify(bookPath, content.replace(/^created_at: .*$/m, ''));
		const result = await validateObject(vault, registry, labels, bookPath);
		const diag = result.diagnostics.find((d) => d.rule_id === 'object.created_at.required');
		expect(diag?.severity).toBe('warning');
		expect(diag?.fix_available).toBe(true);
	});

	it('object.updated_at.order: updated_at раньше created_at (error, уровень 4)', async () => {
		const content = await vault.read(bookPath);
		await vault.modify(
			bookPath,
			content
				.replace(/^created_at: .*$/m, 'created_at: 2026-10-24T12:00')
				.replace(/^updated_at: .*$/m, 'updated_at: 2026-10-24T11:59'),
		);
		expect(await ruleIds(bookPath)).toContain('object.updated_at.order');
	});

	it('object.frontmatter.broken: битый YAML — одна диагностика, объект не применён (ADR-002)', async () => {
		await vault.modify(bookPath, '---\ntitle: [незакрытая\n  x: : :\n---\n\nтело\n');
		const result = await validateObject(vault, registry, labels, bookPath);
		expect(result.unparsable).toBe(true);
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0].rule_id).toBe('object.frontmatter.broken');
	});

	it('property.key.no_system_conflict: определение свойства с системным key (И6, error, уровень 4)', async () => {
		const path = `${METAMODEL_SUBFOLDERS.properties}/PROPERTY-01J8Z6M4K2Q7V9X3N5B0C1D2PT.md`;
		await vault.put(
			path,
			[
				'---',
				'id: 01J8Z6M4K2Q7V9X3N5B0C1D2PT',
				'type: property',
				'title: Title',
				'created_at: 2026-10-24T10:00',
				'updated_at: 2026-10-24T10:00',
				'key: title',
				'label: Название (конфликт)',
				'value_type: text',
				'cardinality: "1"',
				'required: true',
				'scope: universal',
				'---',
				'',
			].join('\n'),
		);
		expect(await ruleIds(path)).toContain('property.key.no_system_conflict');
	});
});
