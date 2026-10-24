/**
 * Тест слоёв (09-modules §3, правило М2): ядро не знает об Obsidian.
 *
 * Импорт 'obsidian' разрешён ТОЛЬКО в:
 *   - src/main.ts (точка входа плагина);
 *   - src/adapter/obsidian-adapter.ts (тонкая обёртка, слой 0).
 * Файлы src/core/** и интерфейс src/adapter/vault-adapter.ts обязаны быть
 * среда-независимыми — это позволяет тестировать всё ядро на FakeVault.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');

const OBSIDIAN_IMPORT_ALLOWED = new Set(
	['main.ts', path.join('adapter', 'obsidian-adapter.ts')].map((p) => path.join(SRC_ROOT, p)),
);

const OBSIDIAN_IMPORT_PATTERN = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"]obsidian['"]|(?:^|\n)\s*import\s*['"]obsidian['"]/;

async function collectTsFiles(dir: string): Promise<string[]> {
	const results: string[] = [];
	for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
		const abs = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...(await collectTsFiles(abs)));
		} else if (entry.name.endsWith('.ts')) {
			results.push(abs);
		}
	}
	return results;
}

describe('правило слоёв: изоляция от API Obsidian (М2, ADR-003)', () => {
	it('src/core/** и vault-adapter.ts не импортируют "obsidian"', async () => {
		const files = await collectTsFiles(SRC_ROOT);
		const offenders: string[] = [];
		for (const file of files) {
			if (OBSIDIAN_IMPORT_ALLOWED.has(file)) {
				continue;
			}
			const content = await fs.readFile(file, 'utf8');
			if (OBSIDIAN_IMPORT_PATTERN.test(content)) {
				offenders.push(path.relative(SRC_ROOT, file));
			}
		}
		expect(offenders, `Эти файлы ядра импортируют 'obsidian': ${offenders.join(', ')}`).toEqual([]);
	});

	it('src/core/** не импортирует прод-адаптер (только интерфейс)', async () => {
		const coreDir = path.join(SRC_ROOT, 'core');
		const files = await collectTsFiles(coreDir);
		const offenders: string[] = [];
		for (const file of files) {
			const content = await fs.readFile(file, 'utf8');
			if (/from\s*['"][^'"]*obsidian-adapter['"]/.test(content)) {
				offenders.push(path.relative(SRC_ROOT, file));
			}
		}
		expect(offenders).toEqual([]);
	});

	it('разрешённые файлы существуют (тест не «позеленел» из-за пустоты)', async () => {
		for (const allowed of OBSIDIAN_IMPORT_ALLOWED) {
			expect(await fs.readFile(allowed, 'utf8')).toBeTruthy();
		}
		const coreFiles = await collectTsFiles(path.join(SRC_ROOT, 'core'));
		expect(coreFiles.length).toBeGreaterThanOrEqual(5); // errors, model, ulid, datetime, identity, markdown-parser
	});
});
