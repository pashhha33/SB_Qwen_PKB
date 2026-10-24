/**
 * Контракт-тесты VaultAdapter (прогоняются на FakeVault).
 *
 * Смысл (решение DL-244, вопрос 9.3 = А): прод-реализация ObsidianVaultAdapter —
 * тонкая обёртка над API Obsidian и автоматически не тестируется (мокировать сам
 * Obsidian бесполезно). Вместо этого фиксируется ПОВЕДЕНЧЕСКИЙ КОНТРАКТ интерфейса:
 * FakeVault обязан ему удовлетворять (эти тесты), а прод-реализация — вести себя
 * так же (расхождение = баг; проверяется вручную по чек-боксам DoD, phases.md §4).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SbError } from '../../src/core/errors';
import { FakeVault } from '../support/fake-vault';

describe('VaultAdapter контракт (FakeVault)', () => {
	let vault: FakeVault;

	beforeEach(async () => {
		vault = await FakeVault.create();
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	it('create → exists → read: содержимое сохраняется (UTF-8, кириллица)', async () => {
		expect(await vault.exists('a.md')).toBe(false);
		await vault.create('a.md', '---\ntitle: Книга\n---\n\nСодержимое ✓\n');
		expect(await vault.exists('a.md')).toBe(true);
		expect(await vault.read('a.md')).toContain('Содержимое ✓');
	});

	it('create на существующий файл — ошибка file_exists (семантика vault.create)', async () => {
		await vault.create('a.md', 'x');
		await expect(vault.create('a.md', 'y')).rejects.toThrow(SbError);
	});

	it('create создаёт промежуточные папки; пути с пробелами и кириллицей работают', async () => {
		await vault.create('Мои книги/Том 1/BOOK-x.md', 'содержимое');
		expect(await vault.read('Мои книги/Том 1/BOOK-x.md')).toBe('содержимое');
	});

	it('modify перезаписывает; modify несуществующего — ошибка file_not_found', async () => {
		await vault.create('a.md', 'v1');
		await vault.modify('a.md', 'v2');
		expect(await vault.read('a.md')).toBe('v2');
		await expect(vault.modify('нет.md', 'x')).rejects.toThrow(SbError);
	});

	it('rename переносит файл, старый путь исчезает', async () => {
		await vault.create('старое имя.md', 'данные');
		await vault.rename('старое имя.md', 'папка/BOOK-новое.md');
		expect(await vault.exists('старое имя.md')).toBe(false);
		expect(await vault.read('папка/BOOK-новое.md')).toBe('данные');
	});

	it('remove удаляет файл; повторное удаление — ошибка', async () => {
		await vault.create('a.md', 'x');
		await vault.remove('a.md');
		expect(await vault.exists('a.md')).toBe(false);
		await expect(vault.remove('a.md')).rejects.toThrow(SbError);
	});

	it('createFolder идемпотентен; listFolder отдаёт файлы и подпапки', async () => {
		await vault.createFolder('Metamodel/ObjectTypes');
		await vault.createFolder('Metamodel/ObjectTypes'); // не ошибка
		await vault.create('Metamodel/ObjectTypes/type.md', 'x');
		const listed = await vault.listFolder('Metamodel');
		expect(listed.folders).toEqual(['Metamodel/ObjectTypes']);
		expect(listed.files).toEqual([]);
		const inner = await vault.listFolder('Metamodel/ObjectTypes');
		expect(inner.files).toEqual(['Metamodel/ObjectTypes/type.md']);
	});

	it('listMarkdown: все .md рекурсивно, БЕЗ dot-папок (.sb/ не индексируется)', async () => {
		await vault.create('a.md', '1');
		await vault.create('books/b.md', '2');
		await vault.create('notes.txt', 'не-md');
		await vault.dataWrite('.sb/cache/index.json', '{}');
		await vault.dataWrite('.sb/заметка.md', 'служебная');
		const files = await vault.listMarkdown();
		expect(files).toEqual(['a.md', 'books/b.md']);
	});

	it('processFrontMatter: меняет YAML, тело сохраняет байт-в-байт', async () => {
		const body = '\nТело\n\n- пункт\n\n---\n\nпостскриптум\n';
		await vault.create('a.md', `---\ntitle: Старое\nrating: 5\n---\n${body}`);
		await vault.processFrontMatter('a.md', (fm) => {
			fm.title = 'Новое';
			fm.added = true;
		});
		const after = await vault.read('a.md');
		expect(after).toContain('title: Новое');
		expect(after).toContain('rating: 5'); // существующие ключи не теряются
		expect(after).toContain('added: true');
		expect(after.endsWith(body.replace(/^\n/, ''))).toBe(true);
	});

	it('processFrontMatter добавляет блок, если frontmatter не было (семантика Obsidian)', async () => {
		await vault.create('plain.md', 'просто тело\n');
		await vault.processFrontMatter('plain.md', (fm) => {
			fm.title = 'Добавлено';
		});
		const after = await vault.read('plain.md');
		expect(after.startsWith('---\n')).toBe(true);
		expect(after).toContain('title: Добавлено');
		expect(after).toContain('просто тело');
	});

	it('parseYaml / stringifyYaml: круговой проход (ADR-002 — YAML разбирает «хозяин» среды)', () => {
		const value = vault.parseYaml('a: 1\nb:\n  - x\n  - y\n');
		expect(value).toEqual({ a: 1, b: ['x', 'y'] });
		expect(vault.parseYaml(vault.stringifyYaml(value))).toEqual(value);
	});

	it('parseYaml на битом YAML бросает исключение (парсер заметок ловит его в issue)', () => {
		expect(() => vault.parseYaml('a: [незакрытая')).toThrow();
	});

	it('data*: служебная область .sb/ доступна (ADR-010)', async () => {
		await vault.dataCreateFolder('.sb/cache');
		await vault.dataWrite('.sb/cache/state.json', '{"schema_version":"1.0.1"}');
		expect(await vault.dataExists('.sb/cache/state.json')).toBe(true);
		expect(await vault.dataRead('.sb/cache/state.json')).toContain('1.0.1');
		const listed = await vault.dataList('.sb/cache');
		expect(listed.files).toEqual(['.sb/cache/state.json']);
		await vault.dataRemove('.sb/cache/state.json');
		expect(await vault.dataExists('.sb/cache/state.json')).toBe(false);
	});

	it('dataWrite сам создаёт родительские папки — контракт (DL-255)', async () => {
		// DataAdapter.write в Obsidian папки НЕ создаёт (obsidian.d.ts: «otherwise the
		// file will be created» — про папки ни слова), поэтому прод-адаптер строит
		// цепочку mkdir-ом перед записью. Без этого первая запись в свежем хранилище
		// (.sb/cache/registry.json, .sb/logs/plugin-log.jsonl) падает ENOENT — баг,
		// пойманный пользователем 2026-10-24. Контракт закреплён за интерфейсом, чтобы
		// обе реализации вели себя одинаково; порядок вызовов в проде проверяет
		// tests/unit/obsidian-adapter.test.ts.
		await vault.dataWrite('.sb/logs/plugin-log.jsonl', '{"level":"info"}\n');
		expect(await vault.dataExists('.sb/logs/plugin-log.jsonl')).toBe(true);

		// Вложенность произвольной глубины — тоже без предварительного dataCreateFolder.
		await vault.dataWrite('.sb/backups/2026/10/24/snapshot.json', '{}');
		expect(await vault.dataRead('.sb/backups/2026/10/24/snapshot.json')).toBe('{}');
	});
});
