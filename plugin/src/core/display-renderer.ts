/**
 * display-renderer (модуль этапа B1.2, 09-modules слой 2): показ числовых
 * значений по настройкам `display.*` определения свойства.
 *
 * Нормы: `04-attributes.md` §12 (DL-123), перечисление `display.renderer`
 * (`05-enumerations.md` §3.18 — plain/stars/progress, закрыто), ADR-011.
 *
 * Главный принцип (М1/DL-117): настройки влияют ТОЛЬКО на показ, никогда — на
 * хранение. Символы звёзд (★ U+2605 / ☆ U+2606) и шкал (▰/▱) в данных не
 * хранятся: в файле лежит `rating: 7`, а «звёздочки» рисует слой отображения.
 * Осознанный выбор символов: монохромная пара ★/☆, а не U+2B50 — эмодзи
 * «звезда» в двух кодировках ломал бы поиск и сортировку (DL-117).
 *
 * Слой: ядро (2) — чистые функции, среда-независимы (М2); потребители —
 * формы (property-editor, B1.2) и будущие представления.
 */

import type { PropertyDisplay } from './registry';

/** Закрытый набор способов показа (05-enumerations §3.18). */
export const DISPLAY_RENDERERS = ['plain', 'stars', 'progress'] as const;

export type DisplayRenderer = (typeof DISPLAY_RENDERERS)[number];

/** Результат рендеринга числового значения: текст и данные для UI-контрола. */
export interface NumberDisplayRendered {
	/** Способ показа (из определения; неизвестный/не задан → plain). */
	mode: DisplayRenderer;
	/** Готовый текст для показа (например, «★★★★★★★☆☆☆ 7/10» или «30 %»). */
	text: string;
	/** Доля 0…1 (для графической шкалы в формах; NaN → 0). */
	ratio: number;
	/** Единица измерения (`стр.`, `мин.`, …) или null. */
	unit: string | null;
}

const STAR_FILLED = '★'; // U+2605
const STAR_EMPTY = '☆'; // U+2606
const BAR_FILLED = '▰';
const BAR_EMPTY = '▱';
const BAR_SEGMENTS = 10;

/** Настройки показа по умолчанию (scale_max = 10 — 04-attributes §12). */
export function displayOrDefault(display: PropertyDisplay | null): { renderer: DisplayRenderer; scaleMax: number; unit: string | null } {
	if (display === null || !(DISPLAY_RENDERERS as readonly string[]).includes(display.renderer)) {
		return { renderer: 'plain', scaleMax: display?.scaleMax ?? 10, unit: display?.unit ?? null };
	}
	return { renderer: display.renderer as DisplayRenderer, scaleMax: display.scaleMax, unit: display.unit };
}

/**
 * Рендерит числовое значение по настройкам `display.*`.
 * Нечисловые значения показываются как есть (plain) — слой показа не чинит
 * данные: ошибки типа ловит валидация (value.type_conformance).
 */
export function renderNumberDisplay(value: unknown, display: PropertyDisplay | null): NumberDisplayRendered {
	const settings = displayOrDefault(display);
	const withUnit = (text: string): string => (settings.unit !== null ? `${text} ${settings.unit}` : text);

	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return { mode: 'plain', text: withUnit(String(value ?? '')), ratio: 0, unit: settings.unit };
	}

	switch (settings.renderer) {
		case 'stars': {
			const total = Math.max(1, Math.round(settings.scaleMax));
			const filled = Math.min(total, Math.max(0, Math.round(value)));
			const stars = STAR_FILLED.repeat(filled) + STAR_EMPTY.repeat(total - filled);
			return { mode: 'stars', text: withUnit(`${stars} ${trimNumber(value)}/${total}`), ratio: ratioOf(value, total), unit: settings.unit };
		}
		case 'progress': {
			const ratio = ratioOf(value, settings.scaleMax);
			const filled = Math.round(ratio * BAR_SEGMENTS);
			const bar = BAR_FILLED.repeat(filled) + BAR_EMPTY.repeat(BAR_SEGMENTS - filled);
			return { mode: 'progress', text: withUnit(`${bar} ${Math.round(ratio * 100)} %`), ratio, unit: settings.unit };
		}
		default:
			return { mode: 'plain', text: withUnit(trimNumber(value)), ratio: ratioOf(value, settings.scaleMax), unit: settings.unit };
	}
}

/** Доля value/scaleMax, ограниченная 0…1 (scaleMax ≤ 0 → 0). */
function ratioOf(value: number, scaleMax: number): number {
	if (!Number.isFinite(scaleMax) || scaleMax <= 0) {
		return 0;
	}
	return Math.min(1, Math.max(0, value / scaleMax));
}

/** Число без хвостовых нулей для показа («7», «7.5»). */
function trimNumber(value: number): string {
	return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}
