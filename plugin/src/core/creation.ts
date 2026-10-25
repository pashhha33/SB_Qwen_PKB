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
import type { LogFn } from './activity-log';
import { nowStamp } from './datetime';
import { SbError } from './errors';
import { buildFileName, isValidTypePrefix } from './identity';
import { SYSTEM_KEYS } from './model';
import { METAMODEL_SUBFOLDERS, SYSTEM_TYPE_PREFIXES, TypeRegistry, type PropertyDef } from './registry';
import {
	APPLIES_OPERATIONS,
	CARDINALITIES,
	coverageIntersects,
	coverageOf,
	ENUM_VALUE_PATTERN,
	PROPERTY_KEY_PATTERN,
	VALUE_TYPES,
} from './schema-engine';
import { generateUlid, isValidUlid } from './ulid';

/** Паттерн type_key (ADR-003, defs.json#$defs.type_key). */
export const TYPE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

/**
 * Сборка имени файла БЕЗ строгой валидации префикса (только ULID проверяется).
 * Префикс берётся из существующих определений/системной таблицы — он уже легитимен
 * (реестр 02-entities). Строгая проверка isValidTypePrefix — для НОВОГО
 * пользовательского ввода (create-object-type). Разделение сознательное: чтение
 * и запись существующего не должны ломаться из-за строгости к новому вводу.
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
 * по схеме defs#type_prefix (3–20, A–Z/0–9/дефис/подчёркивание — F5-7 = А, DL-253);
 * уникальность type_key и type_prefix — по реестру (object_type.type_prefix.unique).
 */
export async function createObjectTypeDefinition(
	adapter: VaultAdapter,
	registry: TypeRegistry,
	input: CreateObjectTypeInput,
	log?: LogFn,
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
			`TYPE_PREFIX «${input.typePrefix}» не проходит: 3–20 символов, A–Z, 0–9, дефис, подчёркивание; начало с буквы`,
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
	log?.('info', 'creation', `Создан тип объекта «${input.label.trim()}» (${input.typeKey})`, {
		path,
		id,
		type_prefix: input.typePrefix,
		abstract: input.abstract === true,
	});
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
	log?: LogFn,
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
	log?.('info', 'creation', `Создан объект «${title}» типа «${typeDef.label}»`, { path, id, type: typeDef.typeKey });
	return { path, id, fileName };
}

// ---------------------------------------------------------------------------
// create-property (B1.1 часть 2, DL-261/266): определение свойства командой
// ---------------------------------------------------------------------------

/** Область применения свойства (defs.json#$defs.scope, 04-attributes §4). */
export const SCOPES = ['universal', 'family', 'specific'] as const;

/** Способ хранения связи (defs.json; обязателен для object_reference — ADR-009/010). */
export const LINK_MODES = ['direct', 'reified'] as const;

/** Цель ссылки media_reference (ADR-008). */
export const MEDIA_TARGETS = ['object', 'file', 'both'] as const;

/** `required` производно от `cardinality` (таблица 04-attributes §4) — не вводится вручную. */
export function requiredFromCardinality(cardinality: string): boolean {
	return cardinality === '1' || cardinality === '1..N';
}

export interface CreatePropertyInput {
	/** Ключ свойства (английский snake_case, ADR-003). */
	key: string;
	/** Русская подпись (label свободен — ADR-003). */
	label: string;
	/** Тип значения из закрытого набора семи (ADR-006). */
	valueType: string;
	/** Кардинальность: 1, 0..1, 0..N, 1..N (required выводится из неё). */
	cardinality: string;
	/** Область: universal | family | specific (04-attributes §4). */
	scope: string;
	/** Ключи типов для family (ровно один абстрактный предок) / specific. */
	objectTypeKeys?: string[];
	/** Ключи целевых типов для object_reference / media_reference. */
	targetTypeKeys?: string[];
	/** direct | reified — обязателен для object_reference (ADR-009/010). */
	linkMode?: string | null;
	/** object | file | both — обязателен для media_reference (ADR-008). */
	mediaTarget?: string | null;
	/** Закрытый список значений перечисления (05-enumerations §5). */
	allowedValues?: string[];
	/** Условие показа (04-attributes §11, М1–М7) или null. */
	appliesWhen?: { property: string; operation: string; value: string[] } | null;
	/** Пояснение (поле definition схемы property). */
	definition?: string;
}

/**
 * Команда create-property: создаёт определение свойства — заметку type: property
 * в Metamodel/Properties/ (ADR-004: элементы метамодели создаются только командами).
 *
 * Проверки уровня 1 (до записи, ADR-011) зеркалят группу B реестра правил — созданное
 * определение проходит validate-object без диагностик. Осознанные отличия:
 *   - `required` не вводится, а ВЫВОДИТСЯ из cardinality (04-attributes §4) —
 *     рассогласование невозможно по построению;
 *   - `service: true` не предлагается: служебные свойства объявляет плагин
 *     (08-views §7; в MVP одно — sb_issues, сеется бутстрапом);
 *   - `target_facet` и `default_value` в части 2 не вводятся (фасеты появляются
 *     с classification-service в B1.3 — граница architecture.md §5, B1.1-9);
 *   - триггер applies_when должен быть уже объявлен (property.applies_when.
 *     property_exists — error; «объявить позже» в MVP не поддерживается).
 */
export async function createPropertyDefinition(
	adapter: VaultAdapter,
	registry: TypeRegistry,
	input: CreatePropertyInput,
	log?: LogFn,
): Promise<CreationResult> {
	// --- ключ и подпись ---
	const key = input.key.trim();
	if (!PROPERTY_KEY_PATTERN.test(key)) {
		throw new SbError('not_supported', `Ключ свойства «${key}» не соответствует формату: строчная латиница, цифры, «_» (^[a-z][a-z0-9_]*$)`);
	}
	if ((SYSTEM_KEYS as readonly string[]).includes(key)) {
		throw new SbError('not_supported', `Ключ «${key}» занят системным атрибутом (И6): id, type, title, aliases, created_at, updated_at, categories, tags не переопределяются`);
	}
	const label = input.label.trim();
	if (label === '') {
		throw new SbError('not_supported', 'Русская подпись (label) обязательна');
	}

	// --- закрытые наборы ---
	if (!(VALUE_TYPES as readonly string[]).includes(input.valueType)) {
		throw new SbError('not_supported', `Тип значения «${input.valueType}» вне закрытого набора семи (ADR-006): ${VALUE_TYPES.join(', ')}`);
	}
	if (!(CARDINALITIES as readonly string[]).includes(input.cardinality)) {
		throw new SbError('not_supported', `Кардинальность «${input.cardinality}» вне закрытого набора: ${CARDINALITIES.join(', ')}`);
	}
	if (!(SCOPES as readonly string[]).includes(input.scope)) {
		throw new SbError('not_supported', `Область «${input.scope}» вне закрытого набора: ${SCOPES.join(', ')}`);
	}

	// --- область и привязка к типам (04-attributes §4.1, F5-8 = А) ---
	const objectTypeKeys = (input.objectTypeKeys ?? []).map((k) => k.trim()).filter((k) => k !== '');
	if (input.scope === 'universal' && objectTypeKeys.length > 0) {
		throw new SbError('not_supported', 'scope: universal — список типов (object_types) должен быть пуст');
	}
	if (input.scope === 'family') {
		if (objectTypeKeys.length !== 1) {
			throw new SbError('not_supported', `scope: family — ровно один абстрактный предок (указано ${objectTypeKeys.length})`);
		}
		const ancestor = registry.getType(objectTypeKeys[0]);
		if (!ancestor) {
			throw new SbError('not_supported', `Тип-предок «${objectTypeKeys[0]}» не найден в реестре`);
		}
		if (!ancestor.abstract) {
			throw new SbError('not_supported', `scope: family ссылается на неабстрактный тип «${ancestor.label}»; для конкретных типов — scope: specific`);
		}
	}
	if (input.scope === 'specific') {
		if (objectTypeKeys.length === 0) {
			throw new SbError('not_supported', 'scope: specific — укажите минимум один конкретный тип');
		}
		for (const typeKey of objectTypeKeys) {
			const target = registry.getType(typeKey);
			if (!target) {
				throw new SbError('not_supported', `Тип «${typeKey}» не найден в реестре`);
			}
			if (target.abstract) {
				throw new SbError('not_supported', `scope: specific ссылается на абстрактный тип «${target.label}»; для абстрактного предка — scope: family`);
			}
		}
	}

	// --- уникальность ключа с учётом покрытия типов (property.key.unique_in_type, F5-8) ---
	const objectTypes = objectTypeKeys.map((typeKey) => registry.getType(typeKey)?.id).filter((id): id is string => id !== undefined);
	const draft: Pick<PropertyDef, 'scope' | 'objectTypes'> = { scope: input.scope, objectTypes };
	const draftCoverage = coverageOf(draft, registry);
	for (const other of registry.properties) {
		if (other.key === key && coverageIntersects(draftCoverage, coverageOf(other, registry))) {
			throw new SbError('not_supported', `Ключ «${key}» уже объявлен свойством (${other.path}) с пересекающимся покрытием типов`);
		}
	}

	// --- ссылки: target_types, link_mode, media_target (ADR-006/008/009) ---
	const targetTypeKeys = (input.targetTypeKeys ?? []).map((k) => k.trim()).filter((k) => k !== '');
	const isReference = input.valueType === 'object_reference' || input.valueType === 'media_reference';
	if (isReference && targetTypeKeys.length === 0) {
		throw new SbError('not_supported', `Для свойства-ссылки (${input.valueType}) обязателен target_types — минимум один тип цели`);
	}
	if (!isReference && targetTypeKeys.length > 0) {
		throw new SbError('not_supported', 'target_types имеет смысл только для object_reference и media_reference (property.target_types.for_reference)');
	}
	const targetTypes = targetTypeKeys.map((typeKey) => {
		const target = registry.getType(typeKey);
		if (!target) {
			throw new SbError('not_supported', `Целевой тип «${typeKey}» не найден в реестре`);
		}
		return target;
	});
	let linkMode: string | null = null;
	if (input.valueType === 'object_reference') {
		if (input.linkMode !== 'direct' && input.linkMode !== 'reified') {
			throw new SbError('not_supported', 'object_reference требует link_mode: direct (значение-ссылка в поле) или reified (отношение-объект) — ADR-009/010');
		}
		linkMode = input.linkMode;
	} else if (input.linkMode) {
		throw new SbError('not_supported', `link_mode задаётся только у object_reference (у «${input.valueType}» поле не используется)`);
	}
	let mediaTarget: string | null = null;
	if (input.valueType === 'media_reference') {
		if (input.mediaTarget !== 'object' && input.mediaTarget !== 'file' && input.mediaTarget !== 'both') {
			throw new SbError('not_supported', 'media_reference требует media_target: object (обёртки media), file (вложения) или both — ADR-008');
		}
		mediaTarget = input.mediaTarget;
	} else if (input.mediaTarget) {
		throw new SbError('not_supported', `media_target задаётся только у media_reference (у «${input.valueType}» поле не используется)`);
	}

	// --- перечисление (05-enumerations §5) ---
	const allowedValues = (input.allowedValues ?? []).map((v) => v.trim()).filter((v) => v !== '');
	if (allowedValues.length > 0) {
		for (const value of allowedValues) {
			if (!ENUM_VALUE_PATTERN.test(value)) {
				throw new SbError('not_supported', `Значение перечисления «${value}» не соответствует формату ^[a-z][a-z0-9_]*$ (строчная латиница, цифры, «_»)`);
			}
		}
		if (new Set(allowedValues).size !== allowedValues.length) {
			throw new SbError('not_supported', 'В списке allowed_values есть повторы');
		}
	}

	// --- условие applies_when (04-attributes §11, М3–М5) ---
	let appliesWhen: { property: string; operation: string; value: string[] } | null = null;
	if (input.appliesWhen !== null && input.appliesWhen !== undefined) {
		const trigger = input.appliesWhen.property.trim();
		const operation = input.appliesWhen.operation;
		const values = input.appliesWhen.value.map((v) => v.trim()).filter((v) => v !== '');
		if (!PROPERTY_KEY_PATTERN.test(trigger)) {
			throw new SbError('not_supported', `Свойство-триггер «${trigger}» не соответствует формату ключа (^[a-z][a-z0-9_]*$)`);
		}
		if (!(APPLIES_OPERATIONS as readonly string[]).includes(operation)) {
			throw new SbError('not_supported', `Операция «${operation}» вне закрытого набора (М4): ${APPLIES_OPERATIONS.join(', ')}`);
		}
		if (values.length === 0) {
			throw new SbError('not_supported', 'Значение условия applies_when пусто (property.applies_when.value_present)');
		}
		if (!registry.properties.some((p) => p.key === trigger)) {
			throw new SbError('not_supported', `Свойство-триггер «${trigger}» не объявлено в Metamodel/Properties/ — сначала создайте его (property.applies_when.property_exists)`);
		}
		appliesWhen = { property: trigger, operation, value: values };
	}

	// --- запись (ADR-001: PROPERTY-{ULID}.md; И4: aliases[0] == title) ---
	const id = generateUlid();
	const fileName = assembleFileName(SYSTEM_TYPE_PREFIXES.property, id);
	const path = `${METAMODEL_SUBFOLDERS.properties}/${fileName}`;
	if (await adapter.exists(path)) {
		throw new SbError('file_exists', `Файл уже существует: ${path}`);
	}

	const stamp = nowStamp();
	const frontmatter: Record<string, unknown> = {
		id,
		type: 'property',
		title: key,
		aliases: [key],
		created_at: stamp,
		updated_at: stamp,
		key,
		label,
		value_type: input.valueType,
		cardinality: input.cardinality,
		required: requiredFromCardinality(input.cardinality),
		scope: input.scope,
	};
	const typeLink = (typeKey: string): string => {
		const target = registry.getType(typeKey);
		return target
			? `[[${SYSTEM_TYPE_PREFIXES.object_type}-${target.id}.md|${target.label}]]`
			: `[[${SYSTEM_TYPE_PREFIXES.object_type}-${typeKey}]]`;
	};
	if (objectTypeKeys.length > 0) {
		frontmatter.object_types = objectTypeKeys.map(typeLink);
	}
	if (targetTypeKeys.length > 0) {
		frontmatter.target_types = targetTypeKeys.map(typeLink);
	}
	if (linkMode !== null) {
		frontmatter.link_mode = linkMode;
	}
	if (mediaTarget !== null) {
		frontmatter.media_target = mediaTarget;
	}
	if (allowedValues.length > 0) {
		frontmatter.allowed_values = allowedValues;
	}
	if (appliesWhen !== null) {
		frontmatter.applies_when = {
			property: appliesWhen.property,
			operation: appliesWhen.operation,
			// одно значение — строка, несколько — список (defs.json#$defs.applies_when)
			value: appliesWhen.value.length === 1 ? appliesWhen.value[0] : appliesWhen.value,
		};
	}
	if (input.definition && input.definition.trim() !== '') {
		frontmatter.definition = input.definition.trim();
	}
	const body = `\n<!-- Смысл свойства, примеры значений, источник нормы (карточка типа / 04-attributes) -->\n`;

	await adapter.createFolder(METAMODEL_SUBFOLDERS.properties);
	await adapter.create(path, renderNote(adapter, frontmatter, body));
	log?.('info', 'creation', `Создано свойство «${label}» (${key})`, {
		path,
		id,
		key,
		value_type: input.valueType,
		cardinality: input.cardinality,
		scope: input.scope,
	});
	return { path, id, fileName };
}
