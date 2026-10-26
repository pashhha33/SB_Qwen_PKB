/**
 * Общие заготовки тестов классификации (B1.3 часть 2): детерминированные «ULID»
 * и запись корректных заметок-объектов в FakeVault (6 системных атрибутов + И4).
 */

import type { FakeVault } from './fake-vault';

/** Детерминированный «ULID» для тестов (26 символов Crockford Base32). */
export function uid(n: number): string {
	return `01SBTEST${String(n).padStart(18, '0')}`;
}

/** Каноническая ссылка (значение поля в YAML — в кавычках). */
export function link(prefix: string, id: string, title: string): string {
	return `"[[${prefix}-${id}.md|${title}]]"`;
}

export interface NoteSpec {
	id: string;
	type: string;
	title: string;
	folder: string;
	prefix: string;
	label?: string;
	fields?: Record<string, string | string[] | number | boolean | null>;
}

/**
 * YAML-литерал для строки: wikilink-и и прочие «особые» значения кавычатся
 (иначе `[[…]]` разобрался бы как вложенный flow-список), уже кавыченные
 * значения (`link()`) не трогаем.
 */
function yamlScalar(item: string): string {
	if (item.startsWith('"')) {
		return item;
	}
	return /^[\[{]|\[\[|:\s|\s#/.test(item) ? JSON.stringify(item) : item;
}

/** Пишет корректную заметку-объект и возвращает её путь. */
export async function putNote(vault: FakeVault, spec: NoteSpec): Promise<string> {
	const lines = [
		'---',
		`id: ${spec.id}`,
		`type: ${spec.type}`,
		`title: ${spec.title}`,
		'aliases:',
		`  - ${spec.title}`,
		'created_at: "2026-10-26T10:00"',
		'updated_at: "2026-10-26T10:00"',
	];
	if (spec.label !== undefined) {
		lines.push(`label: ${spec.label}`);
	}
	for (const [key, value] of Object.entries(spec.fields ?? {})) {
		if (value === null) {
			lines.push(`${key}: null`);
		} else if (Array.isArray(value)) {
			if (value.length === 0) {
				lines.push(`${key}: []`);
			} else {
				lines.push(`${key}:`, ...value.map((item) => `  - ${yamlScalar(item)}`));
			}
		} else if (typeof value === 'string') {
			lines.push(`${key}: ${value.startsWith('"') ? value : JSON.stringify(value)}`);
		} else {
			lines.push(`${key}: ${String(value)}`);
		}
	}
	lines.push('---', '');
	const path = `${spec.folder}/${spec.prefix}-${spec.id}.md`;
	await vault.put(path, lines.join('\n'));
	return path;
}
