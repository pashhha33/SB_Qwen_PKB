/**
 * applies-when (модуль этапа B1.1 часть 2, 09-modules слой 2): движок условных
 * свойств — вычисление условия `applies_when` на экземпляре объекта.
 *
 * Нормы: `04-attributes.md` §11 (операции equals / in_category / includes_any,
 * правила М1–М7), rules.md («value.cardinality не применяется к скрытым условным
 * свойствам» — М6), ADR-011.
 *
 * Правила, которые движок соблюдает:
 *   - М1: условие влияет только на ПОКАЗ и на ПРОВЕРКУ ОБЯЗАТЕЛЬНОСТИ, никогда —
 *     на хранение. Движок ничего не удаляет и не переписывает: он лишь сообщает,
 *     видно ли свойство (формы — B1.2 — скрывают невидимые поля).
 *   - М2: значения «погашенных» свойств сохраняются; проверка качества данных
 *     (тип значения, перечисление, ссылка) выполняется и для скрытых свойств —
 *     не выполняется только проверка обязательности/количества (М6).
 *   - М3: цепочки условий запрещены — за этим следит группа B
 *     (property.applies_when.no_chain); движок значение триггера читает как есть,
 *     рекурсивно условия не вычисляет.
 *   - М5: условие одно и ссылается на одно свойство-триггер (или на назначение
 *     категории для in_category).
 *   - М7: `value` может быть списком — свойство обслуживает несколько групп
 *     значений (например, known_for при role ∈ [athlete, scientist, …]).
 *
 * Семантика операций (04-attributes §11.1):
 *   - equals        — значение триггера равно одному из `value` (для 0..N —
 *                     хотя бы один элемент);
 *   - includes_any  — хотя бы одно значение триггера входит в список `value`;
 *                     для одиночного триггера равносильно equals (рантайм-
 *                     вычисление одинаково — пересечение множеств; различие
 *                     декларативно и проверяется группой B:
 *                     operation_matches_cardinality);
 *   - in_category   — объекту назначена категория из `value` (значение — id
 *                     категорий, ULID); триггер — не свойство, а системный
 *                     атрибут `categories`.
 *
 * Отказы (безопасное поведение — свойство считается СКРЫТЫМ):
 *   - триггер отсутствует или его значение пустое;
 *   - `value` условия пусто (группа B уже пожаловалась: value_present);
 *   - операция вне закрытого набора (группа B: operation_closed, М4).
 *
 * `in_category` и предки категории (B1.3 часть 2 — граница B1.1-4 СНЯТА):
 * если передан снимок классификации, назначенные категории раскрываются своими
 * предками — назначен потомок («Космическая опера»), условие по предку
 * («Научная фантастика») истинно (01-classification §2.3: предки вычисляются).
 * Без снимка (вызывающий его не построил) движок проверяет только прямое
 * назначение — прежнее поведение, безопасный отказ: свойство скрыто.
 */

import { assignedCategoryIds, expandWithAncestors, type ClassificationSnapshot } from './classification';
import type { SbNote } from './model';
import type { PropertyDef } from './registry';

/** ULID категорий из системного поля `categories` (переехало в classification-service). */
export { assignedCategoryIds };

/** Строковые значения свойства-триггера из frontmatter (нестроки отбрасываются). */
export function triggerValues(note: SbNote, triggerKey: string): string[] {
	const raw = note.properties[triggerKey];
	if (raw === undefined || raw === null) {
		return [];
	}
	const items = Array.isArray(raw) ? raw : [raw];
	return items.filter((item): item is string => typeof item === 'string');
}

/**
 * Видно ли свойство на экземпляре (М1: видимость — для показа и проверки
 * обязательности). Свойство без `applies_when` видимо всегда.
 *
 * @param classification снимок классификации — нужен только для `in_category`
 *        (раскрытие назначенных категорий предками); null/undefined — проверка
 *        по прямому назначению.
 */
export function isPropertyVisible(def: PropertyDef, note: SbNote, classification?: ClassificationSnapshot | null): boolean {
	const condition = def.appliesWhen;
	if (condition === null) {
		return true;
	}
	if (condition.value.length === 0) {
		return false; // условие неполно (value_present — группа B): скрыть безопаснее, чем показать
	}
	switch (condition.operation) {
		case 'equals':
		case 'includes_any': {
			const values = triggerValues(note, condition.property);
			return values.some((value) => condition.value.includes(value));
		}
		case 'in_category': {
			const categories = assignedCategoryIds(note);
			const effective = classification === undefined || classification === null ? categories : expandWithAncestors(classification, categories);
			return effective.some((id) => condition.value.includes(id));
		}
		default:
			return false; // операция вне закрытого набора (М4) — группа B уже сообщила
	}
}
