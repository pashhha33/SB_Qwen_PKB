import { describe, expect, it } from 'vitest';
import {
	formatDateLocal,
	formatDateTimeLocal,
	isDateString,
	isDateTimeString,
	normalizeDateValue,
	normalizeSystemDateTime,
	nowStamp,
} from '../../src/core/datetime';

describe('datetime — локальное время без смещения (ADR-006, 06-time-and-intervals)', () => {
	it('formatDateTimeLocal: YYYY-MM-DDTHH:mm, до минут, с ведущими нулями', () => {
		// Дата конструируется из ЛОКАЛЬНЫХ компонентов — результат не зависит от timezone песочницы.
		expect(formatDateTimeLocal(new Date(2026, 9, 24, 9, 5))).toBe('2026-10-24T09:05');
		expect(formatDateTimeLocal(new Date(2026, 0, 1, 23, 59))).toBe('2026-01-01T23:59');
	});

	it('formatDateLocal: YYYY-MM-DD', () => {
		expect(formatDateLocal(new Date(2026, 8, 14))).toBe('2026-09-14');
	});

	it('nowStamp соответствует формату метки', () => {
		expect(isDateTimeString(nowStamp())).toBe(true);
	});

	it('isDateTimeString: минуты обязательны, секунды допустимы, смещение запрещено', () => {
		expect(isDateTimeString('2026-10-24T09:05')).toBe(true);
		expect(isDateTimeString('2026-10-24T09:05:30')).toBe(true);
		expect(isDateTimeString('2026-10-24T09:05:30Z')).toBe(false); // timezone не храним
		expect(isDateTimeString('2026-10-24T09:05+03:00')).toBe(false);
		expect(isDateTimeString('2026-10-24')).toBe(false); // дата без времени — не datetime
		expect(isDateTimeString('2026-10-24 09:05')).toBe(false); // пробел вместо T
		expect(isDateTimeString(123)).toBe(false);
	});

	it('isDateString: YYYY-MM-DD (частичные даты — тоже формат YYYY-MM-DD, «00» проверяет runner)', () => {
		expect(isDateString('1928-00-00')).toBe(true); // частичная дата: только год
		expect(isDateString('1928-05-00')).toBe(true);
		expect(isDateString('1928-05-14')).toBe(true);
		expect(isDateString('1928-5-14')).toBe(false);
		expect(isDateString('28-05-14')).toBe(false);
	});

	it('normalizeDateValue: Date в полночь → только дата; Date со временем → дата+время; строки не трогает', () => {
		expect(normalizeDateValue(new Date(2026, 8, 14))).toEqual({
			value: '2026-09-14',
			normalized: true,
		});
		expect(normalizeDateValue(new Date(2026, 8, 14, 10, 30))).toEqual({
			value: '2026-09-14T10:30',
			normalized: true,
		});
		expect(normalizeDateValue('1966-00-00')).toEqual({
			value: '1966-00-00',
			normalized: false,
		});
		expect(normalizeDateValue(7)).toEqual({ value: 7, normalized: false });
		expect(normalizeDateValue(null)).toEqual({ value: null, normalized: false });
	});

	it('normalizeSystemDateTime: created_at в полночь СОХРАНЯЕТ время (без эвристики «только дата»)', () => {
		expect(normalizeSystemDateTime(new Date(2026, 9, 24, 0, 0))).toEqual({
			value: '2026-10-24T00:00',
			normalized: true,
		});
		expect(normalizeSystemDateTime('2026-10-24T09:05')).toEqual({
			value: '2026-10-24T09:05',
			normalized: false,
		});
	});
});
