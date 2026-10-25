/**
 * Интеграционные тесты бутстрапа Metamodel/ (A2 часть 2, DL-250/257).
 *
 * Проверяют чек-бокс DoD этапа A (phases.md §4): «Плагин загружается в пустом
 * хранилище и сам создаёт папку Metamodel/ с 7 системными типами (бутстрап)» —
 * на FakeVault (main.ts — тонкая обёртка и по отклонению М4 вручную проверяется
 * в Obsidian по чек-листам handoff).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { VaultAdapter } from '../../src/adapter/vault-adapter';
import type { LogLevel } from '../../src/core/activity-log';
import { bootstrapMetamodel, SB_ISSUES_PROPERTY_ULID, SYSTEM_PROPERTY_SEEDS, SYSTEM_TYPE_SEEDS } from '../../src/core/bootstrap';
import { createObjectTypeDefinition } from '../../src/core/creation';
import { METAMODEL_SUBFOLDERS, SYSTEM_TYPE_PREFIXES, TypeRegistry } from '../../src/core/registry';
import { FakeVault } from '../support/fake-vault';

type LogRecord = { level: LogLevel; area: string; message: string; data?: Record<string, unknown> };

function logSpy(): { records: LogRecord[]; fn: (level: LogLevel, area: string, message: string, data?: Record<string, unknown>) => void } {
	const records: LogRecord[] = [];
	return {
		records,
		fn: (level, area, message, data) => records.push({ level, area, message, data }),
	};
}

/** Обёртка-инъекция отказа: create() на заданном пути бросает ошибку, остальное делегирует. */
function failCreateOn(adapter: VaultAdapter, failPath: string): VaultAdapter {
	return new Proxy(adapter, {
		get(target, prop) {
			if (prop === 'create') {
				return async (path: string, content: string) => {
					if (path === failPath) {
						throw new Error(`Отказ записи (тест): ${path}`);
					}
					return target.create(path, content);
				};
			}
			const value = Reflect.get(target, prop) as unknown;
			return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
		},
	});
}

describe('bootstrapMetamodel — DoD: пустое хранилище → Metamodel/ с 7 системными типами и sb_issues', () => {
	let vault: FakeVault;

	beforeEach(async () => {
		vault = await FakeVault.create();
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	it('в свежем хранилище создаёт все 8 семян (7 типов + sb_issues) байт-в-байт', async () => {
		const spy = logSpy();
		const report = await bootstrapMetamodel(vault, spy.fn);

		expect(report.created).toHaveLength(SYSTEM_TYPE_SEEDS.length + SYSTEM_PROPERTY_SEEDS.length);
		expect(report.skipped).toHaveLength(0);
		expect(report.failed).toHaveLength(0);

		for (const seed of [...SYSTEM_TYPE_SEEDS, ...SYSTEM_PROPERTY_SEEDS]) {
			expect(await vault.exists(seed.path), `${seed.path} существует`).toBe(true);
			expect(await vault.read(seed.path), `${seed.path} содержимое из семени`).toBe(seed.content);
		}

		// Журналирование: info-запись области bootstrap с итогами (DL-251).
		const info = spy.records.filter((r) => r.level === 'info' && r.area === 'bootstrap');
		expect(info).toHaveLength(1);
		expect(info[0].data?.created).toBe(SYSTEM_TYPE_SEEDS.length + SYSTEM_PROPERTY_SEEDS.length);
	});

	it('реестр после бутстрапа видит 7 типов без проблем; все — корни дерева', async () => {
		await bootstrapMetamodel(vault);
		const registry = await TypeRegistry.load(vault);

		expect(registry.issues).toEqual([]);
		expect(registry.types).toHaveLength(7);
		for (const seed of SYSTEM_TYPE_SEEDS) {
			const type = registry.getType(seed.typeKey);
			expect(type, `${seed.typeKey} в реестре`).toBeDefined();
			expect(type?.id).toBe(seed.ulid);
			expect(type?.label).toBe(seed.label);
			expect(type?.typePrefix).toBe(SYSTEM_TYPE_PREFIXES[seed.typeKey]);
			expect(type?.abstract).toBe(false);
			expect(type?.lifecycle).toBe('standard');
			expect(type?.parentId, `${seed.typeKey}: без родителя (02-entities §3)`).toBeNull();
		}
		expect(registry.getTypeByPrefix('OBJECT_TYPE')?.typeKey).toBe('object_type');

		// Часть 2: служебное свойство sb_issues сеется бутстрапом и читается реестром.
		expect(registry.properties).toHaveLength(1);
		const sbIssues = registry.properties[0];
		expect(sbIssues.key).toBe('sb_issues');
		expect(sbIssues.id).toBe(SB_ISSUES_PROPERTY_ULID);
		expect(sbIssues.service).toBe(true);
		expect(sbIssues.scope).toBe('universal');
		expect(sbIssues.valueType).toBe('text');
		expect(sbIssues.cardinality).toBe('0..N');
		expect(sbIssues.required).toBe(false);
	});

	it('идемпотентен: повторный запуск ничего не создаёт и не перезаписывает (F5-9 = А)', async () => {
		await bootstrapMetamodel(vault);
		const before = new Map<string, string>();
		for (const seed of SYSTEM_TYPE_SEEDS) {
			before.set(seed.path, await vault.read(seed.path));
		}

		const spy = logSpy();
		const second = await bootstrapMetamodel(vault, spy.fn);
		expect(second.created).toHaveLength(0);
		expect(second.skipped).toHaveLength(SYSTEM_TYPE_SEEDS.length + SYSTEM_PROPERTY_SEEDS.length);
		expect(second.failed).toHaveLength(0);

		for (const seed of SYSTEM_TYPE_SEEDS) {
			expect(await vault.read(seed.path), `${seed.path} не тронут`).toBe(before.get(seed.path));
		}
		// Повтор без созданий — debug, не info (журнал не шумит на каждой загрузке).
		expect(spy.records.filter((r) => r.area === 'bootstrap' && r.level === 'debug')).toHaveLength(1);
		expect(spy.records.filter((r) => r.area === 'bootstrap' && r.level === 'info')).toHaveLength(0);
	});

	it('частичное состояние: доcreates только отсутствующие определения', async () => {
		await bootstrapMetamodel(vault);
		const taxonomy = SYSTEM_TYPE_SEEDS.find((s) => s.typeKey === 'taxonomy')!;
		const facet = SYSTEM_TYPE_SEEDS.find((s) => s.typeKey === 'facet')!;
		await vault.remove(taxonomy.path);
		await vault.remove(facet.path);

		const report = await bootstrapMetamodel(vault);
		expect(report.created).toEqual([taxonomy.path, facet.path]);
		expect(report.skipped).toHaveLength(SYSTEM_TYPE_SEEDS.length + SYSTEM_PROPERTY_SEEDS.length - 2);
		expect(report.failed).toHaveLength(0);

		const registry = await TypeRegistry.load(vault);
		expect(registry.types).toHaveLength(7);
		expect(registry.issues).toEqual([]);
	});

	it('пользовательские определения не трогает: type, созданный командой, переживает бутстрап', async () => {
		// Пользователь уже создал свой тип ДО первого запуска бутстрапа (или между запусками).
		const registry0 = await TypeRegistry.load(vault);
		const book = await createObjectTypeDefinition(vault, registry0, {
			typeKey: 'book',
			label: 'Книга',
			typePrefix: 'BOOK',
			description: 'Письменное произведение',
		});
		const bookBefore = await vault.read(book.path);

		const report = await bootstrapMetamodel(vault);
		expect(report.created).toHaveLength(SYSTEM_TYPE_SEEDS.length + SYSTEM_PROPERTY_SEEDS.length);

		expect(await vault.read(book.path), 'определение пользователя не перезаписано').toBe(bookBefore);
		const registry = await TypeRegistry.load(vault);
		expect(registry.types).toHaveLength(8);
		expect(registry.issues).toEqual([]);
		expect(registry.getType('book')?.id).toBe(book.id);
	});

	it('цепочка DoD: бутстрап → create-object-type «book» работает поверх 7 системных типов', async () => {
		await bootstrapMetamodel(vault);
		const registry = await TypeRegistry.load(vault);

		const book = await createObjectTypeDefinition(vault, registry, {
			typeKey: 'book',
			label: 'Книга',
			typePrefix: 'BOOK',
		});
		expect(book.path.startsWith(`${METAMODEL_SUBFOLDERS.objectTypes}/OBJECT_TYPE-`)).toBe(true);

		const reloaded = await TypeRegistry.load(vault);
		expect(reloaded.types).toHaveLength(8);
		expect(reloaded.issues).toEqual([]);
		// Префикс BOOK не конфликтует с системными (уникальность как целая строка — F5-7).
		expect(reloaded.getTypeByPrefix('BOOK')?.typeKey).toBe('book');
	});

	it('ошибка записи одного семени не прерывает бутстрап остальных (отказоустойчивость)', async () => {
		// Инъекция отказа: обёртка над FakeVault — create() на одном пути бросает ошибку.
		const victim = SYSTEM_TYPE_SEEDS.find((s) => s.typeKey === 'relation')!;
		const failing = failCreateOn(vault, victim.path);

		const spy = logSpy();
		const report = await bootstrapMetamodel(failing, spy.fn);

		expect(report.failed).toHaveLength(1);
		expect(report.failed[0].path).toBe(victim.path);
		expect(report.created).toHaveLength(SYSTEM_TYPE_SEEDS.length + SYSTEM_PROPERTY_SEEDS.length - 1);
		expect(report.skipped).toHaveLength(0);
		expect(spy.records.some((r) => r.level === 'error' && r.area === 'bootstrap')).toBe(true);

		// Реестр читает созданные 6 типов; отсутствующее определение просто не индексируется.
		const registry = await TypeRegistry.load(vault);
		expect(registry.types).toHaveLength(6);
		expect(registry.properties).toHaveLength(1); // sb_issues не пострадал
		expect(registry.issues).toEqual([]);
		expect(registry.getType('relation')).toBeNull();
	});
});
