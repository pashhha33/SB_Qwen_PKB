/**
 * Юнит-тесты поиска целей ссылки (B1.2 часть 2, DL-273):
 * object-service#searchReferenceTargets — фильтр по target_types, поиск по
 * заголовку и имени файла, сортировка «с начала — раньше», каноническая ссылка
 * (ADR-001 + DL-186), лимит, исключение редактируемой заметки.
 * Индекс собирается вручную (buildVaultIndex покрыт schema-engine-тестами).
 */

import { describe, expect, it } from 'vitest';
import { searchReferenceTargets } from '../../src/core/object-service';
import type { TypeRegistry } from '../../src/core/registry';
import type { VaultIndex } from '../../src/core/schema-engine';

// Crockford-ULID: без I/L/O/U.
const P1 = '01J8Z6M4K2Q7V9X3N5B0C1D2A1';
const P2 = '01J8Z6M4K2Q7V9X3N5B0C1D2A2';
const B1 = '01J8Z6M4K2Q7V9X3N5B0C1D2A3';

/** Минимальный реестр: только getType (ярлык типа). */
const registry = {
	getType: (key: string) => {
		if (key === 'person') {
			return { key: 'person', label: 'Человек' };
		}
		if (key === 'book') {
			return { key: 'book', label: 'Книга' };
		}
		return null;
	},
} as unknown as TypeRegistry;

function makeIndex(entries: Array<{ path: string; type: string | null; title?: string }>): VaultIndex {
	const noteTypes = new Map<string, string | null>();
	const titleByPath = new Map<string, string>();
	for (const e of entries) {
		noteTypes.set(e.path, e.type);
		if (e.title !== undefined) {
			titleByPath.set(e.path, e.title);
		}
	}
	return { byUlid: new Map(), byBaseName: new Map(), noteTypes, titleByPath, sbObjectPaths: new Set() };
}

/** Хранилище-фикстура: 2 человека, книга, заметка без типа. */
const vaultIndex = makeIndex([
	{ path: `Persons/PERSON-${P1}.md`, type: 'person', title: 'Аркадий Стругацкий' },
	{ path: `Persons/PERSON-${P2}.md`, type: 'person', title: 'Борис Стругацкий' },
	{ path: `Books/BOOK-${B1}.md`, type: 'book', title: 'Понедельник начинается в субботу' },
	{ path: 'Заметки/Черновик.md', type: null, title: 'Черновик без типа' },
	{ path: 'Persons/PERSON-01J8Z6M4K2Q7V9X3N5B0C1D2A9.md', type: 'person' }, // без titleByPath — резерв имя файла
]);

describe('searchReferenceTargets — фильтр и поиск', () => {
	it('пустой запрос: все кандидаты допустимых типов, без заметок без типа', () => {
		const found = searchReferenceTargets(vaultIndex, registry, ['person'], '');
		expect(found).toHaveLength(3);
		expect(found.every((c) => c.typeKey === 'person')).toBe(true);
	});

	it('пустой target_types: любые типизированные заметки', () => {
		const found = searchReferenceTargets(vaultIndex, registry, [], '');
		expect(found).toHaveLength(4); // 3 человека + книга, черновик без типа — вне
	});

	it('поиск по подстроке заголовка, регистр не важен', () => {
		const found = searchReferenceTargets(vaultIndex, registry, ['person'], 'стругацкий');
		expect(found.map((c) => c.title)).toEqual(['Аркадий Стругацкий', 'Борис Стругацкий']);
	});

	it('поиск по имени файла, когда заголовок не совпадает', () => {
		const index = makeIndex([{ path: `Persons/PERSON-${P1}.md`, type: 'person', title: 'Человек с ружьём' }]);
		const found = searchReferenceTargets(index, registry, ['person'], P1.toLowerCase());
		expect(found).toHaveLength(1);
		expect(found[0].title).toBe('Человек с ружьём');
	});

	it('тип цели фильтрует: book не попадает в выдачу по person', () => {
		const found = searchReferenceTargets(vaultIndex, registry, ['person'], 'понедельник');
		expect(found).toHaveLength(0);
	});
});

describe('searchReferenceTargets — сортировка, лимит, исключения', () => {
	it('совпадения с начала заголовка идут раньше совпадений в середине', () => {
		const index = makeIndex([
			{ path: `Persons/PERSON-${P1}.md`, type: 'person', title: 'Про Бориса' }, // «про» с начала
			{ path: `Persons/PERSON-${P2}.md`, type: 'person', title: 'Архипрогресс' }, // «про» в середине
		]);
		const found = searchReferenceTargets(index, registry, ['person'], 'про');
		expect(found.map((c) => c.title)).toEqual(['Про Бориса', 'Архипрогресс']);
	});

	it('limit обрезает выдачу', () => {
		const found = searchReferenceTargets(vaultIndex, registry, [], '', { limit: 2 });
		expect(found).toHaveLength(2);
	});

	it('excludePath убирает редактируемую заметку (самоссылка не предлагается)', () => {
		const found = searchReferenceTargets(vaultIndex, registry, ['person'], '', { excludePath: `Persons/PERSON-${P1}.md` });
		expect(found).toHaveLength(2);
		expect(found.every((c) => c.path !== `Persons/PERSON-${P1}.md`)).toBe(true);
	});

	it('индекс без readTypes (noteTypes не заполнен): пустая выдача', () => {
		const index: VaultIndex = { byUlid: new Map(), byBaseName: new Map() };
		expect(searchReferenceTargets(index, registry, [], '')).toEqual([]);
	});
});

describe('searchReferenceTargets — каноническая ссылка и ярлыки', () => {
	it('каноническое имя: PREFIX-ULID.md|title (ADR-001, псевдоним всегда — DL-186)', () => {
		const found = searchReferenceTargets(vaultIndex, registry, ['person'], 'аркадий');
		expect(found[0].canonicalLink).toBe(`[[PERSON-${P1}.md|Аркадий Стругацкий]]`);
		expect(found[0].typeLabel).toBe('Человек');
	});

	it('неканоническое имя файла: ссылка по имени без расширения', () => {
		const index = makeIndex([{ path: 'Persons/Мой друг.md', type: 'person', title: 'Мой друг' }]);
		const found = searchReferenceTargets(index, registry, ['person'], 'друг');
		expect(found[0].canonicalLink).toBe('[[Мой друг|Мой друг]]');
	});

	it('незарегистрированный тип: typeLabel — сам ключ', () => {
		const index = makeIndex([{ path: `Aliens/ALIEN-${P1}.md`, type: 'alien', title: 'Гость' }]);
		const found = searchReferenceTargets(index, registry, ['alien'], '');
		expect(found[0].typeLabel).toBe('alien');
		expect(found[0].typeKey).toBe('alien');
	});

	it('заголовок-резерв: нет titleByPath — имя файла без расширения', () => {
		const found = searchReferenceTargets(vaultIndex, registry, ['person'], 'A9');
		expect(found).toHaveLength(1);
		expect(found[0].title).toBe('PERSON-01J8Z6M4K2Q7V9X3N5B0C1D2A9');
	});
});
