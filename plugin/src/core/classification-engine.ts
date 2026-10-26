/**
 * classification-engine (правила группы E реестра, `docs/validation/rules.md`):
 * проверка определений классификации (таксономия/фасет/категория) и назначений
 * категорий объекту. Часть модуля `classification-service` (09-modules слой 3);
 * снимок строит `classification.ts`.
 *
 * Нормы: ADR-005 (три уровня, наследование умолчаний), ADR-007 (фасет независим;
 * П8 — категория не ссылается на таксономию), `01-classification.md` §2.1–§2.4, §6,
 * `04-attributes.md` §2 (системное поле `categories`), DL-119/DL-126 (граница
 * «жанр ≠ форма»), DL-208/209 (потомки включаются в `allowed_*`).
 *
 * Приоритет правил (rules.md «Перекрывающиеся правила»): специальное правило имеет
 * приоритет, общее запускается только если специальное не сработало. Поэтому
 * schema-engine НЕ выдаёт общие правила на полях, которые проверяются здесь
 * (таблица `CLASSIFICATION_SPECIALIZED_RULES`): `category.facet` (вместо
 * `value.cardinality`), `category.parent` (вместо `value.reference.exists` и
 * `value.reference.target_type`), `facet.taxonomy` (вместо `value.reference.exists`),
 * `taxonomy.facets` (вместо `value.cardinality`).
 *
 * Вне объёма (границы, architecture.md §5):
 *   - значения перечислений определений (`hierarchy_mode: free`, `assignment_cardinality:
 *     many`) контролирует схема и PROPERTY-определения через группы C/G
 *     (`enum.value.in_set`); не-snake enum-ы кардинальностей `allowed_values` не имеют
 *     (B1.3-3) — их ловит только прогонщик примеров (ajv);
 *   - согласованность `taxonomy.facets` ↔ `facet.taxonomy` (упомянута разбором примера
 *     `examples/instances/taxonomy/invalid-01.md`) — правила в реестре нет (B1.3-9);
 *   - «корневая» категория в назначении жанра (пример valid-01-genre трактует
 *     `root_requirement_min` как требование к назначению) — реестр правил трактует
 *     его как требование к составу фасета (B1.3-8);
 *   - запись назначений — команда `assign-category` (доставлена в 0.12.0 вместе с
 *     этим движком правил: правило уровня error обязано поставляться вместе с
 *     инструментом его устранения — конвенция architecture §4, урок DL-282).
 */

import { diagnostic, type SbDiagnostic } from './diagnostics';
import type { LabelResolver } from './label-resolver';
import type { SbNote } from './model';
import type { TypeRegistry } from './registry';
import {
	assignedCategoryIds,
	classificationName,
	isTypeAllowedForFacet,
	effectiveSettings,
	findSystemFacet,
	rootCategoriesOfFacet,
	taxonomiesOfFacet,
	type CategoryInfo,
	type ClassificationSnapshot,
} from './classification';

export interface ClassificationContext {
	registry: TypeRegistry;
	labels: LabelResolver;
	snapshot: ClassificationSnapshot;
}

type PushFn = (input: Omit<Parameters<typeof diagnostic>[0], 'object_id' | 'object_path'>) => void;

/**
 * Поля определений классификации, на которых общие правила подавляются
 * специальными (rules.md «Перекрывающиеся правила»). Ключ — `{type}:{property}`.
 */
export const CLASSIFICATION_SPECIALIZED_RULES: Record<string, string[]> = {
	'category:facet': ['value.cardinality'],
	'category:parent': ['value.reference.exists', 'value.reference.target_type'],
	'facet:taxonomy': ['value.reference.exists'],
	'taxonomy:facets': ['value.cardinality'],
};

/** Общие правила, подавляемые на поле (пусто — подавления нет). */
export function suppressedRulesFor(typeKey: string, propertyKey: string): string[] {
	return CLASSIFICATION_SPECIALIZED_RULES[`${typeKey}:${propertyKey}`] ?? [];
}

/** Нормализация названия для сравнения «та же категория в двух фасетах» (DL-126). */
function normalizeName(value: string): string {
	return value.trim().toLowerCase().replace(/ё/g, 'е');
}

// ---------------------------------------------------------------------------
// Определения классификации (уровни 2–4)
// ---------------------------------------------------------------------------

/**
 * Проверяет заметку-определение классификации (`taxonomy`, `facet`, `category`).
 * Вызывается validation-runner'ом для заметок этих типов; для прочих типов
 * возвращает пустой список.
 */
export function validateClassificationDefinition(note: SbNote, ctx: ClassificationContext): SbDiagnostic[] {
	const type = typeof note.system.type === 'string' ? note.system.type : null;
	if (type !== 'category' && type !== 'facet' && type !== 'taxonomy') {
		return [];
	}
	const out: SbDiagnostic[] = [];
	const base = {
		object_id: typeof note.system.id === 'string' ? note.system.id : null,
		object_path: note.path,
	};
	const push: PushFn = (input) => out.push(diagnostic({ ...base, ...input }));
	if (type === 'category') {
		checkCategory(note, ctx, push);
	} else if (type === 'facet') {
		checkFacet(note, ctx, push);
	} else {
		checkTaxonomy(note, ctx, push);
	}
	return out;
}

function checkCategory(note: SbNote, ctx: ClassificationContext, push: PushFn): void {
	const { snapshot } = ctx;
	const selfId = typeof note.system.id === 'string' ? note.system.id : null;
	const self = selfId !== null ? (snapshot.categoryById.get(selfId) ?? null) : null;

	// category.facet.required (error, 2) — ровно один фасет обязателен
	const facetIds = self?.facetIds ?? [];
	if (facetIds.length === 0) {
		push({
			rule_id: 'category.facet.required',
			severity: 'error',
			level: 2,
			property_key: 'facet',
			message: 'У категории не указан фасет',
			hint: 'Заполните поле «Фасет» ссылкой на FACET-….md: категория принадлежит ровно одному фасету (ADR-005)',
		});
	} else if (facetIds.length > 1) {
		// category.facet.single (error, 4)
		push({
			rule_id: 'category.facet.single',
			severity: 'error',
			level: 4,
			property_key: 'facet',
			actual_value: facetIds.length,
			message: `Категория принадлежит ${facetIds.length} фасетам вместо одного`,
			hint: 'Оставьте один фасет; если значение нужно в двух измерениях — создайте две категории (по одной в каждом фасете)',
		});
	}

	// category.taxonomy_direct.forbidden (error, 4) — правило П8 (ADR-007)
	const taxonomyIds = self?.taxonomyIds ?? [];
	if (taxonomyIds.length > 0) {
		push({
			rule_id: 'category.taxonomy_direct.forbidden',
			severity: 'error',
			level: 4,
			property_key: 'taxonomy',
			actual_value: taxonomyIds.length,
			message: 'Категория ссылается на таксономию напрямую (правило П8)',
			hint: 'Уберите поле taxonomy: категория входит в таксономию через свой фасет (ADR-007)',
		});
	}

	if (self === null) {
		return; // без id/в снимке структурные проверки невозможны (object.id.format уже сообщил)
	}
	const facet = facetIds.length === 1 ? (snapshot.facetById.get(facetIds[0]) ?? null) : null;

	// category.parent.exists (error, 3) и category.parent.same_facet (error, 4)
	for (const parentId of self.parentIds) {
		const parent = snapshot.categoryById.get(parentId);
		if (parent === undefined) {
			push({
				rule_id: 'category.parent.exists',
				severity: 'error',
				level: 3,
				property_key: 'parent',
				actual_value: parentId,
				message: 'Родительская категория не найдена среди определений классификации',
				hint: 'Проверьте wikilink parent: цель — файл CATEGORY-{ULID}.md (или уберите родителя — категория станет корневой)',
			});
			continue;
		}
		if (facet !== null && parent.facetIds.length === 1 && parent.facetIds[0] !== facet.id) {
			const parentFacet = snapshot.facetById.get(parent.facetIds[0]);
			push({
				rule_id: 'category.parent.same_facet',
				severity: 'error',
				level: 4,
				property_key: 'parent',
				actual_value: parent.title,
				message: `Родитель «${classificationName(parent)}» принадлежит другому фасету${parentFacet !== undefined ? ` («${classificationName(parentFacet)}»)` : ''}`,
				hint: 'Иерархия строится внутри одного фасета (01-classification §2.3): выберите родителя того же фасета или перенесите категорию',
			});
		}
	}

	// category.parent.strict_mode (error, 4) — в strict-фасете родитель максимум один
	if (facet !== null && self.parentIds.length > 1 && effectiveSettings(snapshot, facet).hierarchyMode === 'strict') {
		push({
			rule_id: 'category.parent.strict_mode',
			severity: 'error',
			level: 4,
			property_key: 'parent',
			actual_value: self.parentIds.length,
			message: `У категории ${self.parentIds.length} родителя в фасете со строгой иерархией («${classificationName(facet)}»)`,
			hint: 'Оставьте одного родителя либо переведите фасет в режим polyhierarchical (поле hierarchy_mode)',
		});
	}

	// category.parent.no_cycle (error, 3) — обход цепочки родителей с посещёнными id
	if (self.parentIds.length > 0) {
		const visited = new Set<string>([self.id]);
		const queue = [...self.parentIds];
		let cycle: string | null = null;
		while (queue.length > 0 && cycle === null) {
			const id = queue.shift() as string;
			if (visited.has(id)) {
				cycle = id;
				break;
			}
			visited.add(id);
			queue.push(...(snapshot.categoryById.get(id)?.parentIds ?? []));
		}
		if (cycle !== null) {
			push({
				rule_id: 'category.parent.no_cycle',
				severity: 'error',
				level: 3,
				property_key: 'parent',
				actual_value: cycle,
				message: `В цепочке родителей категории «${classificationName(self)}» есть цикл`,
				hint: 'Уберите одну из ссылок parent: иерархия категорий — дерево (или сеть без циклов в полиерархии)',
			});
		}
	}
}

function checkFacet(note: SbNote, ctx: ClassificationContext, push: PushFn): void {
	const { registry, snapshot } = ctx;
	const selfId = typeof note.system.id === 'string' ? note.system.id : null;
	const facet = selfId !== null ? (snapshot.facetById.get(selfId) ?? null) : null;
	if (facet === null) {
		return;
	}

	// facet.taxonomy.exists (error, 3)
	const taxonomies: { id: string; found: boolean }[] = [];
	for (const taxonomyId of facet.taxonomyIds) {
		const found = snapshot.taxonomyById.has(taxonomyId);
		taxonomies.push({ id: taxonomyId, found });
		if (!found) {
			push({
				rule_id: 'facet.taxonomy.exists',
				severity: 'error',
				level: 3,
				property_key: 'taxonomy',
				actual_value: taxonomyId,
				message: 'Таксономия из поля taxonomy не найдена среди определений',
				hint: 'Проверьте ссылку (TAXONOMY-{ULID}.md) или сделайте фасет независимым: taxonomy: [] (ADR-007)',
			});
		}
	}

	const settings = effectiveSettings(snapshot, facet);
	const knownTaxonomies = taxonomiesOfFacet(snapshot, facet);

	// facet.allowed_types.conflict (warning, 4) — подмножество области таксономии
	if (facet.allowedObjectTypeIds.length > 0 && knownTaxonomies.length > 0) {
		const allowedByTaxonomies = new Set<string>();
		for (const taxonomy of knownTaxonomies) {
			for (const id of taxonomy.allowedObjectTypeIds) {
				allowedByTaxonomies.add(id);
			}
		}
		if (allowedByTaxonomies.size > 0) {
			const outside = facet.allowedObjectTypeIds.filter((id) => !allowedByTaxonomies.has(id));
			if (outside.length > 0) {
				const names = outside
					.map((id) => registry.getTypeById(id)?.label ?? id)
					.join(', ');
				push({
					rule_id: 'facet.allowed_types.conflict',
					severity: 'warning',
					level: 4,
					property_key: 'allowed_object_types',
					actual_value: outside.length,
					message: `Область применения фасета «${classificationName(facet)}» шире области таксономии: ${names}`,
					hint: 'allowed_object_types фасета должно быть подмножеством значения таксономии (01-classification §2.2)',
				});
			}
		}
	}

	// facet.root_requirement (warning, 4) — число КОРНЕВЫХ категорий фасета
	const roots = rootCategoriesOfFacet(snapshot, facet.id).length;
	const min = settings.rootRequirementMin;
	const max = settings.rootRequirementMax;
	if (roots < min) {
		push({
			rule_id: 'facet.root_requirement',
			severity: 'warning',
			level: 4,
			property_key: 'root_requirement_min',
			actual_value: roots,
			message: `У фасета «${classificationName(facet)}» корневых категорий: ${roots} (минимум ${min})`,
			hint: 'Создайте корневые категории командой «Создать объект» (тип — Категория, поле parent оставьте пустым)',
		});
	} else if (max !== null && roots > max) {
		push({
			rule_id: 'facet.root_requirement',
			severity: 'warning',
			level: 4,
			property_key: 'root_requirement_max',
			actual_value: roots,
			message: `У фасета «${classificationName(facet)}» корневых категорий: ${roots} (максимум ${max})`,
			hint: 'Объедините корневые категории иерархией (поле parent) или поднимите root_requirement_max',
		});
	}
}

function checkTaxonomy(note: SbNote, ctx: ClassificationContext, push: PushFn): void {
	const { snapshot } = ctx;
	const selfId = typeof note.system.id === 'string' ? note.system.id : null;
	const taxonomy = selfId !== null ? (snapshot.taxonomyById.get(selfId) ?? null) : null;
	const facetIds = taxonomy?.facetIds ?? [];
	if (facetIds.length === 0) {
		push({
			rule_id: 'taxonomy.facets.min_one',
			severity: 'error',
			level: 2,
			property_key: 'facets',
			actual_value: facetIds.length,
			message: 'У таксономии нет ни одного фасета',
			hint: 'Добавьте в поле facets ссылку хотя бы на один фасет (FACET-….md) или удалите таксономию: фасеты самостоятельны (ADR-007)',
		});
	}
}

// ---------------------------------------------------------------------------
// Назначения категорий объекту (уровень 4)
// ---------------------------------------------------------------------------

/**
 * Проверяет назначения категорий объекту: `assignment.*` и специальные правила
 * фасета жанра (`facet.genre.required_for_book`, `facet.genre.not_form`).
 * Системное поле `categories` предметным свойством не объявляется (И6), поэтому
 * существование цели ссылки проверяется здесь общим правилом `value.reference.exists`.
 */
export function validateClassificationAssignments(note: SbNote, typeKey: string, ctx: ClassificationContext): SbDiagnostic[] {
	const { registry, labels, snapshot } = ctx;
	const out: SbDiagnostic[] = [];
	const base = {
		object_id: typeof note.system.id === 'string' ? note.system.id : null,
		object_path: note.path,
	};
	const push: PushFn = (input) => out.push(diagnostic({ ...base, ...input }));

	const assigned = assignedCategoryIds(note);
	const byFacet = new Map<string, string[]>();
	for (const id of assigned) {
		const category = snapshot.categoryById.get(id);
		if (category === undefined) {
			push({
				rule_id: 'value.reference.exists',
				severity: 'error',
				level: 3,
				property_key: 'categories',
				actual_value: id,
				message: 'Назначенная категория не найдена среди определений классификации',
				hint: 'Проверьте ссылку в поле categories: цель — CATEGORY-{ULID}.md; назначение обновите командой «Назначить категорию (assign-category)»',
			});
			continue;
		}
		const facetId = category.facetIds[0];
		if (facetId === undefined) {
			continue; // у категории нет фасета — об этом сообщила проверка определения
		}
		const list = byFacet.get(facetId) ?? [];
		list.push(id);
		byFacet.set(facetId, list);
	}

	const genreFacet = findSystemFacet(snapshot, 'genre');
	const isBook = typeKey === 'book' || registry.ancestorsOf(typeKey).some((t) => t.typeKey === 'book');
	let genreRuleFired = false;

	// facet.genre.required_for_book (error, 4) — специальное правило приоритетнее общего
	if (isBook && genreFacet !== null && (byFacet.get(genreFacet.id)?.length ?? 0) === 0) {
		push({
			rule_id: 'facet.genre.required_for_book',
			severity: 'error',
			level: 4,
			property_key: 'categories',
			message: `У книги не назначен жанр (фасет «${classificationName(genreFacet)}»)`,
			hint: 'Откройте книгу и выполните команду «Назначить категорию (assign-category)» — она предложит фасет «Жанр» и его категории; если категорий жанра ещё нет, создайте их командой «Создать объект» (тип — Категория)',
		});
		genreRuleFired = true;
	}

	// assignment.type_allowed (error, 4) + assignment.cardinality (error/warning, 4)
	for (const [facetId, ids] of byFacet) {
		const facet = snapshot.facetById.get(facetId);
		if (facet === undefined) {
			continue;
		}
		const settings = effectiveSettings(snapshot, facet);
		const facetName = classificationName(facet);
		if (!isTypeAllowedForFacet(registry, settings, typeKey)) {
			const allowedNames = settings.allowedObjectTypeIds
				.map((id) => registry.getTypeById(id)?.label ?? id)
				.join(', ');
			push({
				rule_id: 'assignment.type_allowed',
				severity: 'error',
				level: 4,
				property_key: 'categories',
				actual_value: facetName,
				message: `Фасет «${facetName}» не применяется к типу «${labels.forTypeKey(typeKey)}» (допустимые типы: ${allowedNames})`,
				hint: 'Снимите назначение командой «Назначить категорию (assign-category)» или расширьте allowed_object_types фасета (ссылка на предка включает потомков — DL-208/209)',
			});
		}
		const cardinality = settings.assignmentCardinality;
		const count = ids.length;
		const skipCardinality = genreRuleFired && genreFacet !== null && facetId === genreFacet.id;
		if (!skipCardinality) {
			if ((cardinality === '1' || cardinality === '1..N') && count === 0) {
				// недоназначение при обязательной кардинальности — error
				push({
					rule_id: 'assignment.cardinality',
					severity: 'error',
					level: 4,
					property_key: 'categories',
					actual_value: count,
					message: `Фасет «${facetName}» требует минимум одну категорию (кардинальность ${cardinality})`,
					hint: 'Выполните команду «Назначить категорию (assign-category)» и выберите категорию этого фасета',
				});
			} else if (cardinality === '1' && count > 1) {
				push({
					rule_id: 'assignment.cardinality',
					severity: 'error',
					level: 4,
					property_key: 'categories',
					actual_value: count,
					message: `Фасет «${facetName}» допускает ровно одну категорию, назначено ${count}`,
					hint: 'Командой «Назначить категорию (assign-category)» оставьте одну категорию фасета или измените assignment_cardinality фасета на 1..N/0..N',
				});
			} else if (cardinality === '0..1' && count > 1) {
				push({
					rule_id: 'assignment.cardinality',
					severity: 'warning',
					level: 4,
					property_key: 'categories',
					actual_value: count,
					message: `Фасет «${facetName}» рассчитан на одну категорию (0..1), назначено ${count}`,
					hint: 'Командой «Назначить категорию (assign-category)» оставьте основную категорию или измените assignment_cardinality фасета',
				});
			}
		}
	}

	// Кардинальность «1»/«1..N» без единого назначения для фасетов, разрешённых типу,
	// уже покрыта: обязательный жанр книги — специальным правилом, прочие фасеты —
	// назначением (неназначенный фасет не создаёт записей в byFacet). Для фасета жанра
	// у не-книг требование не действует (allowed_object_types + assignment.type_allowed).

	// facet.genre.not_form (warning, 4) — граница DL-126: жанр ≠ литературная форма
	const formFacet = findSystemFacet(snapshot, 'literary_form');
	if (genreFacet !== null && formFacet !== null) {
		const genreNames = new Map<string, CategoryInfo>();
		for (const id of byFacet.get(genreFacet.id) ?? []) {
			const category = snapshot.categoryById.get(id);
			if (category !== undefined) {
				genreNames.set(normalizeName(classificationName(category)), category);
			}
		}
		for (const id of byFacet.get(formFacet.id) ?? []) {
			const category = snapshot.categoryById.get(id);
			if (category === undefined) {
				continue;
			}
			const key = normalizeName(classificationName(category));
			const twin = genreNames.get(key);
			if (twin !== undefined) {
				push({
					rule_id: 'facet.genre.not_form',
					severity: 'warning',
					level: 4,
					property_key: 'categories',
					actual_value: classificationName(category),
					message: `«${classificationName(category)}» назначено одновременно как жанр и как литературная форма`,
					hint: 'Граница DL-126: форма отвечает на «какой формы?», жанр — на «какого жанра?». Оставьте одну из двух категорий',
				});
			}
		}
	}

	// Предки назначенных категорий учитываются движком applies-when (in_category),
	// само назначение всегда прямое (01-classification §2.4).
	return out;
}
