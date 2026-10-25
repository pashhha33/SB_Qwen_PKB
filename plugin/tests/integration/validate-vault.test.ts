/**
 * Интеграционные тесты validate-vault (B1.1 часть 2, DL-266): прогон всего
 * хранилища с общим индексом, сводка, запись служебных меток, vault-уровневая
 * проверка объявленности sb_issues, подавление по-заметочного журнала.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LogLevel } from '../../src/core/activity-log';
import { bootstrapMetamodel, SB_ISSUES_PROPERTY_ULID, SYSTEM_TYPE_SEEDS } from '../../src/core/bootstrap';
import { createObjectInstance, createObjectTypeDefinition, createPropertyDefinition } from '../../src/core/creation';
import { LabelResolver } from '../../src/core/label-resolver';
import { parseNote } from '../../src/core/markdown-parser';
import { METAMODEL_SUBFOLDERS, TypeRegistry } from '../../src/core/registry';
import { validateObject, validateVault } from '../../src/core/validation';
import { FakeVault } from '../support/fake-vault';

type LogRecord = { level: LogLevel; area: string; message: string; data?: Record<string, unknown> };

function logSpy(): { records: LogRecord[]; fn: (level: LogLevel, area: string, message: string, data?: Record<string, unknown>) => void } {
	const records: LogRecord[] = [];
	return {
		records,
		fn: (level, area, message, data) => {
			records.push({ level, area, message, data });
		},
	};
}

describe('validate-vault — прогон хранилища со сводкой', () => {
	let vault: FakeVault;

	beforeEach(async () => {
		vault = await FakeVault.create();
		await bootstrapMetamodel(vault);
		// Тип book + обязательное свойство read_status (перечисление).
		let registry = await TypeRegistry.load(vault);
		await createObjectTypeDefinition(vault, registry, { typeKey: 'book', label: 'Книга', typePrefix: 'BOOK' });
		registry = await TypeRegistry.load(vault);
		await createPropertyDefinition(vault, registry, {
			key: 'read_status',
			label: 'Статус чтения',
			valueType: 'text',
			cardinality: '1',
			scope: 'specific',
			objectTypeKeys: ['book'],
			allowedValues: ['reading', 'finished'],
		});
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	async function run(options?: { logPerNote?: boolean }) {
		const registry = await TypeRegistry.load(vault);
		const labels = new LabelResolver(registry);
		return validateVault(vault, registry, labels, undefined, options);
	}

	it('чистое хранилище: системные семена, 0 ошибок; служебные метки не появляются', async () => {
		const summary = await run();
		// 7 системных типов + sb_issues + тип book + свойство read_status = 10 SB-заметок.
		expect(summary.checked).toBe(SYSTEM_TYPE_SEEDS.length + 1 + 1 + 1);
		expect(summary.errors).toBe(0);
		expect(summary.warnings).toBe(0);
		expect(summary.vaultDiagnostics).toEqual([]);
		expect(summary.worst).toEqual([]);

		// Метки не пишутся на чистые объекты.
		for (const seed of SYSTEM_TYPE_SEEDS) {
			const note = parseNote({ path: seed.path, content: await vault.read(seed.path) }, vault);
			expect((note.system.tags ?? []).some((t) => t.startsWith('sb/')), seed.path).toBe(false);
			expect(note.properties.sb_issues, seed.path).toBeUndefined();
		}
	});

	it('проблемный экземпляр: ошибка учтена в сводке, метки и sb_issues записаны', async () => {
		const registry = await TypeRegistry.load(vault);
		const book = await createObjectInstance(vault, registry, { typeKey: 'book', title: 'Без статуса' });

		const summary = await run();
		expect(summary.errors).toBeGreaterThanOrEqual(1);
		expect(summary.withIssues).toBeGreaterThanOrEqual(1);
		expect(summary.worst.some((w) => w.path === book.path)).toBe(true);
		expect(summary.flagsWritten).toBeGreaterThanOrEqual(1);

		const note = parseNote({ path: book.path, content: await vault.read(book.path) }, vault);
		expect(note.system.tags).toContain('sb/error');
		expect(note.properties.sb_issues).toContain('value.cardinality: error');
	});

	it('заметки без признака объекта не проверяются и не помечаются', async () => {
		await vault.put('Дневник/2026-10-25.md', 'Просто текст дня.');
		await vault.put('MOC.md', '---\ntags:\n  - moc\n---\n\nКарта без id и type.');

		const summary = await run();
		expect(summary.worst.some((w) => w.path === 'MOC.md')).toBe(false);
		const moc = parseNote({ path: 'MOC.md', content: await vault.read('MOC.md') }, vault);
		expect(moc.system.tags).not.toContain('sb/error');
	});

	it('abstract.no_instance: экземпляр абстрактного типа ловится на определении типа (общий индекс)', async () => {
		// Ручная заметка-«экземпляр» абстрактного типа work.
		let registry = await TypeRegistry.load(vault);
		const work = await createObjectTypeDefinition(vault, registry, { typeKey: 'work', label: 'Произведение', typePrefix: 'WORK', abstract: true });
		await vault.put(
			'Works/WORK-01J8Z6M4K2Q7V9X3N5B0C1D2I9.md',
			[
				'---',
				'id: 01J8Z6M4K2Q7V9X3N5B0C1D2I9',
				'type: work',
				'title: Нечто',
				'aliases:',
				'  - Нечто',
				'created_at: "2026-10-25T10:00"',
				'updated_at: "2026-10-25T10:00"',
				'---',
				'',
			].join('\n'),
		);

		const summary = await run();
		expect(summary.errors).toBeGreaterThanOrEqual(2); // abstract.no_instance + object.type.not_abstract на самом экземпляре
		registry = await TypeRegistry.load(vault);
		const labels = new LabelResolver(registry);
		const defCheck = await validateObject(vault, registry, labels, work.path, undefined, false, undefined, { checkServiceDeclaration: false });
		// Одиночный режим без readTypes-индекса правило пропускает (граница B1.1-7)...
		expect(defCheck.diagnostics.map((d) => d.rule_id)).not.toContain('object_type.abstract.no_instance');
		// ...но в сводке validate-vault оно есть (проверяем через журнал/сводку: ошибка учтена).
		expect(summary.worst.some((w) => w.path === work.path)).toBe(true);
		expect(summary.worst.some((w) => w.path === 'Works/WORK-01J8Z6M4K2Q7V9X3N5B0C1D2I9.md')).toBe(true);
	});

	it('sb_issues удалён: vault-диагностика declared — одна на прогон (не на каждой заметке)', async () => {
		const sbPath = `${METAMODEL_SUBFOLDERS.properties}/PROPERTY-${SB_ISSUES_PROPERTY_ULID}.md`;
		await vault.remove(sbPath);

		const summary = await run();
		expect(summary.vaultDiagnostics).toHaveLength(1);
		expect(summary.vaultDiagnostics[0].rule_id).toBe('diagnostics.service_property.declared');
		expect(summary.errors).toBeGreaterThanOrEqual(1);

		// На заметках declared не дублируется (checkServiceDeclaration: false в прогоне)...
		const note = parseNote({ path: SYSTEM_TYPE_SEEDS[0].path, content: await vault.read(SYSTEM_TYPE_SEEDS[0].path) }, vault);
		expect(note.properties.sb_issues).toBeUndefined();
		// ...но метка пишется (решение 4: sb_issues не объявлен — только метки).
		// Чистых заметок это не касается:
		expect((note.system.tags ?? []).some((t) => t.startsWith('sb/'))).toBe(false);
	});

	it('журнал: одна сводная запись на прогон; logPerNote включает по-заметочные записи', async () => {
		const registry = await TypeRegistry.load(vault);
		await createObjectInstance(vault, registry, { typeKey: 'book', title: 'Без статуса' });

		const quiet = logSpy();
		const reg1 = await TypeRegistry.load(vault);
		await validateVault(vault, reg1, new LabelResolver(reg1), quiet.fn);
		expect(quiet.records.filter((r) => r.area === 'validation' && r.message.startsWith('Проверка хранилища'))).toHaveLength(1);
		expect(quiet.records.filter((r) => r.message.startsWith('Проверка «'))).toHaveLength(0);

		const loud = logSpy();
		const reg2 = await TypeRegistry.load(vault);
		await validateVault(vault, reg2, new LabelResolver(reg2), loud.fn, { logPerNote: true });
		expect(loud.records.filter((r) => r.message.startsWith('Проверка «')).length).toBeGreaterThan(1);
	});
});
