/**
 * Юнит- и интеграционные тесты служебного слоя диагностик (B1.1 часть 2, DL-266).
 * Нормы: 08-views §7 (метки sb/error|sb/warning|sb/info + свойство sb_issues,
 * DL-168), rules.md группа K (diagnostics.tags_issues_synced,
 * diagnostics.service_property.readonly, diagnostics.service_property.declared).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { diagnostic, type SbDiagnostic } from '../../src/core/diagnostics';
import { parseNote } from '../../src/core/markdown-parser';
import type { SbNote } from '../../src/core/model';
import { TypeRegistry } from '../../src/core/registry';
import {
	applyServiceFlags,
	baseIssues,
	checkServiceFlags,
	expectedTagFor,
	formatIssues,
	isSbObjectNote,
	isServiceRule,
	SB_TAG_ERROR,
	SB_TAG_INFO,
	SB_TAG_WARNING,
	sbIssuesDeclarationProblem,
	tagFromIssueValues,
} from '../../src/core/service-flags';
import { FakeVault } from '../support/fake-vault';

function diag(rule_id: string, severity: SbDiagnostic['severity']): SbDiagnostic {
	return diagnostic({ rule_id, severity, level: 2, object_path: 'Books/BOOK-01J8Z6M4K2Q7V9X3N5B0C1D2B1.md', message: 'тест', hint: 'тест' });
}

describe('service-flags — чистые функции (08-views §7)', () => {
	it('expectedTagFor: error > warning > info > null', () => {
		expect(expectedTagFor([])).toBeNull();
		expect(expectedTagFor([diag('a.b', 'info')])).toBe(SB_TAG_INFO);
		expect(expectedTagFor([diag('a.b', 'info'), diag('c.d', 'warning')])).toBe(SB_TAG_WARNING);
		expect(expectedTagFor([diag('a.b', 'warning'), diag('c.d', 'error')])).toBe(SB_TAG_ERROR);
	});

	it('formatIssues: «{rule_id}: {severity}», без повторов, порядок сохранён', () => {
		expect(formatIssues([diag('value.cardinality', 'error'), diag('value.cardinality', 'error'), diag('datetime.no_seconds', 'warning')])).toEqual([
			'value.cardinality: error',
			'datetime.no_seconds: warning',
		]);
	});

	it('tagFromIssueValues: метка из содержимого sb_issues', () => {
		expect(tagFromIssueValues([])).toBeNull();
		expect(tagFromIssueValues(['a.b: info'])).toBe(SB_TAG_INFO);
		expect(tagFromIssueValues(['a.b: warning', 'c.d: info'])).toBe(SB_TAG_WARNING);
		expect(tagFromIssueValues(['a.b: info', 'c.d: error'])).toBe(SB_TAG_ERROR);
	});

	it('baseIssues: правила diagnostics.* исключаются (сходимость записи, решение 1)', () => {
		const issues = baseIssues([diag('value.cardinality', 'error'), diag('diagnostics.tags_issues_synced', 'warning')]);
		expect(issues.map((d) => d.rule_id)).toEqual(['value.cardinality']);
		expect(isServiceRule('diagnostics.service_property.readonly')).toBe(true);
		expect(isServiceRule('value.cardinality')).toBe(false);
	});
});

describe('service-flags — запись и проверки на FakeVault', () => {
	let vault: FakeVault;
	const PATH = 'Books/BOOK-01J8Z6M4K2Q7V9X3N5B0C1D2B1.md';

	function note(fields: string[]): string {
		return ['---', 'id: 01J8Z6M4K2Q7V9X3N5B0C1D2B1', 'type: book', 'title: Тест', 'aliases:', '  - Тест', ...fields, '---', '', 'Тело.', ''].join('\n');
	}

	async function readNote(): Promise<SbNote> {
		return parseNote({ path: PATH, content: await vault.read(PATH) }, vault);
	}

	beforeEach(async () => {
		vault = await FakeVault.create();
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	it('isSbObjectNote: без id/type и с битым frontmatter — не объект Second Brain', async () => {
		await vault.put(PATH, note([]));
		expect(isSbObjectNote(await readNote())).toBe(true);
		await vault.put('Диалог.md', 'Просто заметка без frontmatter');
		const plain = parseNote({ path: 'Диалог.md', content: await vault.read('Диалог.md') }, vault);
		expect(isSbObjectNote(plain)).toBe(false);
		await vault.put('Сломанная.md', '---\n: : :\n---\n');
		const broken = parseNote({ path: 'Сломанная.md', content: await vault.read('Сломанная.md') }, vault);
		expect(isSbObjectNote({ ...broken, frontmatterBroken: true })).toBe(false);
	});

	it('applyServiceFlags: пишет sb_issues и метку вместе; повторный запуск — no-op (сходимость)', async () => {
		await vault.put(PATH, note(['tags:', '  - жанр/фантастика']));
		const issues = [diag('value.cardinality', 'error'), diag('datetime.no_seconds', 'warning')];

		const written = await applyServiceFlags(vault, await readNote(), issues, true);
		expect(written).toBe(true);

		const after = await readNote();
		expect(after.properties.sb_issues).toEqual(['value.cardinality: error', 'datetime.no_seconds: warning']);
		expect(after.system.tags).toContain(SB_TAG_ERROR);
		expect(after.system.tags).toContain('жанр/фантастика'); // пользовательские метки сохранены
		expect(after.system.tags?.filter((t) => t.startsWith('sb/'))).toEqual([SB_TAG_ERROR]); // ровно одна служебная

		// Повторный прогон с теми же проблемами — ничего не меняется.
		expect(await applyServiceFlags(vault, await readNote(), issues, true)).toBe(false);
	});

	it('applyServiceFlags: исправление проблемы снимает метки и sb_issues', async () => {
		await vault.put(PATH, note(['tags:', '  - sb/error', 'sb_issues:', '  - "value.cardinality: error"']));
		expect(await applyServiceFlags(vault, await readNote(), [], true)).toBe(true);
		const after = await readNote();
		expect(after.properties.sb_issues).toBeUndefined();
		expect(after.system.tags ?? []).not.toContain(SB_TAG_ERROR);
	});

	it('applyServiceFlags: updated_at не трогается (служебные данные — не данные пользователя)', async () => {
		await vault.put(PATH, note(['created_at: "2026-10-25T10:00"', 'updated_at: "2026-10-25T10:00"']));
		await applyServiceFlags(vault, await readNote(), [diag('value.cardinality', 'error')], true);
		const after = await readNote();
		expect(after.system.updated_at).toBe('2026-10-25T10:00');
	});

	it('applyServiceFlags: sb_issues не объявлен — пишется только метка (решение 4)', async () => {
		await vault.put(PATH, note([]));
		await applyServiceFlags(vault, await readNote(), [diag('value.cardinality', 'error')], false);
		const after = await readNote();
		expect(after.properties.sb_issues).toBeUndefined();
		expect(after.system.tags).toContain(SB_TAG_ERROR);
	});

	it('checkServiceFlags: устаревший sb_issues — readonly warning; рассинхрон меток — synced warning', async () => {
		await vault.put(PATH, note(['tags:', '  - sb/info', 'sb_issues:', '  - "value.cardinality: error"']));
		const stale = await readNote();
		const fresh = [diag('datetime.no_seconds', 'warning')];

		const diags = checkServiceFlags(stale, fresh, null, false);
		const ids = diags.map((d) => d.rule_id);
		// sb_issues устарел (не совпадает со свежим результатом) → readonly;
		// метка sb/info не соответствует содержимому sb_issues (там error) → synced.
		expect(ids).toContain('diagnostics.service_property.readonly');
		expect(ids).toContain('diagnostics.tags_issues_synced');
	});

	it('checkServiceFlags: синхронное состояние — чисто; declaredProblem — проверки пропускаются', async () => {
		await vault.put(PATH, note(['tags:', '  - sb/warning', 'sb_issues:', '  - "datetime.no_seconds: warning"']));
		const synced = await readNote();
		expect(checkServiceFlags(synced, [diag('datetime.no_seconds', 'warning')], null, false)).toEqual([]);
		// sb_issues не объявлен — значение и синхронность не проверяются (ошибка declared уже выдана).
		expect(checkServiceFlags(synced, [], 'свойство не объявлено', false)).toEqual([]);
	});

	it('sbIssuesDeclarationProblem: нет / два / не универсальное / корректное', async () => {
		const registry = await TypeRegistry.load(vault);
		expect(sbIssuesDeclarationProblem(registry)).toMatch(/не объявлено/);

		const decl = (ulid: string, extra: string[] = []) =>
			[
				'---',
				`id: ${ulid}`,
				'type: property',
				'title: sb_issues',
				'created_at: "2026-10-25T10:00"',
				'updated_at: "2026-10-25T10:00"',
				'key: sb_issues',
				'label: Проблемы',
				'value_type: text',
				'cardinality: "0..N"',
				'required: false',
				...extra,
				'---',
				'',
			].join('\n');

		await vault.put('Metamodel/Properties/PROPERTY-01J8Z6M4K2Q7V9X3N5B0C1D2S1.md', decl('01J8Z6M4K2Q7V9X3N5B0C1D2S1', ['scope: universal', 'service: true']));
		expect(sbIssuesDeclarationProblem(await TypeRegistry.load(vault))).toBeNull();

		await vault.put('Metamodel/Properties/PROPERTY-01J8Z6M4K2Q7V9X3N5B0C1D2S2.md', decl('01J8Z6M4K2Q7V9X3N5B0C1D2S2', ['scope: universal', 'service: true']));
		expect(sbIssuesDeclarationProblem(await TypeRegistry.load(vault))).toMatch(/2 раза/);
	});
});
