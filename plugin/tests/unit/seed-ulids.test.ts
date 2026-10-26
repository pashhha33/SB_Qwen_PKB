/**
 * Тесты фиксированных ULID базовой библиотеки (B1.3 часть 1, B1-4 = А, DL-261/276).
 *
 * Что закрепляют:
 *   1. каждая константа SEED_ULIDS воспроизводится документированным рецептом
 *      (SHA-256 от «second-brain/{recipe}», первые 16 байт, время — SEED_TIME_MS);
 *   2. состав карты == состав спецификаций (нет лишних и потерянных рецептов);
 *   3. ULID валидны (Crockford, 26), уникальны, временная часть — дата утверждения
 *      метамодели 1.0.0 (2026-10-23, DL-242);
 *   4. --check генератора сторожит свежесть файла (как D2 для src/generated/).
 */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SEED_TIME_MS } from '../../src/core/bootstrap';
import { FACET_SEED_SPECS, PROPERTY_SEED_SPECS, TYPE_SEED_SPECS } from '../../src/core/seeds/library-specs';
import { SEED_ULIDS } from '../../src/core/seeds/seed-ulids';
import { decodeUlidTime, generateUlid, isValidUlid } from '../../src/core/ulid';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Рецепт из шапки generate-seed-ulids.mjs / bootstrap.ts. */
function recipeUlid(recipe: string): string {
	const digest = createHash('sha256').update(`second-brain/${recipe}`).digest();
	return generateUlid(SEED_TIME_MS, digest.subarray(0, 16));
}

const ALL_SPECS = [
	...TYPE_SEED_SPECS.map((s) => s.recipe),
	...FACET_SEED_SPECS.map((s) => s.recipe),
	...PROPERTY_SEED_SPECS.map((s) => s.recipe),
];

describe('seed-ulids — рецепт B1-4 = А (фиксированные ULID библиотеки)', () => {
	it('состав карты совпадает со спецификациями (138 рецептов: 4 типа + 5 фасетов + 129 свойств)', () => {
		expect(ALL_SPECS.length).toBe(138);
		expect(new Set(ALL_SPECS).size).toBe(ALL_SPECS.length);
		expect(Object.keys(SEED_ULIDS).sort()).toEqual([...ALL_SPECS].sort());
	});

	it('каждая константа воспроизводится рецептом SHA-256', () => {
		for (const recipe of ALL_SPECS) {
			expect(SEED_ULIDS[recipe], `рецепт ${recipe}`).toBe(recipeUlid(recipe));
		}
	});

	it('ULID валидны, уникальны, время — 2026-10-23 (утверждение метамодели 1.0.0)', () => {
		const values = Object.values(SEED_ULIDS);
		expect(new Set(values).size).toBe(values.length);
		for (const ulid of values) {
			expect(isValidUlid(ulid), ulid).toBe(true);
			expect(decodeUlidTime(ulid)).toBe(SEED_TIME_MS);
		}
	});

	it('сиды не пересекаются с ULID бутстрапа (7 системных типов + sb_issues)', async () => {
		const { SYSTEM_TYPE_ULIDS, SB_ISSUES_PROPERTY_ULID } = await import('../../src/core/bootstrap');
		const bootstrapUlids = new Set<string>([...Object.values(SYSTEM_TYPE_ULIDS), SB_ISSUES_PROPERTY_ULID]);
		for (const ulid of Object.values(SEED_ULIDS)) {
			expect(bootstrapUlids.has(ulid), ulid).toBe(false);
		}
	});

	it('файл seed-ulids.ts свеж (генератор --check)', () => {
		const result = spawnSync(process.execPath, [path.join(PLUGIN_ROOT, 'scripts', 'generate-seed-ulids.mjs'), '--check'], {
			cwd: PLUGIN_ROOT,
			encoding: 'utf8',
		});
		expect(result.status, result.stderr || result.stdout).toBe(0);
	});
});
