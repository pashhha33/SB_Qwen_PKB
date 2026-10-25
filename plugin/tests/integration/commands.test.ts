/**
 * Интеграционные тесты цепочки создания (слой команд — тонкая обёртка, поэтому
 * тестируется ЯДРО создания: core/creation.ts; сами модалки проверяются вручную
 * по чек-боксам DoD — отклонение М4 как у obsidian-adapter).
 *
 * Сценарий DoD этапа A (phases.md §4): create-object-type создаёт тип `book`
 * по определению в Markdown — без перекомпиляции плагина; create-object создаёт
 * экземпляр BOOK-{ULID}.md с системными атрибутами и И4.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ActivityLog, DEFAULT_LOG_SETTINGS } from '../../src/core/activity-log';
import { SbError } from '../../src/core/errors';
import { assembleFileName, createObjectInstance, createObjectTypeDefinition } from '../../src/core/creation';
import { isValidTypePrefix, parseFileName } from '../../src/core/identity';
import { parseNote } from '../../src/core/markdown-parser';
import { METAMODEL_SUBFOLDERS, TypeRegistry } from '../../src/core/registry';
import { isValidUlid } from '../../src/core/ulid';
import { validateObject } from '../../src/core/validation';
import { LabelResolver } from '../../src/core/label-resolver';
import { FakeVault } from '../support/fake-vault';

describe('цепочка создания: тип → экземпляр → проверка (сценарий DoD этапа A)', () => {
	let vault: FakeVault;

	beforeEach(async () => {
		vault = await FakeVault.create();
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	it('полный цикл: create-object-type → reload реестра → create-object → validate 0 ошибок', async () => {
		// 1. Тип создаётся командой — определение в Markdown, без перекомпиляции.
		let registry = await TypeRegistry.load(vault);
		const type = await createObjectTypeDefinition(vault, registry, {
			typeKey: 'book',
			label: 'Книга',
			typePrefix: 'BOOK',
			description: 'Письменное произведение',
		});
		expect(type.path.startsWith(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-`)).toBe(true);

		// 2. Реестр перечитан из заметок — плагин «узнал» тип из данных.
		registry = await TypeRegistry.load(vault);
		expect(registry.getType('book')?.label).toBe('Книга');

		// 3. Экземпляр: ULID, имя файла BOOK-{ULID}.md, системные атрибуты, И4.
		const object = await createObjectInstance(vault, registry, {
			typeKey: 'book',
			title: 'Мастер и Маргарита',
		});
		const identity = parseFileName(object.fileName);
		expect(identity?.typePrefix).toBe('BOOK');
		expect(isValidUlid(identity?.ulid ?? '')).toBe(true);
		expect(object.id).toBe(identity?.ulid);

		const note = parseNote({ path: object.path, content: await vault.read(object.path) }, vault);
		expect(note.system.id).toBe(object.id);
		expect(note.system.type).toBe('book');
		expect(note.system.title).toBe('Мастер и Маргарита');
		expect(note.system.aliases?.[0]).toBe('Мастер и Маргарита'); // И4
		expect(note.system.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
		expect(note.system.updated_at).toBe(note.system.created_at);

		// 4. validate-object: чисто.
		const labels = new LabelResolver(registry);
		// checkServiceDeclaration: false — фикстура без бутстрапа (sb_issues не объявлен);
		// служебный слой диагностик проверяется отдельными тестами части 2.
		const result = await validateObject(vault, registry, labels, object.path, undefined, true, undefined, {
			checkServiceDeclaration: false,
		});
		expect(result.diagnostics).toEqual([]);
	});

	it('create-object в папку: путь создаётся, имя файла каноническое', async () => {
		let registry = await TypeRegistry.load(vault);
		await createObjectTypeDefinition(vault, registry, { typeKey: 'book', label: 'Книга', typePrefix: 'BOOK' });
		registry = await TypeRegistry.load(vault);
		const object = await createObjectInstance(vault, registry, {
			typeKey: 'book',
			title: 'Том 1',
			folder: 'Books/2026',
		});
		expect(object.path).toBe(`Books/2026/${object.fileName}`);
		expect(await vault.exists(object.path)).toBe(true);
	});

	it('create-object-type отклоняет: дубль type_key, дубль префикса, неформат key/prefix (уровень 1 — до записи)', async () => {
		let registry = await TypeRegistry.load(vault);
		await createObjectTypeDefinition(vault, registry, { typeKey: 'book', label: 'Книга', typePrefix: 'BOOK' });
		registry = await TypeRegistry.load(vault);

		await expect(
			createObjectTypeDefinition(vault, registry, { typeKey: 'book', label: 'Книга 2', typePrefix: 'BOOK2' }),
		).rejects.toThrow(SbError);
		await expect(
			createObjectTypeDefinition(vault, registry, { typeKey: 'novel', label: 'Роман', typePrefix: 'BOOK' }),
		).rejects.toThrow(SbError);
		await expect(
			createObjectTypeDefinition(vault, registry, { typeKey: 'Book', label: 'Книга', typePrefix: 'NOVEL' }),
		).rejects.toThrow(SbError); // заглавные в type_key
		// F5-7 = А (DL-253): подчёркивание в префиксе легализовано схемой defs#type_prefix:
		expect(isValidTypePrefix('WEB_PAGE')).toBe(true);
		const webPage = await createObjectTypeDefinition(vault, registry, { typeKey: 'web_page', label: 'Страница', typePrefix: 'WEB_PAGE' });
		// файл определения — OBJECT_TYPE-{ULID}.md (определение само является объектом
		// типа object_type); префикс WEB_PAGE — значение поля type_prefix в нём:
		expect(webPage.fileName.startsWith('OBJECT_TYPE-')).toBe(true);
		const webPageContent = await vault.read(webPage.path);
		expect(webPageContent).toContain('type_prefix: WEB_PAGE');
		// слишком длинный префикс (21) по-прежнему отклоняется:
		await expect(
			createObjectTypeDefinition(vault, registry, { typeKey: 'long', label: 'Длинный', typePrefix: 'ABCDEFGHIJKLMNOPQRSTU' }),
		).rejects.toThrow(SbError);
	});

	it('create-object отклоняет: абстрактный тип (И3), неизвестный тип, пустое название', async () => {
		let registry = await TypeRegistry.load(vault);
		await createObjectTypeDefinition(vault, registry, {
			typeKey: 'work',
			label: 'Произведение',
			typePrefix: 'WORK',
			abstract: true,
		});
		registry = await TypeRegistry.load(vault);

		await expect(createObjectInstance(vault, registry, { typeKey: 'work', title: 'X' })).rejects.toThrow(SbError);
		await expect(createObjectInstance(vault, registry, { typeKey: 'nosuch', title: 'X' })).rejects.toThrow(SbError);
		await expect(createObjectInstance(vault, registry, { typeKey: 'work', title: '   ' })).rejects.toThrow(SbError);
	});

	it('родительский тип: каноническая ссылка с псевдонимом (ADR-001 + DL-186)', async () => {
		let registry = await TypeRegistry.load(vault);
		const work = await createObjectTypeDefinition(vault, registry, {
			typeKey: 'work',
			label: 'Произведение',
			typePrefix: 'WORK',
			abstract: true,
		});
		registry = await TypeRegistry.load(vault);
		const book = await createObjectTypeDefinition(vault, registry, {
			typeKey: 'book',
			label: 'Книга',
			typePrefix: 'BOOK',
			parentTypeId: work.id,
		});
		const content = await vault.read(book.path);
		expect(book.path).toBe(`${METAMODEL_SUBFOLDERS.objectTypes}/${assembleFileName('OBJECT_TYPE', book.id)}`);
		expect(content).toContain(`[[OBJECT_TYPE-${work.id}.md|Произведение]]`);
		registry = await TypeRegistry.load(vault);
		expect(registry.ancestorsOf('book').map((def) => def.typeKey)).toEqual(['work']);
	});

	it('журнал (DL-251): создание типа и объекта пишет события info; отказ — error', async () => {
		const logger = new ActivityLog(vault, { ...DEFAULT_LOG_SETTINGS, levels: { ...DEFAULT_LOG_SETTINGS.levels } });
		let registry = await TypeRegistry.load(vault);
		await createObjectTypeDefinition(
			vault,
			registry,
			{ typeKey: 'book', label: 'Книга', typePrefix: 'BOOK' },
			logger.fn,
		);
		registry = await TypeRegistry.load(vault);
		await createObjectInstance(vault, registry, { typeKey: 'book', title: 'Том 1' }, logger.fn);
		try {
			await createObjectInstance(vault, registry, { typeKey: 'nosuch', title: 'X' }, logger.fn);
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(SbError);
		}
		const entries = logger.tail(20);
		expect(entries.filter((entry) => entry.level === 'info' && entry.area === 'creation')).toHaveLength(2);
		expect(entries.some((entry) => entry.message.includes('«Книга» (book)'))).toBe(true);
		// отказ команды логирует error (в командах — catch; здесь проверяем сам механизм)
		logger.log('error', 'creation', 'Тип «nosuch» не найден в реестре определений');
		expect(logger.tail(20).filter((entry) => entry.level === 'error')).toHaveLength(1);
	});

	it('созданные определения проходят валидацию группы A без ошибок', async () => {
		let registry = await TypeRegistry.load(vault);
		const type = await createObjectTypeDefinition(vault, registry, {
			typeKey: 'person',
			label: 'Человек',
			typePrefix: 'PERSON',
		});
		registry = await TypeRegistry.load(vault);
		const labels = new LabelResolver(registry);
		const result = await validateObject(vault, registry, labels, type.path, undefined, true, undefined, {
			checkServiceDeclaration: false, // фикстура без бутстрапа — служебный слой вне предмета теста
		});
		// Определение типа — объект типа object_type; самого object_type в реестре
		// ещё нет (бутстрап — часть 2), поэтому type.exists законно срабатывает;
		// системные атрибуты и инварианты — чистые.
		const nonTypeRules = result.diagnostics.filter((d) => d.rule_id !== 'object.type.exists');
		expect(nonTypeRules).toEqual([]);
	});
});
