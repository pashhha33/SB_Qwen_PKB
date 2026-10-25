/**
 * Юнит-тесты LabelResolver + регрессия дефекта 0.8.0 (DL-271, фикс 0.8.2):
 * резолвер жил со СТАРЫМ снимком реестра после reloadRegistry — подписи
 * определений, созданных в текущей сессии (create-object-type/create-property),
 * деградировали до ключей В ОБЕИХ режимах: toggle-label-mode «ничего не менял»,
 * формы показывали ключи вместо русских подписей.
 *
 * Контракт (урок DL-255 «дефект → контракт-тест»): setRegistry() переподключает
 * резолвер к новому снимку, режим сохраняется.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createObjectInstance, createObjectTypeDefinition, createPropertyDefinition } from '../../src/core/creation';
import { LabelResolver } from '../../src/core/label-resolver';
import { buildFormModel } from '../../src/core/object-service';
import { parseNote } from '../../src/core/markdown-parser';
import { TypeRegistry } from '../../src/core/registry';
import { FakeVault } from '../support/fake-vault';

describe('LabelResolver — режимы (ADR-003)', () => {
	let vault: FakeVault;

	beforeEach(async () => {
		vault = await FakeVault.create();
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	it('view — русские подписи, source — технические ключи', async () => {
		let registry = await TypeRegistry.load(vault);
		await createObjectTypeDefinition(vault, registry, { typeKey: 'book', label: 'Книга', typePrefix: 'BOOK' });
		registry = await TypeRegistry.load(vault);
		await createPropertyDefinition(vault, registry, {
			key: 'format',
			label: 'Формат',
			valueType: 'text',
			cardinality: '1',
			scope: 'specific',
			objectTypeKeys: ['book'],
		});
		registry = await TypeRegistry.load(vault);

		const labels = new LabelResolver(registry);
		expect(labels.forPropertyKey('format', 'book')).toBe('Формат');
		expect(labels.forTypeKey('book')).toBe('Книга');
		labels.setMode('source');
		expect(labels.forPropertyKey('format', 'book')).toBe('format');
		expect(labels.forTypeKey('book')).toBe('book');
	});

	it('М4-резерв: неизвестный ключ показывается ключом, а не пустотой', async () => {
		const labels = new LabelResolver(await TypeRegistry.load(vault));
		expect(labels.forPropertyKey('несуществующий')).toBe('несуществующий');
		expect(labels.forTypeKey('unknown_type')).toBe('unknown_type');
	});
});

describe('LabelResolver — регрессия DL-271: устаревший реестр после reload', () => {
	let vault: FakeVault;

	beforeEach(async () => {
		vault = await FakeVault.create();
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	it('ДЕФЕКТ (воспроизведение): со старым снимком подписи созданных в сессии определений деградируют до ключей', async () => {
		// Плагин загрузился: реестр пуст, резолвер создан с этим снимком.
		const stale = await TypeRegistry.load(vault);
		const labels = new LabelResolver(stale);

		// Пользователь создал тип и свойство командами (команды перечитывают реестр —
		// но резолвер в 0.8.0 оставался на старом снимке).
		let registry = await TypeRegistry.load(vault);
		await createObjectTypeDefinition(vault, registry, { typeKey: 'book', label: 'Книга', typePrefix: 'BOOK' });
		registry = await TypeRegistry.load(vault);
		await createPropertyDefinition(vault, registry, {
			key: 'format',
			label: 'Формат',
			valueType: 'text',
			cardinality: '1',
			scope: 'specific',
			objectTypeKeys: ['book'],
		});
		// Старый снимок не знает новых определений — fallback на ключ (так выглядел дефект:
		// форма показывала «format» в режиме view, и toggle-label-mode «ничего не менял»).
		expect(labels.forPropertyKey('format', 'book')).toBe('format');
		expect(labels.forTypeKey('book')).toBe('book');
	});

	it('ФИКС: setRegistry переподключает к новому снимку — подписи сразу русские, режим сохранён', async () => {
		const stale = await TypeRegistry.load(vault);
		const labels = new LabelResolver(stale);
		labels.setMode('source');

		let registry = await TypeRegistry.load(vault);
		await createObjectTypeDefinition(vault, registry, { typeKey: 'book', label: 'Книга', typePrefix: 'BOOK' });
		registry = await TypeRegistry.load(vault);
		await createPropertyDefinition(vault, registry, {
			key: 'rating',
			label: 'Оценка',
			valueType: 'number',
			cardinality: '0..1',
			scope: 'specific',
			objectTypeKeys: ['book'],
		});
		const fresh = await TypeRegistry.load(vault);

		labels.setRegistry(fresh);
		// Режим сохранился (source — ключи):
		expect(labels.forPropertyKey('rating', 'book')).toBe('rating');
		labels.setMode('view');
		// Новый снимок — русские подписи созданных в сессии определений:
		expect(labels.forPropertyKey('rating', 'book')).toBe('Оценка');
		expect(labels.forTypeKey('book')).toBe('Книга');
	});

	it('форма объекта после переподключения показывает русские подписи (связка buildFormModel + labels)', async () => {
		const stale = await TypeRegistry.load(vault);
		const labels = new LabelResolver(stale);

		let registry = await TypeRegistry.load(vault);
		await createObjectTypeDefinition(vault, registry, { typeKey: 'book', label: 'Книга', typePrefix: 'BOOK' });
		registry = await TypeRegistry.load(vault);
		await createPropertyDefinition(vault, registry, {
			key: 'format',
			label: 'Формат',
			valueType: 'text',
			cardinality: '1',
			scope: 'specific',
			objectTypeKeys: ['book'],
		});
		registry = await TypeRegistry.load(vault);
		const book = await createObjectInstance(vault, registry, { typeKey: 'book', title: 'Тестовая книга' });

		// Без переподключения (дефект): подпись — ключ.
		const note0 = parseNote({ path: book.path, content: await vault.read(book.path) }, vault);
		const modelStale = buildFormModel(registry, labels, note0)!;
		expect(modelStale.fields.find((f) => f.def.key === 'format')!.label).toBe('format');

		// reloadRegistry в main.ts теперь делает setRegistry — подписи русские.
		labels.setRegistry(await TypeRegistry.load(vault));
		const modelFresh = buildFormModel(registry, labels, note0)!;
		expect(modelFresh.fields.find((f) => f.def.key === 'format')!.label).toBe('Формат');
		expect(modelFresh.typeLabel).toBe('Книга');
	});
});
