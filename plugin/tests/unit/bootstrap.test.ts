/**
 * Юнит-тесты семенных данных бутстрапа (A2 часть 2, DL-250/257).
 *
 * Что закрепляют:
 *   1. фиксированные ULID (F5-9 = А) — константы, их воспроизводимость по
 *      документированному рецепту и закодированную дату (утверждение метамодели);
 *   2. корректность семенных заметок: парсятся универсальным парсером, проходят
 *      требования реестра (ingestType), инвариант И4, конвенции имени файла (ADR-001);
 *   3. статичность содержимого: LF, без BOM, без токенов Templater (DL-190).
 */

import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	SB_ISSUES_PROPERTY_ULID,
	SEED_TIME_MS,
	SYSTEM_PROPERTY_SEEDS,
	SEED_TIMESTAMP,
	SYSTEM_TYPE_SEEDS,
	SYSTEM_TYPE_ULIDS,
} from '../../src/core/bootstrap';
import { TYPE_KEY_PATTERN } from '../../src/core/creation';
import { buildFileName, isValidTypePrefix, parseFileName } from '../../src/core/identity';
import { parseNote } from '../../src/core/markdown-parser';
import { METAMODEL_SUBFOLDERS, SYSTEM_TYPE_PREFIXES } from '../../src/core/registry';
import { decodeUlidTime, generateUlid, isValidUlid } from '../../src/core/ulid';
import { FakeVault } from '../support/fake-vault';

/** ожидаемые константы — зашиты в SYSTEM_TYPE_ULIDS; тест защищает от случайной правки. */
const EXPECTED_ULIDS: Record<string, string> = {
	object_type: '01M5K0XB00HX9XWND1C4WYZEYW',
	property: '01M5K0XB00ZCAD7KJ8Z5R4F346',
	relation_type: '01M5K0XB007JDGH8AH4N89YSRC',
	relation: '01M5K0XB00YRHHGDQ60WJACEWD',
	taxonomy: '01M5K0XB006NG3CT8WX11Z9R2D',
	facet: '01M5K0XB00YK6T08S1MAA312YQ',
	category: '01M5K0XB006CG18SWHZW3C3KC8',
};

/** Канонический порядок реестра 02-entities §3. */
const CANONICAL_ORDER = ['object_type', 'property', 'relation_type', 'relation', 'taxonomy', 'facet', 'category'];

/** Рецепт из шапки bootstrap.ts: SHA-256 от «second-brain/system-type/{type_key}», первые 16 байт. */
function recipeUlid(typeKey: string): string {
	const digest = createHash('sha256').update(`second-brain/system-type/${typeKey}`).digest();
	return generateUlid(SEED_TIME_MS, digest.subarray(0, 16));
}

describe('bootstrap — фиксированные ULID системных типов (F5-9 = А)', () => {
	it('семь констант совпадают с ожидаемыми (байт-стабильность семени)', () => {
		expect(Object.keys(SYSTEM_TYPE_ULIDS).sort()).toEqual([...CANONICAL_ORDER].sort());
		expect(SYSTEM_TYPE_ULIDS).toEqual(EXPECTED_ULIDS);
	});

	it('константы воспроизводятся по документированному рецепту', () => {
		for (const key of CANONICAL_ORDER) {
			expect(recipeUlid(key), `рецепт для ${key}`).toBe(EXPECTED_ULIDS[key]);
		}
	});

	it('все ULID валидны, уникальны и кодируют дату утверждения метамодели (2026-10-23T00:00:00Z)', () => {
		expect(SEED_TIME_MS).toBe(Date.UTC(2026, 9, 23, 0, 0, 0));
		const seen = new Set<string>();
		for (const key of CANONICAL_ORDER) {
			const ulid = SYSTEM_TYPE_ULIDS[key as keyof typeof SYSTEM_TYPE_ULIDS];
			expect(isValidUlid(ulid), `${key}: формат И1`).toBe(true);
			expect(seen.has(ulid), `${key}: уникальность`).toBe(false);
			seen.add(ulid);
			expect(decodeUlidTime(ulid), `${key}: временная часть`).toBe(SEED_TIME_MS);
		}
		expect(seen.size).toBe(7);
	});
});

describe('bootstrap — состав и формат семенных заметок (F5-10 = Б)', () => {
	let vault: FakeVault;

	beforeEach(async () => {
		vault = await FakeVault.create();
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	it('7 семян в каноническом порядке 02-entities §3', () => {
		expect(SYSTEM_TYPE_SEEDS).toHaveLength(7);
		expect(SYSTEM_TYPE_SEEDS.map((s) => s.typeKey)).toEqual(CANONICAL_ORDER);
	});

	it('метаданные семян согласованы с реестром (type_key, label, type_prefix, пути)', () => {
		for (const seed of SYSTEM_TYPE_SEEDS) {
			expect(TYPE_KEY_PATTERN.test(seed.typeKey), `${seed.typeKey}: формат ключа`).toBe(true);
			expect(seed.typePrefix, `${seed.typeKey}: префикс из системной таблицы`).toBe(SYSTEM_TYPE_PREFIXES[seed.typeKey]);
			expect(isValidTypePrefix(seed.typePrefix), `${seed.typeKey}: префикс по схеме defs#type_prefix`).toBe(true);
			expect(seed.label.trim().length, `${seed.typeKey}: русская подпись непустая`).toBeGreaterThan(0);
			expect(seed.fileName).toBe(buildFileName('OBJECT_TYPE', seed.ulid));
			expect(seed.path).toBe(`${METAMODEL_SUBFOLDERS.objectTypes}/${seed.fileName}`);
		}
	});

	it('содержимое статично: LF, без BOM, без токенов Templater (DL-190)', () => {
		for (const seed of SYSTEM_TYPE_SEEDS) {
			expect(seed.content.startsWith('---\n'), `${seed.typeKey}: начинается с frontmatter`).toBe(true);
			expect(seed.content).toContain('\n---\n');
			expect(seed.content.includes('\r'), `${seed.typeKey}: только LF`).toBe(false);
			expect(seed.content.includes('\uFEFF'), `${seed.typeKey}: без BOM`).toBe(false);
			expect(seed.content.includes('<%'), `${seed.typeKey}: без токенов Templater`).toBe(false);
			expect(seed.content.includes(`created_at: "${SEED_TIMESTAMP}"`), `${seed.typeKey}: фиксированная метка`).toBe(true);
		}
	});

	it('заметки парсятся универсальным парсером и удовлетворяют требованиям реестра', async () => {
		for (const seed of SYSTEM_TYPE_SEEDS) {
			const note = parseNote({ path: seed.path, content: seed.content }, vault);
			expect(note.frontmatterBroken, `${seed.typeKey}: frontmatter разбирается`).toBe(false);
			expect(note.issues, `${seed.typeKey}: без замечаний парсера`).toEqual([]);

			// Системные атрибуты (ADR-006) + инвариант И4.
			expect(note.system.type).toBe('object_type');
			expect(note.system.id).toBe(seed.ulid);
			expect(note.system.title).toBe(seed.typeKey);
			expect(note.system.aliases?.[0], `${seed.typeKey}: И4 — aliases[0] == title`).toBe(note.system.title);
			expect(note.system.created_at).toBe(SEED_TIMESTAMP);
			expect(note.system.updated_at).toBe(SEED_TIMESTAMP);

			// Предметные поля определения (схема object_type: required type_key/label/type_prefix/abstract).
			expect(note.properties.type_key).toBe(seed.typeKey);
			expect(note.properties.label).toBe(seed.label);
			expect(note.properties.type_prefix).toBe(seed.typePrefix);
			expect(note.properties.abstract).toBe(false);
			expect(note.properties.lifecycle).toBe('standard');
			expect(note.properties.parent_type, `${seed.typeKey}: системные типы — корни дерева (02-entities §3)`).toBeUndefined();
			expect(typeof note.properties.description).toBe('string');
			expect((note.properties.description as string).length).toBeGreaterThan(0);

			// Идентичность из имени файла совпадает с id (И2).
			const identity = parseFileName(seed.fileName);
			expect(identity?.typePrefix).toBe('OBJECT_TYPE');
			expect(identity?.ulid).toBe(seed.ulid);
		}
	});
});

describe('bootstrap — семя служебного свойства sb_issues (часть 2, B1-4 = А, DL-266)', () => {
	let vault: FakeVault;
	beforeEach(async () => {
		vault = await FakeVault.create();
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	/** Рецепт из шапки bootstrap.ts: SHA-256 от «second-brain/system-property/{type_key}.{property_key}». */
	function recipeUlid(recipe: string): string {
		const digest = createHash('sha256').update(recipe).digest();
		return generateUlid(SEED_TIME_MS, digest.subarray(0, 16));
	}

	it('фиксированный ULID воспроизводится по документированному рецепту', () => {
		expect(recipeUlid('second-brain/system-property/universal.sb_issues')).toBe(SB_ISSUES_PROPERTY_ULID);
		expect(isValidUlid(SB_ISSUES_PROPERTY_ULID)).toBe(true);
		expect(decodeUlidTime(SB_ISSUES_PROPERTY_ULID)).toBe(SEED_TIME_MS);
	});

	it('одно семя; путь и имя файла канонические (PROPERTY-{ULID}.md в Metamodel/Properties/)', () => {
		expect(SYSTEM_PROPERTY_SEEDS).toHaveLength(1);
		const seed = SYSTEM_PROPERTY_SEEDS[0];
		expect(seed.key).toBe('sb_issues');
		expect(seed.label).toBe('Проблемы');
		expect(seed.fileName).toBe(`PROPERTY-${SB_ISSUES_PROPERTY_ULID}.md`);
		expect(seed.path).toBe(`${METAMODEL_SUBFOLDERS.properties}/${seed.fileName}`);
		expect(seed.fileName).toBe(buildFileName(SYSTEM_TYPE_PREFIXES.property, SB_ISSUES_PROPERTY_ULID));
	});

	it('содержимое семени разбирается и соответствует норме 08-views §7', () => {
		const seed = SYSTEM_PROPERTY_SEEDS[0];
		const note = parseNote({ path: seed.path, content: seed.content }, vault);
		expect(note.frontmatterBroken).toBe(false);
		expect(note.issues).toEqual([]);

		// Системные атрибуты + И4.
		expect(note.system.type).toBe('property');
		expect(note.system.id).toBe(SB_ISSUES_PROPERTY_ULID);
		expect(note.system.title).toBe('sb_issues');
		expect(note.system.aliases?.[0]).toBe('sb_issues');
		expect(note.system.created_at).toBe(SEED_TIMESTAMP);
		expect(note.system.updated_at).toBe(SEED_TIMESTAMP);

		// Норма: ключ sb_issues, подпись «Проблемы», text, 0..N, universal, service: true.
		expect(note.properties.key).toBe('sb_issues');
		expect(note.properties.label).toBe('Проблемы');
		expect(note.properties.value_type).toBe('text');
		expect(note.properties.cardinality).toBe('0..N');
		expect(note.properties.required).toBe(false);
		expect(note.properties.scope).toBe('universal');
		expect(note.properties.service).toBe(true);
		expect(note.properties.lifecycle).toBe('standard');
	});

	it('статичность: LF, без BOM, без токенов Templater (DL-190)', () => {
		for (const seed of SYSTEM_PROPERTY_SEEDS) {
			expect(seed.content).not.toContain('\r');
			expect(seed.content.charCodeAt(0)).not.toBe(0xfeff);
			expect(seed.content).not.toMatch(/<%|\{\{/);
		}
	});
});
