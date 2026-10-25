/**
 * schema-engine (модуль этапа B1.1, 09-modules слой 2): проверка определений свойств
 * и значений экземпляров по метамодели.
 *
 * Нормы: `docs/validation/rules.md` — группы B (определения свойств, 16 правил),
 * C (значения свойств), G (перечисления), H (даты — через date-engine);
 * `04-attributes.md` §2/§4/§4.1/§5, `05-enumerations.md` §5, ADR-006/008/011.
 * Уровни контроля 2–4 (severity-policy §3): движок вызывается при чтении объекта
 * и по команде; уровень 1 (в модалке при вводе) появится в B1.2.
 *
 * Приоритет правил (rules.md «Перекрывающиеся правила»): специальное правило имеет
 * приоритет, общее запускается только если специальное не сработало. Поэтому:
 *   - для date/datetime выдаются правила группы H, а не общее `value.type_conformance`;
 *   - для перечислений — `enum.value.in_set` (частный случай `value.allowed_values`:
 *     runtime-носитель реестра перечислений — `allowed_values` определения, посеянные
 *     из `05-enumerations.md`; расхождение id зафиксировано в architecture.md §5);
 *   - для ссылок — `value.reference.exists` / `value.reference.target_type`.
 *
 * Границы части 1 (честно, M6) — сняты в части 2 (DL-266):
 *   - условные свойства (`applies_when`) проверяются движком applies-when (М1–М7):
 *     скрытое свойство не проверяется на обязательность (М6), но качество его
 *     сохранённых значений проверяется (М2 — данные не удаляются);
 *   - правило П2 реализовано как `date.all_unknown.optional_only` (rules.md v0.14.0);
 *   - правила группы E для определений типов (`object_type.*`) — здесь
 *     (validateObjectTypeDefinition); классификация (`category.*`, `facet.*`,
 *     `taxonomy.*`, `assignment.*`) — B1.3 с classification-service.
 * По-прежнему вне объёма: существование файлов-вложений для `media_target: file` —
 * этап D (media-service); правила `period.*` — этап C (интервалы в `.sb/relations/`);
 * `display_template.*` (уровень 5) — B1.2; разрешение ссылок по псевдонимам — B2.
 */

import type { VaultAdapter } from '../adapter/vault-adapter';
import { isPropertyVisible } from './applies-when';
import { isFullyUnknownDate, validateDateTimeValue, validateDateValue } from './date-engine';
import { diagnostic, type SbDiagnostic } from './diagnostics';
import { parseFileName } from './identity';
import type { LabelResolver } from './label-resolver';
import { parseNote } from './markdown-parser';
import type { SbNote } from './model';
import { SYSTEM_KEYS } from './model';
import { linkIdList, type PropertyDef, type TypeRegistry } from './registry';

/** Закрытый набор типов значений (ADR-006; `defs.json#$defs.value_type`). */
export const VALUE_TYPES = ['text', 'number', 'date', 'datetime', 'boolean', 'object_reference', 'media_reference'] as const;

/** Закрытый набор кардинальностей (`defs.json#$defs.cardinality`). */
export const CARDINALITIES = ['0..1', '1', '0..N', '1..N'] as const;

/** Закрытый набор операций `applies_when` (М4, 04-attributes §11). */
export const APPLIES_OPERATIONS = ['equals', 'in_category', 'includes_any'] as const;

/** Формат значения перечисления (`enum.value.format`, 05-enumerations §5). */
export const ENUM_VALUE_PATTERN = /^[a-z][a-z0-9_]*$/;

/** Формат ключа свойства (`property.key.format`, ADR-003). */
export const PROPERTY_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

/** Кириллица (и прочие славянские символы) — `enum.value.no_mixed_script`. */
export const CYRILLIC_PATTERN = /[\u0400-\u04FF]/;

// ---------------------------------------------------------------------------
// Индекс хранилища (для структурных проверок уровня 3)
// ---------------------------------------------------------------------------

/** Куда ведёт ссылка: каноническое имя (ULID) или произвольное имя заметки. */
export interface VaultIndexEntry {
	path: string;
	typePrefix: string | null;
}

/** Снимок имён хранилища для проверок «цель ссылки существует» (уровень 3). */
export interface VaultIndex {
	byUlid: Map<string, VaultIndexEntry>;
	/** Имя файла без расширения (нижний регистр) → пути (коллизии имён возможны). */
	byBaseName: Map<string, string[]>;
	/**
	 * Тип из frontmatter по пути (null — типа нет/файл не разобрался). Заполняется
	 * только при `readTypes: true` (validate-vault); нужно для правила
	 * `object_type.abstract.no_instance` (уровень 4 — проверка масштаба хранилища).
	 */
	noteTypes?: Map<string, string | null>;
	/**
	 * Заметки — объекты Second Brain (во frontmatter есть `id` или `type`): область
	 * действия validate-vault и служебного слоя (service-flags, решение 3).
	 * Заполняется только при `readTypes: true`.
	 */
	sbObjectPaths?: Set<string>;
}

export interface BuildVaultIndexOptions {
	/**
	 * Читать frontmatter всех заметок (типы + признак SB-объекта). Дороже именного
	 * прохода (чтение каждого файла), поэтому по умолчанию выключено: validate-object
	 * строит индекс имён, validate-vault — полный индекс (один на прогон).
	 */
	readTypes?: boolean;
}

/**
 * Строит индекс по всем Markdown-файлам хранилища (listMarkdown; dot-папки не входят —
 * Obsidian их не индексирует). Разрешение ссылок: каноническая цель {TYPE_PREFIX}-{ULID}
 * ищется по ULID; прочее — по имени файла без расширения. Разрешение по псевдонимам —
 * этап B2 (alias-index); до этого неканоническая ссылка на заметку с другим именем
 * считается несуществующей (честное ограничение, architecture.md §5).
 */
export async function buildVaultIndex(adapter: VaultAdapter, options?: BuildVaultIndexOptions): Promise<VaultIndex> {
	const index: VaultIndex = { byUlid: new Map(), byBaseName: new Map() };
	const paths = await adapter.listMarkdown();
	for (const path of paths) {
		const fileName = path.slice(path.lastIndexOf('/') + 1);
		const baseName = fileName.replace(/\.md$/i, '').toLowerCase();
		const list = index.byBaseName.get(baseName) ?? [];
		list.push(path);
		index.byBaseName.set(baseName, list);
		const identity = parseFileName(fileName);
		if (identity !== null) {
			index.byUlid.set(identity.ulid, { path, typePrefix: identity.typePrefix });
		}
	}
	if (options?.readTypes === true) {
		index.noteTypes = new Map();
		index.sbObjectPaths = new Set();
		for (const path of paths) {
			try {
				const content = await adapter.read(path);
				const note = parseNote({ path, content }, adapter);
				const type = typeof note.system.type === 'string' ? note.system.type : null;
				index.noteTypes.set(path, type);
				if (!note.frontmatterBroken && (type !== null || typeof note.system.id === 'string')) {
					index.sbObjectPaths.add(path);
				}
			} catch {
				index.noteTypes.set(path, null); // файл не читается — validate-object пожалуется отдельно
			}
		}
	}
	return index;
}

/** Извлекает цель wikilink-а из значения свойства (строка с [[цель…]] или голая строка). */
function extractLinkTarget(value: unknown): string | null {
	if (typeof value !== 'string') {
		return null;
	}
	const wiki = /\[\[([^\]|#^]+)/.exec(value);
	if (wiki !== null) {
		return wiki[1].trim();
	}
	return value.trim() === '' ? null : value.trim();
}

// ---------------------------------------------------------------------------
// Группа B: определения свойств (16 правил)
// ---------------------------------------------------------------------------

interface DefinitionContext {
	registry: TypeRegistry;
	labels: LabelResolver;
	/** null — структурные проверки (уровень 3) пропускаются. */
	index: VaultIndex | null;
}

/**
 * Множество id типов, которые покрывает определение свойства (F5-8 = А):
 * universal без object_types — все типы ('ALL'); иначе — указанные типы + потомки
 * (семантика family: ссылка на абстрактного предка включает потомков, DL-208).
 * Экспортируется для creation.ts (проверка уникальности ключа до записи, уровень 1).
 */
export function coverageOf(def: Pick<PropertyDef, 'scope' | 'objectTypes'>, registry: TypeRegistry): Set<string> | 'ALL' {
	if (def.scope === 'universal' && def.objectTypes.length === 0) {
		return 'ALL';
	}
	const covered = new Set<string>();
	for (const typeId of def.objectTypes) {
		const typeDef = registry.getTypeById(typeId);
		if (!typeDef) continue;
		covered.add(typeDef.typeKey);
		for (const candidate of registry.types) {
			if (registry.ancestorsOf(candidate.typeKey).some((ancestor) => ancestor.id === typeId)) {
				covered.add(candidate.typeKey);
			}
		}
	}
	return covered;
}

export function coverageIntersects(a: Set<string> | 'ALL', b: Set<string> | 'ALL'): boolean {
	if (a === 'ALL' || b === 'ALL') {
		return true;
	}
	for (const key of a) {
		if (b.has(key)) {
			return true;
		}
	}
	return false;
}

/**
 * Проверяет заметку-определение свойства (type: property) по группе B реестра правил.
 * Вызывается из validateObject; обязательные поля уже проверены реестром при загрузке
 * (issues 'missing_required_field') — здесь семантика.
 */
export function validatePropertyDefinition(note: SbNote, ctx: DefinitionContext): SbDiagnostic[] {
	const { registry, labels, index } = ctx;
	const out: SbDiagnostic[] = [];
	const raw = note.properties;
	const base = {
		object_id: typeof note.system.id === 'string' ? note.system.id : null,
		object_path: note.path,
	};
	const push = (input: Omit<Parameters<typeof diagnostic>[0], 'object_id' | 'object_path'>) =>
		out.push(diagnostic({ ...base, ...input }));

	const key = typeof raw.key === 'string' ? raw.key : null;
	const self = key !== null ? registry.properties.find((p) => p.path === note.path) ?? null : null;

	// property.key.format (error, 2)
	if (key !== null && !PROPERTY_KEY_PATTERN.test(key)) {
		push({
			rule_id: 'property.key.format',
			severity: 'error',
			level: 2,
			property_key: 'key',
			actual_value: key,
			message: `Ключ свойства «${key}» не соответствует формату: строчная латиница, цифры, «_» (^[a-z][a-z0-9_]*$)`,
			hint: 'Ключ стабилен и англоязычен (ADR-003); русское название задаётся полем label',
		});
	}

	// property.key.no_system_conflict (error, 4) — инвариант И6
	if (key !== null && (SYSTEM_KEYS as readonly string[]).includes(key)) {
		push({
			rule_id: 'property.key.no_system_conflict',
			severity: 'error',
			level: 4,
			property_key: 'key',
			actual_value: key,
			message: `Ключ свойства «${key}» занят системным атрибутом (И6)`,
			hint: 'Выберите другой ключ: системные атрибуты (id, type, title, aliases, created_at, updated_at, categories, tags) не переопределяются',
		});
	}

	// property.label.required (error, 2)
	const label = typeof raw.label === 'string' ? raw.label.trim() : '';
	if (label === '') {
		push({
			rule_id: 'property.label.required',
			severity: 'error',
			level: 2,
			property_key: 'label',
			actual_value: raw.label ?? null,
			message: 'У свойства не заполнена русская подпись (label)',
			hint: 'Подпись показывает интерфейс (ADR-003): например, «Автор», «Год издания»',
		});
	}

	// property.value_type.closed (error, 4)
	const valueType = typeof raw.value_type === 'string' ? raw.value_type : null;
	if (valueType !== null && !(VALUE_TYPES as readonly string[]).includes(valueType)) {
		push({
			rule_id: 'property.value_type.closed',
			severity: 'error',
			level: 4,
			property_key: 'value_type',
			actual_value: valueType,
			message: `Тип значения «${valueType}» не входит в закрытый набор из семи (ADR-006)`,
			hint: `Допустимы: ${VALUE_TYPES.join(', ')}`,
		});
	}

	// property.required.cardinality_consistency (error, 4) — 04-attributes §4
	const cardinality = typeof raw.cardinality === 'string' ? raw.cardinality : null;
	if (typeof raw.required === 'boolean' && cardinality !== null) {
		const expectsRequired = cardinality === '1' || cardinality === '1..N';
		const expectsOptional = cardinality === '0..1' || cardinality === '0..N';
		if ((expectsRequired && raw.required !== true) || (expectsOptional && raw.required !== false)) {
			push({
				rule_id: 'property.required.cardinality_consistency',
				severity: 'error',
				level: 4,
				property_key: 'required',
				actual_value: raw.required,
				message: `Пара required=${String(raw.required)} и cardinality=«${cardinality}» несогласована`,
				hint: 'cardinality «1» и «1..N» ⇒ required: true; «0..1» и «0..N» ⇒ required: false (04-attributes §4)',
			});
		}
	}

	// property.target_types.for_reference (error, 4)
	if (valueType === 'object_reference' || valueType === 'media_reference') {
		const targetTypes = self?.targetTypeIds ?? [];
		if (targetTypes.length === 0) {
			push({
				rule_id: 'property.target_types.for_reference',
				severity: 'error',
				level: 4,
				property_key: 'target_types',
				message: `У свойства типа «${valueType}» не заполнен target_types`,
				hint: 'Перечислите типы, на которые может ссылаться свойство (ссылки на OBJECT_TYPE-определения)',
			});
		}
	}

	// property.target_facet.is_facet (error, 3)
	if (self !== null && self.targetFacetId !== null) {
		const entry = index?.byUlid.get(self.targetFacetId) ?? null;
		if (index !== null && (entry === null || entry.typePrefix !== 'FACET')) {
			push({
				rule_id: 'property.target_facet.is_facet',
				severity: 'error',
				level: 3,
				property_key: 'target_facet',
				actual_value: self.targetFacetId,
				message:
					entry === null
						? 'Цель target_facet не найдена в хранилище'
						: `Цель target_facet — не фасет (файл ${entry.path})`,
				hint: 'target_facet указывает на определение фасета (FACET-{ULID}.md, ADR-007)',
			});
		}
	}

	// ---- applies_when: пять правил (04-attributes §11) ----
	const appliesRaw =
		typeof raw.applies_when === 'object' && raw.applies_when !== null && !Array.isArray(raw.applies_when)
			? (raw.applies_when as Record<string, unknown>)
			: null;
	if (raw.applies_when !== undefined && appliesRaw === null) {
		push({
			rule_id: 'property.applies_when.value_present',
			severity: 'error',
			level: 2,
			property_key: 'applies_when',
			actual_value: raw.applies_when,
			message: 'applies_when должен быть блоком { property, operation, value }',
			hint: 'См. 04-attributes §11: условие показа и проверки свойства',
		});
	} else if (appliesRaw !== null) {
		const triggerKey = typeof appliesRaw.property === 'string' ? appliesRaw.property : null;
		const operation = typeof appliesRaw.operation === 'string' ? appliesRaw.operation : null;
		const valuePresent =
			appliesRaw.value !== undefined &&
			appliesRaw.value !== null &&
			!(Array.isArray(appliesRaw.value) && appliesRaw.value.length === 0) &&
			!(typeof appliesRaw.value === 'string' && appliesRaw.value.trim() === '');

		// property.applies_when.value_present (error, 2)
		if (!valuePresent || triggerKey === null) {
			push({
				rule_id: 'property.applies_when.value_present',
				severity: 'error',
				level: 2,
				property_key: 'applies_when',
				actual_value: raw.applies_when,
				message: 'Условие applies_when неполное: нужны property и непустое value',
				hint: 'Пример: { property: format, operation: equals, value: file }',
			});
		}

		// property.applies_when.operation_closed (error, 4 — правило М4)
		if (operation !== null && !(APPLIES_OPERATIONS as readonly string[]).includes(operation)) {
			push({
				rule_id: 'property.applies_when.operation_closed',
				severity: 'error',
				level: 4,
				property_key: 'applies_when',
				actual_value: operation,
				message: `Операция условия «${operation}» не входит в закрытый набор (М4)`,
				hint: `Допустимы: ${APPLIES_OPERATIONS.join(', ')}`,
			});
		}

		if (triggerKey !== null && self !== null) {
			const selfCoverage = coverageOf(self, registry);
			const trigger = registry.properties.find((p) => p.key === triggerKey && p.path !== note.path) ?? null;

			// property.applies_when.property_exists (error, 3)
			if (trigger === null || !coverageIntersects(selfCoverage, coverageOf(trigger, registry))) {
				push({
					rule_id: 'property.applies_when.property_exists',
					severity: 'error',
					level: 3,
					property_key: 'applies_when',
					actual_value: triggerKey,
					message: `Свойство-триггер «${triggerKey}» не существует в том же типе (или его покрытие не пересекается)`,
					hint: 'Условие ссылается на свойство того же типа объекта (М2: только объявленная схема)',
				});
			} else {
				// property.applies_when.no_chain (error, 4 — правило М3)
				if (trigger.appliesWhen !== null) {
					push({
						rule_id: 'property.applies_when.no_chain',
						severity: 'error',
						level: 4,
						property_key: 'applies_when',
						actual_value: triggerKey,
						message: `Свойство-триггер «${triggerKey}» само условное — цепочки условий запрещены (М3)`,
						hint: 'Триггером может быть только безусловное свойство',
					});
				}
				// property.applies_when.operation_matches_cardinality (warning, 4)
				if (
					operation === 'includes_any' &&
					trigger.cardinality !== '0..N' &&
					trigger.cardinality !== '1..N'
				) {
					push({
						rule_id: 'property.applies_when.operation_matches_cardinality',
						severity: 'warning',
						level: 4,
						property_key: 'applies_when',
						actual_value: trigger.cardinality,
						message: `includes_any применяется к триггеру «${triggerKey}» с одиночной кардинальностью (${trigger.cardinality})`,
						hint: 'includes_any рассчитан на множественный триггер (0..N/1..N); для одиночного обычно достаточно equals',
					});
				}
			}
		}
	}

	// property.create_from_link.auto_needs_single_target (error, 3 — раздел 12)
	if (typeof raw.create_from_link === 'string' && raw.create_from_link === 'auto') {
		const targetTypes = self?.targetTypeIds ?? [];
		if (targetTypes.length !== 1) {
			push({
				rule_id: 'property.create_from_link.auto_needs_single_target',
				severity: 'error',
				level: 3,
				property_key: 'create_from_link',
				actual_value: targetTypes.length,
				message: `create_from_link: auto требует ровно один тип цели в target_types (найдено ${targetTypes.length})`,
				hint: 'Авто-создание из пустой ссылки однозначно только при единственном типе цели; иначе — ask',
			});
		}
	}

	// property.object_types.scope_consistency (error, 4) и .exists (error, 3) — F5-8 = А
	if (self !== null) {
		const scope = self.scope;
		const links = self.objectTypes;
		if (scope === 'universal' && links.length > 0) {
			push({
				rule_id: 'property.object_types.scope_consistency',
				severity: 'error',
				level: 4,
				property_key: 'object_types',
				actual_value: links.length,
				message: 'У свойства со scope: universal список object_types должен быть пуст (или отсутствовать)',
				hint: 'universal + пусто = свойство доступно всем типам (04-attributes §4.1)',
			});
		} else if (scope === 'family') {
			if (links.length !== 1) {
				push({
					rule_id: 'property.object_types.scope_consistency',
					severity: 'error',
					level: 4,
					property_key: 'object_types',
					actual_value: links.length,
					message: `scope: family требует ровно одну ссылку на абстрактного предка (найдено ${links.length})`,
					hint: 'Потомки предка включаются автоматически (DL-208)',
				});
			} else {
				const target = registry.getTypeById(links[0]);
				if (target !== null && !target.abstract) {
					push({
						rule_id: 'property.object_types.scope_consistency',
						severity: 'error',
						level: 4,
						property_key: 'object_types',
						actual_value: target.typeKey,
						message: `scope: family ссылается на неабстрактный тип «${target.label}»`,
						hint: 'family — ссылка на АБСТРАКТНОГО предка; для конкретных типов — scope: specific',
					});
				}
			}
		} else if (scope === 'specific') {
			if (links.length === 0) {
				push({
					rule_id: 'property.object_types.scope_consistency',
					severity: 'error',
					level: 4,
					property_key: 'object_types',
					actual_value: links.length,
					message: 'scope: specific требует одну или более ссылок на неабстрактные типы',
					hint: 'Перечислите конкретные типы в object_types (04-attributes §4.1)',
				});
			}
			for (const linkId of links) {
				const target = registry.getTypeById(linkId);
				if (target !== null && target.abstract) {
					push({
						rule_id: 'property.object_types.scope_consistency',
						severity: 'error',
						level: 4,
						property_key: 'object_types',
						actual_value: target.typeKey,
						message: `scope: specific ссылается на абстрактный тип «${target.label}»`,
						hint: 'Для абстрактного предка используйте scope: family (потомки включатся автоматически)',
					});
				}
			}
		}
		for (const linkId of links) {
			if (registry.getTypeById(linkId) === null) {
				push({
					rule_id: 'property.object_types.exists',
					severity: 'error',
					level: 3,
					property_key: 'object_types',
					actual_value: linkId,
					message: 'Ссылка object_types ведёт на несуществующее определение типа',
					hint: 'Проверьте wikilink: цель — файл OBJECT_TYPE-{ULID}.md из Metamodel/ObjectTypes/',
				});
			}
		}
	}

	// property.key.unique_in_type (error, 3) — пересечение покрытия с другим определением того же ключа
	if (key !== null && self !== null) {
		const selfCoverage = coverageOf(self, registry);
		for (const other of registry.properties) {
			if (other.path === note.path || other.key !== key) continue;
			if (coverageIntersects(selfCoverage, coverageOf(other, registry))) {
				push({
					rule_id: 'property.key.unique_in_type',
					severity: 'error',
					level: 3,
					property_key: 'key',
					actual_value: key,
					message: `Ключ «${key}» уже объявлен другим свойством (${other.path}) с пересекающимся покрытием типов`,
					hint: 'В пределах типа и его предков ключ не повторяется; объедините определения или сузьте object_types',
				});
				break;
			}
		}
	}

	return out;
}

// ---------------------------------------------------------------------------
// Группа E (часть): определения типов объектов — object_type.* (4 правила)
// ---------------------------------------------------------------------------

/**
 * Проверяет заметку-определение типа (type: object_type) по правилам группы E
 * реестра (`object_type.*`); правила классификации (`category.*`, `facet.*`,
 * `taxonomy.*`, `assignment.*`) — B1.3 вместе с classification-service.
 *
 *   - object_type.parent.exists      (error, 3) — родитель существует в реестре;
 *   - object_type.parent.no_cycle    (error, 3) — в цепочке родителей нет цикла;
 *   - object_type.type_prefix.unique (error, 2) — префикс уникален как целая строка;
 *   - object_type.abstract.no_instance (error, 4) — у абстрактного типа нет экземпляров.
 *     Правило масштаба хранилища: работает, когда индекс построен с `readTypes: true`
 *     (validate-vault); в одиночном validate-object без типов в индексе пропускается
 *     (честная граница — architecture.md §5, B1.1-7).
 *
 * Как и группа B в части 1: определение проверяется, даже если метатип `object_type`
 * не зарегистрирован (дух ADR-002 — object.type.exists уже пожаловался).
 */
export function validateObjectTypeDefinition(note: SbNote, ctx: DefinitionContext): SbDiagnostic[] {
	const { registry, index } = ctx;
	const out: SbDiagnostic[] = [];
	const base = {
		object_id: typeof note.system.id === 'string' ? note.system.id : null,
		object_path: note.path,
	};
	const push = (input: Omit<Parameters<typeof diagnostic>[0], 'object_id' | 'object_path'>) =>
		out.push(diagnostic({ ...base, ...input }));

	const self = registry.types.find((t) => t.path === note.path) ?? null;

	// object_type.parent.exists (error, 3) — по wikilink-ам parent_type (список или одиночная ссылка)
	for (const parentId of linkIdList(note.properties.parent_type)) {
		if (registry.getTypeById(parentId) === null) {
			push({
				rule_id: 'object_type.parent.exists',
				severity: 'error',
				level: 3,
				property_key: 'parent_type',
				actual_value: parentId,
				message: 'Родительский тип не найден среди определений метамодели',
				hint: 'Проверьте wikilink parent_type: цель — файл OBJECT_TYPE-{ULID}.md из Metamodel/ObjectTypes/',
			});
		}
	}

	if (self !== null) {
		// object_type.parent.no_cycle (error, 3) — обход цепочки родителей с посещёнными id
		const visited = new Set<string>([self.id]);
		let current = self;
		for (;;) {
			if (current.parentId === null) {
				break;
			}
			if (visited.has(current.parentId)) {
				push({
					rule_id: 'object_type.parent.no_cycle',
					severity: 'error',
					level: 3,
					property_key: 'parent_type',
					actual_value: current.parentId,
					message: `В цепочке родителей типа «${self.label}» есть цикл (${self.typeKey} → … → ${current.typeKey} → …)`,
					hint: 'Иерархия типов — дерево (07-hierarchy): уберите одну из ссылок parent_type',
				});
				break;
			}
			const parent = registry.getTypeById(current.parentId);
			if (parent === null) {
				break; // висячий родитель — уже отмечен parent.exists
			}
			visited.add(parent.id);
			current = parent;
		}

		// object_type.type_prefix.unique (error, 2) — префикс уникален как целая строка (ADR-001)
		const prefixTwins = registry.types.filter((t) => t.path !== self.path && t.typePrefix === self.typePrefix);
		if (prefixTwins.length > 0) {
			push({
				rule_id: 'object_type.type_prefix.unique',
				severity: 'error',
				level: 2,
				property_key: 'type_prefix',
				actual_value: self.typePrefix,
				message: `TYPE_PREFIX «${self.typePrefix}» уже занят типом «${prefixTwins.map((t) => t.typeKey).join(', ')}»`,
				hint: 'Префикс уникален как целая строка (ADR-001, реестр 02-entities §6); выберите другой',
			});
		}

		// object_type.abstract.no_instance (error, 4) — только с полным индексом (readTypes)
		if (self.abstract && index?.noteTypes !== undefined) {
			const instances: string[] = [];
			for (const [path, type] of index.noteTypes) {
				if (type === self.typeKey && path !== self.path) {
					instances.push(path);
				}
			}
			if (instances.length > 0) {
				const examples = instances.slice(0, 3).join(', ');
				push({
					rule_id: 'object_type.abstract.no_instance',
					severity: 'error',
					level: 4,
					property_key: 'abstract',
					actual_value: instances.length,
					message: `У абстрактного типа «${self.label}» (${self.typeKey}) найдено экземпляров: ${instances.length} (${examples}${instances.length > 3 ? ', …' : ''})`,
					hint: 'Экземпляры абстрактного типа невозможны (И3): смените тип экземпляров на конкретного потомка или снимите abstract у типа',
				});
			}
		}
	}
	return out;
}

// ---------------------------------------------------------------------------
// Группы C/G/H: значения экземпляров
// ---------------------------------------------------------------------------

/** Результат разрешения ссылки (уровень 3). */
interface ResolvedReference {
	exists: boolean;
	targetTypeKey: string | null;
	targetPath: string | null;
}

function resolveReference(target: string, ctx: DefinitionContext): ResolvedReference {
	const { registry, index } = ctx;
	if (index === null) {
		return { exists: true, targetTypeKey: null, targetPath: null }; // уровень 3 пропускается
	}
	const fileName = target.slice(target.lastIndexOf('/') + 1);
	const identity = parseFileName(fileName.endsWith('.md') ? fileName : `${fileName}.md`);
	if (identity !== null) {
		const entry = index.byUlid.get(identity.ulid);
		if (entry === undefined) {
			return { exists: false, targetTypeKey: null, targetPath: null };
		}
		const typeDef = registry.getTypeByPrefix(identity.typePrefix);
		return { exists: true, targetTypeKey: typeDef?.typeKey ?? null, targetPath: entry.path };
	}
	const byName = index.byBaseName.get(fileName.replace(/\.md$/i, '').toLowerCase());
	if (byName !== undefined && byName.length > 0) {
		return { exists: true, targetTypeKey: null, targetPath: byName[0] };
	}
	return { exists: false, targetTypeKey: null, targetPath: null };
}

/**
 * Проверяет значения предметных полей экземпляра (группы C, G и форматная часть H)
 * по определениям свойств типа.
 *
 * Условные свойства (`applies_when`) — часть 2 (движок applies-when, М1–М7):
 *   - условие ВЫПОЛНЕНО (свойство видимо) — проверки в полном объёме, включая
 *     обязательность (М6: обязательность проверяется только когда условие выполнено);
 *   - условие НЕ выполнено (свойство скрыто) — `value.cardinality` не применяется
 *     (rules.md «Перекрывающиеся правила»), но качество СОХРАНЁННЫХ значений
 *     проверяется (М2: значения «погасших» свойств не удаляются — испорченные
 *     данные должны быть видны независимо от видимости поля).
 */
export function validateInstanceValues(
	note: SbNote,
	typeKey: string,
	ctx: DefinitionContext,
): SbDiagnostic[] {
	const { registry, labels, index } = ctx;
	const out: SbDiagnostic[] = [];
	const base = {
		object_id: typeof note.system.id === 'string' ? note.system.id : null,
		object_path: note.path,
	};
	const push = (input: Omit<Parameters<typeof diagnostic>[0], 'object_id' | 'object_path'>) =>
		out.push(diagnostic({ ...base, ...input }));

	for (const def of registry.getPropertiesForType(typeKey)) {
		const visible = isPropertyVisible(def, note);
		const rawValue = note.properties[def.key];
		const multiple = def.cardinality === '0..N' || def.cardinality === '1..N';
		const present = rawValue !== undefined && rawValue !== null && !(Array.isArray(rawValue) && rawValue.length === 0);
		const items: unknown[] = present ? (Array.isArray(rawValue) ? rawValue : [rawValue]) : [];
		const propertyLabel = labels.forPropertyKey(def.key, typeKey);

		// value.cardinality (error, уровень 4): обязательность и количество.
		// М6: к скрытым условным свойствам правило не применяется.
		if (visible) {
			if (def.required && items.length === 0) {
				push({
					rule_id: 'value.cardinality',
					severity: 'error',
					level: 4,
					property_key: def.key,
					message: `Обязательное свойство «${propertyLabel}» не заполнено`,
					hint: `Заполните поле «${propertyLabel}» (кардинальность ${def.cardinality})`,
				});
				continue;
			}
			if (!multiple && items.length > 1) {
				push({
					rule_id: 'value.cardinality',
					severity: 'error',
					level: 4,
					property_key: def.key,
					actual_value: items.length,
					message: `Свойство «${propertyLabel}» допускает одно значение (кардинальность ${def.cardinality}), найдено ${items.length}`,
					hint: 'Оставьте одно значение или измените кардинальность в определении свойства',
				});
			}
		}

		for (const item of items) {
			checkValueItem(item, def, propertyLabel, push, ctx, visible);
		}
	}
	return out;
}

type PushFn = (input: Omit<Parameters<typeof diagnostic>[0], 'object_id' | 'object_path'>) => void;

function checkValueItem(item: unknown, def: PropertyDef, propertyLabel: string, push: PushFn, ctx: DefinitionContext, visible = true): void {
	switch (def.valueType) {
		case 'text': {
			if (typeof item !== 'string') {
				pushTypeMismatch(item, def, propertyLabel, push, 'текст');
			} else if (def.allowedValues.length > 0) {
				checkEnumValue(item, def, propertyLabel, push);
			}
			return;
		}
		case 'number': {
			if (typeof item !== 'number' || !Number.isFinite(item)) {
				pushTypeMismatch(item, def, propertyLabel, push, 'число');
			}
			return;
		}
		case 'boolean': {
			if (typeof item !== 'boolean') {
				pushTypeMismatch(item, def, propertyLabel, push, 'true/false');
			}
			return;
		}
		case 'date':
		case 'datetime': {
			const result = def.valueType === 'date' ? validateDateValue(item) : validateDateTimeValue(item);
			if (!result.ok) {
				for (const violation of result.violations) {
					push({
						rule_id: violation.rule_id,
						severity: violation.severity,
						level: 2,
						property_key: def.key,
						actual_value: item,
						message: `Свойство «${propertyLabel}»: ${violation.detail}`,
						hint:
							def.valueType === 'date'
								? 'Формат даты: YYYY-MM-DD; неизвестный компонент — «00» (06-time-and-intervals §2)'
								: 'Формат: YYYY-MM-DDTHH:mm, локальное время, точность до минут (04-attributes §6)',
					});
				}
			}
			// П2 → date.all_unknown.optional_only (warning, 2; rules.md v0.14.0, DL-265):
			// дата, неизвестная целиком, допустима только в необязательном поле.
			// Обязательность проверяется только для видимых свойств (М6 — скрытое
			// условное свойство не «обязательное» в момент, когда условие не выполнено).
			if (def.valueType === 'date' && visible && def.required && isFullyUnknownDate(item)) {
				push({
					rule_id: 'date.all_unknown.optional_only',
					severity: 'warning',
					level: 2,
					property_key: def.key,
					actual_value: item,
					message: `Обязательное свойство «${propertyLabel}» содержит дату, неизвестную целиком (0000-00-00)`,
					hint: 'Дата «неизвестна целиком» допустима только в необязательном поле (П2, 06-time-and-intervals §2): укажите хотя бы год или очистите поле',
				});
			}
			return;
		}
		case 'object_reference':
		case 'media_reference': {
			if (typeof item !== 'string') {
				pushTypeMismatch(item, def, propertyLabel, push, 'ссылка');
				return;
			}
			if (def.valueType === 'media_reference' && def.mediaTarget === 'file') {
				// Ссылка на вложение: существование файла проверяет media-service (этап D).
				return;
			}
			const target = extractLinkTarget(item);
			if (target === null) {
				push({
					rule_id: 'value.type_conformance',
					severity: 'error',
					level: 4,
					property_key: def.key,
					actual_value: item,
					message: `Свойство «${propertyLabel}» ожидало ссылку, значение пустое`,
					hint: 'Каноническая ссылка: [[{TYPE_PREFIX}-{ULID}.md|название]] (ADR-001)',
				});
				return;
			}
			const resolved = resolveReference(target, ctx);
			if (!resolved.exists) {
				push({
					rule_id: 'value.reference.exists',
					severity: 'error',
					level: 3,
					property_key: def.key,
					actual_value: item,
					message: `Свойство «${propertyLabel}»: цель ссылки «${target}» не найдена в хранилище`,
					hint: 'Создайте объект-цель или исправьте ссылку (разрешение по псевдонимам появится в B2)',
				});
				return;
			}
			if (
				ctx.index !== null &&
				resolved.targetTypeKey !== null &&
				def.targetTypeKeys.length > 0 &&
				!def.targetTypeKeys.includes(resolved.targetTypeKey)
			) {
				push({
					rule_id: 'value.reference.target_type',
					severity: 'error',
					level: 3,
					property_key: def.key,
					actual_value: item,
					message: `Свойство «${propertyLabel}»: цель ссылки — тип «${resolved.targetTypeKey}», а допустимы: ${def.targetTypeKeys.join(', ')}`,
					hint: 'Проверьте target_types в определении свойства или выберите объект допустимого типа',
				});
			}
			return;
		}
		default:
			return;
	}
}

function checkEnumValue(item: string, def: PropertyDef, propertyLabel: string, push: PushFn): void {
	// enum.value.no_mixed_script (error, 2) — специальное, раньше format (кириллица не даст ему пройти)
	if (CYRILLIC_PATTERN.test(item)) {
		push({
			rule_id: 'enum.value.no_mixed_script',
			severity: 'error',
			level: 2,
			property_key: def.key,
			actual_value: item,
			message: `Значение перечисления «${item}» содержит кириллицу`,
			hint: 'Ключи значений — английский snake_case (ADR-003); русская подпись — в реестре перечисления',
		});
		return;
	}
	// enum.value.format (error, 2)
	if (!ENUM_VALUE_PATTERN.test(item)) {
		push({
			rule_id: 'enum.value.format',
			severity: 'error',
			level: 2,
			property_key: def.key,
			actual_value: item,
			message: `Значение перечисления «${item}» не соответствует формату ^[a-z][a-z0-9_]*$`,
			hint: 'Значения перечислений — строчная латиница, цифры и «_» (05-enumerations §5)',
		});
		return;
	}
	// enum.value.in_set (error, 4) — runtime-носитель реестра: allowed_values определения
	if (!def.allowedValues.includes(item)) {
		push({
			rule_id: 'enum.value.in_set',
			severity: 'error',
			level: 4,
			property_key: def.key,
			actual_value: item,
			message: `Значение «${item}» не входит в перечисление свойства «${propertyLabel}»`,
			hint: `Допустимы: ${def.allowedValues.join(', ')}`,
		});
	}
}

function pushTypeMismatch(item: unknown, def: PropertyDef, propertyLabel: string, push: PushFn, expected: string): void {
	push({
		rule_id: 'value.type_conformance',
		severity: 'error',
		level: 4,
		property_key: def.key,
		actual_value: item,
		message: `Свойство «${propertyLabel}» ожидает ${expected} (тип значения «${def.valueType}»), получено: ${JSON.stringify(item) ?? 'null'}`,
		hint: 'Исправьте значение или проверьте value_type в определении свойства',
	});
}
