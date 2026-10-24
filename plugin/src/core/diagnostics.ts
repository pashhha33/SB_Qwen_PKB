/**
 * Диагностика — формат из 11 полей (норма: docs/validation/severity-policy.md §4).
 * Каждая диагностика — структура, а не текст; сообщения — на русском, с подписями
 * полей (правила М1–М5 формирования сообщений).
 */

export type Severity = 'error' | 'warning' | 'info';

export interface SbDiagnostic {
	/** Идентификатор правила из единого реестра docs/validation/rules.md. */
	rule_id: string;
	severity: Severity;
	/** Уровень контроля целостности (1–6, ADR-011). */
	level: number;
	/** ULID объекта или null (если id отсутствует/невалиден). */
	object_id: string | null;
	object_path: string;
	/** Ключ поля, если проблема в поле, иначе null. */
	property_key: string | null;
	/** Фактическое значение (как есть; null если неприменимо). */
	actual_value: unknown;
	/** Готовое сообщение на русском. */
	message: string;
	/** Что сделать пользователю. */
	hint: string;
	/** Есть ли автоматическое исправление (4 разрешённых случая severity-policy §2). */
	fix_available: boolean;
	/** Что сделает исправление (null, если его нет). */
	fix_description: string | null;
}

export interface DiagnosticInput {
	rule_id: string;
	severity: Severity;
	level: number;
	object_id?: string | null;
	object_path: string;
	property_key?: string | null;
	actual_value?: unknown;
	message: string;
	hint: string;
	fix_available?: boolean;
	fix_description?: string | null;
}

/** Собирает полную диагностику с значениями по умолчанию (меньше шума в правилах). */
export function diagnostic(input: DiagnosticInput): SbDiagnostic {
	return {
		rule_id: input.rule_id,
		severity: input.severity,
		level: input.level,
		object_id: input.object_id ?? null,
		object_path: input.object_path,
		property_key: input.property_key ?? null,
		actual_value: input.actual_value ?? null,
		message: input.message,
		hint: input.hint,
		fix_available: input.fix_available ?? false,
		fix_description: input.fix_description ?? null,
	};
}

/** Краткое человеко-читаемое представление (Notice/списки): «[error] правило — сообщение». */
export function formatDiagnostic(diag: SbDiagnostic): string {
	const badge = diag.severity === 'error' ? '✖' : diag.severity === 'warning' ? '⚠' : 'ℹ';
	return `${badge} ${diag.message} (${diag.rule_id})`;
}
