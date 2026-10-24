/**
 * Интеграционный тест: универсальный парсер против 64 примеров шага 9 (+F5-8, DL-252)
 * (examples/instances/) — те самые заметки, на которых зелёный `npm run check`
 * (схемы + runner), должны безупречно читаться парсером плагина.
 *
 * Важное соглашение примеров (записано в них самих): «Имя файла примера —
 * демонстрационное; инвариант И2 (id ↔ имя файла) применяется к реальным
 * заметкам хранилища, а не к папке examples/». Поэтому И2 здесь НЕ проверяется;
 * проверяется каноничность ПОСТРОЕНИЯ имени (buildFileName) из type+id.
 */

import { describe, expect, it } from 'vitest';
import { buildFileName, isValidTypePrefix } from '../../src/core/identity';
import { parseNote } from '../../src/core/markdown-parser';
import { isValidUlid } from '../../src/core/ulid';
import { TYPE_PREFIX_BY_TYPE, loadExamples } from '../support/examples';
import { FakeVault } from '../support/fake-vault';

describe('парсер × примеры репозитория (64 файла, шаг 9 + F5-8)', () => {
	it('все примеры читаются: 64 файла, ни одной ошибки YAML', async () => {
		const vault = await FakeVault.create();
		try {
			const examples = await loadExamples();
			expect(examples.length).toBe(64); // защита от дрейфа: число примеров = учтённое в чек-листе (62 шага 9 + 2 F5-8, DL-252)

			for (const example of examples) {
				const note = parseNote({ path: example.relative, content: example.content }, vault);

				// Структурный разбор успешен для всех (и valid, и invalid — «некорректность»
				// примеров семантическая, ловится схемой/runner, не парсером).
				expect(note.frontmatterPresent, example.relative).toBe(true);
				expect(note.frontmatterBroken, `${example.relative}: issues=${JSON.stringify(note.issues)}`).toBe(false);
				expect(
					note.issues.filter((issue) => issue.code === 'yaml_error'),
					example.relative,
				).toHaveLength(0);

				// Тип из frontmatter совпадает с папкой примера.
				expect(note.system.type, example.relative).toBe(example.type);
			}
		} finally {
			await vault.cleanup();
		}
	});

	it('корректные примеры (valid-*): И1 — id валидный ULID; И4 — aliases[0] == title; каноническое имя строится', async () => {
		const vault = await FakeVault.create();
		try {
			const examples = await loadExamples();
			const valid = examples.filter((example) => example.validity === 'valid');
			expect(valid.length).toBeGreaterThanOrEqual(36); // ≥3 на каждый из 12 md-типов (минимумы D3)

			for (const example of valid) {
				const note = parseNote({ path: example.relative, content: example.content }, vault);
				const where = example.relative;

				// И1 (формат): id есть и это валидный ULID.
				expect(note.system.id, `${where}: нет id`).toBeDefined();
				expect(isValidUlid(note.system.id), `${where}: id не ULID`).toBe(true);

				// title есть (системный атрибут).
				expect(note.system.title, `${where}: нет title`).toBeDefined();

				// И4: aliases[0] == title (если aliases заданы).
				if (note.system.aliases !== undefined && note.system.aliases.length > 0) {
					expect(note.system.aliases[0], `${where}: И4 нарушен`).toBe(note.system.title);
				}

				// Префикс типа известен (реестр 02-entities) и проходит валидацию схемы
				// defs#type_prefix — для всех типов, включая snake_case OBJECT_TYPE и
				// RELATION_TYPE (F5-7 = А, DL-253: '_' и длина 3–20 легализованы).
				const prefix = TYPE_PREFIX_BY_TYPE[example.type];
				expect(prefix, `${where}: нет префикса в реестре для ${example.type}`).toBeDefined();
				expect(isValidTypePrefix(prefix), `${where}: префикс ${prefix} не проходит defs#type_prefix`).toBe(true);
				const canonical = buildFileName(prefix, note.system.id as string);
				expect(canonical).toBe(`${prefix}-${note.system.id}.md`);

				// created_at/updated_at у корректных примеров — строки нормативного формата.
				expect(note.system.created_at, `${where}: нет created_at`).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
				expect(note.system.updated_at, `${where}: нет updated_at`).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
			}
		} finally {
			await vault.cleanup();
		}
	});

	it('некорректные примеры (invalid-*): парсер не падает и ничего не «чинит молча»', async () => {
		const vault = await FakeVault.create();
		try {
			const examples = await loadExamples();
			const invalid = examples.filter((example) => example.validity === 'invalid');
			expect(invalid.length).toBeGreaterThanOrEqual(24); // ≥2 на каждый из 12 md-типов (минимумы D4)

			for (const example of invalid) {
				const note = parseNote({ path: example.relative, content: example.content }, vault);
				// Нарушения — забота схемы и runner'а; парсер лишь честно возвращает, что есть.
				expect(note.frontmatterPresent, example.relative).toBe(true);
				expect(typeof note.body).toBe('string');
			}

			// Контрольная точка: у person/invalid-01.md действительно нет id (разбор D4) —
			// парсер возвращает system без id, а не выдуманное значение.
			const personInvalid = examples.find((example) => example.relative === 'person/invalid-01.md');
			expect(personInvalid).toBeDefined();
			const note = parseNote(
				{ path: personInvalid!.relative, content: personInvalid!.content },
				vault,
			);
			expect(note.system.id).toBeUndefined();
		} finally {
			await vault.cleanup();
		}
	});

	it('тело глав содержит блок sb-chapter-nav, и wikilink-и внутри него НЕ извлекаются (DL-129)', async () => {
		const vault = await FakeVault.create();
		try {
			const examples = await loadExamples();
			const chapter = examples.find((example) => example.relative === 'chapter/valid-01-numbered.md');
			expect(chapter).toBeDefined();
			const note = parseNote({ path: chapter!.relative, content: chapter!.content }, vault);
			expect(note.body).toContain('```sb-chapter-nav');
			// Внутри блока — пусто (```\nsb-chapter-nav\n```), ссылок в теле главы нет.
			expect(note.wikilinks).toHaveLength(0);
		} finally {
			await vault.cleanup();
		}
	});

	it('И8 у media: встраивание ![[файл|подпись]] в теле извлекается как embed', async () => {
		const vault = await FakeVault.create();
		try {
			const examples = await loadExamples();
			const media = examples.filter((example) => example.type === 'media' && example.validity === 'valid');
			expect(media.length).toBeGreaterThan(0);
			let embedsFound = 0;
			for (const example of media) {
				const note = parseNote({ path: example.relative, content: example.content }, vault);
				embedsFound += note.wikilinks.filter((link) => link.isEmbed).length;
			}
			expect(embedsFound).toBeGreaterThan(0);
		} finally {
			await vault.cleanup();
		}
	});
});
