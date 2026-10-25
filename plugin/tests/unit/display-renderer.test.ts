/**
 * Юнит-тесты display-renderer (B1.2 часть 1, DL-268): звёзды/прогресс/plain
 * по настройкам display.* (04-attributes §12, DL-123; 05-enumerations §3.18).
 * Главный принцип: рендеринг НЕ меняет данные (М1/DL-117) — чистая функция.
 */

import { describe, expect, it } from 'vitest';
import { displayOrDefault, renderNumberDisplay } from '../../src/core/display-renderer';

describe('display-renderer — plain (по умолчанию)', () => {
	it('без настроек display — plain: число как есть', () => {
		const r = renderNumberDisplay(7, null);
		expect(r.mode).toBe('plain');
		expect(r.text).toBe('7');
	});

	it('единица измерения добавляется к тексту (unit)', () => {
		expect(renderNumberDisplay(320, { renderer: 'plain', scaleMax: 10, unit: 'стр.' }).text).toBe('320 стр.');
	});

	it('дробные значения — без хвостовых нулей', () => {
		expect(renderNumberDisplay(7.5, null).text).toBe('7.5');
	});

	it('нечисловое значение показывается как есть (слой показа не чинит данные)', () => {
		expect(renderNumberDisplay('много', null).text).toBe('много');
		expect(renderNumberDisplay(undefined, null).text).toBe('');
	});
});

describe('display-renderer — stars (04-attributes §12: ★/☆, U+2605/U+2606)', () => {
	it('rating 7 при scale_max 10 — 7 заполненных звёзд из 10 (пример DL-123)', () => {
		const r = renderNumberDisplay(7, { renderer: 'stars', scaleMax: 10, unit: null });
		expect(r.mode).toBe('stars');
		expect(r.text).toBe('★★★★★★★☆☆☆ 7/10');
		expect(r.ratio).toBeCloseTo(0.7);
	});

	it('scale_max 5 — пять звёзд; округление до целой звезды', () => {
		expect(renderNumberDisplay(3.4, { renderer: 'stars', scaleMax: 5, unit: null }).text).toBe('★★★☆☆ 3.4/5');
	});

	it('выход за шкалу ограничен (0 и scale_max)', () => {
		expect(renderNumberDisplay(12, { renderer: 'stars', scaleMax: 10, unit: null }).text).toBe('★★★★★★★★★★ 12/10');
		expect(renderNumberDisplay(-2, { renderer: 'stars', scaleMax: 10, unit: null }).text).toBe('☆☆☆☆☆☆☆☆☆☆ -2/10');
	});

	it('символы звёзд — монохромная пара (не эмодзи U+2B50 — DL-117)', () => {
		const text = renderNumberDisplay(1, { renderer: 'stars', scaleMax: 5, unit: null }).text;
		expect(text).toContain('\u2605');
		expect(text).toContain('\u2606');
		expect(text).not.toContain('\u2B50');
	});
});

describe('display-renderer — progress', () => {
	it('процент и сегменты шкалы', () => {
		const r = renderNumberDisplay(30, { renderer: 'progress', scaleMax: 100, unit: null });
		expect(r.mode).toBe('progress');
		expect(r.text).toBe('▰▰▰▱▱▱▱▱▱▱ 30 %');
		expect(r.ratio).toBeCloseTo(0.3);
	});

	it('значение больше предела — 100 %', () => {
		expect(renderNumberDisplay(150, { renderer: 'progress', scaleMax: 100, unit: null }).ratio).toBe(1);
	});
});

describe('displayOrDefault — нормализация настроек', () => {
	it('неизвестный renderer деградирует в plain (мягкий отказ)', () => {
		expect(displayOrDefault({ renderer: 'fireworks', scaleMax: 10, unit: null }).renderer).toBe('plain');
	});

	it('scale_max по умолчанию — 10', () => {
		expect(displayOrDefault(null).scaleMax).toBe(10);
	});

	it('unit сохраняется во всех режимах', () => {
		expect(renderNumberDisplay(60, { renderer: 'progress', scaleMax: 100, unit: 'мин.' }).text).toContain('мин.');
	});
});
