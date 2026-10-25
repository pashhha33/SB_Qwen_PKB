/**
 * service-flags (модуль этапа B1.1 часть 2, 09-modules слой 2): служебный слой
 * диагностик — служебные метки в `tags` и служебное свойство `sb_issues`.
 *
 * Нормы: `08-views.md` §7 (DL-168 — оба механизма: метки для фильтрации Bases,
 * `sb_issues` для колонки), rules.md группа K (`diagnostics.tags_issues_synced`,
 * `diagnostics.service_property.readonly`, `diagnostics.service_property.declared`),
 * `04-attributes.md` (tags — системный атрибут, свободные метки).
 *
 * Механика (08-views §7):
 *   - метка `sb/error`   — есть хотя бы одна диагностика уровня error;
 *     метка `sb/warning` — есть warning, но нет error;
 *     метка `sb/info`    — только info. Метки снимаются, когда проблема исправлена;
 *   - `sb_issues` — список строк формата `{rule_id}: {severity}`;
 *   - метки и свойство пишутся и снимаются ВМЕСТЕ (синхронно); расхождение —
 *     warning `diagnostics.tags_issues_synced`.
 *
 * Проектные решения части 2 (зафиксированы в architecture.md §5, B1.1-4…6):
 *   1. В `sb_issues` и в выбор метки попадают только «базовые» диагностики —
 *      все, кроме самих правил группы `diagnostics.*`. Иначе слой диагностики
 *      проверял бы сам себя и осциллировал: предупреждение о рассинхроне попало
 *      бы в sb_issues, на следующем прогоне стало бы новым рассинхроном.
 *      Исключение `diagnostics.*` делает запись сходящейся за один проход.
 *   2. Служебная запись НЕ трогает `updated_at`: служебные данные — не данные
 *      пользователя (проверка хранилища не должна «пачкать» все заметки).
 *   3. Метки и `sb_issues` пишутся только на объектах Second Brain — заметках,
 *      у которых во frontmatter есть `id` или `type`. Произвольные заметки
 *      хранилища (дневники, MOC) служебным слоем не помечаются.
 *   4. Если `sb_issues` не объявлен (правило diagnostics.service_property.declared
 *      уже пожаловалось) — пишется только метка; проверки readonly/synced
 *      пропускаются (сравнивать не с чем, а declared-ошибка уже видна).
 *
 * Слой: ядро (2) — среда-независим (М2 09-modules); запись — через
 * VaultAdapter.processFrontMatter (тело заметки не трогается).
 */

import type { VaultAdapter } from '../adapter/vault-adapter';
import { diagnostic, type SbDiagnostic } from './diagnostics';
import type { SbNote } from './model';
import type { TypeRegistry } from './registry';

/** Ключ служебного свойства (08-views §7; объявляется бутстрапом, B1-4 = А). */
export const SB_ISSUES_KEY = 'sb_issues';

/** Служебные метки диагностик (08-views §7) — свободные метки в системном `tags`. */
export const SB_TAG_ERROR = 'sb/error';
export const SB_TAG_WARNING = 'sb/warning';
export const SB_TAG_INFO = 'sb/info';
export const SB_TAGS: readonly string[] = [SB_TAG_ERROR, SB_TAG_WARNING, SB_TAG_INFO];

/** Правила служебного слоя (группа K, diagnostics.*) — не попадают в sb_issues (решение 1). */
export function isServiceRule(ruleId: string): boolean {
	return ruleId.startsWith('diagnostics.');
}

/** «Базовые» диагностики — содержимое sb_issues и источник выбора метки. */
export function baseIssues(diagnostics: SbDiagnostic[]): SbDiagnostic[] {
	return diagnostics.filter((d) => !isServiceRule(d.rule_id));
}

/** Метка наивысшей серьёзности (08-views §7): error > warning > info; нет проблем — null. */
export function expectedTagFor(issues: SbDiagnostic[]): string | null {
	if (issues.some((d) => d.severity === 'error')) {
		return SB_TAG_ERROR;
	}
	if (issues.some((d) => d.severity === 'warning')) {
		return SB_TAG_WARNING;
	}
	if (issues.some((d) => d.severity === 'info')) {
		return SB_TAG_INFO;
	}
	return null;
}

/** Значения `sb_issues`: «{rule_id}: {severity}», без повторов, порядок проверок сохранён. */
export function formatIssues(issues: SbDiagnostic[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const d of issues) {
		const value = `${d.rule_id}: ${d.severity}`;
		if (!seen.has(value)) {
			seen.add(value);
			out.push(value);
		}
	}
	return out;
}

/** Метка, следующая ИЗ СОДЕРЖИМОГО sb_issues (для проверки синхронности, группа K). */
export function tagFromIssueValues(values: string[]): string | null {
	let hasWarning = false;
	let hasInfo = false;
	for (const value of values) {
		const severity = value.slice(value.lastIndexOf(':') + 1).trim();
		if (severity === 'error') {
			return SB_TAG_ERROR;
		}
		if (severity === 'warning') {
			hasWarning = true;
		} else if (severity === 'info') {
			hasInfo = true;
		}
	}
	return hasWarning ? SB_TAG_WARNING : hasInfo ? SB_TAG_INFO : null;
}

/** Текущие значения `sb_issues` в заметке (нет поля — пустой список). */
export function actualIssueValues(note: SbNote): string[] {
	const raw = note.properties[SB_ISSUES_KEY];
	if (raw === undefined || raw === null) {
		return [];
	}
	return (Array.isArray(raw) ? raw : [raw]).filter((item): item is string => typeof item === 'string');
}

/** Текущие служебные метки в `tags` (прочие метки не трогаем — tags свободны, ADR-006). */
export function actualSbTags(note: SbNote): string[] {
	return (note.system.tags ?? []).filter((tag) => typeof tag === 'string' && SB_TAGS.includes(tag));
}

/** Заметка — объект Second Brain: frontmatter цел и есть `id` или `type` (решение 3). */
export function isSbObjectNote(note: SbNote): boolean {
	return (
		!note.frontmatterBroken &&
		(typeof note.system.id === 'string' || typeof note.system.type === 'string')
	);
}

/**
 * Проверка объявления `sb_issues` (diagnostics.service_property.declared, error, 3):
 * свойство объявлено РОВНО ОДИН раз как универсальное служебное (08-views §7).
 * Возвращает текст проблемы или null (всё в порядке).
 */
export function sbIssuesDeclarationProblem(registry: TypeRegistry): string | null {
	const defs = registry.properties.filter((p) => p.key === SB_ISSUES_KEY);
	if (defs.length === 0) {
		return 'Служебное свойство sb_issues не объявлено в Metamodel/Properties/ — колонка «Проблемы» в представлениях не работает';
	}
	if (defs.length > 1) {
		return `Свойство sb_issues объявлено ${defs.length} раза (${defs.map((d) => d.path).join(', ')}) — требуется ровно одно определение`;
	}
	const def = defs[0];
	if (def.scope !== 'universal' || !def.service) {
		return 'Свойство sb_issues должно быть объявлено один раз как универсальное служебное (scope: universal, service: true)';
	}
	return null;
}

/**
 * Диагностики группы K о состоянии служебного слоя заметки:
 *   - diagnostics.service_property.readonly (warning, 4) — sb_issues не совпадает
 *     с результатом текущей проверки (устарел или отредактирован вручную);
 *   - diagnostics.tags_issues_synced (warning, 6) — метки не соответствуют
 *     содержимому sb_issues.
 * Если sb_issues не объявлен (declaredProblem !== null), проверки пропускаются —
 * ошибка объявления уже выдана (решение 4).
 */
export function checkServiceFlags(
	note: SbNote,
	issues: SbDiagnostic[],
	declaredProblem: string | null,
	flagsWritten: boolean,
): SbDiagnostic[] {
	if (declaredProblem !== null) {
		return [];
	}
	const out: SbDiagnostic[] = [];
	const base = {
		object_id: typeof note.system.id === 'string' ? note.system.id : null,
		object_path: note.path,
	};
	const expected = formatIssues(issues);
	const actual = actualIssueValues(note);
	const issuesEqual =
		actual.length === expected.length && actual.every((value, i) => value === expected[i]);
	if (!issuesEqual) {
		out.push(
			diagnostic({
				...base,
				rule_id: 'diagnostics.service_property.readonly',
				severity: 'warning',
				level: 4,
				property_key: SB_ISSUES_KEY,
				actual_value: actual,
				message: 'Значение «Проблемы» (sb_issues) не соответствует результату последней проверки',
				hint: flagsWritten
					? 'Служебное свойство ведёт плагин — значение обновлено этой проверкой (08-views §7)'
					: 'Служебное свойство (service: true) редактируется только плагином; запустите проверку, чтобы обновить',
				fix_available: flagsWritten,
				fix_description: flagsWritten ? 'Обновлено плагином по итогам проверки' : null,
			}),
		);
	}
	const expectedTag = tagFromIssueValues(actual);
	const actualTags = actualSbTags(note);
	const tagsSynced =
		expectedTag === null
			? actualTags.length === 0
			: actualTags.length === 1 && actualTags[0] === expectedTag;
	if (!tagsSynced) {
		out.push(
			diagnostic({
				...base,
				rule_id: 'diagnostics.tags_issues_synced',
				severity: 'warning',
				level: 6,
				property_key: 'tags',
				actual_value: actualTags,
				message: 'Служебные метки (sb/error, sb/warning, sb/info) не соответствуют содержимому sb_issues',
				hint: flagsWritten
					? 'Метки и свойство пишутся вместе — синхронность восстановлена этой проверкой (08-views §7)'
					: 'Метки и sb_issues пишутся и снимаются вместе; запустите проверку для восстановления',
				fix_available: flagsWritten,
				fix_description: flagsWritten ? 'Синхронизировано плагином по итогам проверки' : null,
			}),
		);
	}
	return out;
}

/**
 * Записать служебные метки и `sb_issues` по итогам проверки (08-views §7:
 * «пишутся и снимаются вместе»). Возвращает true, если заметка изменена.
 *
 * - только для объектов Second Brain (решение 3);
 * - `updated_at` не трогается (решение 2);
 * - прочие (неслужебные) метки в `tags` сохраняются;
 * - если sb_issues не объявлен — пишется только метка (решение 4).
 */
export async function applyServiceFlags(
	adapter: VaultAdapter,
	note: SbNote,
	issues: SbDiagnostic[],
	sbIssuesDeclared: boolean,
): Promise<boolean> {
	if (!isSbObjectNote(note)) {
		return false;
	}
	const expectedIssues = formatIssues(issues);
	const expectedTag = expectedTagFor(issues);
	const currentIssues = actualIssueValues(note);
	const currentTags = actualSbTags(note);
	const issuesEqual =
		currentIssues.length === expectedIssues.length &&
		currentIssues.every((value, i) => value === expectedIssues[i]);
	const tagsEqual =
		expectedTag === null
			? currentTags.length === 0
			: currentTags.length === 1 && currentTags[0] === expectedTag;
	const sbIssuesEqual = !sbIssuesDeclared || issuesEqual;
	if (sbIssuesEqual && tagsEqual) {
		return false;
	}
	await adapter.processFrontMatter(note.path, (frontmatter) => {
		const rawTags = frontmatter.tags;
		const tagList = Array.isArray(rawTags)
			? rawTags.filter((tag): tag is string => typeof tag === 'string')
			: typeof rawTags === 'string' && rawTags.trim() !== ''
				? [rawTags.trim()]
				: [];
		const kept = tagList.filter((tag) => !SB_TAGS.includes(tag));
		if (expectedTag !== null) {
			kept.push(expectedTag);
		}
		if (kept.length === 0) {
			delete frontmatter.tags;
		} else {
			frontmatter.tags = kept;
		}
		if (sbIssuesDeclared) {
			if (expectedIssues.length === 0) {
				delete frontmatter[SB_ISSUES_KEY];
			} else {
				frontmatter[SB_ISSUES_KEY] = expectedIssues;
			}
		}
	});
	return true;
}
