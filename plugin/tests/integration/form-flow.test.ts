/**
 * Интеграционные тесты потока форм (B1.2 часть 1, DL-268):
 * bootstrap → create-object-type «book» → create-property (перечисление-триггер,
 * условные свойства, рейтинг со звёздами, ссылка) → create-object →
 * buildFormModel → saveObjectForm → validate-object чисто.
 *
 * Ключевые сценарии нормы:
 *   - service-свойство sb_issues в форму НЕ попадает (08-views §7);
 *   - М1: видимость условных полей пересчитывается по значениям формы;
 *   - М2: значение «погасшего» свойства сохраняется при записи (не удаляется);
 *   - И4: смена title синхронизирует aliases[0]; И5: updated_at обновляется;
 *   - неизвестные поля frontmatter сохраняются (схема не ограничивает состав);
 *   - display.* парсится реестром (звёзды для rating).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bootstrapMetamodel } from '../../src/core/bootstrap';
import { createObjectInstance, createObjectTypeDefinition, createPropertyDefinition } from '../../src/core/creation';
import { LabelResolver } from '../../src/core/label-resolver';
import { parseNote } from '../../src/core/markdown-parser';
import { buildFormModel, saveObjectForm } from '../../src/core/object-service';
import { TypeRegistry } from '../../src/core/registry';
import { validateObject } from '../../src/core/validation';
import { FakeVault } from '../support/fake-vault';

describe('поток форм: book с условными свойствами (критерий B1 на движке, UI — вручную)', () => {
	let vault: FakeVault;
	let bookPath: string;
	let personPath: string;

	beforeEach(async () => {
		vault = await FakeVault.create();
		await bootstrapMetamodel(vault);
		let registry = await TypeRegistry.load(vault);
		await createObjectTypeDefinition(vault, registry, { typeKey: 'book', label: 'Книга', typePrefix: 'BOOK' });
		await createObjectTypeDefinition(vault, registry, { typeKey: 'person', label: 'Человек', typePrefix: 'PERSON' });
		registry = await TypeRegistry.load(vault);
		// format — перечисление-триггер (кардинальность 1 — обязательное).
		await createPropertyDefinition(vault, registry, {
			key: 'format',
			label: 'Формат',
			valueType: 'text',
			cardinality: '1',
			scope: 'specific',
			objectTypeKeys: ['book'],
			allowedValues: ['file', 'web_novel', 'audio'],
		});
		registry = await TypeRegistry.load(vault);
		await createPropertyDefinition(vault, registry, {
			key: 'file_size',
			label: 'Размер файла',
			valueType: 'number',
			cardinality: '0..1',
			scope: 'specific',
			objectTypeKeys: ['book'],
			appliesWhen: { property: 'format', operation: 'equals', value: ['file'] },
		});
		await createPropertyDefinition(vault, registry, {
			key: 'platform',
			label: 'Площадка',
			valueType: 'text',
			cardinality: '1',
			scope: 'specific',
			objectTypeKeys: ['book'],
			appliesWhen: { property: 'format', operation: 'equals', value: ['web_novel'] },
		});
		await createPropertyDefinition(vault, registry, {
			key: 'rating',
			label: 'Оценка',
			valueType: 'number',
			cardinality: '0..1',
			scope: 'specific',
			objectTypeKeys: ['book'],
			display: { renderer: 'stars', scaleMax: 10, unit: null },
		});
		await createPropertyDefinition(vault, registry, {
			key: 'author',
			label: 'Автор',
			valueType: 'object_reference',
			cardinality: '0..1',
			scope: 'specific',
			objectTypeKeys: ['book'],
			targetTypeKeys: ['person'],
			linkMode: 'direct',
		});
		registry = await TypeRegistry.load(vault);
		const person = await createObjectInstance(vault, registry, { typeKey: 'person', title: 'Михаил Булгаков' });
		personPath = person.path;
		const book = await createObjectInstance(vault, registry, { typeKey: 'book', title: 'Мастер и Маргарита' });
		bookPath = book.path;
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	async function freshRegistry(): Promise<TypeRegistry> {
		return TypeRegistry.load(vault);
	}

	async function model() {
		const registry = await freshRegistry();
		const labels = new LabelResolver(registry);
		const note = parseNote({ path: bookPath, content: await vault.read(bookPath) }, vault);
		return { registry, labels, note, model: buildFormModel(registry, labels, note) };
	}

	it('display.* парсится реестром (rating — звёзды, scale_max 10)', async () => {
		const registry = await freshRegistry();
		const rating = registry.getPropertiesByKey('rating')[0];
		expect(rating?.display).toEqual({ renderer: 'stars', scaleMax: 10, unit: null });
		const format = registry.getPropertiesByKey('format')[0];
		expect(format?.display).toBeNull();
	});

	it('модель формы: 5 предметных полей, sb_issues исключён (service), подписи русские (view)', async () => {
		const { model: form } = await model();
		expect(form).not.toBeNull();
		const keys = form!.fields.map((f) => f.def.key).sort();
		expect(keys).toEqual(['author', 'file_size', 'format', 'platform', 'rating']);
		expect(keys).not.toContain('sb_issues');
		const rating = form!.fields.find((f) => f.def.key === 'rating')!;
		expect(rating.label).toBe('Оценка');
		expect(form!.hasConditional).toBe(true);
	});

	it('режим source: подписи — технические ключи (toggle-label-mode)', async () => {
		const registry = await freshRegistry();
		const labels = new LabelResolver(registry);
		labels.setMode('source');
		const note = parseNote({ path: bookPath, content: await vault.read(bookPath) }, vault);
		const form = buildFormModel(registry, labels, note)!;
		expect(form.fields.find((f) => f.def.key === 'rating')!.label).toBe('rating');
	});

	it('сохранение формы: значения записаны, validate-object чисто, updated_at и И4 обновлены', async () => {
		// Откатываем updated_at в прошлое: точность штамма — минуты (ADR-006),
		// в пределах одной минуты «>» не сработало бы.
		await vault.processFrontMatter(bookPath, (fm) => {
			fm.updated_at = '2020-01-01T00:00';
		});
		const { model: form, note } = await model();
		const before = note.system.updated_at!;
		expect(before).toBe('2020-01-01T00:00');
		const result = await saveObjectForm(vault, form!, note, {
			title: 'Мастер и Маргарита (издание 2)',
			values: {
				format: ['web_novel'],
				platform: ['author.today'],
				rating: [7],
				author: [`[[${personPath.replace(/\.md$/, '')}|Михаил Булгаков]]`.replace('Persons/', 'Persons/')],
			},
		});
		expect(result.updatedKeys.sort()).toEqual(['author', 'format', 'platform', 'rating', 'title'].filter((k) => k !== 'title').sort());

		const after = parseNote({ path: bookPath, content: await vault.read(bookPath) }, vault);
		expect(after.system.title).toBe('Мастер и Маргарита (издание 2)');
		expect(after.system.aliases?.[0]).toBe('Мастер и Маргарита (издание 2)'); // И4
		expect(after.properties.format).toBe('web_novel');
		expect(after.properties.platform).toBe('author.today');
		expect(after.properties.rating).toBe(7);
		expect(after.system.updated_at! > before).toBe(true); // И5

		const registry = await freshRegistry();
		const check = await validateObject(vault, registry, new LabelResolver(registry), bookPath);
		expect(check.diagnostics).toEqual([]);
	});

	it('М2: смена триггера НЕ удаляет значение «погасшего» свойства', async () => {
		const first = await model();
		await saveObjectForm(vault, first.model!, first.note, {
			title: 'Книга',
			values: { format: ['file'], file_size: [450], platform: [], rating: [], author: [] },
		});
		// format меняется на web_novel: file_size «гаснет», но значение остаётся в данных.
		const second = await model();
		await saveObjectForm(vault, second.model!, second.note, {
			title: 'Книга',
			values: { format: ['web_novel'], file_size: [450], platform: ['litres'], rating: [], author: [] },
		});
		const after = parseNote({ path: bookPath, content: await vault.read(bookPath) }, vault);
		expect(after.properties.file_size).toBe(450); // М2 — не удалено
		expect(after.properties.format).toBe('web_novel');
	});

	it('неизвестные поля frontmatter сохраняются при записи формы', async () => {
		await vault.processFrontMatter(bookPath, (fm) => {
			fm.junk_field = 'что угодно';
		});
		const { model: form, note: note0 } = await model();
		await saveObjectForm(vault, form!, note0, { title: 'Книга', values: { format: ['file'], file_size: [1] } });
		const after = parseNote({ path: bookPath, content: await vault.read(bookPath) }, vault);
		expect(after.properties.junk_field).toBe('что угодно');
	});

	it('пустое необязательное поле удаляется из frontmatter при сохранении', async () => {
		const first = await model();
		await saveObjectForm(vault, first.model!, first.note, {
			title: 'Книга',
			values: { format: ['file'], file_size: [450], rating: [9] },
		});
		const second = await model();
		await saveObjectForm(vault, second.model!, second.note, {
			title: 'Книга',
			values: { format: ['file'], file_size: [], rating: [] }, // пользователь «стёр» значения
		});
		const after = parseNote({ path: bookPath, content: await vault.read(bookPath) }, vault);
		expect(after.properties.file_size).toBeUndefined();
		expect(after.properties.rating).toBeUndefined();
		expect(after.properties.format).toBe('file');
	});

	it('пустой title отклоняется (object.title.required — уровень 1)', async () => {
		const { model: form, note } = await model();
		await expect(saveObjectForm(vault, form!, note, { title: '   ', values: {} })).rejects.toThrow(/Название/);
	});

	it('форма не открывается для абстрактного типа и заметки без type (buildFormModel → null)', async () => {
		const registry = await freshRegistry();
		await createObjectTypeDefinition(vault, registry, { typeKey: 'work', label: 'Произведение', typePrefix: 'WORK', abstract: true });
		const registry2 = await freshRegistry();
		const labels = new LabelResolver(registry2);
		await vault.put('Works/WORK-01J8Z6M4K2Q7V9X3N5B0C1D2W9.md', [
			'---',
			'id: 01J8Z6M4K2Q7V9X3N5B0C1D2W9',
			'type: work',
			'title: Нечто',
			'created_at: "2026-10-25T10:00"',
			'updated_at: "2026-10-25T10:00"',
			'---',
			'',
		].join('\n'));
		const abstractNote = parseNote({ path: 'Works/WORK-01J8Z6M4K2Q7V9X3N5B0C1D2W9.md', content: await vault.read('Works/WORK-01J8Z6M4K2Q7V9X3N5B0C1D2W9.md') }, vault);
		expect(buildFormModel(registry2, labels, abstractNote)).toBeNull();
		await vault.put('Обычная.md', '---\ntitle: Без типа\n---\n');
		const plain = parseNote({ path: 'Обычная.md', content: await vault.read('Обычная.md') }, vault);
		expect(buildFormModel(registry2, labels, plain)).toBeNull();
	});
});
