/**
 * Идентичность объекта (модуль identity, этап A; нормы: ADR-001, инварианты И1–И3).
 *
 * Отвечает за:
 *  - имя файла объекта: {TYPE_PREFIX}-{ULID}.md;
 *  - TYPE_PREFIX: UPPER_SNAKE_CASE, 3–20 символов, A–Z, 0–9, дефис, подчёркивание
 *    (ADR-001, 02-entities §6; F5-7 = А, DL-253; схема defs.json#$defs.type_prefix);
 *  - И1 (формат ULID; уникальность в хранилище — findDuplicateIds);
 *  - И2 (id из frontmatter совпадает с ULID в имени файла; при расхождении имя
 *    файла ЧИНИТСЯ ПО id — мера M5: repairFileNameById);
 *  - запрещённые символы имён файлов (ADR-001): [ ] # ^ | и пробелы по краям.
 *
 * И3 (type указывает на существующий неабстрактный тип) требует реестра типов —
 * проверяется в под-батче A2 (type-registry + validation), здесь не реализуется.
 */

import type { VaultAdapter } from '../adapter/vault-adapter';
import { SbError } from './errors';
import type { ObjectIdentity } from './model';
import { generateUlid, isValidUlid } from './ulid';

/** Паттерн TYPE_PREFIX — зеркало defs.json#$defs.type_prefix (F5-7 = А, DL-253). */
export const TYPE_PREFIX_PATTERN = /^[A-Z][A-Z0-9_-]*$/;

/** Границы длины TYPE_PREFIX (ADR-001/02-entities §6: 3–20 символов, F5-7 = А). */
export const TYPE_PREFIX_MIN_LENGTH = 3;
export const TYPE_PREFIX_MAX_LENGTH = 20;

/** Запрещённые в именах файлов символы (ADR-001): квадратные скобки, # ^ |. */
export const FORBIDDEN_FILE_NAME_CHARS = /[#^[\]|]/;

/**
 * Разбор имени файла объекта: {TYPE_PREFIX}-{ULID}.md.
 * ULID всегда ровно 26 символов, поэтому граница префикса ищется ОТ КОНЦА —
 * это важно, потому что сам TYPE_PREFIX может содержать дефисы (например,
 * гипотетический 'AUDIO-BOOK'). Примеры из реестра 02-entities: OBJECT_TYPE,
 * RELATION_TYPE, SERIES_COLLECTION, CHP, MEDIA.
 *
 * Разбор ДЕЛИКАТЕН: прочитать существующее имя — не значит одобрить его.
 * С символьным составом префикса (включая '_' — F5-7 = А, DL-253) разбор и
 * валидация согласованы; строгость (длины, начало с буквы) живёт в isValidTypePrefix.
 */
const OBJECT_FILE_NAME_PATTERN = /^([A-Z][A-Z0-9_-]*)-([0-9A-HJKMNP-TV-Z]{26})\.md$/;

export function isValidTypePrefix(prefix: unknown): prefix is string {
	return (
		typeof prefix === 'string' &&
		TYPE_PREFIX_PATTERN.test(prefix) &&
		prefix.length >= TYPE_PREFIX_MIN_LENGTH &&
		prefix.length <= TYPE_PREFIX_MAX_LENGTH
	);
}

/** Проверяет имя файла на запрещённые символы и пробелы по краям (ADR-001). */
export function fileNameViolations(fileName: string): string[] {
	const violations: string[] = [];
	if (FORBIDDEN_FILE_NAME_CHARS.test(fileName)) {
		violations.push('имя файла содержит запрещённые символы (# ^ [ ] |)');
	}
	if (fileName !== fileName.trim()) {
		violations.push('имя файла содержит ведущие или завершающие пробелы');
	}
	return violations;
}

/** Собирает имя файла объекта: {TYPE_PREFIX}-{ULID}.md. Бросает SbError на невалидных частях. */
export function buildFileName(typePrefix: string, ulid: string): string {
	if (!isValidTypePrefix(typePrefix)) {
		throw new SbError(
			'invalid_type_prefix',
			`Некорректный TYPE_PREFIX «${typePrefix}»: 3–20 символов, A–Z, 0–9, дефис, подчёркивание; начало с буквы`,
		);
	}
	if (!isValidUlid(ulid)) {
		throw new SbError('invalid_ulid', `Некорректный ULID «${ulid}»: ожидается 26 символов Crockford Base32`);
	}
	return `${typePrefix}-${ulid}.md`;
}

/**
 * Разбирает имя файла {TYPE_PREFIX}-{ULID}.md. Возвращает null, если имя
 * не подходит под формат (например, обычная заметка пользователя «Заметка.md»
 * или демонстрационные имена examples/ — на них И2 не распространяется).
 * Принимает и полный путь, и голое имя файла.
 */
export function parseFileName(fileNameOrPath: string): ObjectIdentity | null {
	const fileName = fileNameOrPath.includes('/')
		? fileNameOrPath.slice(fileNameOrPath.lastIndexOf('/') + 1)
		: fileNameOrPath;
	const match = OBJECT_FILE_NAME_PATTERN.exec(fileName);
	if (!match) {
		return null;
	}
	return { typePrefix: match[1], ulid: match[2] };
}

/** Инвариант И2 (проверка): ULID в имени файла совпадает с id из frontmatter. */
export function fileNameMatchesId(fileNameOrPath: string, id: string): boolean {
	const identity = parseFileName(fileNameOrPath);
	return identity !== null && identity.ulid === id;
}

/**
 * Инвариант И2 (починка, мера M5 ADR-001): при расхождении id и ULID в имени файла
 * имя файла чинится ПО id — id первичен, он не переиспользуется и не меняется.
 * Префикс и папка сохраняются. Например:
 *   'Books/BOOK-01J8...C1D2EF.md' + id '01J8...XXXXXX' → 'Books/BOOK-01J8...XXXXXX.md'
 * Если имя файла не формата {TYPE_PREFIX}-{ULID}.md, prefix берётся аргументом.
 */
export function repairFileNameById(
	fileNameOrPath: string,
	id: string,
	typePrefixFallback?: string,
): string {
	if (!isValidUlid(id)) {
		throw new SbError('invalid_ulid', `Починка имени файла невозможна: id «${id}» — не валидный ULID`);
	}
	const folder = fileNameOrPath.includes('/')
		? fileNameOrPath.slice(0, fileNameOrPath.lastIndexOf('/') + 1)
		: '';
	const current = parseFileName(fileNameOrPath);
	const prefix = current?.typePrefix ?? typePrefixFallback;
	if (!prefix) {
		throw new SbError(
			'invalid_file_name',
			`Не могу починить имя «${fileNameOrPath}»: формат не {TYPE_PREFIX}-{ULID}.md и не передан typePrefixFallback`,
		);
	}
	return folder + buildFileName(prefix, id);
}

/** Создаёт новую идентичность объекта: свежий ULID + имя файла. */
export function newObjectIdentity(typePrefix: string, timeMs?: number): { identity: ObjectIdentity; fileName: string } {
	const ulid = generateUlid(timeMs);
	const identity: ObjectIdentity = { typePrefix, ulid };
	return { identity, fileName: buildFileName(typePrefix, ulid) };
}

/**
 * Инвариант И1 (уникальность): ищет в хранилище Markdown-файлы, у которых в
 * frontmatter тот же id. Используется командой create-object (A2) ПЕРЕД созданием
 * и диагностикой object.id.unique.
 *
 * Производительность: полный проход по заметкам (O(N)) — для MVP допустимо;
 * в A2 появится реестр с кэшем .sb/cache/ (модуль type-registry, правило М5:
 * кэш перестраивается командой), и поиск станет индексным.
 */
export async function findDuplicateIds(
	adapter: VaultAdapter,
	id: string,
	excludePath?: string,
): Promise<string[]> {
	if (!isValidUlid(id)) {
		throw new SbError('invalid_ulid', `findDuplicateIds: «${id}» — не валидный ULID`);
	}
	const duplicates: string[] = [];
	const paths = await adapter.listMarkdown();
	for (const path of paths) {
		if (excludePath !== undefined && path === excludePath) {
			continue;
		}
		// Быстрый предварительный фильтр по сырому тексту: если подстроки id нет —
		// файл точно не дубль. Это НЕ самописный разбор YAML (фильтр ничего не
		// решает), полное чтение — только для кандидатов; итог сверяется через парсер.
		const raw = await adapter.read(path);
		if (!raw.includes(id)) {
			continue;
		}
		const idMatch = /^id:[ \t]*["']?([0-9A-HJKMNP-TV-Z]{26})["']?[ \t]*$/m.exec(raw);
		if (idMatch && idMatch[1] === id) {
			duplicates.push(path);
		}
	}
	return duplicates;
}
