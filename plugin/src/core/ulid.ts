/**
 * ULID — идентификатор объекта (ADR-001, инвариант И1).
 *
 * ULID (термин) = «сортируемый по времени уникальный идентификатор»:
 * 26 символов Crockford Base32, первые 10 кодируют время создания в миллисекундах,
 * остальные 16 — случайные. В отличие от UUID короче, читается одним регистром
 * и сортируется как строка в хронологическом порядке.
 *
 * Алфавит Crockford: 0-9 A-Z БЕЗ I, L, O, U (чтобы не путать с 1, 1, 0 и не читать
 * ругательство «F.U.»). Регистр — верхний. Пример: 01J8Z6M4K2Q7V9X3N5B0C1D2EF.
 *
 * Соответствие схеме: schema/common/defs.json#$defs.ulid — паттерн
 * ^[0-9A-HJKMNP-TV-Z]{26}$ (тот же алфавит, записанный диапазонами).
 *
 * Своей зависимости нет (рамки: минимум зависимостей): реализация ~60 строк,
 * крипто-случайность — стандартный crypto.getRandomValues (есть и в Node 20+,
 * и в renderer Obsidian).
 */

/** Алфавит Crockford Base32 (32 символа, без I L O U). */
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Паттерн валидного ULID — зеркало defs.json#$defs.ulid. */
export const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** Длина ULID в символах. */
export const ULID_LENGTH = 26;

/** Длина временной части (48 бит времени = 10 символов base32). */
const TIME_LENGTH = 10;

/** Длина случайной части (80 бит = 16 символов). */
const RANDOM_LENGTH = 16;

/** Проверяет, что строка — валидный ULID (формат И1; уникальность — не здесь). */
export function isValidUlid(value: unknown): value is string {
	return typeof value === 'string' && ULID_PATTERN.test(value);
}

/**
 * Кодирует неотрицательное целое в base32 фиксированной длины (старшие разряды first).
 */
function encodeBase32(value: number, length: number): string {
	let rest = value;
	let out = '';
	for (let i = length - 1; i >= 0; i--) {
		out = CROCKFORD_ALPHABET[rest % 32] + out;
		rest = Math.floor(rest / 32);
	}
	return out;
}

/** Декодирует base32-строку в число. */
function decodeBase32(text: string): number {
	let value = 0;
	for (const char of text) {
		const digit = CROCKFORD_ALPHABET.indexOf(char);
		if (digit < 0) {
			return NaN;
		}
		value = value * 32 + digit;
	}
	return value;
}

/**
 * Случайные байты. crypto.getRandomValues доступен и в Obsidian (Chromium),
 * и в Node 18+ (globalThis.crypto).
 */
function randomBytes(length: number): Uint8Array {
	const bytes = new Uint8Array(length);
	globalThis.crypto.getRandomValues(bytes);
	return bytes;
}

/**
 * Генерирует ULID.
 *
 * @param timeMs — метка времени в миллисекундах (по умолчанию Date.now());
 *                 параметр нужен для детерминированных тестов.
 * @param random — необязательные готовые байты случайной части (16 штук) для тестов.
 *
 * Замечание о монотонности: в пределах одной миллисекунды порядок случайный —
 * для нашего сценария (создание объектов человеком) этого достаточно: точность
 * времени в данных всё равно до минут (ADR-006), а коллизия 80 случайных бит
 * практически невозможна. Осознанное упрощение против библиотеки `ulid`
 * (monotonic factory) — фиксируем здесь, а не в отдельном ADR.
 */
export function generateUlid(timeMs: number = Date.now(), random?: Uint8Array): string {
	if (!Number.isFinite(timeMs) || timeMs < 0) {
		throw new RangeError(`generateUlid: время должно быть неотрицательным числом, получено ${timeMs}`);
	}
	const timePart = encodeBase32(timeMs, TIME_LENGTH);

	const bytes = random ?? randomBytes(RANDOM_LENGTH);
	if (bytes.length < RANDOM_LENGTH) {
		throw new RangeError(`generateUlid: нужно минимум ${RANDOM_LENGTH} случайных байт, получено ${bytes.length}`);
	}
	let randomPart = '';
	for (let i = 0; i < RANDOM_LENGTH; i++) {
		// 256 % 32 === 0 → взятие остатка не создаёт перекоса распределения.
		randomPart += CROCKFORD_ALPHABET[bytes[i] % 32];
	}
	return timePart + randomPart;
}

/**
 * Извлекает метку времени (мс) из ULID. Для невалидного ULID — NaN.
 * Используется диагностикой («когда создан объект по его id») и тестами.
 */
export function decodeUlidTime(ulid: string): number {
	if (!isValidUlid(ulid)) {
		return NaN;
	}
	return decodeBase32(ulid.slice(0, TIME_LENGTH));
}
