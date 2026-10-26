/**
 * Тесты classification-service (B1.3 часть 2, DL-278): снимок классификации,
 * наследование умолчаний, предки категории, поиск системного фасета, кэш.
 *
 * Нормы: ADR-005 (три уровня), ADR-007 (фасет независим, П8),
 * `01-classification.md` §2.1–§2.4 (наследование «фасет → таксономия → таблица»),
 * ADR-002 (кэш — производные данные).
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
	ancestorsOfCategory,
	assignmentsByFacet,
	buildClassificationFromNotes,
	categoriesOfFacet,
	classificationName,
	CLASSIFICATION_CACHE_PATH,
	effectiveSettings,
	expandWithAncestors,
	findSystemFacet,
	isClassificationPath,
	loadClassification,
	loadClassificationCache,
	rootCategoriesOfFacet,
	saveClassificationCache,
} from '../../src/core/classification';
import { bootstrapMetamodel } from '../../src/core/bootstrap';
import { parseNote } from '../../src/core/markdown-parser';
import { METAMODEL_SUBFOLDERS, TypeRegistry } from '../../src/core/registry';
import { installBaseLibrary } from '../../src/core/seed-library';
import { SEED_ULIDS } from '../../src/core/seeds/seed-ulids';
import { FakeVault } from '../support/fake-vault';

const vaults: FakeVault[] = [];

import { link, putNote, uid } from '../support/classification-fixtures';

async function setup(): Promise<{ vault: FakeVault; registry: TypeRegistry }> {
	const vault = await FakeVault.create();
	vaults.push(vault);
	await bootstrapMetamodel(vault);
	const bootstrapRegistry = await TypeRegistry.load(vault);
	await installBaseLibrary(vault, bootstrapRegistry);
	const registry = await TypeRegistry.load(vault);
	return { vault, registry };
}

afterEach(async () => {
	while (vaults.length > 0) {
		await vaults.pop()!.cleanup();
	}
});

describe('classification-service — снимок и область чтения', () => {
	it('читает определения из Metamodel/ (таксономии, фасеты, категории) и узнаёт канонические имена вне папок', async () => {
		const { vault } = await setup();
		await putNote(vault, {
			id: uid(1), type: 'taxonomy', title: 'Классификация книг', folder: METAMODEL_SUBFOLDERS.taxonomies, prefix: 'TAXONOMY',
			label: 'Классификация книг', fields: { facets: [link('FACET', SEED_ULIDS['system-facet/genre'], 'Genre')] },
		});
		await putNote(vault, {
			id: uid(2), type: 'category', title: 'Science fiction', folder: METAMODEL_SUBFOLDERS.categories, prefix: 'CATEGORY',
			label: 'Научная фантастика', fields: { facet: [link('FACET', SEED_ULIDS['system-facet/genre'], 'Genre')], parent: [] },
		});
		// каноническое имя вне Metamodel/ тоже входит в область (isClassificationPath)
		expect(isClassificationPath(`Книги/CATEGORY-${uid(2)}.md`)).toBe(true);
		expect(isClassificationPath('Дневник/2026-10-26.md')).toBe(false);

		const snapshot = await loadClassification(vault);
		expect(snapshot.taxonomies.length).toBe(1);
		expect(snapshot.facets.length).toBe(5); // семенные фасеты библиотеки
		expect(snapshot.categories.length).toBe(1);
		expect(snapshot.categoryById.get(uid(2))?.label).toBe('Научная фантастика');
		expect(classificationName(snapshot.categoryById.get(uid(2))!)).toBe('Научная фантастика');
		expect(snapshot.issues).toEqual([]);
	});

	it('РЕГРЕССИЯ (урок DL-255/259/281): снимок читает ТОЛЬКО заметки классификации, а не всю Metamodel/', async () => {
		const { vault } = await setup();
		const all = await vault.listMarkdown();
		const classificationPaths = all.filter(isClassificationPath);
		expect(classificationPaths.length).toBe(5); // 5 семенных фасетов, категорий и таксономий нет
		expect(all.length).toBeGreaterThan(140); // бутстрап + базовая библиотека
		let reads = 0;
		const original = vault.read.bind(vault);
		(vault as { read: (p: string) => Promise<string> }).read = async (p: string) => {
			reads += 1;
			return original(p);
		};
		const snapshot = await loadClassification(vault);
		expect(reads).toBe(classificationPaths.length);
		expect(snapshot.facets.length).toBe(5);
	});

	it('битый frontmatter — не катастрофа: снимок строится, проблема видна в issues (ADR-002)', async () => {
		const { vault } = await setup();
		await vault.put(`${METAMODEL_SUBFOLDERS.categories}/CATEGORY-${uid(3)}.md`, ['---', 'id: [', 'type: category', '---', ''].join('\n'));
		const snapshot = await loadClassification(vault);
		expect(snapshot.issues.some((issue) => issue.code === 'frontmatter_broken')).toBe(true);
		expect(snapshot.categories.length).toBe(0);
	});

	it('buildClassificationFromNotes: снимок из уже разобранных заметок (без чтения хранилища)', () => {
		const notes = [
			{ path: 'a.md', system: { id: uid(10), type: 'facet', title: 'Mood' }, properties: { label: 'Настроение' }, frontmatterBroken: false },
		];
		const snapshot = buildClassificationFromNotes(notes as never, '2026-10-26T10:00');
		expect(snapshot.facets.length).toBe(1);
		expect(snapshot.builtAt).toBe('2026-10-26T10:00');
	});
});

describe('classification-service — наследование умолчаний (фасет → таксономия → таблица §2.2)', () => {
	it('значение фасета важнее значения таксономии, оба важнее умолчания', async () => {
		const { vault } = await setup();
		await putNote(vault, {
			id: uid(20), type: 'taxonomy', title: 'Таксономия', folder: METAMODEL_SUBFOLDERS.taxonomies, prefix: 'TAXONOMY',
			fields: {
				facets: [link('FACET', uid(21), 'Фасет A'), link('FACET', uid(22), 'Фасет B')],
				allowed_object_types: [link('OBJECT_TYPE', SEED_ULIDS['system-type/book'], 'Книга')],
				hierarchy_mode: 'polyhierarchical',
				assignment_cardinality: '1..N',
				root_requirement_min: 2,
			},
		});
		// Фасет A — всё своё; Фасет B — наследует таксономию
		await putNote(vault, {
			id: uid(21), type: 'facet', title: 'Фасет A', folder: METAMODEL_SUBFOLDERS.facets, prefix: 'FACET',
			fields: {
				taxonomy: [link('TAXONOMY', uid(20), 'Таксономия')],
				hierarchy_mode: 'strict',
				assignment_cardinality: '0..1',
				root_requirement_min: 0,
			},
		});
		await putNote(vault, {
			id: uid(22), type: 'facet', title: 'Фасет B', folder: METAMODEL_SUBFOLDERS.facets, prefix: 'FACET',
			fields: { taxonomy: [link('TAXONOMY', uid(20), 'Таксономия')] },
		});
		const snapshot = await loadClassification(vault);
		const a = effectiveSettings(snapshot, snapshot.facetById.get(uid(21))!);
		expect(a.hierarchyMode).toBe('strict');
		expect(a.assignmentCardinality).toBe('0..1');
		expect(a.rootRequirementMin).toBe(0);
		expect(a.allowedObjectTypeIds).toEqual([SEED_ULIDS['system-type/book']]); // пусто на фасете → из таксономии

		const b = effectiveSettings(snapshot, snapshot.facetById.get(uid(22))!);
		expect(b.hierarchyMode).toBe('polyhierarchical');
		expect(b.assignmentCardinality).toBe('1..N');
		expect(b.rootRequirementMin).toBe(2);
	});

	it('независимый фасет без таксономии — умолчания таблицы: strict, 0..N, 0, null', async () => {
		const { vault } = await setup();
		await putNote(vault, {
			id: uid(23), type: 'facet', title: 'Mood', folder: METAMODEL_SUBFOLDERS.facets, prefix: 'FACET', fields: { taxonomy: [] },
		});
		const snapshot = await loadClassification(vault);
		const settings = effectiveSettings(snapshot, snapshot.facetById.get(uid(23))!);
		expect(settings).toEqual({
			hierarchyMode: 'strict',
			assignmentCardinality: '0..N',
			rootRequirementMin: 0,
			rootRequirementMax: null,
			allowedObjectTypeIds: [],
		});
	});
});

describe('classification-service — предки категории (транзитивное замыкание)', () => {
	it('назначен потомок — предки видны: expandWithAncestors раскрывает цепочку', async () => {
		const { vault } = await setup();
		const genre = SEED_ULIDS['system-facet/genre'];
		await putNote(vault, { id: uid(30), type: 'category', title: 'Science fiction', folder: METAMODEL_SUBFOLDERS.categories, prefix: 'CATEGORY', fields: { facet: [link('FACET', genre, 'Genre')], parent: [] } });
		await putNote(vault, { id: uid(31), type: 'category', title: 'Space opera', folder: METAMODEL_SUBFOLDERS.categories, prefix: 'CATEGORY', fields: { facet: [link('FACET', genre, 'Genre')], parent: [link('CATEGORY', uid(30), 'Science fiction')] } });
		await putNote(vault, { id: uid(32), type: 'category', title: 'Military SF', folder: METAMODEL_SUBFOLDERS.categories, prefix: 'CATEGORY', fields: { facet: [link('FACET', genre, 'Genre')], parent: [link('CATEGORY', uid(31), 'Space opera')] } });

		const snapshot = await loadClassification(vault);
		expect(ancestorsOfCategory(snapshot, uid(32)).sort()).toEqual([uid(30), uid(31)].sort());
		expect(ancestorsOfCategory(snapshot, uid(30))).toEqual([]);
		expect(expandWithAncestors(snapshot, [uid(32)]).sort()).toEqual([uid(30), uid(31), uid(32)].sort());
		expect(rootCategoriesOfFacet(snapshot, genre).map((c) => c.id)).toEqual([uid(30)]);
		expect(categoriesOfFacet(snapshot, genre).length).toBe(3);
	});

	it('цикл в родителях не зацикливает запрос (безопасный обход)', async () => {
		const { vault } = await setup();
		const genre = SEED_ULIDS['system-facet/genre'];
		await putNote(vault, { id: uid(33), type: 'category', title: 'A', folder: METAMODEL_SUBFOLDERS.categories, prefix: 'CATEGORY', fields: { facet: [link('FACET', genre, 'Genre')], parent: [link('CATEGORY', uid(34), 'B')] } });
		await putNote(vault, { id: uid(34), type: 'category', title: 'B', folder: METAMODEL_SUBFOLDERS.categories, prefix: 'CATEGORY', fields: { facet: [link('FACET', genre, 'Genre')], parent: [link('CATEGORY', uid(33), 'A')] } });
		const snapshot = await loadClassification(vault);
		// сама категория в предки не входит (seen стартует с неё) — обход обрывается безопасно
		expect(ancestorsOfCategory(snapshot, uid(33))).toEqual([uid(34)]);
	});
});

describe('classification-service — системные фасеты и назначения', () => {
	it('findSystemFacet: семенный фасет по фиксированному ULID рецепта', async () => {
		const { vault } = await setup();
		const snapshot = await loadClassification(vault);
		expect(findSystemFacet(snapshot, 'genre')?.id).toBe(SEED_ULIDS['system-facet/genre']);
		expect(findSystemFacet(snapshot, 'literary_form')?.id).toBe(SEED_ULIDS['system-facet/literary_form']);
	});

	it('findSystemFacet: пользовательский фасет «Жанр» узнаётся по title/label (конвенция DL-277)', async () => {
		const vault = await FakeVault.create();
		vaults.push(vault);
		await bootstrapMetamodel(vault);
		await putNote(vault, { id: uid(40), type: 'facet', title: 'Жанры книг', folder: METAMODEL_SUBFOLDERS.facets, prefix: 'FACET', label: 'Жанр', fields: { taxonomy: [] } });
		const snapshot = await loadClassification(vault);
		expect(findSystemFacet(snapshot, 'genre')?.id).toBe(uid(40));
		expect(findSystemFacet(snapshot, 'literary_form')).toBeNull();
	});

	it('assignmentsByFacet: wikilink-и и голые ULID, неизвестные категории не группируются', async () => {
		const { vault } = await setup();
		const genre = SEED_ULIDS['system-facet/genre'];
		await putNote(vault, { id: uid(41), type: 'category', title: 'Fantasy', folder: METAMODEL_SUBFOLDERS.categories, prefix: 'CATEGORY', fields: { facet: [link('FACET', genre, 'Genre')], parent: [] } });
		const note = parseNote(
			{
				path: 'Books/BOOK-01SBTEST000000000000000099.md',
				content: [
					'---',
					`id: ${uid(99)}`,
					'type: book',
					'title: Книга',
					'categories:',
					`  - "${'[[CATEGORY-' + uid(41) + '.md|Fantasy]]'}"`,
					`  - ${uid(41)}`,
					`  - "[[CATEGORY-${uid(500)}.md|Неизвестная]]"`,
					'  - просто текст',
					'---',
					'',
				].join('\n'),
			},
			vault,
		);
		const snapshot = await loadClassification(vault);
		const byFacet = assignmentsByFacet(snapshot, note);
		expect([...byFacet.keys()]).toEqual([genre]);
		expect(byFacet.get(genre)).toEqual([uid(41), uid(41)]); // назначение как записано (дубли видит проверка)
	});
});

describe('classification-service — кэш .sb/cache/classification.json (ADR-002)', () => {
	it('saveClassificationCache → loadClassificationCache: данные совпадают, индексы восстанавливаются', async () => {
		const { vault } = await setup();
		const genre = SEED_ULIDS['system-facet/genre'];
		await putNote(vault, { id: uid(50), type: 'category', title: 'Fantasy', folder: METAMODEL_SUBFOLDERS.categories, prefix: 'CATEGORY', fields: { facet: [link('FACET', genre, 'Genre')], parent: [] } });
		const snapshot = await loadClassification(vault, '2026-10-26T12:00');
		await saveClassificationCache(vault, snapshot);

		const cached = await loadClassificationCache(vault);
		expect(cached?.format).toBe(1);
		expect(cached?.builtAt).toBe('2026-10-26T12:00');
		expect(cached?.categories.length).toBe(1);
		expect(cached?.facets.length).toBe(5);

		await vault.dataWrite(CLASSIFICATION_CACHE_PATH, '{ не json');
		expect(await loadClassificationCache(vault)).toBeNull();
	});
});
