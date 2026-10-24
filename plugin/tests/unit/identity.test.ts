import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SbError } from '../../src/core/errors';
import {
	buildFileName,
	fileNameMatchesId,
	fileNameViolations,
	findDuplicateIds,
	newObjectIdentity,
	parseFileName,
	repairFileNameById,
	isValidTypePrefix,
} from '../../src/core/identity';
import { generateUlid } from '../../src/core/ulid';
import { FakeVault } from '../support/fake-vault';

// Эталоны из документации (ADR-001):
const ULID = '01J8Z6M4K2Q7V9X3N5B0C1D2EF';
const OTHER_ULID = '01J8Z6M4K2Q7V9X3N5B0C1D2EG';

describe('identity — TYPE_PREFIX', () => {
	it('принимает префиксы реестра 02-entities, соответствующие схеме defs#type_prefix', () => {
		for (const prefix of ['BOOK', 'PERSON', 'CHP', 'MEDIA', 'PROJECT', 'KNOWLEDGE', 'TAXONOMY', 'FACET', 'CATEGORY', 'RELATION', 'PROPERTY', 'IMGWRAP', 'SERIES']) {
			expect(isValidTypePrefix(prefix)).toBe(true);
		}
	});

	it('F5-7 = А (DL-253): snake_case-префиксы реестра 02-entities легализованы схемой', () => {
		// Реестр 02-entities §6 содержит 12 префиксов с подчёркиванием (OBJECT_TYPE,
		// PROPERTY_TYPE, RELATION_TYPE, SERIES_COLLECTION, AUDIOVISUAL_WORK, MUSIC_TRACK,
		// MUSIC_ALBUM, VIDEO_GAME, WEB_PAGE, VIDEO_SOURCE, AUDIO_SOURCE, MUSIC_WORK),
		// из них 4 длиннее 12 (PROPERTY_TYPE, RELATION_TYPE — 13; AUDIOVISUAL_WORK — 16;
		// SERIES_COLLECTION — 17). Решение F5-7 = А: '_' и длина 3–20 легализованы
		// (схема defs#type_prefix, ADR-001, 02-entities §6; метамодель 1.2.0) —
		// реестр и схема согласованы, бутстрап (A2 часть 2) разблокирован.
		for (const prefix of ['OBJECT_TYPE', 'PROPERTY_TYPE', 'RELATION_TYPE', 'SERIES_COLLECTION', 'AUDIOVISUAL_WORK', 'MUSIC_TRACK', 'MUSIC_ALBUM', 'VIDEO_GAME', 'WEB_PAGE', 'VIDEO_SOURCE', 'AUDIO_SOURCE', 'MUSIC_WORK']) {
			expect(isValidTypePrefix(prefix), `${prefix} отклоняется`).toBe(true);
		}
		expect(parseFileName(`OBJECT_TYPE-${ULID}.md`)).toEqual({ typePrefix: 'OBJECT_TYPE', ulid: ULID });
	});

	it('отклоняет: нижний регистр, короче 3, длиннее 20, начало не с буквы, чужие символы', () => {
		expect(isValidTypePrefix('book')).toBe(false);
		expect(isValidTypePrefix('AB')).toBe(false); // 2 символа
		expect(isValidTypePrefix('ABCDEFGHIJKLMNOPQRSTU')).toBe(false); // 21 символ
		expect(isValidTypePrefix('1BOOK')).toBe(false); // начало с цифры
		expect(isValidTypePrefix('BO-OK.X')).toBe(false); // точка — чужой символ
		expect(isValidTypePrefix('BOOK ')).toBe(false);
	});

	it('дефис и подчёркивание разрешены; границы длины 3 и 20 (ADR-001, F5-7 = А)', () => {
		expect(isValidTypePrefix('WEB-PAGE')).toBe(true);
		expect(isValidTypePrefix('ABCDEFGHIJKLM')).toBe(true); // 13 символов — теперь в границах
		expect(isValidTypePrefix('ABC')).toBe(true); // ровно 3
		expect(isValidTypePrefix('ABCDEFGHIJKLMNOPQRST')).toBe(true); // ровно 20
	});
});

describe('identity — имя файла {TYPE_PREFIX}-{ULID}.md (ADR-001)', () => {
	it('buildFileName собирает каноническое имя', () => {
		expect(buildFileName('BOOK', ULID)).toBe(`BOOK-${ULID}.md`);
	});

	it('buildFileName бросает SbError на невалидных частях', () => {
		expect(() => buildFileName('book', ULID)).toThrow(SbError);
		try {
			buildFileName('BOOK', 'не-ulid');
			expect.unreachable();
		} catch (error) {
			expect((error as SbError).code).toBe('invalid_ulid');
		}
	});

	it('parseFileName разбирает имя и путь', () => {
		expect(parseFileName(`BOOK-${ULID}.md`)).toEqual({ typePrefix: 'BOOK', ulid: ULID });
		expect(parseFileName(`Books/BOOK-${ULID}.md`)).toEqual({ typePrefix: 'BOOK', ulid: ULID });
	});

	it('parseFileName: префикс с дефисом — граница находится от конца (ULID ровно 26)', () => {
		expect(parseFileName(`WEB-PAGE-${ULID}.md`)).toEqual({ typePrefix: 'WEB-PAGE', ulid: ULID });
	});

	it('parseFileName возвращает null для обычных заметок', () => {
		expect(parseFileName('Заметка.md')).toBeNull();
		expect(parseFileName('valid-01-file-format.md')).toBeNull(); // демонстрационные имена examples/
		expect(parseFileName(`BOOK-${ULID.toLowerCase()}.md`)).toBeNull(); // нижний регистр
		expect(parseFileName(`BOOK-${ULID}.txt`)).toBeNull();
	});

	it('И2: fileNameMatchesId сравнивает ULID в имени с id из frontmatter', () => {
		expect(fileNameMatchesId(`BOOK-${ULID}.md`, ULID)).toBe(true);
		expect(fileNameMatchesId(`BOOK-${OTHER_ULID}.md`, ULID)).toBe(false);
		expect(fileNameMatchesId('Заметка.md', ULID)).toBe(false);
	});

	it('И2/M5: repairFileNameById чинит имя ПО id, сохраняя папку и префикс', () => {
		expect(repairFileNameById(`Books/BOOK-${OTHER_ULID}.md`, ULID)).toBe(`Books/BOOK-${ULID}.md`);
		expect(repairFileNameById(`BOOK-${OTHER_ULID}.md`, ULID)).toBe(`BOOK-${ULID}.md`);
	});

	it('repairFileNameById: обычная заметка без fallback-префикса — ошибка', () => {
		expect(() => repairFileNameById('Заметка.md', ULID)).toThrow(SbError);
		expect(repairFileNameById('Заметка.md', ULID, 'KNOWLEDGE')).toBe(`KNOWLEDGE-${ULID}.md`);
	});

	it('repairFileNameById отклоняет невалидный id', () => {
		try {
			repairFileNameById(`BOOK-${ULID}.md`, 'XYZ');
			expect.unreachable();
		} catch (error) {
			expect((error as SbError).code).toBe('invalid_ulid');
		}
	});

	it('newObjectIdentity: префикс + свежий ULID + имя файла согласованы', () => {
		const { identity, fileName } = newObjectIdentity('PERSON');
		expect(isValidTypePrefix(identity.typePrefix)).toBe(true);
		expect(fileName).toBe(`PERSON-${identity.ulid}.md`);
		expect(parseFileName(fileName)).toEqual(identity);
	});
});

describe('identity — запрещённые символы имён (ADR-001)', () => {
	it('ловит # ^ [ ] | и пробелы по краям', () => {
		expect(fileNameViolations('My [note]#1.md').length).toBeGreaterThan(0);
		expect(fileNameViolations('a^b.md').length).toBeGreaterThan(0);
		expect(fileNameViolations('a|b.md').length).toBeGreaterThan(0);
		expect(fileNameViolations(' leading.md').length).toBeGreaterThan(0);
		expect(fileNameViolations('trailing .md ').length).toBeGreaterThan(0);
		expect(fileNameViolations(`BOOK-${ULID}.md`)).toEqual([]);
		expect(fileNameViolations('Обычная заметка.md')).toEqual([]);
	});
});

describe('identity — И1 уникальность: findDuplicateIds на FakeVault', () => {
	let vault: FakeVault;

	beforeEach(async () => {
		vault = await FakeVault.create();
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	const note = (id: string): string => `---\nid: ${id}\ntype: book\ntitle: T\n---\n\nтело\n`;

	it('находит файлы с тем же id и пропускает остальные', async () => {
		await vault.put(`BOOK-${ULID}.md`, note(ULID));
		await vault.put('Books/dup.md', note(ULID));
		await vault.put(`PERSON-${OTHER_ULID}.md`, note(OTHER_ULID));

		const found = await findDuplicateIds(vault, ULID);
		expect(found.sort()).toEqual([`BOOK-${ULID}.md`, 'Books/dup.md'].sort());
	});

	it('excludePath исключает сам проверяемый файл', async () => {
		await vault.put(`BOOK-${ULID}.md`, note(ULID));
		const found = await findDuplicateIds(vault, ULID, `BOOK-${ULID}.md`);
		expect(found).toEqual([]);
	});

	it('id в теле (не в frontmatter) дублем не считается', async () => {
		await vault.put('note.md', `---\ntitle: цитата\n---\n\nТут упоминается ${ULID} в тексте.\n`);
		expect(await findDuplicateIds(vault, ULID)).toEqual([]);
	});

	it('невалидный id — ошибка', async () => {
		await expect(findDuplicateIds(vault, 'oops')).rejects.toThrow(SbError);
	});

	it('ULID генерируется уникальный для серии объектов', () => {
		const ids = new Set(Array.from({ length: 500 }, () => generateUlid()));
		expect(ids.size).toBe(500);
	});
});
