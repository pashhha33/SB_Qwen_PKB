/**
 * date-engine (модуль этапа B1.1, 09-modules): даты, частичные даты, интервалы.
 *
 * Нормы: `06-time-and-intervals.md` §1–§2 (форматы, частичные даты, правила П1–П6),
 * `04-attributes.md` §6 (локальное время без смещения, точность до минут),
 * ADR-011; правила валидации — группа H реестра (`docs/validation/rules.md`).
 *
 * Важное ограничение П6: формат частичных дат НЕ является ISO 8601 — значения нельзя
 * передавать внешним библиотекам разбора дат без нормализации в диапазон
 * (`normalizePartialDateToRange` — единственная точка входа для вычислений, мера M4 ADR-011).
 *
 * Правила группы H, реализуемые здесь (уровень 2, форматные):
 *   - `date.format`                     — YYYY-MM-DD, неизвестный компонент — `00`;
 *   - `date.partial.no_gap`             — неизвестный компонент не идёт после известного (П1);
 *   - `date.partial.unknown_only_zero`  — неизвестный компонент записан именно как `00`;
 *   - `date.range.valid`                — день/месяц допустимы для года, високосные учитываются;
 *   - `datetime.format`                 — YYYY-MM-DDTHH:mm;
 *   - `datetime.no_seconds`             — секунды не храним (warning; специальное правило
 *                                         приоритетнее общего `datetime.format` — rules.md
 *                                         «Перекрывающиеся правила»).
 * Правила `period.*` — этап C (интервалы живут в строках `.sb/relations/`, ADR-010);
 * `display_template.*` (уровень 5) — B1.2 (слой отображения). Правило П2 (`0000-00-00`
 * только в необязательном поле, warning) не реализуется: в реестре нет отдельного id —
 * расхождение зафиксировано в `docs/plugin/architecture.md` §5.
 */

/** Паттерн даты (включая частичные `00`) — зеркало `defs.json#$defs.date`. */
export const DATE_PATTERN = /^\d{4}-(00|0[1-9]|1[0-2])-(00|0[1-9]|[12]\d|3[01])$/;

/** Паттерн datetime минутной точности — зеркало `defs.json#$defs.datetime` (без секунд). */
export const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** datetime с секундами — схема допускает, хранение не допускает (warning `datetime.no_seconds`). */
export const DATETIME_SECONDS_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

/**
 * «Рыхлый» паттерн даты: год + два компонента-заполнителя (цифры, `?`, `x`, `*`, `_`, пробел).
 * Нужен, чтобы отличить «неизвестный компонент записан НЕ как 00» (`1928-??-00`, `1928-0-0`)
 * от полностью произвольного мусора (специальное правило приоритетнее общего).
 */
const LOOSE_DATE_PATTERN = /^(\d{4}|[?xX*_]{1,4})-([0-9?xX*_ ]{1,2})-([0-9?xX*_ ]{1,2})$/;

/** id правил группы H, которые возвращает движок (все зарегистрированы в rules.md). */
export type DateRuleId =
	| 'date.format'
	| 'date.partial.no_gap'
	| 'date.partial.unknown_only_zero'
	| 'date.range.valid'
	| 'datetime.format'
	| 'datetime.no_seconds';

export interface DateViolation {
	rule_id: DateRuleId;
	severity: 'error' | 'warning';
	/** Короткая деталь для сообщения диагностики. */
	detail: string;
}

export interface DateCheckResult {
	ok: boolean;
	violations: DateViolation[];
}

/** Високосный год (григорианский календарь). */
export function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Дней в месяце (1–12) с учётом високосного февраля. */
export function daysInMonth(year: number, month: number): number {
	const table = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	return table[month - 1] ?? 0;
}

/**
 * Проверяет значение свойства типа `date` (правила группы H, уровень 2).
 * Не бросает исключений: всё возвращается списком нарушений.
 */
export function validateDateValue(raw: unknown): DateCheckResult {
	if (typeof raw !== 'string') {
		return fail('date.format', 'значение не строка');
	}
	const text = raw.trim();
	if (DATE_PATTERN.test(text)) {
		return checkPartialDateComponents(text);
	}
	// Специальное правило приоритетнее общего: «почти дата» с не-`00` заполнителями
	// неизвестных компонентов — это unknown_only_zero, а не произвольный формат.
	// Заполнитель — небуквенно-цифровой символ (?, x, *, _, пробел) или одиночный «0»;
	// одноцифровые ЧИСЛА («1928-5-15») — нарушение формата (нужны два разряда).
	const loose = LOOSE_DATE_PATTERN.exec(text);
	if (loose !== null) {
		const placeholderLike = [loose[1], loose[2], loose[3]].some(
			(part) => /[?xX*_ ]/.test(part) || part === '0',
		);
		if (placeholderLike) {
			return fail('date.partial.unknown_only_zero', `неизвестный компонент должен быть записан как «00»: «${text}»`);
		}
	}
	return fail('date.format', `«${text}» не соответствует формату YYYY-MM-DD (частичные даты — «00») `);
}

/** Компоненты валидной по формату даты: П1 (no_gap) и допустимость диапазона (range.valid). */
function checkPartialDateComponents(text: string): DateCheckResult {
	const [yearText, monthText, dayText] = text.split('-');
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);
	const yearUnknown = year === 0;
	const monthUnknown = month === 0;
	const dayUnknown = day === 0;

	// П1: неизвестный компонент не может идти ПОСЛЕ известного.
	if ((yearUnknown && (!monthUnknown || !dayUnknown)) || (monthUnknown && !dayUnknown)) {
		return fail('date.partial.no_gap', `в дате «${text}» неизвестный компонент стоит после известного`);
	}
	// Полная дата: день допустим для месяца и года (високосные учтены).
	if (!yearUnknown && !monthUnknown && !dayUnknown && day > daysInMonth(year, month)) {
		return fail('date.range.valid', `в ${year} году месяца ${month} не бывает дня ${day}`);
	}
	return { ok: true, violations: [] };
}

/**
 * Проверяет значение свойства типа `datetime` (правила группы H, уровень 2).
 * Секунды — предупреждение `datetime.no_seconds` (специальное правило; общее
 * `datetime.format` при этом не выдаётся — rules.md «Перекрывающиеся правила»).
 */
export function validateDateTimeValue(raw: unknown): DateCheckResult {
	if (typeof raw !== 'string') {
		return fail('datetime.format', 'значение не строка');
	}
	const text = raw.trim();
	if (DATETIME_PATTERN.test(text)) {
		// Дата внутри datetime — полная (часы/минуты известны ⇒ известны и компоненты даты;
		// частичные даты со временем не хранятся — 06-time-and-intervals §1).
		return checkPartialDateComponents(text.slice(0, 10));
	}
	if (DATETIME_SECONDS_PATTERN.test(text)) {
		const secondsCheck = checkPartialDateComponents(text.slice(0, 10));
		if (!secondsCheck.ok) {
			return secondsCheck;
		}
		return {
			ok: false,
			violations: [
				{
					rule_id: 'datetime.no_seconds',
					severity: 'warning',
					detail: `время хранится с точностью до минут — секунды будут отброшены: «${text}»`,
				},
			],
		};
	}
	return fail('datetime.format', `«${text}» не соответствует формату YYYY-MM-DDTHH:mm (локальное время, без смещения)`);
}

function fail(rule_id: DateRuleId, detail: string): DateCheckResult {
	return { ok: false, violations: [{ rule_id, severity: 'error', detail }] };
}

/**
 * Нормализация частичной даты в диапазон (П4; единственная точка входа для вычислений —
 * мера M4 ADR-011). Для невалидного значения — null (сначала прогнать validateDateValue).
 *
 *   1928-00-00 → 1928-01-01 … 1928-12-31
 *   1928-05-00 → 1928-05-01 … 1928-05-31
 *   1928-05-15 → 1928-05-15 … 1928-05-15
 *   0000-00-00 → null (дата неизвестна — диапазоном не выражается)
 */
export function normalizePartialDateToRange(value: string): { from: string; to: string } | null {
	if (!DATE_PATTERN.test(value)) {
		return null;
	}
	const [yearText, monthText, dayText] = value.split('-');
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);
	if (year === 0) {
		return null;
	}
	if (month === 0) {
		return { from: `${yearText}-01-01`, to: `${yearText}-12-31` };
	}
	if (day === 0) {
		const last = daysInMonth(year, month);
		return { from: `${yearText}-${monthText}-01`, to: `${yearText}-${monthText}-${String(last).padStart(2, '0')}` };
	}
	return { from: value, to: value };
}

/**
 * Сравнение (частичных) дат по правилу П3: неизвестный компонент меньше любого известного.
 * Для валидных значений эквивалентно лексикографическому сравнению строк (`00` сортируется
 * раньше всех), но функция требует валидности и возвращает null для мусора.
 * 06-time-and-intervals §2: сортировка по возрастанию — 1928-00-00 < 1928-05-00 < 1928-05-15.
 */
export function comparePartialDates(a: string, b: string): number | null {
	if (!DATE_PATTERN.test(a) || !DATE_PATTERN.test(b)) {
		return null;
	}
	return a < b ? -1 : a > b ? 1 : 0;
}
