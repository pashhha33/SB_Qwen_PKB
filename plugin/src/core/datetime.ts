/**
 * Дата и время проекта (ADR-006, 06-time-and-intervals).
 *
 * Норма хранения: ЛОКАЛЬНОЕ время без смещения (timezone), точность до минут:
 *   дата      — YYYY-MM-DD          (частичные даты: 1928-00-00 — только год)
 *   дата+время — YYYY-MM-DDTHH:mm   (секунды допустимы схемой, но не создаются плагином)
 *
 * Известное ограничение G-04-1 (зафиксировано, не чинится в MVP): при создании
 * заметок в разных часовых поясах хронологический порядок может нарушаться.
 */

function pad(value: number, width = 2): string {
	return String(value).padStart(width, '0');
}

/** Локальная дата Date → 'YYYY-MM-DD'. */
export function formatDateLocal(value: Date): string {
	return `${pad(value.getFullYear(), 4)}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/** Локальные дата+время Date → 'YYYY-MM-DDTHH:mm' (точность до минут, ADR-006). */
export function formatDateTimeLocal(value: Date): string {
	return `${formatDateLocal(value)}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

/** Текущая метка 'YYYY-MM-DDTHH:mm' — для created_at/updated_at новых объектов (этап A2). */
export function nowStamp(): string {
	return formatDateTimeLocal(new Date());
}

/** Локальные дата+время Date → 'YYYY-MM-DDTHH:mm:ss' — для журнала плагина (DL-251). */
export function formatDateTimeWithSecondsLocal(value: Date): string {
	return `${formatDateTimeLocal(value)}:${pad(value.getSeconds())}`;
}

/** Точная метка времени YAML-формата: 'YYYY-MM-DDTHH:mm:ss' (со секундами). */
const DATE_TIME_SECONDS_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

/** Метка проекта: 'YYYY-MM-DDTHH:mm' (секунды допустимы — defs.json#$defs.datetime). */
const DATE_TIME_MINUTES_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Простая дата: 'YYYY-MM-DD' (частичные '00'-компоненты проверяет runner, не формат). */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDateTimeString(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		(DATE_TIME_MINUTES_PATTERN.test(value) || DATE_TIME_SECONDS_PATTERN.test(value))
	);
}

export function isDateString(value: unknown): value is string {
	return typeof value === 'string' && DATE_PATTERN.test(value);
}

/**
 * НОРМАЛИЗАЦИЯ ДАТ ИЗ YAML — исправление TZ-бага под-батча A1 (плагин 0.1.1, DL-245).
 *
 * Суть бага: js-yaml (и, по нашим данным, parseYaml Obsidian) разбирает НЕкавычные
 * YAML-метки времени как **UTC** (date-only → UTC-полночь; «2026-09-14 10:30:00» →
 * 10:30 UTC). Первая реализация форматировала такие Date ЛОКАЛЬНЫМИ геттерами —
 * на машине с UTC+3 даты съезжали на +3 часа («2026-09-14» → «2026-09-14T03:00»).
 *
 * Исправление — два уровня, оба TZ-независимы:
 *   1. ЛЕКСИЧЕСКИЙ (основной): значение берётся из СЫРОГО текста frontmatter
 *      (normalizeDateScalarText) — «что написано, то и хранится», без Date-объектов
 *      и арифметики часовых поясов. Работает для скаляров верхнего уровня.
 *   2. FALLBACK (Date в списках/вложенных структурах, где сырой скаляр не найти):
 *      UTC-геттеры — они возвращают ровно то, что написал пользователь, потому что
 *      парсер построил Date в UTC.
 *
 * Норма проекта при этом не нарушается: мы ХРАНИМ локальное время без смещения
 * (ADR-006) — созданные плагином метки пишутся локальными геттерами
 * (formatDateTimeLocal/nowStamp); UTC-геттеры используются ТОЛЬКО чтобы
 * восстановить написанный текст из чужого Date-объекта.
 */

/** UTC-дата Date → 'YYYY-MM-DD' (восстановление date-only из чужого Date). */
export function formatDateUTC(value: Date): string {
	return `${pad(value.getUTCFullYear(), 4)}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
}

/** UTC-дата+время Date → 'YYYY-MM-DDTHH:mm' (восстановление datetime из чужого Date). */
export function formatDateTimeUTC(value: Date): string {
	return `${formatDateUTC(value)}T${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
}

/** Точная UTC-полночь = признак date-only значения ( js-yaml строит их как UTC-полночь). */
function isUtcMidnight(value: Date): boolean {
	return (
		value.getUTCHours() === 0 &&
		value.getUTCMinutes() === 0 &&
		value.getUTCSeconds() === 0 &&
		value.getUTCMilliseconds() === 0
	);
}

/**
 * Лексическая нормализация СЫРОГО скаляра YAML (уровень 1):
 *   '2026-09-14'               → '2026-09-14'          (date-only; частичные '1928-00-00' проходят)
 *   '2026-09-14 10:30:00'      → '2026-09-14T10:30'    (секунды отбрасываются — точность до минут)
 *   '2026-09-14T10:30:00+03:00'→ '2026-09-14T10:30'    (смещение отбрасывается — не храним, ADR-006)
 *   не дата                    → null
 */
export function normalizeDateScalarText(text: string): string | null {
	const trimmed = text.trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
		return trimmed;
	}
	const match = /^(\d{4}-\d{2}-\d{2})[Tt ](\d{2}):(\d{2})/.exec(trimmed);
	if (match) {
		return `${match[1]}T${match[2]}:${match[3]}`;
	}
	return null;
}

/**
 * Нормализация ЗНАЧЕНИЯ СВОЙСТВА (fallback-уровень): Date → строка по UTC-компонентам.
 * Точная UTC-полночь считается date-only → 'YYYY-MM-DD', иначе → 'YYYY-MM-DDTHH:mm'.
 * Строки и остальные значения проходят без изменений.
 *
 * ВНИМАНИЕ: для created_at/updated_at НЕ применяется (там полночь законна как время
 * суток) — для них есть normalizeSystemDateTime.
 */
export function normalizeDateValue(value: unknown): { value: unknown; normalized: boolean } {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return {
			value: isUtcMidnight(value) ? formatDateUTC(value) : formatDateTimeUTC(value),
			normalized: true,
		};
	}
	return { value, normalized: false };
}

/**
 * Нормализация created_at/updated_at (fallback-уровень): эти ключи по норме ВСЕГДА
 * дата+время (defs.json#$defs.datetime), поэтому Date → 'YYYY-MM-DDTHH:mm'
 * (UTC-полночь date-only значения даёт '…T00:00' — починка по 1-му случаю
 * автоисправления severity-policy).
 */
export function normalizeSystemDateTime(value: unknown): { value: unknown; normalized: boolean } {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return { value: formatDateTimeUTC(value), normalized: true };
	}
	return { value, normalized: false };
}
