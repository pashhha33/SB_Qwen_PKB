import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseNote, splitFrontmatter } from '../../src/core/markdown-parser';
import { FakeVault } from '../support/fake-vault';

const ULID = '01J8Z6M4K2Q7V9X3N5B0C1D2EF';

describe('markdown-parser — splitFrontmatter', () => {
	it('отделяет блок frontmatter от тела', () => {
		const raw = '---\ntitle: Книга\n---\n\nТело заметки.\n';
		const result = splitFrontmatter(raw);
		expect(result.frontmatterText).toBe('title: Книга');
		expect(result.body).toBe('\nТело заметки.\n');
	});

	it('файл без frontmatter: всё — тело', () => {
		const result = splitFrontmatter('Просто текст\n');
		expect(result.frontmatterText).toBeNull();
		expect(result.body).toBe('Просто текст\n');
	});

	it('--- не в начале файла — не frontmatter', () => {
		const result = splitFrontmatter('Текст\n---\ntitle: x\n---\n');
		expect(result.frontmatterText).toBeNull();
	});

	it('пустой блок frontmatter законен', () => {
		const result = splitFrontmatter('---\n---\nтело');
		expect(result.frontmatterText).toBe('');
		expect(result.body).toBe('тело');
	});

	it('горизонтальная линейка --- в теле не ломает разбор (берётся ПЕРВЫЙ блок)', () => {
		const raw = '---\ntitle: x\n---\n\nТекст\n\n---\n\nЕщё текст\n';
		const result = splitFrontmatter(raw);
		expect(result.frontmatterText).toBe('title: x');
		expect(result.body).toContain('---');
	});
});

describe('markdown-parser — parseNote', () => {
	let vault: FakeVault;

	beforeEach(async () => {
		vault = await FakeVault.create();
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	it('полная заметка: системные атрибуты отделены от предметных свойств', () => {
		const content = [
			'---',
			`id: ${ULID}`,
			'type: book',
			'title: Мастер и Маргарита',
			'aliases:',
			'  - Мастер и Маргарита',
			'  - The Master and Margarita',
			'created_at: 2026-10-22T14:35',
			'updated_at: 2026-10-23T11:20',
			'rating: 7',
			'format: file',
			'categories:',
			'  - "[[CATEGORY-01J8Z6M4K2Q7V9X3N5B0C1D2EN.md|Фантастика]]"',
			'tags:',
			'  - перечитать',
			'---',
			'',
			'Тело.',
			'',
		].join('\n');

		const note = parseNote({ path: `BOOK-${ULID}.md`, content }, vault);
		expect(note.frontmatterPresent).toBe(true);
		expect(note.frontmatterBroken).toBe(false);
		expect(note.system.id).toBe(ULID);
		expect(note.system.type).toBe('book');
		expect(note.system.title).toBe('Мастер и Маргарита');
		expect(note.system.aliases).toEqual(['Мастер и Маргарита', 'The Master and Margarita']);
		expect(note.system.created_at).toBe('2026-10-22T14:35');
		expect(note.system.updated_at).toBe('2026-10-23T11:20');
		expect(note.system.categories).toHaveLength(1);
		expect(note.system.tags).toEqual(['перечитать']);
		// предметные свойства
		expect(note.properties).toEqual({ rating: 7, format: 'file' });
		// идентичность из имени файла
		expect(note.fileNameIdentity).toEqual({ typePrefix: 'BOOK', ulid: ULID });
		expect(note.body.trim()).toBe('Тело.');
	});

	it('CRLF (Windows) разбирается так же, как LF', () => {
		const content = `---\r\nid: ${ULID}\r\ntype: book\r\n---\r\n\r\nТело.\r\n`;
		const note = parseNote({ path: `BOOK-${ULID}.md`, content }, vault);
		expect(note.system.id).toBe(ULID);
		expect(note.system.type).toBe('book');
		expect(note.body).toContain('Тело.');
	});

	it('BOM снимается и фиксируется в issues', () => {
		const note = parseNote({ path: 'a.md', content: `\uFEFF---\ntitle: T\n---\nbody` }, vault);
		expect(note.system.title).toBe('T');
		expect(note.issues.some((issue) => issue.code === 'bom_stripped')).toBe(true);
	});

	it('заметка без frontmatter: frontmatterPresent false, всё в теле', () => {
		const note = parseNote({ path: 'Заметка.md', content: 'Просто текст' }, vault);
		expect(note.frontmatterPresent).toBe(false);
		expect(note.system).toEqual({});
		expect(note.properties).toEqual({});
		expect(note.body).toBe('Просто текст');
		expect(note.fileNameIdentity).toBeNull();
	});

	it('сломанный YAML: не исключение, а frontmatterBroken + issue yaml_error (ADR-002)', () => {
		const content = '---\ntitle: [незакрытая\n  broken: : :\n---\n\nтело\n';
		const note = parseNote({ path: 'x.md', content }, vault);
		expect(note.frontmatterBroken).toBe(true);
		expect(note.issues.some((issue) => issue.code === 'yaml_error')).toBe(true);
		expect(note.system).toEqual({});
		expect(note.body).toContain('тело');
	});

	it('frontmatter-список (не «ключ: значение») — frontmatter_not_mapping', () => {
		const content = '---\n- пункт 1\n- пункт 2\n---\nтело';
		const note = parseNote({ path: 'x.md', content }, vault);
		expect(note.frontmatterBroken).toBe(true);
		expect(note.issues.some((issue) => issue.code === 'frontmatter_not_mapping')).toBe(true);
	});

	it('aliases строкой нормализуется в массив (модель едина)', () => {
		const note = parseNote({ path: 'x.md', content: '---\ntitle: T\naliases: jedno\n---\n' }, vault);
		expect(note.system.aliases).toEqual(['jedno']);
	});

	it('голая дата YAML (Date-объект) нормализуется в строку (конвенция DL-228)', () => {
		const content = '---\ntitle: T\nfinished_on: 2026-09-14\ncreated_at: 2026-09-14 10:30:00\n---\n';
		const note = parseNote({ path: 'x.md', content }, vault);
		expect(note.properties.finished_on).toBe('2026-09-14');
		expect(note.system.created_at).toBe('2026-09-14T10:30');
		expect(note.issues.filter((issue) => issue.code === 'date_normalized').length).toBe(2);
	});

	it('created_at в полночь сохраняет время (системный datetime не урезается до даты)', () => {
		const note = parseNote({ path: 'x.md', content: '---\ncreated_at: 2026-09-14 00:00:00\n---\n' }, vault);
		expect(note.system.created_at).toBe('2026-09-14T00:00');
	});

	it('TZ-баг исправлен (DL-245): некавычные даты нормализуются лексически, результат не зависит от timezone машины', () => {
		// js-yaml разбирает некавычные метки времени как UTC; на машине UTC+3 прежняя
		// реализация выдавала «2026-09-14T03:00» вместо «2026-09-14». Лексический
		// уровень берёт значение из сырого текста frontmatter — «что написано».
		const content = '---\ntitle: T\nfinished_on: 2026-09-14\nupdated_at: 2026-09-14T10:30:00+03:00\n---\n';
		const note = parseNote({ path: 'x.md', content }, vault);
		expect(note.properties.finished_on).toBe('2026-09-14');
		expect(note.system.updated_at).toBe('2026-09-14T10:30'); // смещение отброшено, стена сохранена
	});

	it('нестроковые aliases (числа) не нормализуются молча — остаются вне system', () => {
		const note = parseNote({ path: 'x.md', content: '---\naliases: 42\n---\n' }, vault);
		// Парсер не «чинит молча» (спецификация v1.0 §19): значение не строковое —
		// в нормализованную модель не попадает, проблему увидит валидация (группа A).
		expect(note.system.aliases).toBeUndefined();
	});

	it('пустой frontmatter: present true, полей нет', () => {
		const note = parseNote({ path: 'x.md', content: '---\n---\nтело' }, vault);
		expect(note.frontmatterPresent).toBe(true);
		expect(note.system).toEqual({});
		expect(note.frontmatterBroken).toBe(false);
	});
});
