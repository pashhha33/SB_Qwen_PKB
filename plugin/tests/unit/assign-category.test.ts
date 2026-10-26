/**
 * Тесты назначения категорий — ядро команды `assign-category` (0.12.0, DL-282/283):
 * `classification.ts#assignCategories`, `facetsForType`, `categoriesInHierarchy`,
 * `cardinalityViolation`.
 *
 * Нормы: `01-classification` §2.4 (назначение — системное поле `categories`, всегда
 * прямое), `04-attributes` §2 (заполняется через `assign-category`), ADR-011 (уровень 1:
 * некорректное назначение не записывается), rules.md §E (`assignment.type_allowed`,
 * `assignment.cardinality`), DL-184 (авторский отображаемый текст ссылки не переписывается).
 *
 * Хранилище ОДНО на файл (beforeAll) — урок DL-255/259/281: установка базовой
 * библиотеки не повторяется в каждом тесте.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { LogFn } from '../../src/core/activity-log';
import { bootstrapMetamodel } from '../../src/core/bootstrap';
import {
	assignCategories,
	cardinalityOverflow,
	cardinalityShortfall,
	cardinalityViolation,
	categoriesInHierarchy,
	facetsForType,
	loadClassification,
	type ClassificationSnapshot,
} from '../../src/core/classification';
import { SbError } from '../../src/core/errors';
import { parseNote } from '../../src/core/markdown-parser';
import { METAMODEL_SUBFOLDERS, TypeRegistry } from '../../src/core/registry';
import { installBaseLibrary } from '../../src/core/seed-library';
import { SEED_ULIDS } from '../../src/core/seeds/seed-ulids';
import { link, putNote, uid } from '../support/classification-fixtures';
import { FakeVault } from '../support/fake-vault';

const GENRE = SEED_ULIDS['system-facet/genre'];
const LANGUAGE = SEED_ULIDS['system-facet/language'];

const TIMEOUT = 120_000;

interface Ctx {
	vault: FakeVault;
	registry: TypeRegistry;
	snapshot: ClassificationSnapshot;
	logs: { entries: { level: string; area: string; message: string }[]; fn: LogFn };
	/** Перечитать заметку после записи. */
	reread(path: string): Promise<ReturnType<typeof parseNote>>;
}

let ctx: Ctx;

beforeAll(async () => {
	const vault = await FakeVault.create();
	await bootstrapMetamodel(vault);
	await installBaseLibrary(vault, await TypeRegistry.load(vault));
	const registry = await TypeRegistry.load(vault);
	const entries: { level: string; area: string; message: string }[] = [];
	const fn: LogFn = (level, area, message) => entries.push({ level, area, message });
	ctx = {
		vault,
		registry,
		snapshot: await loadClassification(vault),
		logs: { entries, fn },
		reread: async (path: string) => parseNote({ path, content: await vault.read(path) }, vault),
	};
}, TIMEOUT);

afterAll(async () => {
	await ctx.vault.cleanup();
});

/** Книга с уже назначенными категориями (записи — как их пишет пользователь/плагин). */
async function putBook(n: number, categories: string[], title = 'Книга'): Promise<string> {
	return putNote(ctx.vault, {
		id: uid(n),
		type: 'book',
		title,
		folder: 'Books',
		prefix: 'BOOK',
		fields: { format: 'file', read_status: 'planned', categories },
	});
}

/** Человек (для проверок области применения фасета). */
async function putPerson(n: number, categories: string[] = []): Promise<string> {
	return putNote(ctx.vault, {
		id: uid(n),
		type: 'person',
		title: 'Человек',
		folder: 'People',
		prefix: 'PERSON',
		fields: { role: ['author'], categories },
	});
}

async function assign(path: string, typeKey: string, facetId: string, categoryIds: string[], snapshot = ctx.snapshot) {
	const note = await ctx.reread(path);
	return assignCategories(ctx.vault, note, typeKey, snapshot, ctx.registry, { facetId, categoryIds }, ctx.logs.fn);
}

describe('assign-category — запись назначения', () => {
	it('назначает категорию: каноническая ссылка, updated_at обновлён, журнал info/classification', async () => {
		await putNote(ctx.vault, {
			id: uid(201), type: 'category', title: 'Science fiction', folder: METAMODEL_SUBFOLDERS.categories, prefix: 'CATEGORY',
			label: 'Научная фантастика', fields: { facet: [link('FACET', GENRE, 'Genre')], parent: [] },
		});
		const snapshot = await loadClassification(ctx.vault);
		ctx.snapshot = snapshot;
		const path = await putBook(202, []);
		const before = await ctx.reread(path);

		const report = await assign(path, 'book', GENRE, [uid(201)], snapshot);
		expect(report.added).toEqual([uid(201)]);
		expect(report.removed).toEqual([]);
		expect(report.categories).toEqual([`[[CATEGORY-${uid(201)}.md|Science fiction]]`]);

		const after = await ctx.reread(path);
		expect(after.system.categories).toEqual([`[[CATEGORY-${uid(201)}.md|Science fiction]]`]);
		expect(after.system.updated_at).not.toBe(before.system.updated_at);
		expect(ctx.logs.entries.some((e) => e.level === 'info' && e.area === 'classification' && e.message.includes('Назначены категории'))).toBe(true);
	});

	it('слияние: категории ДРУГОГО фасета и нераспознанные записи сохраняются как были', async () => {
		await putNote(ctx.vault, {
			id: uid(203), type: 'category', title: 'Russian', folder: METAMODEL_SUBFOLDERS.categories, prefix: 'CATEGORY',
			label: 'русский', fields: { facet: [link('FACET', LANGUAGE, 'Language')], parent: [] },
		});
		await putNote(ctx.vault, {
			id: uid(204), type: 'category', title: 'Fantasy', folder: METAMODEL_SUBFOLDERS.categories, prefix: 'CATEGORY',
			label: 'Фэнтези', fields: { facet: [link('FACET', GENRE, 'Genre')], parent: [] },
		});
		const snapshot = await loadClassification(ctx.vault);
		ctx.snapshot = snapshot;
		const foreign = `[[CATEGORY-${uid(203)}.md|русский]]`;
		const unknown = '[[Какая-то заметка]]'; // не категория — запись пользователя, не трогаем
		const path = await putBook(205, [foreign, unknown]);

		const report = await assign(path, 'book', GENRE, [uid(204)], snapshot);
		expect(report.kept).toEqual([foreign, unknown]);
		expect(report.added).toEqual([uid(204)]);
		const after = await ctx.reread(path);
		expect(after.system.categories).toEqual([foreign, unknown, `[[CATEGORY-${uid(204)}.md|Fantasy]]`]);
	});

	it('переназначение: прежняя категория фасета снята, новая добавлена, чужие не тронуты', async () => {
		await putNote(ctx.vault, {
			id: uid(206), type: 'category', title: 'Detective', folder: METAMODEL_SUBFOLDERS.categories, prefix: 'CATEGORY',
			label: 'Детектив', fields: { facet: [link('FACET', GENRE, 'Genre')], parent: [] },
		});
		const snapshot = await loadClassification(ctx.vault);
		ctx.snapshot = snapshot;
		const foreign = `[[CATEGORY-${uid(203)}.md|русский]]`;
		const path = await putBook(207, [`[[CATEGORY-${uid(204)}.md|Fantasy]]`, foreign]);

		const report = await assign(path, 'book', GENRE, [uid(206)], snapshot);
		expect(report.removed).toEqual([uid(204)]);
		expect(report.added).toEqual([uid(206)]);
		const after = await ctx.reread(path);
		expect(after.system.categories).toEqual([foreign, `[[CATEGORY-${uid(206)}.md|Detective]]`]);
	});

	it('снятие ВСЕХ категорий фасета разрешено (DL-183: неполный объект допустим) — с предупреждением', async () => {
		const foreign = `[[CATEGORY-${uid(203)}.md|русский]]`;
		const path = await putBook(208, [`[[CATEGORY-${uid(206)}.md|Detective]]`, foreign]);
		const report = await assign(path, 'book', GENRE, []);
		expect(report.removed).toEqual([uid(206)]);
		expect(report.categories).toEqual([foreign]);
		expect((await ctx.reread(path)).system.categories).toEqual([foreign]);
		// жанр у книги обязателен (1..N) — сохранение не блокируем, но предупреждаем:
		// ошибку выдаст validate-object (facet.genre.required_for_book)
		expect(report.warning).toMatch(/минимум одну категорию/);
	});

	it('снятие единственного назначения: поле categories удаляется из frontmatter', async () => {
		const path = await putBook(209, [`[[CATEGORY-${uid(206)}.md|Detective]]`]);
		const report = await assign(path, 'book', GENRE, []);
		expect(report.categories).toEqual([]);
		expect(report.warning).not.toBeNull();
		const content = await ctx.vault.read(path);
		expect(content).not.toContain('categories:');
		expect((await ctx.reread(path)).system.categories ?? []).toEqual([]);
	});

	it('дубликаты в выборе схлопываются (одна запись в поле)', async () => {
		const path = await putBook(210, []);
		const report = await assign(path, 'book', GENRE, [uid(206), uid(206)]);
		expect(report.categories.length).toBe(1);
	});
});

describe('assign-category — отказы уровня 1 (ADR-011: некорректное назначение не записывается)', () => {
	it('категория другого фасета: SbError, файл не изменён', async () => {
		const path = await putBook(211, []);
		const before = await ctx.vault.read(path);
		await expect(assign(path, 'book', GENRE, [uid(203)])).rejects.toBeInstanceOf(SbError);
		expect(await ctx.vault.read(path)).toBe(before);
	});

	it('область применения: жанр нельзя назначить человеку (assignment.type_allowed)', async () => {
		const path = await putPerson(212);
		const before = await ctx.vault.read(path);
		await expect(assign(path, 'person', GENRE, [uid(206)])).rejects.toThrow(/не применяется к типу/);
		expect(await ctx.vault.read(path)).toBe(before);
	});

	it('кардинальность: фасет «1» не принимает две категории (assignment.cardinality)', async () => {
		const facetPath = await putNote(ctx.vault, {
			id: uid(213), type: 'facet', title: 'Main language', folder: METAMODEL_SUBFOLDERS.facets, prefix: 'FACET',
			label: 'Основной язык', fields: { taxonomy: [], assignment_cardinality: '1' },
		});
		await putNote(ctx.vault, {
			id: uid(214), type: 'category', title: 'Первая', folder: METAMODEL_SUBFOLDERS.categories, prefix: 'CATEGORY',
			fields: { facet: [link('FACET', uid(213), 'Main language')], parent: [] },
		});
		await putNote(ctx.vault, {
			id: uid(215), type: 'category', title: 'Вторая', folder: METAMODEL_SUBFOLDERS.categories, prefix: 'CATEGORY',
			fields: { facet: [link('FACET', uid(213), 'Main language')], parent: [] },
		});
		const snapshot = await loadClassification(ctx.vault);
		ctx.snapshot = snapshot;
		const path = await putBook(216, []);
		const before = await ctx.vault.read(path);
		// ПРЕВЫШЕНИЕ — отказ уровня 1 (ADR-011): файл не изменён
		await expect(assign(path, 'book', uid(213), [uid(214), uid(215)], snapshot)).rejects.toThrow(/ровно одну категорию/);
		expect(await ctx.vault.read(path)).toBe(before);
		// ровно одна — проходит
		const report = await assign(path, 'book', uid(213), [uid(214)], snapshot);
		expect(report.categories.length).toBe(1);
		expect(report.warning).toBeNull();
		// НЕДОБОР (0 при кардинальности 1) — сохраняется с предупреждением (DL-183)
		const emptied = await assign(path, 'book', uid(213), [], snapshot);
		expect(emptied.categories).toEqual([]);
		expect(emptied.warning).toMatch(/ровно одну категорию/);
		expect(facetPath).toContain('FACET-');
	});

	it('несуществующий фасет: SbError', async () => {
		const path = await putBook(217, []);
		await expect(assign(path, 'book', uid(999), [])).rejects.toThrow(/Фасет не найден/);
	});

	it('отказ пишется в журнал вызывающим (урок DL-264): модалка логирует error/classification', async () => {
		// Ядро бросает SbError; журналирование отказа — обязанность UI/команды.
		const path = await putBook(218, []);
		try {
			await assign(path, 'book', GENRE, [uid(203)]);
		} catch (error) {
			ctx.logs.fn('error', 'classification', error instanceof SbError ? error.message : String(error));
		}
		expect(ctx.logs.entries.some((e) => e.level === 'error' && e.area === 'classification')).toBe(true);
	});
});

describe('assign-category — помощники выбора', () => {
	it('facetsForType: жанр виден книге и не виден человеку; фасет без ограничений виден всем', async () => {
		const forBook = facetsForType(ctx.snapshot, ctx.registry, 'book').map((f) => f.id);
		const forPerson = facetsForType(ctx.snapshot, ctx.registry, 'person').map((f) => f.id);
		expect(forBook).toContain(GENRE);
		expect(forPerson).not.toContain(GENRE);
		expect(forPerson).toContain(LANGUAGE); // у фасета «Язык» ограничений нет
		expect(forBook).toContain(LANGUAGE);
	});

	it('categoriesInHierarchy: родитель раньше потомка, глубина растёт', async () => {
		await putNote(ctx.vault, {
			id: uid(219), type: 'category', title: 'Space opera', folder: METAMODEL_SUBFOLDERS.categories, prefix: 'CATEGORY',
			label: 'Космическая опера', fields: { facet: [link('FACET', GENRE, 'Genre')], parent: [link('CATEGORY', uid(201), 'Science fiction')] },
		});
		const snapshot = await loadClassification(ctx.vault);
		ctx.snapshot = snapshot;
		const rows = categoriesInHierarchy(snapshot, GENRE);
		const parentIndex = rows.findIndex((r) => r.category.id === uid(201));
		const childIndex = rows.findIndex((r) => r.category.id === uid(219));
		expect(parentIndex).toBeGreaterThanOrEqual(0);
		expect(childIndex).toBeGreaterThan(parentIndex);
		expect(rows[parentIndex].depth).toBe(0);
		expect(rows[childIndex].depth).toBe(1);
	});

	it('отказ уровня 1 — только превышение; недобор — предупреждение (ADR-011 + DL-183)', () => {
		expect(cardinalityOverflow('1', 2)).toMatch(/ровно одну/);
		expect(cardinalityOverflow('1', 1)).toBeNull();
		expect(cardinalityOverflow('1', 0)).toBeNull(); // недобор — не отказ
		expect(cardinalityOverflow('0..1', 2)).toMatch(/0\.\.1/);
		expect(cardinalityOverflow('0..1', 1)).toBeNull();
		expect(cardinalityOverflow('1..N', 5)).toBeNull();
		expect(cardinalityOverflow('0..N', 5)).toBeNull();
		expect(cardinalityShortfall('1', 0)).toMatch(/ровно одну/);
		expect(cardinalityShortfall('1..N', 0)).toMatch(/минимум одну/);
		expect(cardinalityShortfall('1..N', 2)).toBeNull();
		expect(cardinalityShortfall('0..1', 0)).toBeNull();
		expect(cardinalityShortfall('0..N', 0)).toBeNull();
	});

	it('cardinalityViolation: таблица случаев по норме assignment.cardinality', () => {
		expect(cardinalityViolation('1', 0)).toMatch(/ровно одну/);
		expect(cardinalityViolation('1', 1)).toBeNull();
		expect(cardinalityViolation('1', 2)).toMatch(/ровно одну/);
		expect(cardinalityViolation('1..N', 0)).toMatch(/минимум одну/);
		expect(cardinalityViolation('1..N', 3)).toBeNull();
		expect(cardinalityViolation('0..1', 0)).toBeNull();
		expect(cardinalityViolation('0..1', 1)).toBeNull();
		expect(cardinalityViolation('0..1', 2)).toMatch(/0\.\.1/);
		expect(cardinalityViolation('0..N', 5)).toBeNull();
	});
});
