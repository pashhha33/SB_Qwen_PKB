/**
 * Реестр типов × примеры шага 9: определения object_type и property из
 * examples/instances/ загружаются в Metamodel/ и корректно индексируются.
 * Примеры иллюстративны (DL-019): сквозные id между файлами не согласованы —
 * висячие ссылки родителей фиксируются как issues, но не ломают реестр.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { METAMODEL_SUBFOLDERS, TypeRegistry } from '../../src/core/registry';
import { loadExamples } from '../support/examples';
import { FakeVault } from '../support/fake-vault';

describe('type-registry × примеры репозитория', () => {
	let vault: FakeVault;

	beforeEach(async () => {
		vault = await FakeVault.create();
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	it('3 определения типов + 5 определений свойств из valid-примеров индексируются', async () => {
		const examples = await loadExamples();
		for (const example of examples) {
			if (example.validity !== 'valid') {
				continue;
			}
			if (example.type === 'object_type') {
				await vault.put(`${METAMODEL_SUBFOLDERS.objectTypes}/${example.relative.split('/')[1]}`, example.content);
			} else if (example.type === 'property') {
				await vault.put(`${METAMODEL_SUBFOLDERS.properties}/${example.relative.split('/')[1]}`, example.content);
			}
		}

		const registry = await TypeRegistry.load(vault);

		// типы: book (valid-01), work (valid-02, абстрактный), image_wrapper (valid-03, deprecated)
		expect(registry.types.map((def) => def.typeKey).sort()).toEqual(['book', 'image_wrapper', 'work']);
		expect(registry.getType('book')?.typePrefix).toBe('BOOK');
		expect(registry.getType('work')?.abstract).toBe(true);
		expect(registry.getType('image_wrapper')?.lifecycle).toBe('deprecated');
		expect(registry.getType('image_wrapper')?.supersededById).toBe('01J8Z6M4K2Q7V9X3N5B0C1D2WM');
		expect(registry.instantiableTypes().map((def) => def.typeKey).sort()).toEqual(['book', 'image_wrapper']);

		// свойства: author, cover, format, rating, platform
		expect(registry.properties.map((def) => def.key).sort()).toEqual([
			'author',
			'cover',
			'format',
			'platform',
			'rating',
		]);
		const author = registry.getPropertiesByKey('author')[0];
		expect(author.valueType).toBe('object_reference');
		expect(author.cardinality).toBe('1..N');
		expect(author.required).toBe(true);

		// висячие ссылки примеров (DL-019) — issues, но реестр работает
		expect(registry.issues.some((issue) => issue.code === 'dangling_parent')).toBe(true); // parent_type book → work-пример с другим id
		expect(registry.issues.some((issue) => issue.code === 'dangling_superseded_by')).toBe(true);
		expect(registry.getType('book')?.parentId).toBe('01J8Z6M4K2Q7V9X3N5B0C1D2EA');
	});
});
