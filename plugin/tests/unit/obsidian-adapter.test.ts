/**
 * Юнит-тесты ObsidianVaultAdapter — контракт DL-255 «dataWrite создаёт
 * родительские папки».
 *
 * Зачем это исключение из правила М4 (прод-адаптер не тестируется, отклонение
 * DL-244): баг прод-реализации уже уехал к пользователю — DataAdapter.write не
 * создаёт папки, из-за чего в свежем хранилище кэш реестра и файл журнала не
 * записывались («не удалось сохранить кэш реестра», 2026-10-24). FakeVault
 * поймать это не мог: он создаёт папки сам (fs.mkdir recursive). Тест закрепляет
 * ПОРЯДОК вызовов (mkdir по уровням → write) именно в прод-адаптере.
 *
 * 'obsidian' разрешается в стаб (алиас vitest.config.ts → tests/support/
 * obsidian-stub.ts); вместо приложения — подставной объект с vi.fn-методами:
 * проверяем не Obsidian, а нашу логику поверх него.
 */

import { describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { ObsidianVaultAdapter } from '../../src/adapter/obsidian-adapter';

function makeFakeApp() {
	const calls: string[] = [];
	const existing = new Set<string>();
	const files = new Map<string, string>();
	const dataAdapter = {
		exists: vi.fn(async (p: string) => existing.has(p)),
		mkdir: vi.fn(async (p: string) => {
			calls.push(`mkdir ${p}`);
			existing.add(p);
		}),
		write: vi.fn(async (p: string, c: string) => {
			calls.push(`write ${p}`);
			files.set(p, c);
		}),
	};
	// Из всего App адаптеру для этих сценариев нужен только vault.adapter.
	const app = { vault: { adapter: dataAdapter } } as unknown as App;
	return { app, dataAdapter, calls, existing, files };
}

describe('ObsidianVaultAdapter.dataWrite — контракт «создаёт родительские папки» (DL-255)', () => {
	it('свежее хранилище: цепочка .sb/ создаётся по уровням ДО записи', async () => {
		const { app, calls, files } = makeFakeApp();
		const adapter = new ObsidianVaultAdapter(app);

		await adapter.dataWrite('.sb/cache/registry.json', '{"format":1}');

		expect(calls).toEqual(['mkdir .sb', 'mkdir .sb/cache', 'write .sb/cache/registry.json']);
		expect(files.get('.sb/cache/registry.json')).toBe('{"format":1}');
	});

	it('существующие папки не пересоздаются: вторая запись идёт без mkdir', async () => {
		const { app, calls, dataAdapter } = makeFakeApp();
		const adapter = new ObsidianVaultAdapter(app);

		await adapter.dataWrite('.sb/logs/plugin-log.jsonl', 'a\n');
		calls.length = 0;
		await adapter.dataWrite('.sb/logs/plugin-log.jsonl', 'ab\n');

		expect(calls).toEqual(['write .sb/logs/plugin-log.jsonl']);
		expect(dataAdapter.mkdir).toHaveBeenCalledTimes(2); // только первая запись: .sb и .sb/logs
	});

	it('файл в корне хранилища — без mkdir', async () => {
		const { app, calls } = makeFakeApp();
		const adapter = new ObsidianVaultAdapter(app);

		await adapter.dataWrite('notes.json', '{}');

		expect(calls).toEqual(['write notes.json']);
	});

	it('dataCreateFolder идемпотентен: существующая папка — mkdir не вызывается', async () => {
		const { app, calls, existing } = makeFakeApp();
		existing.add('.sb');
		const adapter = new ObsidianVaultAdapter(app);

		await adapter.dataCreateFolder('.sb');

		expect(calls).toEqual([]);
	});
});
