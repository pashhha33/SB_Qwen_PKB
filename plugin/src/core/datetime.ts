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
 * Нормализация ЗНАЧЕНИЯ СВОЙСТВА, которое YAML-парсер мог превратить в объект Date
 * (конвенция батча 2, DL-228: даты в примерах пишутся в кавычках, но заметка,
 * созданная ВНЕ плагина, может содержать голую дату — это 1-й разрешённый случай
 * автоисправления severity-policy; здесь только чтение, без записи).
 *
 * Эвристика: Date в локальную полночь = «дата без времени» (YAML date) → 'YYYY-MM-DD';
 * иначе → 'YYYY-MM-DDTHH:mm'. Строки и остальные значения проходят без изменений.
 *
 * ВНИМАНИЕ: для created_at/updated_at НЕ применяется (там полночь законна как время
 * суток) — для них есть normalizeSystemDateTime.
 */
export function normalizeDateValue(value: unknown): { value: unknown; normalized: boolean } {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		const isDateOnly =
			value.getHours() === 0 && value.getMinutes() === 0 && value.getSeconds() === 0;
		return {
			value: isDateOnly ? formatDateLocal(value) : formatDateTimeLocal(value),
			normalized: true,
		};
	}
	return { value, normalized: false };
}

/**
 * Нормализация created_at/updated_at: эти ключи по норме ВСЕГДА дата+время
 * (defs.json#$defs.datetime), поэтому Date → 'YYYY-MM-DDTHH:mm' без эвристики.
 */
export function normalizeSystemDateTime(value: unknown): { value: unknown; normalized: boolean } {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return { value: formatDateTimeLocal(value), normalized: true };
	}
	return { value, normalized: false };
}
