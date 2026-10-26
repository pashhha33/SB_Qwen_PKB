/**
 * Тесты правил группы E реестра (B1.3 часть 2, DL-278/279): определения классификации
 * и назначения категорий объекту. Норма — `docs/validation/rules.md` §E (19 правил;
 * 4 `object_type.*` реализованы в B1.1 часть 2, остальные 15 — здесь).
 *
 * Что закрепляют:
 *   1. каждое правило группы E срабатывает на своём нарушении (id, severity, level);
 *   2. приоритет специального правила над общим (rules.md «Перекрывающиеся правила»):
 *      на полях классификации НЕ дублируются `value.cardinality`,
 *      `value.reference.exists`, `value.reference.target_type`;
 *   3. `facet.genre.required_for_book` (error, 4) важнее общего `assignment.cardinality`;
 *   4. `in_category` учитывает предков категории (граница B1.1-4 снята).
 *
 * Хранилище ОДНО на файл (beforeAll): установка базовой библиотеки — ~140 заметок,
 * и её повтор в каждом тесте на медленном диске (Windows + антивирус) упирался в лимит
 * 20 с (инцидент переноса 2026-10-26 — урок DL-255/259/281). Тесты независимы от
 * порядка: у каждого свои ULID, а требования к корням проверяются на СОБСТВЕННОМ
 * фасете теста (не на семенном «Жанре», в который другие тесты добавляют категории).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isPropertyVisible } from '../../src/core/applies-when';
import { bootstrapMetamodel } from '../../src/core/bootstrap';
import { loadClassification, type ClassificationSnapshot } from '../../src/core/classification';
import type { SbDiagnostic } from '../../src/core/diagnostics';
import { LabelResolver } from '../../src/core/label-resolver';
import type { SbNote } from '../../src/core/model';
import { METAMODEL_SUBFOLDERS, type PropertyDef, TypeRegistry } from '../../src/core/registry';
import { buildVaultIndex } from '../../src/core/schema-engine';
import { installBaseLibrary } from '../../src/core/seed-library';
import { SEED_ULIDS } from '../../src/core/seeds/seed-ulids';
import { validateObject } from '../../src/core/validation';
import { link, putNote, uid } from '../support/classification-fixtures';
import { FakeVault } from '../support/fake-vault';

const GENRE = SEED_ULIDS['system-facet/genre'];
const FORM = SEED_ULIDS['system-facet/literary_form'];
const BOOK_TYPE = SEED_ULIDS['system-type/book'];

/** Запас времени на медленных дисках (урок DL-259/281). */
const TIMEOUT = 120_000;

interface Harness {
	vault: FakeVault;
	registry: TypeRegistry;
	labels: LabelResolver;
	check(path: string, snapshot?: ClassificationSnapshot): Promise<SbDiagnostic[]>;
	ruleIds(path: string, snapshot?: ClassificationSnapshot): Promise<string[]>;
}

let h: Harness;

beforeAll(async () => {
	const vault = await FakeVault.create();
	await bootstrapMetamodel(vault);
	await installBaseLibrary(vault, await TypeRegistry.load(vault));
	const registry = await TypeRegistry.load(vault);
	const labels = new LabelResolver(registry);
	h = {
		vault,
		registry,
		labels,
		// Индекс имён (без чтения frontmatter) и снимок классификации строятся на
		// каждый вызов: они дёшевы (listMarkdown + только заметки классификации) и
		// всегда свежи — тесты добавляют заметки в общее хранилище.
		check: async (path: string, snapshot?: ClassificationSnapshot): Promise<SbDiagnostic[]> => {
			const [index, classification] = await Promise.all([
				buildVaultIndex(vault),
				snapshot ?? loadClassification(vault),
			]);
			const result = await validateObject(vault, registry, labels, path, undefined, false, index, { classification });
			return result.diagnostics;
		},
		ruleIds: async (path: string, snapshot?: ClassificationSnapshot) =>
			(await h.check(path, snapshot)).map((d) => d.rule_id),
	};
}, TIMEOUT);

afterAll(async () => {
	await h.vault.cleanup();
});

/** Категория в произвольном фасете. */
async function putCategory(n: number, title: string, facetId: string, parentIds: string[] = [], facetTitle = 'Genre'): Promise<string> {
	return putNote(h.vault, {
		id: uid(n),
		type: 'category',
		title,
		folder: METAMODEL_SUBFOLDERS.categories,
		prefix: 'CATEGORY',
		fields: {
			facet: [link('FACET', facetId, facetTitle)],
			parent: parentIds.map((id) => link('CATEGORY', id, 'родитель')),
		},
	});
}

/** Книга с назначениями (прочие обязательные поля заполнены, чтобы не шуметь). */
async function putBook(n: number, categoryIds: string[], title = 'Книга'): Promise<string> {
	return putNote(h.vault, {
		id: uid(n),
		type: 'book',
		title,
		folder: 'Books',
		prefix: 'BOOK',
		fields: {
			format: 'file',
			read_status: 'planned',
			author: link('PERSON', uid(900), 'Автор'),
			categories: categoryIds.map((id) => link('CATEGORY', id, 'категория')),
		},
	});
}

describe('группа E — определения категории', { timeout: TIMEOUT }, () => {
	it('category.facet.required (error, 2): нет фасета; общий value.cardinality подавлен', async () => {
		const path = await putNote(h.vault, {
			id: uid(101), type: 'category', title: 'Без фасета', folder: METAMODEL_SUBFOLDERS.categories, prefix: 'CATEGORY', fields: { parent: [] },
		});
		const diagnostics = await h.check(path);
		const rule = diagnostics.find((d) => d.rule_id === 'category.facet.required');
		expect(rule?.severity).toBe('error');
		expect(rule?.level).toBe(2);
		expect(diagnostics.map((d) => d.rule_id)).not.toContain('value.cardinality');
	});

	it('category.facet.single (error, 4): два фасета', async () => {
		const path = await putNote(h.vault, {
			id: uid(102), type: 'category', title: 'Два фасета', folder: METAMODEL_SUBFOLDERS.categories, prefix: 'CATEGORY',
			fields: { facet: [link('FACET', GENRE, 'Genre'), link('FACET', FORM, 'Literary form')], parent: [] },
		});
		const diagnostics = await h.check(path);
		expect(diagnostics.find((d) => d.rule_id === 'category.facet.single')?.level).toBe(4);
	});

	it('category.taxonomy_direct.forbidden (error, 4): правило П8 (ADR-007)', async () => {
		const path = await putNote(h.vault, {
			id: uid(103), type: 'category', title: 'С таксономией', folder: METAMODEL_SUBFOLDERS.categories, prefix: 'CATEGORY',
			fields: { facet: [link('FACET', GENRE, 'Genre')], taxonomy: [link('TAXONOMY', uid(104), 'Таксономия')], parent: [] },
		});
		const rule = (await h.check(path)).find((d) => d.rule_id === 'category.taxonomy_direct.forbidden');
		expect(rule?.severity).toBe('error');
		expect(rule?.hint).toContain('через свой фасет');
	});

	it('category.parent.exists (error, 3): родителя нет; общий value.reference.exists подавлен', async () => {
		const path = await putNote(h.vault, {
			id: uid(105), type: 'category', title: 'Сирота', folder: METAMODEL_SUBFOLDERS.categories, prefix: 'CATEGORY',
			fields: { facet: [link('FACET', GENRE, 'Genre')], parent: [link('CATEGORY', uid(999), 'Нет такой')] },
		});
		const diagnostics = await h.check(path);
		expect(diagnostics.find((d) => d.rule_id === 'category.parent.exists')?.level).toBe(3);
		expect(diagnostics.map((d) => d.rule_id)).not.toContain('value.reference.exists');
	});

	it('category.parent.same_facet (error, 4): родитель из другого фасета', async () => {
		await putCategory(106, 'Роман', FORM, [], 'Literary form');
		const path = await putCategory(107, 'Космическая опера', GENRE, [uid(106)]);
		expect(await h.ruleIds(path)).toContain('category.parent.same_facet');
	});

	it('category.parent.strict_mode (error, 4): два родителя в строгом фасете', async () => {
		await putCategory(108, 'Фантастика', GENRE);
		await putCategory(109, 'Детектив', GENRE);
		const path = await putCategory(110, 'Фантастический детектив', GENRE, [uid(108), uid(109)]);
		expect(await h.ruleIds(path)).toContain('category.parent.strict_mode');
	});

	it('полиерархический фасет: два родителя — норма (strict_mode не срабатывает)', async () => {
		await putNote(h.vault, {
			id: uid(111), type: 'facet', title: 'Mood', folder: METAMODEL_SUBFOLDERS.facets, prefix: 'FACET',
			label: 'Настроение', fields: { taxonomy: [], hierarchy_mode: 'polyhierarchical', assignment_cardinality: '0..N' },
		});
		await putCategory(112, 'Мрачное', uid(111), [], 'Mood');
		await putCategory(113, 'Светлое', uid(111), [], 'Mood');
		const path = await putCategory(114, 'Смешанное', uid(111), [uid(112), uid(113)], 'Mood');
		expect(await h.ruleIds(path)).not.toContain('category.parent.strict_mode');
	});

	it('category.parent.no_cycle (error, 3): цикл в цепочке родителей', async () => {
		await putCategory(115, 'A', GENRE, [uid(116)]);
		const pathB = await putCategory(116, 'B', GENRE, [uid(115)]);
		expect(await h.ruleIds(pathB)).toContain('category.parent.no_cycle');
	});
});

describe('группа E — определения фасета и таксономии', { timeout: TIMEOUT }, () => {
	it('facet.taxonomy.exists (error, 3): таксономии нет; общий value.reference.exists подавлен', async () => {
		const path = await putNote(h.vault, {
			id: uid(120), type: 'facet', title: 'Theme', folder: METAMODEL_SUBFOLDERS.facets, prefix: 'FACET',
			fields: { taxonomy: [link('TAXONOMY', uid(121), 'Нет такой')] },
		});
		const diagnostics = await h.check(path);
		expect(diagnostics.find((d) => d.rule_id === 'facet.taxonomy.exists')?.level).toBe(3);
		expect(diagnostics.map((d) => d.rule_id)).not.toContain('value.reference.exists');
	});

	it('facet.allowed_types.conflict (warning, 4): область фасета шире области таксономии', async () => {
		await putNote(h.vault, {
			id: uid(122), type: 'taxonomy', title: 'Книжная', folder: METAMODEL_SUBFOLDERS.taxonomies, prefix: 'TAXONOMY',
			fields: { facets: [link('FACET', uid(123), 'Theme')], allowed_object_types: [link('OBJECT_TYPE', BOOK_TYPE, 'Книга')] },
		});
		const path = await putNote(h.vault, {
			id: uid(123), type: 'facet', title: 'Theme', folder: METAMODEL_SUBFOLDERS.facets, prefix: 'FACET',
			fields: {
				taxonomy: [link('TAXONOMY', uid(122), 'Книжная')],
				allowed_object_types: [link('OBJECT_TYPE', BOOK_TYPE, 'Книга'), link('OBJECT_TYPE', SEED_ULIDS['system-type/person'], 'Человек')],
			},
		});
		const rule = (await h.check(path)).find((d) => d.rule_id === 'facet.allowed_types.conflict');
		expect(rule?.severity).toBe('warning');
		expect(rule?.message).toContain('Человек');
	});

	it('facet.root_requirement (warning, 4): нет корневых категорий — warning, появилась — уходит', async () => {
		// Собственный фасет теста: семенный «Жанр» трогать нельзя — в общее хранилище
		// другие тесты добавляют категории, и ожидание «0 корней» стало бы хрупким.
		const facetPath = await putNote(h.vault, {
			id: uid(126), type: 'facet', title: 'Epoch', folder: METAMODEL_SUBFOLDERS.facets, prefix: 'FACET',
			label: 'Эпоха', fields: { taxonomy: [], root_requirement_min: 1 },
		});
		const rule = (await h.check(facetPath)).find((d) => d.rule_id === 'facet.root_requirement');
		expect(rule?.severity).toBe('warning');
		expect(rule?.message).toContain('корневых категорий: 0');
		expect(rule?.hint).toContain('Создайте корневые категории');

		await putCategory(127, 'Античность', uid(126), [], 'Epoch');
		expect(await h.ruleIds(facetPath)).not.toContain('facet.root_requirement');
	});

	it('facet.root_requirement (warning, 4): корней больше максимума', async () => {
		const facetPath = await putNote(h.vault, {
			id: uid(128), type: 'facet', title: 'Era', folder: METAMODEL_SUBFOLDERS.facets, prefix: 'FACET',
			label: 'Эра', fields: { taxonomy: [], root_requirement_max: 1 },
		});
		await putCategory(129, 'Первая', uid(128), [], 'Era');
		expect(await h.ruleIds(facetPath)).not.toContain('facet.root_requirement');
		await putCategory(130, 'Вторая', uid(128), [], 'Era');
		const rule = (await h.check(facetPath)).find((d) => d.rule_id === 'facet.root_requirement');
		expect(rule?.severity).toBe('warning');
		expect(rule?.property_key).toBe('root_requirement_max');
	});

	it('taxonomy.facets.min_one (error, 2): пустой список фасетов; общий value.cardinality подавлен', async () => {
		const path = await putNote(h.vault, {
			id: uid(125), type: 'taxonomy', title: 'Пустая', folder: METAMODEL_SUBFOLDERS.taxonomies, prefix: 'TAXONOMY', fields: { facets: [] },
		});
		const diagnostics = await h.check(path);
		expect(diagnostics.find((d) => d.rule_id === 'taxonomy.facets.min_one')?.level).toBe(2);
		expect(diagnostics.map((d) => d.rule_id)).not.toContain('value.cardinality');
	});
});

describe('группа E — назначения категорий объекту', { timeout: TIMEOUT }, () => {
	it('facet.genre.required_for_book (error, 4): книга без жанра; общий assignment.cardinality не дублирует', async () => {
		const path = await putBook(131, []);
		const diagnostics = await h.check(path);
		const rule = diagnostics.find((d) => d.rule_id === 'facet.genre.required_for_book');
		expect(rule?.severity).toBe('error');
		expect(rule?.level).toBe(4);
		expect(rule?.hint).toContain('assign-category');
		expect(diagnostics.map((d) => d.rule_id)).not.toContain('assignment.cardinality');
	});

	it('жанр назначен — правила нет; назначение потомком считается (предки раскрываются)', async () => {
		await putCategory(132, 'Фантастика', GENRE);
		await putCategory(133, 'Космическая опера', GENRE, [uid(132)]);
		const path = await putBook(134, [uid(133)]);
		expect(await h.ruleIds(path)).not.toContain('facet.genre.required_for_book');
	});

	it('assignment.type_allowed (error, 4): жанр назначен человеку (область фасета — книги)', async () => {
		await putCategory(135, 'Фантастика человека', GENRE);
		const path = await putNote(h.vault, {
			id: uid(136), type: 'person', title: 'Человек', folder: 'People', prefix: 'PERSON',
			fields: { role: ['author'], categories: [link('CATEGORY', uid(135), 'Фантастика человека')] },
		});
		const rule = (await h.check(path)).find((d) => d.rule_id === 'assignment.type_allowed');
		expect(rule?.severity).toBe('error');
		expect(rule?.message).toContain('Жанр');
	});

	it('assignment.cardinality: «1» и две категории — error; «0..1» и две — warning', async () => {
		const exactlyPath = await putNote(h.vault, {
			id: uid(137), type: 'facet', title: 'Main language', folder: METAMODEL_SUBFOLDERS.facets, prefix: 'FACET',
			label: 'Основной язык', fields: { taxonomy: [], assignment_cardinality: '1' },
		});
		const optionalPath = await putNote(h.vault, {
			id: uid(138), type: 'facet', title: 'Mood', folder: METAMODEL_SUBFOLDERS.facets, prefix: 'FACET',
			label: 'Настроение', fields: { taxonomy: [], assignment_cardinality: '0..1' },
		});
		await putCategory(139, 'Первая', uid(137), [], 'Main language');
		await putCategory(140, 'Вторая', uid(137), [], 'Main language');
		await putCategory(141, 'Мрачное', uid(138), [], 'Mood');
		await putCategory(142, 'Светлое', uid(138), [], 'Mood');

		const bookStrict = await putNote(h.vault, {
			id: uid(143), type: 'book', title: 'Книга 1', folder: 'Books', prefix: 'BOOK',
			fields: { format: 'file', read_status: 'planned', categories: [link('CATEGORY', uid(139), 'Первая'), link('CATEGORY', uid(140), 'Вторая')] },
		});
		const bookSoft = await putNote(h.vault, {
			id: uid(144), type: 'book', title: 'Книга 2', folder: 'Books', prefix: 'BOOK',
			fields: { format: 'file', read_status: 'planned', categories: [link('CATEGORY', uid(141), 'Мрачное'), link('CATEGORY', uid(142), 'Светлое')] },
		});
		const strict = (await h.check(bookStrict)).filter((d) => d.rule_id === 'assignment.cardinality');
		expect(strict.length).toBe(1);
		expect(strict[0].severity).toBe('error');
		const soft = (await h.check(bookSoft)).filter((d) => d.rule_id === 'assignment.cardinality');
		expect(soft.length).toBe(1);
		expect(soft[0].severity).toBe('warning');
		expect(await h.vault.read(exactlyPath)).toContain('assignment_cardinality: "1"');
		expect(await h.vault.read(optionalPath)).toContain('assignment_cardinality: "0..1"');
	});

	it('value.reference.exists (error, 3): назначена несуществующая категория', async () => {
		const path = await putBook(145, [uid(999)]);
		const rule = (await h.check(path)).find((d) => d.rule_id === 'value.reference.exists' && d.property_key === 'categories');
		expect(rule?.severity).toBe('error');
		expect(rule?.level).toBe(3);
	});

	it('facet.genre.not_form (warning, 4): одно название в жанре и в форме (граница DL-126)', async () => {
		await putCategory(146, 'Фантастика NF', GENRE);
		await putCategory(147, 'фантастика nf', FORM, [], 'Literary form');
		const path = await putBook(148, [uid(146), uid(147)]);
		const rule = (await h.check(path)).find((d) => d.rule_id === 'facet.genre.not_form');
		expect(rule?.severity).toBe('warning');
		expect(rule?.message).toContain('одновременно как жанр и как литературная форма');
	});

	it('разные названия в жанре и форме — предупреждения нет', async () => {
		await putCategory(149, 'Фантастика OK', GENRE);
		await putCategory(150, 'Роман', FORM, [], 'Literary form');
		const path = await putBook(151, [uid(149), uid(150)]);
		expect(await h.ruleIds(path)).not.toContain('facet.genre.not_form');
	});
});

describe('applies-when — in_category с предками (граница B1.1-4 снята)', { timeout: TIMEOUT }, () => {
	it('назначен потомок — условие по предку истинно; без снимка — только прямое назначение', async () => {
		await putCategory(152, 'Исторический роман', GENRE);
		await putCategory(153, 'Историческая проза', GENRE, [uid(152)]);
		const snapshot = await loadClassification(h.vault);
		const def = {
			key: 'theme_notes',
			appliesWhen: { property: 'categories', operation: 'in_category', value: [uid(152)] },
		} as unknown as PropertyDef;
		const note = { system: { categories: [link('CATEGORY', uid(153), 'Историческая проза').slice(1, -1)] }, properties: {} } as unknown as SbNote;
		expect(isPropertyVisible(def, note, snapshot)).toBe(true);
		expect(isPropertyVisible(def, note, null)).toBe(false); // прежнее поведение — безопасный отказ
		expect(isPropertyVisible(def, note)).toBe(false);
	});
});
