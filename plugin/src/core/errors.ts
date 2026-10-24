/**
 * Ошибки плагина. Одна ошибка с кодом — чтобы сообщения были стабильными,
 * а диагностика (severity-policy §4) могла ссылаться на код.
 */
export type SbErrorCode =
	| 'invalid_ulid'
	| 'invalid_type_prefix'
	| 'invalid_file_name'
	| 'file_not_found'
	| 'file_exists'
	| 'yaml_error'
	| 'not_supported';

export class SbError extends Error {
	readonly code: SbErrorCode;

	constructor(code: SbErrorCode, message: string) {
		super(message);
		this.name = 'SbError';
		this.code = code;
	}
}
