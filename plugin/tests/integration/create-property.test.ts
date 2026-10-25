/**
 * Интеграционные тесты create-property (B1.1 часть 2, DL-266): ядро создания
 * определений свойств core/creation.ts#createPropertyDefinition (модалка —
 * тонкая обёртка, проверяется вручную по чек-боксам DoD).
 *
 * Ключевой сценарий: созданное командой определение проходит собственную
 * валидацию (группа B) без диагностик — «команды создают корректные данные»
 * (ADR-004, уровень 1 контроля до записи).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bootstrapMetamodel } from '../../src/core/bootstrap';
import { createObjectInstance, createObjectTypeDefinition, createPropertyDefinition, requiredFromCardinality } from '../../src/core/creation';
import { SbError } from '../../src/core/errors';
import { parseNote } from '../../src/core/markdown-parser';
import { LabelResolver } from '../../src/core/label-resolver';
import { METAMODEL_SUBFOLDERS, TypeRegistry } from '../../src/core/registry';
import { validateObject } from '../../src/core/validation';
import { FakeVault } from '../support/fake-vault';

describe('create-property — создание определений свойств командой', () => {
	let vault: FakeVault;

	beforeEach(async () => {
		vault = await FakeVault.create();
		await bootstrapMetamodel(vault);
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	async function seedBookType(): Promise<string> {
		let registry = await TypeRegistry.load(vault);
		const type = await createObjectTypeDefinition(vault, registry, { typeKey: 'book', label: 'Книга', typePrefix: 'BOOK' });
		return type.id;
	}

	async function create(input: Parameters<typeof createPropertyDefinition>[2]) {
		const registry = await TypeRegistry.load(vault);
		return createPropertyDefinition(vault, registry, input);
	}

	it('счастливый путь: файл PROPERTY-{ULID}.md, required выводится из cardinality, реестр видит свойство', async () => {
		await seedBookType();
		const result = await create({
			key: 'published_year',
			label: 'Год издания',
			valueType: 'number',
			cardinality: '0..1',
			scope: 'specific',
			objectTypeKeys: ['book'],
		});
		expect(result.path.startsWith(`${METAMODEL_SUBFOLDERS.properties}/PROPERTY-`)).toBe(true);

		const note = parseNote({ path: result.path, content: await vault.read(result.path) }, vault);
		expect(note.system.id).toBe(result.id);
		expect(note.system.type).toBe('property');
		expect(note.system.title).toBe('published_year');
		expect(note.system.aliases?.[0]).toBe('published_year'); // И4
		expect(note.properties.key).toBe('published_year');
		expect(note.properties.label).toBe('Год издания');
		expect(note.properties.value_type).toBe('number');
		expect(note.properties.cardinality).toBe('0..1');
		expect(note.properties.required).toBe(false); // вывод, а не ввод (04-attributes §4)
		expect(note.properties.object_types).toEqual([expect.stringContaining('[[OBJECT_TYPE-')]);

		const registry = await TypeRegistry.load(vault);
		expect(registry.getPropertiesByKey('published_year')).toHaveLength(1);
	});

	it('requiredFromCardinality: таблица 04-attributes §4', () => {
		expect(requiredFromCardinality('1')).toBe(true);
		expect(requiredFromCardinality('1..N')).toBe(true);
		expect(requiredFromCardinality('0..1')).toBe(false);
		expect(requiredFromCardinality('0..N')).toBe(false);
	});

	it('созданное определение проходит validate-object (группа B) без диагностик', async () => {
		await seedBookType();
		const result = await create({
			key: 'format',
			label: 'Формат',
			valueType: 'text',
			cardinality: '1',
			scope: 'specific',
			objectTypeKeys: ['book'],
			allowedValues: ['file', 'web_novel', 'audio'],
		});
		const registry = await TypeRegistry.load(vault);
		const labels = new LabelResolver(registry);
		const check = await validateObject(vault, registry, labels, result.path);
		expect(check.diagnostics).toEqual([]);
	});

	it('перечисление + условное свойство: applies_when записывается, определение чисто', async () => {
		await seedBookType();
		await create({ key: 'format', label: 'Формат', valueType: 'text', cardinality: '0..1', scope: 'specific', objectTypeKeys: ['book'], allowedValues: ['file', 'web_novel'] });
		const result = await create({
			key: 'file_size',
			label: 'Размер файла',
			valueType: 'number',
			cardinality: '0..1',
			scope: 'specific',
			objectTypeKeys: ['book'],
			appliesWhen: { property: 'format', operation: 'equals', value: ['file'] },
		});
		const note = parseNote({ path: result.path, content: await vault.read(result.path) }, vault);
		expect(note.properties.applies_when).toEqual({ property: 'format', operation: 'equals', value: 'file' });

		const registry = await TypeRegistry.load(vault);
		const check = await validateObject(vault, registry, labels(registry), result.path);
		expect(check.diagnostics).toEqual([]);
	});

	it('ссылка: object_reference требует target_types и link_mode; media_reference — media_target', async () => {
		await seedBookType();
		let registry = await TypeRegistry.load(vault);
		const person = await createObjectTypeDefinition(vault, registry, { typeKey: 'person', label: 'Человек', typePrefix: 'PERSON' });
		registry = await TypeRegistry.load(vault);

		const author = await createPropertyDefinition(vault, registry, {
			key: 'author',
			label: 'Автор',
			valueType: 'object_reference',
			cardinality: '1',
			scope: 'specific',
			objectTypeKeys: ['book'],
			targetTypeKeys: ['person'],
			linkMode: 'direct',
		});
		const note = parseNote({ path: author.path, content: await vault.read(author.path) }, vault);
		expect(note.properties.target_types).toEqual([expect.stringContaining(`OBJECT_TYPE-${person.id}`)]);
		expect(note.properties.link_mode).toBe('direct');

		await expect(
			createPropertyDefinition(vault, registry, { key: 'editor', label: 'Редактор', valueType: 'object_reference', cardinality: '0..1', scope: 'specific', objectTypeKeys: ['book'] }),
		).rejects.toThrow(/target_types/);
		await expect(
			createPropertyDefinition(vault, registry, { key: 'editor', label: 'Редактор', valueType: 'object_reference', cardinality: '0..1', scope: 'specific', objectTypeKeys: ['book'], targetTypeKeys: ['person'] }),
		).rejects.toThrow(/link_mode/);
		await expect(
			createPropertyDefinition(vault, registry, { key: 'cover', label: 'Обложка', valueType: 'media_reference', cardinality: '0..1', scope: 'specific', objectTypeKeys: ['book'], targetTypeKeys: ['person'] }),
		).rejects.toThrow(/media_target/);
	});

	it('отказы уровня 1 (до записи): формат ключа, И6, подпись, закрытые наборы', async () => {
		await seedBookType();
		const base = { label: 'Подпись', valueType: 'text', cardinality: '0..1', scope: 'specific', objectTypeKeys: ['book'] };
		await expect(create({ ...base, key: 'Неверный!' })).rejects.toThrow(SbError);
		await expect(create({ ...base, key: 'title' })).rejects.toThrow(/системным атрибутом/); // И6
		await expect(create({ ...base, key: 'ok_key', label: '  ' })).rejects.toThrow(/подпись/i);
		await expect(create({ ...base, key: 'ok_key', valueType: 'list' })).rejects.toThrow(/закрытого набора семи/);
		await expect(create({ ...base, key: 'ok_key', cardinality: '2..5' })).rejects.toThrow(/Кардинальность/);
		await expect(create({ ...base, key: 'ok_key', scope: 'global' })).rejects.toThrow(/Область/);
		// Ничего не записано:
		const registry = await TypeRegistry.load(vault);
		expect(registry.properties.filter((p) => p.key !== 'sb_issues')).toEqual([]);
	});

	it('отказы: scope/object_types (универсальное с типами, family не абстрактный, specific абстрактный/пусто)', async () => {
		await seedBookType();
		let registry = await TypeRegistry.load(vault);
		await createObjectTypeDefinition(vault, registry, { typeKey: 'work', label: 'Произведение', typePrefix: 'WORK', abstract: true });
		registry = await TypeRegistry.load(vault);

		await expect(create({ key: 'a', label: 'А', valueType: 'text', cardinality: '0..1', scope: 'universal', objectTypeKeys: ['book'] })).rejects.toThrow(/universal/);
		await expect(create({ key: 'b', label: 'Б', valueType: 'text', cardinality: '0..1', scope: 'family', objectTypeKeys: ['book', 'work'] })).rejects.toThrow(/ровно один/);
		await expect(create({ key: 'c', label: 'В', valueType: 'text', cardinality: '0..1', scope: 'family', objectTypeKeys: ['book'] })).rejects.toThrow(/неабстрактный/);
		await expect(create({ key: 'd', label: 'Г', valueType: 'text', cardinality: '0..1', scope: 'specific', objectTypeKeys: [] })).rejects.toThrow(/минимум один/);
		await expect(create({ key: 'e', label: 'Д', valueType: 'text', cardinality: '0..1', scope: 'specific', objectTypeKeys: ['work'] })).rejects.toThrow(/абстрактный/);
		// family с абстрактным предком — корректно:
		const ok = await create({ key: 'f', label: 'Ж', valueType: 'text', cardinality: '0..1', scope: 'family', objectTypeKeys: ['work'] });
		expect(ok.path).toContain('PROPERTY-');
	});

	it('уникальность ключа с учётом покрытия (F5-8): дубль в том же типе отклоняется, в другом — создаётся', async () => {
		await seedBookType();
		let registry = await TypeRegistry.load(vault);
		await createObjectTypeDefinition(vault, registry, { typeKey: 'person', label: 'Человек', typePrefix: 'PERSON' });

		await create({ key: 'note', label: 'Заметка', valueType: 'text', cardinality: '0..1', scope: 'specific', objectTypeKeys: ['book'] });
		await expect(create({ key: 'note', label: 'Заметка 2', valueType: 'text', cardinality: '0..1', scope: 'specific', objectTypeKeys: ['book'] })).rejects.toThrow(/пересекающимся покрытием/);
		// universal пересекается со всем:
		await expect(create({ key: 'note', label: 'Заметка 3', valueType: 'text', cardinality: '0..1', scope: 'universal' })).rejects.toThrow(/пересекающимся покрытием/);
		// Другой тип — не пересекается:
		const other = await create({ key: 'note', label: 'Заметка', valueType: 'text', cardinality: '0..1', scope: 'specific', objectTypeKeys: ['person'] });
		expect(other.path).toContain('PROPERTY-');
	});

	it('перечисления: формат значений, повторы; applies_when: операция, пустое значение, несуществующий триггер', async () => {
		await seedBookType();
		const base = { key: 'k', label: 'К', valueType: 'text', cardinality: '0..1', scope: 'specific', objectTypeKeys: ['book'] };
		await expect(create({ ...base, allowedValues: ['ok', 'Некст'] })).rejects.toThrow(/формату/);
		await expect(create({ ...base, allowedValues: ['a', 'a'] })).rejects.toThrow(/повтор/);
		await expect(create({ ...base, appliesWhen: { property: 'format', operation: 'equals_all', value: ['x'] } })).rejects.toThrow(
			/М4/,
		);
		await expect(create({ ...base, appliesWhen: { property: 'format', operation: 'equals', value: [' '] } })).rejects.toThrow(/пусто/);
		await expect(create({ ...base, appliesWhen: { property: 'format', operation: 'equals', value: ['file'] } })).rejects.toThrow(/не объявлено/);
	});

	it('журнал: успешное создание — info/creation; отказ — error/creation (через обёртку команды не тестируется — ядро)', async () => {
		await seedBookType();
		const records: { level: string; area: string }[] = [];
		const log = (level: string, area: string) => {
			records.push({ level, area });
		};
		const registry = await TypeRegistry.load(vault);
		await createPropertyDefinition(vault, registry, { key: 'pages', label: 'Страницы', valueType: 'number', cardinality: '0..1', scope: 'specific', objectTypeKeys: ['book'] }, log as never);
		expect(records).toContainEqual({ level: 'info', area: 'creation' });
	});

	it('свойство-триггер + экземпляр: полный цикл create-property → create-object → validate-object', async () => {
		await seedBookType();
		await create({ key: 'format', label: 'Формат', valueType: 'text', cardinality: '1', scope: 'specific', objectTypeKeys: ['book'], allowedValues: ['file', 'web_novel'] });
		await create({ key: 'file_size', label: 'Размер файла', valueType: 'number', cardinality: '0..1', scope: 'specific', objectTypeKeys: ['book'], appliesWhen: { property: 'format', operation: 'equals', value: ['file'] } });

		const registry = await TypeRegistry.load(vault);
		const book = await createObjectInstance(vault, registry, { typeKey: 'book', title: 'Тестовая книга' });
		const labels = new LabelResolver(registry);

		// Пустой экземпляр: format обязателен — ошибка; file_size скрыт (условие не выполнено) — нет.
		const empty = await validateObject(vault, registry, labels, book.path);
		const ids = empty.diagnostics.map((d) => `${d.rule_id}:${d.property_key}`);
		expect(ids).toContain('value.cardinality:format');
		expect(ids.some((i) => i.endsWith(':file_size'))).toBe(false);
	});
});

/** Локальный хелпер: LabelResolver из реестра. */
function labels(registry: TypeRegistry): LabelResolver {
	return new LabelResolver(registry);
}
