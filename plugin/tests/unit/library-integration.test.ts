/**
 * Интеграционные тесты базовой библиотеки (B1.3 часть 1, DL-276/277):
 * бутстрап → install-base-types → реестр → валидация → формы.
 *
 * Что закрепляют:
 *   1. ВАЛИДАЦИОННАЯ ЧИСТОТА: каждая семенная заметка (и бутстрап) проходит
 *      validate-object с НУЛЁМ ошибок (группы A/B/C/E/G/K на реальных определениях);
 *   2. критерий B1 на уровне модели формы (phases.md §5): книга при format=web_novel
 *      показывает 4 условных свойства, при format=file — другие 2 (М1);
 *   3. человек при role=[author, physician] видит поля двух групп (includes_any, М7);
 *   4. подписи — русские (LabelResolver по семенным определениям);
 *   5. create-object для book/person работает на семенных определениях.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { bootstrapMetamodel } from '../../src/core/bootstrap';
import { loadClassification } from '../../src/core/classification';
import { createObjectInstance } from '../../src/core/creation';
import { LabelResolver } from '../../src/core/label-resolver';
import { parseNote } from '../../src/core/markdown-parser';
import { buildFormModel, computeVisibleKeys, type FormValues } from '../../src/core/object-service';
import { METAMODEL_SUBFOLDERS, TypeRegistry } from '../../src/core/registry';
import { buildVaultIndex } from '../../src/core/schema-engine';
import { installBaseLibrary } from '../../src/core/seed-library';
import { SEED_ULIDS } from '../../src/core/seeds/seed-ulids';
import { validateObject } from '../../src/core/validation';
import { FakeVault } from '../support/fake-vault';

const vaults: FakeVault[] = [];

async function installedVault(): Promise<{ vault: FakeVault; registry: TypeRegistry; labels: LabelResolver; allPaths: string[] }> {
	const vault = await FakeVault.create();
	vaults.push(vault);
	await bootstrapMetamodel(vault);
	const bootstrapRegistry = await TypeRegistry.load(vault);
	const report = await installBaseLibrary(vault, bootstrapRegistry);
	expect(report.failed).toEqual([]);
	const registry = await TypeRegistry.load(vault);
	const labels = new LabelResolver(registry);
	const allPaths = (await vault.listMarkdown()).filter((p) => p.startsWith(`${METAMODEL_SUBFOLDERS.objectTypes}/`) || p.startsWith('Metamodel/'));
	return { vault, registry, labels, allPaths };
}

afterEach(async () => {
	while (vaults.length > 0) {
		await vaults.pop()!.cleanup();
	}
});

describe('библиотека — валидационная чистота сидов', () => {
	it('каждая заметка Metamodel/ (бутстрап + 138 сидов) проходит validate-object без ошибок', async () => {
		const { vault, registry, labels, allPaths } = await installedVault();
		expect(allPaths.length).toBe(8 + 138); // 7 типов + sb_issues + библиотека
		// ОДИН общий индекс на прогон (как validate-vault): без него каждая из 146 проверок
		// сканировала бы всё хранилище заново — на медленных дисках (Windows + антивирус)
		// это вылетало за лимит 20 с (инцидент переноса 2026-10-26, урок DL-255/259).
		const sharedIndex = await buildVaultIndex(vault, { readTypes: true });
		// ОДИН общий снимок классификации на прогон — как в validate-vault (иначе каждая
		// проверка определений классификации перечитывала бы их заново; урок DL-255/259/281).
		const classification = await loadClassification(vault);
		const genrePath = `${METAMODEL_SUBFOLDERS.facets}/FACET-${SEED_ULIDS['system-facet/genre']}.md`;
		let genreRootWarning = false;
		for (const path of allPaths) {
			const result = await validateObject(vault, registry, labels, path, undefined, false, sharedIndex, { classification });
			const errors = result.diagnostics.filter((d) => d.severity === 'error');
			expect(errors, `${path}: ${JSON.stringify(errors.slice(0, 3))}`).toEqual([]);
			expect(result.unparsable, path).toBe(false);
			if (path === genrePath) {
				genreRootWarning = result.diagnostics.some((d) => d.rule_id === 'facet.root_requirement' && d.severity === 'warning');
			}
		}
		// Норма Ч3-3 = Б: категории создаёт пользователь, поэтому семенной фасет «Жанр»
		// (root_requirement_min: 1, DL-126) до первой корневой категории даёт warning —
		// не ошибку. Ожидание зафиксировано здесь, чтобы его не потеряли (DL-279/280).
		expect(genreRootWarning, `у ${genrePath} ожидался warning facet.root_requirement`).toBe(true);
	}, 120_000);
});

describe('библиотека — критерий B1 (условные свойства книги в модели формы)', () => {
	it('format=web_novel → ровно 4 условных: platform, publication_status, release_cadence, last_chapter_on', async () => {
		const { vault, registry, labels } = await installedVault();
		const created = await createObjectInstance(vault, registry, { typeKey: 'book', title: 'Мастер и Маргарита' });
		const content = await vault.read(created.path);
		const note = parseNote({ path: created.path, content }, vault);
		const model = buildFormModel(registry, labels, note);
		expect(model).not.toBeNull();
		const values: FormValues = { format: ['web_novel'] };
		const visible = computeVisibleKeys(model!, values, []);
		for (const key of ['platform', 'publication_status', 'release_cadence', 'last_chapter_on']) {
			expect(visible.has(key), key).toBe(true);
		}
		for (const key of ['file_path', 'file_format', 'card_series', 'card_count', 'audio_duration', 'narrator']) {
			expect(visible.has(key), key).toBe(false);
		}
		// базовые видны всегда
		for (const key of ['author', 'rating', 'read_status', 'finished_on', 'description']) {
			expect(visible.has(key), key).toBe(true);
		}
	});

	it('format=file → ровно 2 других: file_path, file_format (критерий B1, phases §5)', async () => {
		const { vault, registry, labels } = await installedVault();
		const created = await createObjectInstance(vault, registry, { typeKey: 'book', title: 'Гиперион' });
		const note = parseNote({ path: created.path, content: await vault.read(created.path) }, vault);
		const model = buildFormModel(registry, labels, note)!;
		const visible = computeVisibleKeys(model, { format: ['file'] }, []);
		expect(visible.has('file_path')).toBe(true);
		expect(visible.has('file_format')).toBe(true);
		for (const key of ['platform', 'publication_status', 'release_cadence', 'last_chapter_on', 'card_series', 'card_count', 'audio_duration', 'narrator']) {
			expect(visible.has(key), key).toBe(false);
		}
	});

	it('смена format не «удаляет» поля из модели (М1/М2): значения скрытых остаются в заметке', async () => {
		const { vault, registry, labels } = await installedVault();
		const created = await createObjectInstance(vault, registry, { typeKey: 'book', title: 'Тестовая книга' });
		// значение «погасшего» поля сохраняется в frontmatter (М2)
		await vault.processFrontMatter(created.path, (fm) => {
			fm.format = 'file';
			fm.platform = 'Author.Today';
		});
		const note = parseNote({ path: created.path, content: await vault.read(created.path) }, vault);
		const model = buildFormModel(registry, labels, note)!;
		const visible = computeVisibleKeys(model, { format: ['file'], platform: ['Author.Today'] }, []);
		expect(visible.has('platform')).toBe(false);
		const platformField = model.fields.find((f) => f.def.key === 'platform')!;
		expect(platformField.values).toEqual(['Author.Today']);
	});

	it('подписи полей — русские (LabelResolver): Автор, Формат, Статус прочтения, Оценка', async () => {
		const { vault, registry, labels } = await installedVault();
		const created = await createObjectInstance(vault, registry, { typeKey: 'book', title: 'Книга' });
		const note = parseNote({ path: created.path, content: await vault.read(created.path) }, vault);
		const model = buildFormModel(registry, labels, note)!;
		const labelOf = (key: string): string => model.fields.find((f) => f.def.key === key)!.label;
		expect(labelOf('author')).toBe('Автор');
		expect(labelOf('format')).toBe('Формат');
		expect(labelOf('read_status')).toBe('Статус прочтения');
		expect(labelOf('rating')).toBe('Оценка');
		expect(model.typeLabel).toBe('Книга');
	});
});

describe('библиотека — человек: роль-триггер и группы (includes_any, М7)', () => {
	it('role=[author, physician] → видны поля групп «Литература» и «Медицина» + сквозное known_for', async () => {
		const { vault, registry, labels } = await installedVault();
		const created = await createObjectInstance(vault, registry, { typeKey: 'person', title: 'Михаил Булгаков' });
		const note = parseNote({ path: created.path, content: await vault.read(created.path) }, vault);
		const model = buildFormModel(registry, labels, note)!;
		const visible = computeVisibleKeys(model, { role: ['author', 'physician'] }, []);
		// литература (author ∈ [author, novelist, poet, screenwriter])
		expect(visible.has('writing_genres')).toBe(true);
		expect(visible.has('writing_languages')).toBe(true);
		expect(visible.has('published_works')).toBe(true);
		// медицина (physician)
		expect(visible.has('medical_specialty')).toBe(true);
		expect(visible.has('medical_institution')).toBe(true);
		// сквозное known_for (author входит в 21 значение)
		expect(visible.has('known_for')).toBe(true);
		// чужие группы скрыты
		for (const key of ['instruments', 'sport', 'academic_degree', 'programming_languages', 'military_rank', 'art_movement', 'business_positions']) {
			expect(visible.has(key), key).toBe(false);
		}
		// базовые видны всегда
		for (const key of ['birth_date', 'gender', 'nationality', 'links', 'portrait']) {
			expect(visible.has(key), key).toBe(true);
		}
	});

	it('role=[other_occupation] → только базовые + сквозные не включаются (служебное значение без групп)', async () => {
		const { vault, registry, labels } = await installedVault();
		const created = await createObjectInstance(vault, registry, { typeKey: 'person', title: 'Неизвестный' });
		const note = parseNote({ path: created.path, content: await vault.read(created.path) }, vault);
		const model = buildFormModel(registry, labels, note)!;
		const visible = computeVisibleKeys(model, { role: ['other_occupation'] }, []);
		const conditional = model.fields.filter((f) => f.def.appliesWhen !== null).map((f) => f.def.key);
		expect(conditional.length).toBe(27);
		for (const key of conditional) {
			expect(visible.has(key), key).toBe(false);
		}
		expect(visible.has('birth_date')).toBe(true);
	});

	it('форма книги содержит 22 своих поля + sb_issues не предлагается (service, 08-views §7)', async () => {
		const { vault, registry, labels } = await installedVault();
		const created = await createObjectInstance(vault, registry, { typeKey: 'book', title: 'Форма' });
		const note = parseNote({ path: created.path, content: await vault.read(created.path) }, vault);
		const model = buildFormModel(registry, labels, note)!;
		const keys = model.fields.map((f) => f.def.key);
		expect(keys).not.toContain('sb_issues');
		expect(keys.length).toBe(22);
		expect(keys).toContain('author');
		expect(keys).toContain('narrator');
	});
});
