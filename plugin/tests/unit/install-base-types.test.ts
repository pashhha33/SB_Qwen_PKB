/**
 * Тесты команды install-base-types / core/seed-library (B1.3 часть 1, DL-276/277).
 *
 * Что закрепляют:
 *   1. установка в чистое хранилище: 4 OBJECT_TYPE + 5 FACET + 126 PROPERTY = 135 заметок,
 *      содержание — по нормам (parent_type book → work, target_facet, display, applies_when);
 *   2. идемпотентность — пропуск ПО КЛЮЧУ (DL-276): повторный запуск не создаёт ничего;
 *      существующие пользовательские book/person/фасет (другие ULID) не дублируются,
 *      ссылки сидов разрешаются в ULID существующих определений;
 *   3. отказоустойчивость: ошибка записи одного семени не прерывает остальные;
 *   4. конвенции содержимого: LF, без BOM, без токенов Templater (DL-190), И4
 *      (aliases[0] == title) у каждой созданной заметки; байт-стабильность;
 *   5. журнал: одна сводная запись info/creation (+ error при отказах) — наблюдаемость DL-264.
 */

import { afterEach, describe, expect, it } from 'vitest';
import type { LogFn } from '../../src/core/activity-log';
import { bootstrapMetamodel } from '../../src/core/bootstrap';
import { parseNote } from '../../src/core/markdown-parser';
import { METAMODEL_SUBFOLDERS, TypeRegistry } from '../../src/core/registry';
import { installBaseLibrary, type InstallLibraryReport } from '../../src/core/seed-library';
import { FACET_SEED_SPECS, PROPERTY_SEED_SPECS, TYPE_SEED_SPECS } from '../../src/core/seeds/library-specs';
import { SEED_ULIDS } from '../../src/core/seeds/seed-ulids';
import { FakeVault } from '../support/fake-vault';

const vaults: FakeVault[] = [];

async function setup(): Promise<{ vault: FakeVault; registry: TypeRegistry }> {
	const vault = await FakeVault.create();
	vaults.push(vault);
	await bootstrapMetamodel(vault);
	const registry = await TypeRegistry.load(vault);
	return { vault, registry };
}

function collectLogs(): { entries: { level: string; area: string; message: string }[]; fn: LogFn } {
	const entries: { level: string; area: string; message: string }[] = [];
	return { entries, fn: (level, area, message) => entries.push({ level, area, message }) };
}

function typePath(recipe: string): string {
	return `${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${SEED_ULIDS[recipe]}.md`;
}

function propertyPath(recipe: string): string {
	return `${METAMODEL_SUBFOLDERS.properties}/PROPERTY-${SEED_ULIDS[recipe]}.md`;
}

function facetPath(recipe: string): string {
	return `${METAMODEL_SUBFOLDERS.facets}/FACET-${SEED_ULIDS[recipe]}.md`;
}

afterEach(async () => {
	while (vaults.length > 0) {
		await vaults.pop()!.cleanup();
	}
});

describe('install-base-types — установка в чистое хранилище', () => {
	it('создаёт 135 определений: типов 4, фасетов 5, свойств 126; без пропусков и ошибок', async () => {
		const { vault, registry } = await setup();
		const report = await installBaseLibrary(vault, registry);
		expect(report.failed).toEqual([]);
		expect(report.skipped).toEqual([]);
		expect(report.counts).toEqual({ objectTypes: 4, facets: 5, properties: 126 });
		expect(report.created.length).toBe(135);
		expect(TYPE_SEED_SPECS.length + FACET_SEED_SPECS.length + PROPERTY_SEED_SPECS.length).toBe(135);
		for (const spec of TYPE_SEED_SPECS) {
			expect(await vault.exists(typePath(spec.recipe)), spec.typeKey).toBe(true);
		}
		for (const spec of FACET_SEED_SPECS) {
			expect(await vault.exists(facetPath(spec.recipe)), spec.facetKey).toBe(true);
		}
	});

	it('содержимое по нормам: parent_type book → work; genre 1..N/min 1; target_facet writing_genres → genre; rating — звёзды; known_for — includes_any 21', async () => {
		const { vault, registry } = await setup();
		await installBaseLibrary(vault, registry);

		const book = await vault.read(typePath('system-type/book'));
		expect(book).toContain('type_key: book');
		expect(book).toContain('type_prefix: BOOK');
		expect(book).toContain(`[[OBJECT_TYPE-${SEED_ULIDS['system-type/work']}.md|Произведение]]`);

		const work = await vault.read(typePath('system-type/work'));
		expect(work).toContain('abstract: true');

		const genre = await vault.read(facetPath('system-facet/genre'));
		expect(genre).toContain('title: Genre');
		expect(genre).toContain('label: Жанр');
		expect(genre).toContain('assignment_cardinality: 1..N');
		expect(genre).toContain('root_requirement_min: 1');
		expect(genre).toContain(`[[OBJECT_TYPE-${SEED_ULIDS['system-type/book']}.md|Книга]]`);

		const writingGenres = await vault.read(propertyPath('system-property/person.writing_genres'));
		expect(writingGenres).toContain(`target_facet: "[[FACET-${SEED_ULIDS['system-facet/genre']}.md|Genre]]"`);
		expect(writingGenres).toContain('operation: includes_any');

		const rating = await vault.read(propertyPath('system-property/book.rating'));
		expect(rating).toContain('renderer: stars');
		expect(rating).toContain('scale_max: 10');

		const knownFor = await vault.read(propertyPath('system-property/person.known_for'));
		const values = knownFor.split('\n').filter((line) => line.startsWith('    - ')).length;
		expect(values).toBe(21);

		const cover = await vault.read(propertyPath('system-property/book.cover'));
		expect(cover).toContain('media_target: object');
		expect(cover).toContain(`[[OBJECT_TYPE-${SEED_ULIDS['system-type/media']}.md|Медиа]]`);

		const readStatus = await vault.read(propertyPath('system-property/book.read_status'));
		expect(readStatus).toContain('default_value: planned');
	});

	it('реестр после перечитывания: book — 22 своих свойства, person — 42; условные видны движком applies-when', async () => {
		const { vault, registry } = await setup();
		await installBaseLibrary(vault, registry);
		const reloaded = await TypeRegistry.load(vault);
		expect(reloaded.getType('book')).not.toBeNull();
		expect(reloaded.getType('person')).not.toBeNull();
		expect(reloaded.getType('work')!.abstract).toBe(true);
		expect(reloaded.getType('media')).not.toBeNull();
		expect(reloaded.properties.filter((p) => p.scope === 'specific' && p.objectTypes.includes(reloaded.getType('book')!.id)).length).toBe(22);
		expect(reloaded.properties.filter((p) => p.scope === 'specific' && p.objectTypes.includes(reloaded.getType('person')!.id)).length).toBe(42);
		for (const [owner, count] of [['object_type', 8], ['property', 24], ['relation_type', 13], ['taxonomy', 7], ['facet', 7], ['category', 3]] as const) {
			const ownerDef = reloaded.getType(owner)!;
			expect(reloaded.properties.filter((p) => p.scope === 'specific' && p.objectTypes.includes(ownerDef.id)).length, `свойств у ${owner}`).toBe(count);
		}
		expect(reloaded.getPropertiesForType('book').some((p) => p.key === 'author')).toBe(true);
		expect(reloaded.getPropertiesForType('book').some((p) => p.key === 'sb_issues')).toBe(true); // universal — всем типам
		expect(reloaded.issues).toEqual([]);
		const platform = reloaded.getPropertiesForType('book').find((p) => p.key === 'platform')!;
		expect(platform.appliesWhen).toEqual({ property: 'format', operation: 'equals', value: ['web_novel'] });
		const role = reloaded.getPropertiesForType('person').find((p) => p.key === 'role')!;
		expect(role.allowedValues.length).toBe(40);
		const writingGenres = reloaded.getPropertiesForType('person').find((p) => p.key === 'writing_genres')!;
		expect(writingGenres.targetFacetId).toBe(SEED_ULIDS['system-facet/genre']);
	});

	it('журнал: одна сводная запись info/creation со счётчиками (наблюдаемость, DL-264)', async () => {
		const { vault, registry } = await setup();
		const log = collectLogs();
		await installBaseLibrary(vault, registry, log.fn);
		const info = log.entries.filter((e) => e.level === 'info' && e.area === 'creation');
		expect(info.length).toBe(1);
		expect(info[0].message).toContain('135');
		expect(log.entries.filter((e) => e.level === 'error')).toEqual([]);
	});
});

describe('install-base-types — идемпотентность (пропуск по ключу, DL-276)', () => {
	it('повторный запуск: создано 0, пропущено 135', async () => {
		const { vault, registry } = await setup();
		await installBaseLibrary(vault, registry);
		const reloaded = await TypeRegistry.load(vault);
		const second: InstallLibraryReport = await installBaseLibrary(vault, reloaded);
		expect(second.created).toEqual([]);
		expect(second.failed).toEqual([]);
		expect(second.skipped.length).toBe(135);
		expect(second.counts).toEqual({ objectTypes: 0, facets: 0, properties: 0 });
	});

	it('пользовательские book и rating (другие ULID) не дублируются; ссылки сидов разрешаются в ULID пользователя', async () => {
		const { vault, registry } = await setup();
		const userBookUlid = '01J8Z6M4K2Q7V9X3N5B0C1D2BK';
		const userRatingUlid = '01J8Z6M4K2Q7V9X3N5B0C1D2RT';
		await vault.put(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-${userBookUlid}.md`, [
			'---',
			`id: ${userBookUlid}`,
			'type: object_type',
			'title: book',
			'aliases:',
			'  - book',
			'created_at: "2026-10-25T10:00"',
			'updated_at: "2026-10-25T10:00"',
			'type_key: book',
			'label: Книга',
			'type_prefix: BOOK',
			'abstract: false',
			'lifecycle: standard',
			'---',
			'',
			'Создан пользователем при ручной проверке.',
			'',
		].join('\n'));
		await vault.put(`${METAMODEL_SUBFOLDERS.properties}/PROPERTY-${userRatingUlid}.md`, [
			'---',
			`id: ${userRatingUlid}`,
			'type: property',
			'title: rating',
			'aliases:',
			'  - rating',
			'created_at: "2026-10-25T10:05"',
			'updated_at: "2026-10-25T10:05"',
			'key: rating',
			'label: Оценка',
			'value_type: number',
			'cardinality: 0..1',
			'required: false',
			'scope: specific',
			'object_types:',
			`  - "[[OBJECT_TYPE-${userBookUlid}.md|Книга]]"`,
			'---',
			'',
		].join('\n'));
		const withUser = await TypeRegistry.load(vault);
		const report = await installBaseLibrary(vault, withUser);

		// book и rating пропущены (существующие определения), остальное создано
		const skippedKeys = report.skipped.map((s) => s.key);
		expect(skippedKeys).toContain('book');
		expect(skippedKeys).toContain('book.rating');
		expect(report.skipped.find((s) => s.key === 'book')!.reason).toBe('existing-definition');
		expect(report.created.some((c) => c.key === 'book.rating')).toBe(false);
		expect(report.counts.objectTypes).toBe(3); // work, person, media
		expect(report.counts.properties).toBe(125); // 126 − rating
		expect(await vault.exists(typePath('system-type/book'))).toBe(false);
		expect(await vault.exists(propertyPath('system-property/book.rating'))).toBe(false);

		// ссылки остальных свойств book ведут на ПОЛЬЗОВАТЕЛЬСКИЙ ULID
		const format = await vault.read(propertyPath('system-property/book.format'));
		expect(format).toContain(`[[OBJECT_TYPE-${userBookUlid}.md|Книга]]`);
		expect(format).not.toContain(SEED_ULIDS['system-type/book']);

		// реестр: у пользовательского book 21 сид + свой rating = 22 своих свойства
		const reloaded = await TypeRegistry.load(vault);
		expect(reloaded.getType('book')!.id).toBe(userBookUlid);
		expect(reloaded.properties.filter((p) => p.scope === 'specific' && p.objectTypes.includes(userBookUlid)).length).toBe(22);
	});

	it('существующий пользовательский фасет «Жанр» — сид genre пропускается, target_facet разрешается в его ULID', async () => {
		const { vault, registry } = await setup();
		const userFacetUlid = '01J8Z6M4K2Q7V9X3N5B0C1D2FC';
		await vault.put(`${METAMODEL_SUBFOLDERS.facets}/FACET-${userFacetUlid}.md`, [
			'---',
			`id: ${userFacetUlid}`,
			'type: facet',
			'title: Жанры книг',
			'aliases:',
			'  - Жанры книг',
			'created_at: "2026-10-25T11:00"',
			'updated_at: "2026-10-25T11:00"',
			'label: Жанр',
			'hierarchy_mode: strict',
			'assignment_cardinality: 0..N',
			'---',
			'',
		].join('\n'));
		const report = await installBaseLibrary(vault, registry);
		expect(report.skipped.some((s) => s.kind === 'facet' && s.key === 'genre')).toBe(true);
		expect(await vault.exists(facetPath('system-facet/genre'))).toBe(false);
		const writingGenres = await vault.read(propertyPath('system-property/person.writing_genres'));
		expect(writingGenres).toContain(`[[FACET-${userFacetUlid}.md|Жанры книг]]`);
		// остальные 4 фасета созданы
		expect(report.counts.facets).toBe(4);
	});
});

describe('install-base-types — отказоустойчивость и конвенции содержимого', () => {
	it('ошибка записи одного семени не прерывает установку: failed 1, остальные созданы, журнал — error', async () => {
		const { vault, registry } = await setup();
		const conflictsPath = propertyPath('system-property/person.conflicts');
		const original = vault.create.bind(vault);
		(vault as { create: (p: string, c: string) => Promise<void> }).create = async (p, c) => {
			if (p === conflictsPath) {
				throw new Error('диск полон (имитация)');
			}
			return original(p, c);
		};
		const log = collectLogs();
		const report = await installBaseLibrary(vault, registry, log.fn);
		expect(report.failed.length).toBe(1);
		expect(report.failed[0].path).toBe(conflictsPath);
		expect(report.created.length).toBe(134);
		expect(log.entries.some((e) => e.level === 'error' && e.message.includes('conflicts'))).toBe(true);
	});

	it('все 135 заметок: LF, без BOM, без токенов Templater (DL-190), И4 — aliases[0] == title', async () => {
		const { vault, registry } = await setup();
		const report = await installBaseLibrary(vault, registry);
		expect(report.created.length).toBe(135);
		for (const entry of report.created) {
			const content = await vault.read(entry.path);
			expect(content.includes('\r'), `${entry.path}: только LF`).toBe(false);
			expect(content.charCodeAt(0) === 0xfeff, `${entry.path}: без BOM`).toBe(false);
			expect(content.includes('<%'), `${entry.path}: без токенов Templater`).toBe(false);
			const note = parseNote({ path: entry.path, content }, vault);
			expect(note.frontmatterBroken, `${entry.path}: frontmatter читается`).toBe(false);
			expect(note.system.aliases?.[0], `${entry.path}: И4 aliases[0] == title`).toBe(note.system.title);
			expect(note.system.id, `${entry.path}: id`).toBeTruthy();
		}
	});

	it('байт-стабильность: две чистые установки дают идентичные содержимое и пути', async () => {
		const first = await setup();
		const second = await setup();
		const reportA = await installBaseLibrary(first.vault, first.registry);
		const reportB = await installBaseLibrary(second.vault, second.registry);
		expect(reportA.created.map((c) => c.path)).toEqual(reportB.created.map((c) => c.path));
		for (const entry of reportA.created) {
			expect(await first.vault.read(entry.path), entry.path).toBe(await second.vault.read(entry.path));
		}
	});
});
