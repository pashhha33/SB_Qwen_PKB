/**
 * object-service (модуль этапа B1.2, 09-modules слой 2): создание и
 * редактирование объектов формами — модель формы, проверка уровня 1 и запись
 * значений во frontmatter.
 *
 * Нормы:
 *   - ADR-011 (уровни контроля): уровень 1 — проверка В МОДАЛКЕ при вводе;
 *     некорректное значение не записывается. Отсутствие обязательного поля
 *     сохранению НЕ мешает (принцип DL-183 «сначала объект, потом поля») —
 *     недостающее покажет validate-object (уровни 2–4).
 *   - М1/М2 (04-attributes §11): условие `applies_when` влияет только на показ
 *     поля в форме; значения «погасших» (скрытых) свойств сохраняются при
 *     записи как есть — молчаливое удаление данных запрещено.
 *   - `service: true` исключает свойство из ввода (08-views §7,
 *     `property.service.not_editable`); `lifecycle: archived` — скрыт из форм.
 *   - И4 (ADR-001): при смене `title` первый псевдоним синхронизируется.
 *   - И5: `updated_at` обновляется при записи (это изменение данных
 *     пользователя, в отличие от служебной записи service-flags — B1.1-5).
 *   - Неизвестные поля frontmatter сохраняются (схема не ограничивает состав;
 *     «вне схемы» — warning уровня 4, а не удаление).
 *
 * Системные атрибуты в форме: редактируется только `title` (основное поле
 * карточки); `id`/`type`/`created_at` не показываются (не редактируются);
 * `categories` — с B1.3 (classification-service), `tags` — свободные метки,
 * редактируются штатной панелью Obsidian.
 *
 * Слой: ядро (2) — среда-независим (М2); формы (property-editor) потребляют
 * модель, команды — тонкие обёртки.
 */

import type { VaultAdapter } from '../adapter/vault-adapter';
import type { LogFn } from './activity-log';
import { isPropertyVisible } from './applies-when';
import type { ClassificationSnapshot } from './classification';
import { validateDateTimeValue, validateDateValue } from './date-engine';
import { nowStamp } from './datetime';
import { parseFileName } from './identity';
import type { LabelResolver } from './label-resolver';
import type { SbNote } from './model';
import type { PropertyDef, TypeRegistry } from './registry';
import { CYRILLIC_PATTERN, ENUM_VALUE_PATTERN, type VaultIndex } from './schema-engine';

/** Одно поле формы (по определению свойства). */
export interface FormField {
	/** Определение свойства (источник всех правил поля). */
	def: PropertyDef;
	/** Подпись к показу — зависит от режима LabelResolver (view/source). */
	label: string;
	/** Множественное поле (0..N / 1..N). */
	multiple: boolean;
	/** Текущие значения (нормализованы в список; пусто = не заполнено). */
	values: unknown[];
}

/** Модель формы объекта (собирается из заметки + реестра). */
export interface FormModel {
	path: string;
	typeKey: string;
	typeLabel: string;
	title: string;
	fields: FormField[];
	/** Определения с `applies_when` — для пересчёта видимости в форме. */
	hasConditional: boolean;
}

/** Значения полей формы: key → список значений (нормализовано). */
export type FormValues = Record<string, unknown[]>;

/** Нормализация значения frontmatter в список (undefined/null/[] → []). */
export function normalizeValues(raw: unknown): unknown[] {
	if (raw === undefined || raw === null) {
		return [];
	}
	if (Array.isArray(raw)) {
		return raw;
	}
	return [raw];
}

/**
 * Собирает модель формы для заметки. Возвращает null, если форма невозможна:
 * frontmatter битый, тип не зарегистрирован или абстрактный (И3).
 */
export function buildFormModel(registry: TypeRegistry, labels: LabelResolver, note: SbNote): FormModel | null {
	if (note.frontmatterBroken) {
		return null;
	}
	const typeKey = typeof note.system.type === 'string' ? note.system.type : null;
	if (typeKey === null) {
		return null;
	}
	const typeDef = registry.getType(typeKey);
	if (typeDef === null || typeDef.abstract) {
		return null;
	}
	const fields: FormField[] = [];
	for (const def of registry.getPropertiesForType(typeKey)) {
		// service: true — свойство ведёт плагин, в формы не предлагается (08-views §7);
		// archived — скрыт из форм (ADR-011/DL-107).
		if (def.service || def.lifecycle === 'archived') {
			continue;
		}
		fields.push({
			def,
			label: labels.forPropertyKey(def.key, typeKey),
			multiple: def.cardinality === '0..N' || def.cardinality === '1..N',
			values: normalizeValues(note.properties[def.key]),
		});
	}
	return {
		path: note.path,
		typeKey,
		typeLabel: labels.forTypeKey(typeKey),
		title: typeof note.system.title === 'string' ? note.system.title : '',
		fields,
		hasConditional: fields.some((f) => f.def.appliesWhen !== null),
	};
}

/**
 * Пересчитывает видимость условных полей по ТЕКУЩИМ значениям формы (М1 —
 * условие влияет только на показ). Использует тот же движок applies-when,
 * что и валидация: псевдо-заметка из значений формы + `categories` заметки.
 *
 * @param classification снимок классификации — для условий `in_category`
 *        (назначенный потомок раскрывается предками, 01-classification §2.3).
 *        Без снимка форма проверяет только прямое назначение — как валидация:
 *        расхождение «форма ↔ проверка» исключено (урок DL-271).
 */
export function computeVisibleKeys(
	model: FormModel,
	values: FormValues,
	categories: string[],
	classification?: ClassificationSnapshot | null,
): Set<string> {
	const pseudoNote = {
		system: { categories },
		properties: values,
	} as unknown as SbNote;
	const visible = new Set<string>();
	for (const field of model.fields) {
		if (isPropertyVisible(field.def, pseudoNote, classification ?? null)) {
			visible.add(field.def.key);
		}
	}
	return visible;
}

/**
 * Проверка уровня 1 (ADR-011): первое некорректное ЗНАЧЕНИЕ — текст ошибки
 * для формы, или null (всё в порядке). Обязательность НЕ проверяется —
 * сохранение неполного объекта разрешено (DL-183); её покажет validate-object.
 */
export function validateFieldValues(def: PropertyDef, values: unknown[]): string | null {
	const multiple = def.cardinality === '0..N' || def.cardinality === '1..N';
	if (!multiple && values.length > 1) {
		return `Свойство допускает одно значение (кардинальность ${def.cardinality})`;
	}
	for (const item of values) {
		const message = validateSingleValue(def, item);
		if (message !== null) {
			return message;
		}
	}
	return null;
}

/** Проверка одного значения по типу (сообщение на русском, с подписью нормы). */
function validateSingleValue(def: PropertyDef, item: unknown): string | null {
	switch (def.valueType) {
		case 'text': {
			if (typeof item !== 'string') {
				return 'Ожидался текст';
			}
			if (def.allowedValues.length > 0) {
				if (CYRILLIC_PATTERN.test(item)) {
					return 'Значение перечисления — английский snake_case (кириллица недопустима)';
				}
				if (!ENUM_VALUE_PATTERN.test(item)) {
					return 'Значение перечисления: строчная латиница, цифры и «_» (^[a-z][a-z0-9_]*$)';
				}
				if (!def.allowedValues.includes(item)) {
					return `Значение не входит в перечисление. Допустимы: ${def.allowedValues.join(', ')}`;
				}
			}
			return null;
		}
		case 'number':
			return typeof item === 'number' && Number.isFinite(item) ? null : 'Ожидалось число';
		case 'boolean':
			return typeof item === 'boolean' ? null : 'Ожидалось «да» или «нет»';
		case 'date': {
			const result = validateDateValue(item);
			return result.ok ? null : `Дата: ${result.violations.map((v) => v.detail).join('; ')}`;
		}
		case 'datetime': {
			const result = validateDateTimeValue(item);
			return result.ok ? null : `Дата и время: ${result.violations.map((v) => v.detail).join('; ')}`;
		}
		case 'object_reference':
		case 'media_reference': {
			if (typeof item !== 'string' || item.trim() === '') {
				return 'Ожидалась ссылка (непустая строка)';
			}
			// Существование цели и тип цели — уровни 3/4 (validate-object), не форма.
			return null;
		}
		default:
			return null;
	}
}

/**
 * Сериализует значения поля для записи во frontmatter:
 * пусто → undefined (ключ удаляется), одиночное → скаляр, множественное → список.
 * Строки обрезаются по краям; пустые строки в списках отбрасываются.
 */
export function serializeFieldValues(def: PropertyDef, values: unknown[]): unknown | undefined {
	const multiple = def.cardinality === '0..N' || def.cardinality === '1..N';
	const cleaned: unknown[] = [];
	for (const item of values) {
		if (item === undefined || item === null) {
			continue;
		}
		if (typeof item === 'string') {
			const trimmed = item.trim();
			if (trimmed === '') {
				continue;
			}
			cleaned.push(trimmed);
		} else {
			cleaned.push(item);
		}
	}
	if (cleaned.length === 0) {
		return undefined;
	}
	return multiple ? cleaned : cleaned[0];
}

export interface SaveObjectFormInput {
	/** Новое название (И4: aliases[0] синхронизируется). */
	title: string;
	/** Значения полей формы (включая СКРЫТЫЕ условные — М2: не удаляются). */
	values: FormValues;
}

export interface SaveObjectFormResult {
	path: string;
	/** Ключи предметных полей, которые изменились (для журнала/отладки). */
	updatedKeys: string[];
}

/**
 * Записывает результат формы в заметку (processFrontMatter — тело не трогается):
 * title + И4, значения полей модели (пустые необязательные удаляются),
 * `updated_at` (И5). Неизвестные и системные поля сохраняются как есть.
 */
export async function saveObjectForm(
	adapter: VaultAdapter,
	model: FormModel,
	note: SbNote,
	input: SaveObjectFormInput,
	log?: LogFn,
): Promise<SaveObjectFormResult> {
	const title = input.title.trim();
	if (title === '') {
		throw new Error('Название (title) не может быть пустым (object.title.required)');
	}
	const updatedKeys: string[] = [];
	const serialized = new Map<string, unknown>();
	for (const field of model.fields) {
		const values = input.values[field.def.key] ?? field.values;
		serialized.set(field.def.key, serializeFieldValues(field.def, values));
	}
	await adapter.processFrontMatter(model.path, (frontmatter) => {
		// title + И4: aliases[0] == title (остальные псевдонимы сохраняются).
		const oldTitle = typeof frontmatter.title === 'string' ? frontmatter.title : null;
		frontmatter.title = title;
		const aliases = Array.isArray(frontmatter.aliases)
			? frontmatter.aliases.filter((a): a is string => typeof a === 'string' && a !== oldTitle && a !== title)
			: [];
		frontmatter.aliases = [title, ...aliases];
		// Предметные поля модели (service/archived в модель не попадают).
		for (const [key, value] of serialized) {
			const before = frontmatter[key];
			if (value === undefined) {
				if (key in frontmatter) {
					delete frontmatter[key];
					updatedKeys.push(key);
				}
				continue;
			}
			if (JSON.stringify(before) !== JSON.stringify(value)) {
				updatedKeys.push(key);
			}
			frontmatter[key] = value;
		}
		// И5: updated_at — изменение данных пользователя (в отличие от служебной записи).
		frontmatter.updated_at = nowStamp();
	});
	log?.('info', 'edit', `Объект «${title}» (${model.typeKey}) сохранён через форму`, {
		path: model.path,
		updated: updatedKeys,
	});
	return { path: model.path, updatedKeys };
}

/** Результат преобразования строки ввода в типизированное значение (уровень 1). */
export type CoerceResult = { ok: true; value: unknown } | { ok: false; error: string };

/**
 * Преобразует СТРОКУ из контрола формы в значение объявленного типа
 * (форма хранит весь ввод как строки — единое состояние контролов).
 * Пустая строка — «не заполнено»: ok со значением '' (сериализация его отбросит).
 * Ошибка преобразования — уровень 1 (ADR-011): значение не попадёт в данные.
 */
export function coerceFormInput(def: PropertyDef, raw: string): CoerceResult {
	const text = raw.trim();
	switch (def.valueType) {
		case 'number': {
			if (text === '') {
				return { ok: true, value: '' };
			}
			const num = Number(text.replace(',', '.'));
			if (!Number.isFinite(num)) {
				return { ok: false, error: 'Ожидалось число (например, 7 или 7.5)' };
			}
			return { ok: true, value: num };
		}
		case 'boolean': {
			if (text === '') {
				return { ok: true, value: '' };
			}
			if (text === 'true' || text === 'да') {
				return { ok: true, value: true };
			}
			if (text === 'false' || text === 'нет') {
				return { ok: true, value: false };
			}
			return { ok: false, error: 'Ожидалось «да» или «нет»' };
		}
		default:
			return { ok: true, value: raw };
	}
}

/**
 * Начальные строки ввода для поля формы (фикс 0.8.1, DL-270): значения →
 * строки контролов; булевы — 'true'/'false'. Одиночное поле (0..1 / 1) ВСЕГДА
 * получает ровно одну строку — пустую, если значения нет: иначе контрол
 * одиночного поля не отрисуется (дефект 0.8.0: {#each []} не рисует ничего,
 * а кнопка «+ добавить» есть только у множественных). Множественное поле без
 * значений — ноль строк + кнопка добавления.
 */
export function initialEditRows(values: unknown[], multiple: boolean): string[] {
	const rows = values.map((v) => (typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v ?? '')));
	if (!multiple && rows.length === 0) {
		return [''];
	}
	return rows;
}

// ---------------------------------------------------------------------------
// Подбор цели ссылки (B1.2 часть 2): поиск кандидатов для object_reference
// ---------------------------------------------------------------------------

/** Кандидат подборщика ссылок (link-picker). */
export interface ReferenceCandidate {
	path: string;
	/** Заголовок (system.title; резерв — имя файла). */
	title: string;
	/** Ключ типа цели или null (тип не зарегистрирован/отсутствует). */
	typeKey: string | null;
	/** Подпись типа для показа («Человек») или ключ. */
	typeLabel: string | null;
	/** Готовая каноническая ссылка для записи в поле (ADR-001 + DL-186: всегда с псевдонимом). */
	canonicalLink: string;
}

/**
 * Ищет объекты-цели ссылки для подборщика (B1.2 часть 2, закрывает границу
 * B1.2-1): индекс с типами и заголовками (buildVaultIndex readTypes — один на
 * открытие подборщика), фильтр по `target_types` определения, нечёткий поиск
 * не нужен — простое вхождение подстроки в заголовок или имя файла (регистр
 * не важен). Сортировка: сначала совпадения с начала заголовка, далее по
 * алфавиту (ru). Псевдонимы в поиске не участвуют — alias-index это B2
 * (остаток границы B1.2-1).
 *
 * `media_target: file` (вложения) подборщиком не покрывается — файлы не
 * Markdown, индекс их не видит; медиа-этап D (граница B1.2-7).
 */
export function searchReferenceTargets(
	index: VaultIndex,
	registry: TypeRegistry,
	targetTypeKeys: readonly string[],
	query: string,
	options?: { limit?: number; excludePath?: string | null },
): ReferenceCandidate[] {
	const limit = options?.limit ?? 50;
	const excludePath = options?.excludePath ?? null;
	const noteTypes = index.noteTypes;
	const titles = index.titleByPath;
	if (noteTypes === undefined) {
		return []; // индекс без типов (readTypes не заказан) — подбор невозможен
	}
	const needle = query.trim().toLowerCase();
	const starts: ReferenceCandidate[] = [];
	const contains: ReferenceCandidate[] = [];
	for (const [path, typeKey] of noteTypes) {
		if (typeKey === null || path === excludePath) {
			continue;
		}
		if (targetTypeKeys.length > 0 && !targetTypeKeys.includes(typeKey)) {
			continue;
		}
		const fileName = path.slice(path.lastIndexOf('/') + 1);
		const baseName = fileName.replace(/\.md$/i, '');
		const title = titles?.get(path) ?? baseName;
		if (needle !== '') {
			const titleLower = title.toLowerCase();
			const isStart = titleLower.startsWith(needle) || baseName.toLowerCase().startsWith(needle);
			if (!isStart && !titleLower.includes(needle) && !baseName.toLowerCase().includes(needle)) {
				continue;
			}
			const candidate = toCandidate(path, title, typeKey, registry);
			(isStart ? starts : contains).push(candidate);
		} else {
			contains.push(toCandidate(path, title, typeKey, registry));
		}
	}
	const byTitle = (a: ReferenceCandidate, b: ReferenceCandidate) => a.title.localeCompare(b.title, 'ru');
	starts.sort(byTitle);
	contains.sort(byTitle);
	return [...starts, ...contains].slice(0, limit);
}

function toCandidate(path: string, title: string, typeKey: string, registry: TypeRegistry): ReferenceCandidate {
	const typeDef = registry.getType(typeKey);
	const fileName = path.slice(path.lastIndexOf('/') + 1);
	const identity = parseFileName(fileName);
	// Каноническая ссылка (ADR-001): {TYPE_PREFIX}-{ULID}.md|title; для заметок с
	// неканоническим именем — ссылка по имени файла (псевдоним всегда — DL-186).
	const target = identity !== null ? `${identity.typePrefix}-${identity.ulid}.md` : fileName.replace(/\.md$/i, '');
	return {
		path,
		title,
		typeKey,
		typeLabel: typeDef ? typeDef.label : typeKey,
		canonicalLink: `[[${target}|${title}]]`,
	};
}
