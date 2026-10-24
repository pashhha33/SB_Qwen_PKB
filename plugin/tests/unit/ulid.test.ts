import { describe, expect, it } from 'vitest';
import {
	CROCKFORD_ALPHABET,
	ULID_LENGTH,
	ULID_PATTERN,
	decodeUlidTime,
	generateUlid,
	isValidUlid,
} from '../../src/core/ulid';

describe('ulid — генерация и проверка (ADR-001, И1)', () => {
	it('алфавит Crockford: 32 символа, без I L O U', () => {
		expect(CROCKFORD_ALPHABET).toHaveLength(32);
		for (const forbidden of ['I', 'L', 'O', 'U']) {
			expect(CROCKFORD_ALPHABET).not.toContain(forbidden);
		}
	});

	it('сгенерированный ULID: 26 символов, верхний регистр, только алфавит Crockford', () => {
		for (let i = 0; i < 100; i++) {
			const ulid = generateUlid();
			expect(ulid).toHaveLength(ULID_LENGTH);
			expect(ULID_PATTERN.test(ulid)).toBe(true);
		}
	});

	it('детерминирован при фиксированных времени и случайных байтах (для тестов)', () => {
		const zeros = new Uint8Array(16);
		expect(generateUlid(0, zeros)).toBe('0'.repeat(26));
		const bytes = Uint8Array.from({ length: 16 }, (_, i) => i + 1);
		const again = generateUlid(1234567890123, bytes);
		expect(again).toBe(generateUlid(1234567890123, bytes));
	});

	it('время кодируется в первых 10 символах и декодируется обратно', () => {
		const time = Date.parse('2026-10-23T12:00:00Z');
		const ulid = generateUlid(time);
		expect(decodeUlidTime(ulid)).toBe(time);
	});

	it('лексикографический порядок = хронологический (сортируемость ULID)', () => {
		const early = generateUlid(1000);
		const late = generateUlid(2000);
		expect(early < late).toBe(true);
	});

	it('5000 подряд сгенерированных ULID уникальны', () => {
		const seen = new Set<string>();
		for (let i = 0; i < 5000; i++) {
			seen.add(generateUlid());
		}
		expect(seen.size).toBe(5000);
	});

	it('isValidUlid отклоняет неформат', () => {
		expect(isValidUlid('01J8Z6M4K2Q7V9X3N5B0C1D2EF')).toBe(true); // эталон из ADR-001
		expect(isValidUlid('01j8z6m4k2q7v9x3n5b0c1d2ef')).toBe(false); // нижний регистр
		expect(isValidUlid('01J8Z6M4K2Q7V9X3N5B0C1D2E')).toBe(false); // 25 символов
		expect(isValidUlid('01J8Z6M4K2Q7V9X3N5B0C1D2EFF')).toBe(false); // 27 символов
		expect(isValidUlid('01J8Z6M4K2Q7V9X3N5B0C1D2EL')).toBe(false); // L вне алфавита (находка DL-237)
		expect(isValidUlid('01J8Z6M4K2Q7V9X3N5B0C1D2EU')).toBe(false); // U вне алфавита
		expect(isValidUlid('01J8Z6M4K2Q7V9X3N5B0C1D2EI')).toBe(false); // I вне алфавита
		expect(isValidUlid('01J8Z6M4K2Q7V9X3N5B0C1D2EO')).toBe(false); // O вне алфавита
		expect(isValidUlid(42)).toBe(false); // не строка
		expect(isValidUlid(null)).toBe(false);
	});

	it('decodeUlidTime для невалидного ULID → NaN', () => {
		expect(Number.isNaN(decodeUlidTime('не-ulid'))).toBe(true);
	});

	it('отрицательное время — ошибка (RangeError)', () => {
		expect(() => generateUlid(-1)).toThrow(RangeError);
	});
});
