/**
 * Тесты date-engine (B1.1 часть 1, DL-263): правила группы H реестра
 * (date.format, date.partial.no_gap, date.partial.unknown_only_zero, date.range.valid,
 * datetime.format, datetime.no_seconds) + нормализация частичных дат в диапазон (П4,
 * мера M4 ADR-011) + сравнение по П3. Норма: 06-time-and-intervals §1–§2.
 */

import { describe, expect, it } from 'vitest';
import {
	comparePartialDates,
	daysInMonth,
	isLeapYear,
	normalizePartialDateToRange,
	validateDateTimeValue,
	validateDateValue,
} from '../../src/core/date-engine';

function codes(result: { violations: { rule_id: string }[] }): string[] {
	return result.violations.map((v) => v.rule_id);
}

describe('date-engine — validateDateValue (правила группы H)', () => {
	it('полные и частичные даты в формате — ok', () => {
		for (const value of ['1928-05-15', '1928-05-00', '1928-00-00', '2026-10-25', '0000-00-00']) {
			expect(validateDateValue(value).ok, value).toBe(true);
		}
	});

	it('date.format: не строка и произвольный текст', () => {
		expect(codes(validateDateValue(1928))).toEqual(['date.format']);
		expect(codes(validateDateValue(null))).toEqual(['date.format']);
		expect(codes(validateDateValue('15.05.1928'))).toEqual(['date.format']);
		expect(codes(validateDateValue('1928-5-15'))).toEqual(['date.format']);
	});

	it('date.partial.no_gap: неизвестный компонент не идёт после известного (П1)', () => {
		expect(codes(validateDateValue('1928-00-15'))).toEqual(['date.partial.no_gap']);
		expect(codes(validateDateValue('0000-05-00'))).toEqual(['date.partial.no_gap']);
		expect(codes(validateDateValue('0000-00-15'))).toEqual(['date.partial.no_gap']);
		// Порядок «год → месяц → день» не нарушен:
		expect(validateDateValue('1928-05-00').ok).toBe(true);
	});

	it('date.partial.unknown_only_zero: заполнители неизвестных компонентов — только «00»', () => {
		expect(codes(validateDateValue('1928-??-00'))).toEqual(['date.partial.unknown_only_zero']);
		expect(codes(validateDateValue('1928-XX-00'))).toEqual(['date.partial.unknown_only_zero']);
		expect(codes(validateDateValue('1928-0-0'))).toEqual(['date.partial.unknown_only_zero']);
	});

	it('date.range.valid: день допустим для месяца и года, високосные учтены', () => {
		expect(codes(validateDateValue('2026-02-30'))).toEqual(['date.range.valid']);
		expect(codes(validateDateValue('2026-04-31'))).toEqual(['date.range.valid']);
		expect(codes(validateDateValue('2025-02-29'))).toEqual(['date.range.valid']); // не високосный
		expect(validateDateValue('2024-02-29').ok).toBe(true); // високосный
		expect(validateDateValue('2000-02-29').ok).toBe(true); // делится на 400
		expect(codes(validateDateValue('1900-02-29'))).toEqual(['date.range.valid']); // делится на 100, не на 400
	});

	it('високосные годы и дни месяцев (справочные функции)', () => {
		expect(isLeapYear(2024)).toBe(true);
		expect(isLeapYear(2026)).toBe(false);
		expect(isLeapYear(1900)).toBe(false);
		expect(isLeapYear(2000)).toBe(true);
		expect(daysInMonth(2026, 2)).toBe(28);
		expect(daysInMonth(2024, 2)).toBe(29);
		expect(daysInMonth(2026, 4)).toBe(30);
		expect(daysInMonth(2026, 12)).toBe(31);
	});
});

describe('date-engine — validateDateTimeValue', () => {
	it('минутная точность — ok; секунды — предупреждение datetime.no_seconds (специальное правило)', () => {
		expect(validateDateTimeValue('2026-10-22T14:35').ok).toBe(true);
		const withSeconds = validateDateTimeValue('2026-10-22T14:35:59');
		expect(withSeconds.ok).toBe(false);
		expect(withSeconds.violations).toHaveLength(1);
		expect(withSeconds.violations[0].rule_id).toBe('datetime.no_seconds');
		expect(withSeconds.violations[0].severity).toBe('warning');
	});

	it('datetime.format: не строка, дата без времени, мусор', () => {
		expect(codes(validateDateTimeValue(20261022))).toEqual(['datetime.format']);
		expect(codes(validateDateTimeValue('2026-10-22'))).toEqual(['datetime.format']);
		expect(codes(validateDateTimeValue('22.10.2026 14:35'))).toEqual(['datetime.format']);
	});

	it('дата внутри datetime проверяется правилами группы H (частичные не хранятся)', () => {
		expect(codes(validateDateTimeValue('2026-02-30T10:00'))).toEqual(['date.range.valid']);
	});
});

describe('date-engine — нормализация в диапазон (П4) и сравнение (П3)', () => {
	it('normalizePartialDateToRange: только год / год+месяц / полная / неизвестная', () => {
		expect(normalizePartialDateToRange('1928-00-00')).toEqual({ from: '1928-01-01', to: '1928-12-31' });
		expect(normalizePartialDateToRange('1928-05-00')).toEqual({ from: '1928-05-01', to: '1928-05-31' });
		expect(normalizePartialDateToRange('1928-02-00')).toEqual({ from: '1928-02-01', to: '1928-02-29' }); // високосный
		expect(normalizePartialDateToRange('1928-05-15')).toEqual({ from: '1928-05-15', to: '1928-05-15' });
		expect(normalizePartialDateToRange('0000-00-00')).toBeNull();
		expect(normalizePartialDateToRange('мусор')).toBeNull();
	});

	it('comparePartialDates: неизвестный компонент меньше любого известного (П3)', () => {
		expect(comparePartialDates('1928-00-00', '1928-05-00')).toBe(-1);
		expect(comparePartialDates('1928-05-00', '1928-05-15')).toBe(-1);
		expect(comparePartialDates('1928-05-15', '1929-00-00')).toBe(-1);
		expect(comparePartialDates('1928-05-15', '1928-05-15')).toBe(0);
		expect(comparePartialDates('1928-05-15', 'мусор')).toBeNull();
	});
});
