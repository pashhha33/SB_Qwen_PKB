import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createObjectTypeDefinition } from '../../src/core/creation';
import { LabelResolver } from '../../src/core/label-resolver';
import { METAMODEL_SUBFOLDERS, REGISTRY_CACHE_PATH, TypeRegistry } from '../../src/core/registry';
import { FakeVault } from '../support/fake-vault';

const WORK_ID = '01J8Z6M4K2Q7V9X3N5B0C1D2WA';
const BOOK_ID = '01J8Z6M4K2Q7V9X3N5B0C1D2EK';

const propertyNote = (id: string, key: string, label: string): string =>
	[
		'---',
		`id: ${id}`,
		'type: property',
		`title: ${key}`,
		'created_at: 2026-10-24T10:00',
		'updated_at: 2026-10-24T10:00',
		`key: ${key}`,
		`label: ${label}`,
		'value_type: text',
		'cardinality: 0..1',
		'required: false',
		'scope: specific',
		'---',
		'',
	].join('\n');

describe('type-registry — загрузка определений из Metamodel/', () => {
	let vault: FakeVault;

	beforeEach(async () => {
		vault = await FakeVault.create();
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	it('индексирует типы, созданные сервисом: key/id/prefix, абстрактность, наследование', async () => {
		const work = await createObjectTypeDefinition(vault, await TypeRegistry.load(vault), {
			typeKey: 'work',
			label: 'Произведение',
			typePrefix: 'WORK',
			abstract: true,
		});
		let registry = await TypeRegistry.load(vault);
		await createObjectTypeDefinition(vault, registry, {
			typeKey: 'book',
			label: 'Книга',
			typePrefix: 'BOOK',
			parentTypeId: work.id,
			description: 'Письменное произведение',
		});
		registry = await TypeRegistry.load(vault);

		expect(registry.types).toHaveLength(2);
		const book = registry.getType('book');
		expect(book).not.toBeNull();
		expect(book?.typePrefix).toBe('BOOK');
		expect(book?.abstract).toBe(false);
		expect(book?.parentId).toBe(work.id);
		expect(registry.getTypeByPrefix('BOOK')?.typeKey).toBe('book');
		expect(registry.getTypeById(work.id)?.typeKey).toBe('work');

		// цепочка предков
		expect(registry.ancestorsOf('book').map((def) => def.typeKey)).toEqual(['work']);
		// абстрактные не инстанцируемы
		expect(registry.instantiableTypes().map((def) => def.typeKey)).toEqual(['book']);
	});

	it('определения лежат в Metamodel/ObjectTypes/{OBJECT_TYPE-ULID}.md (DL-029; префикс — из таблицы SYSTEM_TYPE_PREFIXES, F5-7)', async () => {
		const result = await createObjectTypeDefinition(vault, await TypeRegistry.load(vault), {
			typeKey: 'note',
			label: 'Заметка',
			typePrefix: 'NOTE',
		});
		expect(result.path).toBe(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${result.id}.md`);
		expect(await vault.exists(result.path)).toBe(true);
	});

	it('индексирует определения свойств по key (несколько определений с одним key — список)', async () => {
		await vault.put(`${METAMODEL_SUBFOLDERS.properties}/PROPERTY-${BOOK_ID}.md`, propertyNote(BOOK_ID, 'author', 'Автор'));
		await vault.put(
			`${METAMODEL_SUBFOLDERS.properties}/PROPERTY-01J8Z6M4K2Q7V9X3N5B0C1D2PB.md`,
			propertyNote('01J8Z6M4K2Q7V9X3N5B0C1D2PB', 'author', 'Автор (копия)'),
		);
		const registry = await TypeRegistry.load(vault);
		expect(registry.properties).toHaveLength(2);
		expect(registry.getPropertiesByKey('author')).toHaveLength(2);
		expect(registry.getPropertiesByKey('author')[0].label).toBe('Автор');
		expect(registry.getPropertiesByKey('нет-такого')).toEqual([]);
	});

	it('битый frontmatter: определение НЕ применяется, issue записана, остальные работают (ADR-002)', async () => {
		await vault.put(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-broken.md`, '---\ntype_key: [незакрытая\n x: : :\n---\n');
		await createObjectTypeDefinition(vault, await TypeRegistry.load(vault), {
			typeKey: 'book',
			label: 'Книга',
			typePrefix: 'BOOK',
		});
		const registry = await TypeRegistry.load(vault);
		expect(registry.getType('book')).not.toBeNull();
		expect(registry.issues.some((issue) => issue.code === 'frontmatter_broken')).toBe(true);
	});

	it('неполное определение (нет type_key/abstract) не применяется, issue — missing_required_field', async () => {
		await vault.put(
			`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-incomplete.md`,
			['---', `id: ${BOOK_ID}`, 'type: object_type', 'title: Book', 'label: Книга', 'type_prefix: BOOK', '---', ''].join('\n'),
		);
		const registry = await TypeRegistry.load(vault);
		expect(registry.types).toHaveLength(0);
		const issue = registry.issues.find((i) => i.code === 'missing_required_field');
		expect(issue?.message).toContain('type_key');
	});

	it('висячий parent_type: тип индексируется, issue — dangling_parent (примеры иллюстративны, DL-019)', async () => {
		await vault.put(
			`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-book.md`,
			[
				'---',
				`id: ${BOOK_ID}`,
				'type: object_type',
				'title: Book',
				`type_key: book`,
				'label: Книга',
				'type_prefix: BOOK',
				'abstract: false',
				'parent_type:',
				`  - "[[OBJECT_TYPE-${WORK_ID}.md|Произведение]]"`,
				'---',
				'',
			].join('\n'),
		);
		const registry = await TypeRegistry.load(vault);
		expect(registry.getType('book')?.parentId).toBe(WORK_ID);
		expect(registry.issues.some((issue) => issue.code === 'dangling_parent')).toBe(true);
		expect(registry.ancestorsOf('book')).toEqual([]); // предок не найден — цепочка пуста, но не падает
	});

	it('дубль type_key: применено первое определение, issue — id_conflict', async () => {
		await createObjectTypeDefinition(vault, await TypeRegistry.load(vault), {
			typeKey: 'book',
			label: 'Книга',
			typePrefix: 'BOOK',
		});
		// Заметка-дубль: все обязательные поля на месте, но type_key уже занят.
		// Имя 'OBJECT_TYPE-dup.md' сортируется ПОСЛЕ сервисного 'OBJECT_TYPE-01J…',
		// поэтому первым будет применено определение, созданное сервисом.
		await vault.put(
			`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-dup.md`,
			[
				'---',
				`id: ${WORK_ID}`,
				'type: object_type',
				'title: Book 2',
				'type_key: book',
				'label: Книга (дубль)',
				'type_prefix: BOOKDUP',
				'abstract: false',
				'---',
				'',
			].join('\n'),
		);
		const registry = await TypeRegistry.load(vault);
		expect(registry.getType('book')?.label).toBe('Книга');
		expect(registry.issues.some((issue) => issue.code === 'id_conflict')).toBe(true);
	});

	it('заметки вне Metamodel/ реестром не читаются (граница DL-029)', async () => {
		await vault.put(`Books/BOOK-${BOOK_ID}.md`, propertyNote(BOOK_ID, 'author', 'Автор'));
		const registry = await TypeRegistry.load(vault);
		expect(registry.properties).toHaveLength(0);
	});
});

describe('type-registry — кэш .sb/cache/registry.json (М5: кэш не источник истины)', () => {
	let vault: FakeVault;

	beforeEach(async () => {
		vault = await FakeVault.create();
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	it('saveCache → loadCache: снимок совпадает', async () => {
		await createObjectTypeDefinition(vault, await TypeRegistry.load(vault), {
			typeKey: 'book',
			label: 'Книга',
			typePrefix: 'BOOK',
		});
		const registry = await TypeRegistry.load(vault);
		await registry.saveCache(vault, '2026-10-24T12:00:00Z');
		expect(await vault.dataExists(REGISTRY_CACHE_PATH)).toBe(true);

		const snapshot = await TypeRegistry.loadCache(vault);
		expect(snapshot).not.toBeNull();
		expect(snapshot?.types.map((def) => def.typeKey)).toEqual(['book']);
		expect(snapshot?.builtAt).toBe('2026-10-24T12:00:00Z');
	});

	it('повреждённый кэш игнорируется (null), а не роняет загрузку', async () => {
		await vault.dataWrite(REGISTRY_CACHE_PATH, '{ это не json');
		expect(await TypeRegistry.loadCache(vault)).toBeNull();
	});

	it('отсутствие кэша — не ошибка', async () => {
		expect(await TypeRegistry.loadCache(vault)).toBeNull();
	});
});

describe('label-resolver (ADR-003: view — подписи, source — ключи)', () => {
	let vault: FakeVault;

	beforeEach(async () => {
		vault = await FakeVault.create();
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	it('режимы и резервное поведение (нет label → показываем ключ, а не пустоту)', async () => {
		await createObjectTypeDefinition(vault, await TypeRegistry.load(vault), {
			typeKey: 'book',
			label: 'Книга',
			typePrefix: 'BOOK',
		});
		await vault.put(`${METAMODEL_SUBFOLDERS.properties}/PROPERTY-a.md`, propertyNote(BOOK_ID, 'author', 'Автор'));
		const registry = await TypeRegistry.load(vault);
		const labels = new LabelResolver(registry);

		expect(labels.mode).toBe('view');
		expect(labels.forTypeKey('book')).toBe('Книга');
		expect(labels.forPropertyKey('author')).toBe('Автор');
		expect(labels.forPropertyKey('unknown_key')).toBe('unknown_key'); // резерв: ключ, не пустота

		expect(labels.toggle()).toBe('source');
		expect(labels.forTypeKey('book')).toBe('book');
		expect(labels.forPropertyKey('author')).toBe('author');

		labels.setMode('view');
		expect(labels.forTypeKey('nosuchtype')).toBe('nosuchtype');
	});
});

describe('type-registry — привязка свойств к типам (F5-8 = А, DL-250/252)', () => {
	let vault: FakeVault;

	beforeEach(async () => {
		vault = await FakeVault.create();
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	const WORK_DEF_ID = '01J8Z6M4K2Q7V9X3N5B0C1D2WA';
	const BOOK_DEF_ID = '01J8Z6M4K2Q7V9X3N5B0C1D2EK';
	const PERSON_DEF_ID = '01J8Z6M4K2Q7V9X3N5B0C1D2EP';

	const typeNote = (id: string, key: string, label: string, prefix: string, isAbstract: boolean, parentId?: string): string =>
		[
			'---',
			`id: ${id}`,
			'type: object_type',
			`title: ${key}`,
			`type_key: ${key}`,
			`label: ${label}`,
			`type_prefix: ${prefix}`,
			`abstract: ${isAbstract}`,
			...(parentId ? [`parent_type:\n  - "[[OBJECT_TYPE-${parentId}.md|Родитель]]"`] : []),
			'---',
			'',
		].join('\n');

	const propNote = (id: string, key: string, scope: string, objectTypes?: string[]): string =>
		[
			'---',
			`id: ${id}`,
			'type: property',
			`title: ${key}`,
			`key: ${key}`,
			`label: ${key} (подпись)`,
			'value_type: text',
			'cardinality: 0..1',
			'required: false',
			`scope: ${scope}`,
			...(objectTypes ? ['object_types:', ...objectTypes.map((link) => `  - "${link}"`)] : []),
			'---',
			'',
		].join('\n');

	async function seed(): Promise<TypeRegistry> {
		await vault.put(`${METAMODEL_SUBFOLDERS.objectTypes}/work.md`, typeNote(WORK_DEF_ID, 'work', 'Произведение', 'WORK', true));
		await vault.put(`${METAMODEL_SUBFOLDERS.objectTypes}/book.md`, typeNote(BOOK_DEF_ID, 'book', 'Книга', 'BOOK', false, WORK_DEF_ID));
		await vault.put(`${METAMODEL_SUBFOLDERS.objectTypes}/person.md`, typeNote(PERSON_DEF_ID, 'person', 'Человек', 'PERSON', false));
		// universal без привязки — для всех
		await vault.put(`${METAMODEL_SUBFOLDERS.properties}/p-desc.md`, propNote('01J8Z6M4K2Q7V9X3N5B0C1D2P1', 'description', 'universal'));
		// specific — только book
		await vault.put(
			`${METAMODEL_SUBFOLDERS.properties}/p-platform.md`,
			propNote('01J8Z6M4K2Q7V9X3N5B0C1D2P2', 'platform', 'specific', [`[[OBJECT_TYPE-${BOOK_DEF_ID}.md|Книга]]`]),
		);
		// family — ссылка на абстрактного предка work: покрывает всех потомков (DL-208)
		await vault.put(
			`${METAMODEL_SUBFOLDERS.properties}/p-subtitle.md`,
			propNote('01J8Z6M4K2Q7V9X3N5B0C1D2P3', 'subtitle', 'family', [`[[OBJECT_TYPE-${WORK_DEF_ID}.md|Произведение]]`]),
		);
		// specific — только person
		await vault.put(
			`${METAMODEL_SUBFOLDERS.properties}/p-birth.md`,
			propNote('01J8Z6M4K2Q7V9X3N5B0C1D2P4', 'birth_date', 'specific', [`[[OBJECT_TYPE-${PERSON_DEF_ID}.md|Человек]]`]),
		);
		return TypeRegistry.load(vault);
	}

	it('object_types извлекаются как ULID определений', async () => {
		const registry = await seed();
		const platform = registry.getPropertiesByKey('platform')[0];
		expect(platform.objectTypes).toEqual([BOOK_DEF_ID]);
		const description = registry.getPropertiesByKey('description')[0];
		expect(description.objectTypes).toEqual([]);
	});

	it('getPropertiesForType: universal — всем; specific — только своему; family — потомкам предка', async () => {
		const registry = await seed();
		const forBook = registry.getPropertiesForType('book').map((def) => def.key).sort();
		expect(forBook).toEqual(['description', 'platform', 'subtitle']);
		const forPerson = registry.getPropertiesForType('person').map((def) => def.key).sort();
		expect(forPerson).toEqual(['birth_date', 'description']);
	});

	it('getPropertiesForType для неизвестного типа — пустой список (не исключение)', async () => {
		const registry = await seed();
		expect(registry.getPropertiesForType('nosuchtype')).toEqual([]);
	});

	it('LabelResolver с typeKey берёт подпись из типобластного набора (F5-8)', async () => {
		const registry = await seed();
		const labels = new LabelResolver(registry);
		expect(labels.forPropertyKey('platform', 'book')).toBe('platform (подпись)');
		// у person свойства platform нет — резервный поиск по ключу (первое определение)
		expect(labels.forPropertyKey('platform', 'person')).toBe('platform (подпись)');
		// неизвестный ключ — сам ключ
		expect(labels.forPropertyKey('unknown', 'book')).toBe('unknown');
	});
});
