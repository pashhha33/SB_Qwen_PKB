/**
 * Создание объектов и определений (этап A2; нормы: ADR-001, ADR-004, И1–И4).
 *
 * Логика создания живёт в ЯДРЕ (этот файл), команды — тонкие обёртки (DL-244/9.5):
 * обработчики команд не содержат бизнес-логики, только ввод и сообщения.
 *
 * Все элементы метамодели создаются командами (ADR-004, правила П1–П6) — этот файл
 * и есть машинная реализация «создания командой»: ULID выдаётся здесь, инвариант
 * И4 (aliases[0] == title) зашивается сразу, имя файла — {TYPE_PREFIX}-{ULID}.md.
 */

import type { VaultAdapter } from '../adapter/vault-adapter';
import { nowStamp } from './datetime';
import { SbError } from './errors';
import { buildFileName, isValidTypePrefix } from './identity';
import { generateUlid, isValidUlid } from './ulid';
import { METAMODEL_SUBFOLDERS, SYSTEM_TYPE_PREFIXES, TypeRegistry } from './registry';

/** Паттерн type_key (ADR-003, defs.json#$defs.type_key). */
export const TYPE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

/**
 * Сборка имени файла БЕЗ строгой валидации префикса (только ULID проверяется).
 * Префикс берётся из существующих определений/системной таблицы — он уже легитимен
 * (реестр 02-entities). Строгая проверка isValidTypePrefix — для НОВОГО
 * пользовательского ввода (create-object-type). Разделение сознательное: F5-7
 * (подчёркивание в системных префиксах) не должно ломать чтение/запись существующего.
 */
export function assembleFileName(typePrefix: string, ulid: string): string {
	if (!/^[A-Z][A-Z0-9_-]*$/.test(typePrefix)) {
		throw new SbError('invalid_type_prefix', `Некорректный TYPE_PREFIX «${typePrefix}»`);
	}
	if (!isValidUlid(ulid)) {
		throw new SbError('invalid_ulid', `Некорректный ULID «${ulid}»`);
	}
	return `${typePrefix}-${ulid}.md`;
}

export interface CreateObjectTypeInput {
	typeKey: string;
	label: string;
	typePrefix: string;
	abstract?: boolean;
	/** ULID определения родительского типа (не wikilink — он построится сам). */
	parentTypeId?: string | null;
	lifecycle?: string;
	description?: string;
}

export interface CreationResult {
	path: string;
	id: string;
	fileName: string;
}

/** Сериализует frontmatter заметки (YAML — через реализацию среды, ADR-002). */
function renderNote(adapter: VaultAdapter, frontmatter: Record<string, unknown>, body: string): string {
	const yaml = adapter.stringifyYaml(frontmatter);
	return `---\n${yaml.endsWith('\n') ? yaml : `${yaml}\n`}---\n${body}`;
}

/**
 * Команда create-object-type: создаёт определение типа объекта — заметку
 * type: object_type в Metamodel/ObjectTypes/.
 *
 * Строгость к пользовательскому вводу: type_key — ^[a-z][a-z0-9_]*$; type_prefix —
 * по схеме defs#type_prefix (3–12, A–Z/0–9/дефис, БЕЗ подчёркивания) до решения
 * F5-7; уникальность type_key и type_prefix — по реестру (object_type.type_prefix.unique).
 */
export async function createObjectTypeDefinition(
	adapter: VaultAdapter,
	registry: TypeRegistry,
	input: CreateObjectTypeInput,
): Promise<CreationResult> {
	// --- предварительная проверка (уровень 1 контроля, ADR-011: до записи) ---
	if (!TYPE_KEY_PATTERN.test(input.typeKey)) {
		throw new SbError('not_supported', `type_key «${input.typeKey}» не соответствует формату: строчная латиница, цифры, «_» (^[a-z][a-z0-9_]*$)`);
	}
	if (input.label.trim() === '') {
		throw new SbError('not_supported', 'Русская подпись (label) обязательна');
	}
	if (!isValidTypePrefix(input.typePrefix)) {
		throw new SbError(
			'invalid_type_prefix',
			`TYPE_PREFIX «${input.typePrefix}» не проходит: 3–12 символов, только A–Z, 0–9, дефис (подчёркивание временно запрещено — вопрос F5-7)`,
		);
	}
	if (registry.getType(input.typeKey)) {
		throw new SbError('not_supported', `Тип с type_key «${input.typeKey}» уже существует`);
	}
	if (registry.getTypeByPrefix(input.typePrefix)) {
		throw new SbError('invalid_type_prefix', `TYPE_PREFIX «${input.typePrefix}» уже занят другим типом (префикс уникален как целая строка)`);
	}
	let parentLink: string | undefined;
	if (input.parentTypeId) {
		const parent = registry.getTypeById(input.parentTypeId);
		if (!parent) {
			throw new SbError('not_supported', 'Родительский тип не найден в реестре');
		}
		// Каноническая ссылка всегда с псевдонимом (ADR-001 + DL-186).
		parentLink = `[[${SYSTEM_TYPE_PREFIXES.object_type}-${parent.id}.md|${parent.label}]]`;
	}

	const id = generateUlid();
	const fileName = assembleFileName(SYSTEM_TYPE_PREFIXES.object_type, id);
	const path = `${METAMODEL_SUBFOLDERS.objectTypes}/${fileName}`;
	if (await adapter.exists(path)) {
		throw new SbError('file_exists', `Файл уже существует: ${path}`);
	}

	const stamp = nowStamp();
	const frontmatter: Record<string, unknown> = {
		id,
		type: 'object_type',
		title: input.typeKey,
		aliases: [input.typeKey],
		created_at: stamp,
		updated_at: stamp,
		type_key: input.typeKey,
		label: input.label.trim(),
		type_prefix: input.typePrefix,
		abstract: input.abstract === true,
		lifecycle: input.lifecycle ?? 'standard',
	};
	if (parentLink) {
		frontmatter.parent_type = [parentLink];
	}
	if (input.description && input.description.trim() !== '') {
		frontmatter.description = input.description.trim();
	}
	const body = `\n<!-- Назначение типа, границы применимости, примеры объектов -->\n`;

	await adapter.createFolder(METAMODEL_SUBFOLDERS.objectTypes);
	await adapter.create(path, renderNote(adapter, frontmatter, body));
	return { path, id, fileName };
}

export interface CreateObjectInput {
	typeKey: string;
	title: string;
	/** Папка создания (по умолчанию — корень хранилища). Настройка появится на этапе E. */
	folder?: string;
}

/**
 * Команда create-object: создаёт экземпляр неабстрактного типа.
 * Минимальный корректный каркас: 6 системных атрибутов + И4 (aliases[0] == title).
 * Обязательные предметные свойства НЕ заполняются: объект создаётся неполным,
 * недостающее покажет validate-object (норма DL-183 — создание из ссылки;
 * для create-object действует тот же принцип «сначала объект, потом поля»).
 * Тело: у media — встраивание (И8), у глав — блок навигации; родовое тело пустое,
 * шаблоны по типам придут с семенными данными (вопрос F5-10).
 */
export async function createObjectInstance(
	adapter: VaultAdapter,
	registry: TypeRegistry,
	input: CreateObjectInput,
): Promise<CreationResult> {
	const typeDef = registry.getType(input.typeKey);
	if (!typeDef) {
		throw new SbError('not_supported', `Тип «${input.typeKey}» не найден в реестре определений`);
	}
	if (typeDef.abstract) {
		throw new SbError('not_supported', `Тип «${typeDef.label}» абстрактный — экземпляры создавать нельзя (И3); выберите конкретный подтип`);
	}
	const title = input.title.trim();
	if (title === '') {
		throw new SbError('not_supported', 'Название (title) не может быть пустым');
	}

	const id = generateUlid();
	const fileName = assembleFileName(typeDef.typePrefix, id);
	const folder = input.folder && input.folder.trim() !== '' ? input.folder.trim().replace(/\/+$/, '') : '';
	const path = folder === '' ? fileName : `${folder}/${fileName}`;
	if (await adapter.exists(path)) {
		throw new SbError('file_exists', `Файл уже существует: ${path}`);
	}

	const stamp = nowStamp();
	const frontmatter: Record<string, unknown> = {
		id,
		type: typeDef.typeKey,
		title,
		aliases: [title],
		created_at: stamp,
		updated_at: stamp,
	};
	const body = '\n';

	if (folder !== '') {
		await adapter.createFolder(folder);
	}
	await adapter.create(path, renderNote(adapter, frontmatter, body));
	return { path, id, fileName };
}
