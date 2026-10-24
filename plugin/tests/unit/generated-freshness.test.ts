/**
 * Тест свежести сгенерированных типов (пункт D2 чек-листа, конструкция DL-222):
 * «перегенерация == зафиксированное». Сгенерированные файлы КОММИТЯТСЯ
 * (src/generated/), поэтому единственный способ их отставания от схем — забытая
 * перегенерация; тест ловит её запуском генератора в режиме --check.
 *
 * Расхождение = схема в schema/** изменилась, а npm run generate:types не выполнен.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GENERATED_DIR = path.join(PLUGIN_ROOT, 'src', 'generated');

/** Ожидаемый состав: 13 схем MVP (6 метамодели + 6 предметных типов + строка .jsonl). */
const EXPECTED_FILES = [
	'object_type.ts',
	'property.ts',
	'relation_type.ts',
	'taxonomy.ts',
	'facet.ts',
	'category.ts',
	'book.ts',
	'person.ts',
	'media.ts',
	'chapter.ts',
	'project.ts',
	'knowledge.ts',
	'relation_line.ts',
];

const EXPECTED_ROOT_TYPES: Record<string, string> = {
	'object_type.ts': 'ObjectTypeNote',
	'property.ts': 'PropertyNote',
	'relation_type.ts': 'RelationTypeNote',
	'taxonomy.ts': 'TaxonomyNote',
	'facet.ts': 'FacetNote',
	'category.ts': 'CategoryNote',
	'book.ts': 'BookNote',
	'person.ts': 'PersonNote',
	'media.ts': 'MediaNote',
	'chapter.ts': 'ChapterNote',
	'project.ts': 'ProjectNote',
	'knowledge.ts': 'KnowledgeNote',
	'relation_line.ts': 'RelationLine',
};

describe('D2 — генерация TS-типов из схем (DL-222)', () => {
	it(
		'перегенерация == зафиксированное: генератор --check не находит расхождений',
		() => {
			const result = spawnSync(process.execPath, ['scripts/generate-schema-types.mjs', '--check'], {
				cwd: PLUGIN_ROOT,
				encoding: 'utf8',
				timeout: 120_000,
			});
			const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
			expect(result.status, `генератор --check должен завершиться без расхождений:\n${output}`).toBe(0);
			expect(output).toContain('файлов свежи');
		},
		180_000,
	);

	it('состав src/generated/ ровно из 13 файлов (без лишних и потерянных)', () => {
		const actual = readdirSync(GENERATED_DIR).filter((f) => f.endsWith('.ts')).sort();
		expect(actual).toEqual([...EXPECTED_FILES].sort());
	});

	it('каждый файл — с баннером «СГЕНЕРИРОВАНО» и каноническим корневым типом', () => {
		for (const file of EXPECTED_FILES) {
			// Рабочая копия на Windows может нести CRLF (git core.autocrlf=true) — в репозитории
			// blob всегда LF, поэтому сверяем после нормализации переводов строк (урок DL-259).
			const text = readFileSync(path.join(GENERATED_DIR, file), 'utf8').replace(/\r\n/g, '\n');
			const rootType = EXPECTED_ROOT_TYPES[file];
			expect(text.startsWith('/**\n * СГЕНЕРИРОВАНО'), `${file}: баннер`).toBe(true);
			// Корневой тип — `export type` или `export interface` (зависит от формы схемы).
			expect(
				text.includes(`export type ${rootType}`) || text.includes(`export interface ${rootType}`),
				`${file}: корневой тип ${rootType}`,
			).toBe(true);
			// Одиночных \r (вне пар CRLF) быть не должно ни на какой платформе.
			expect(text.includes('\r'), `${file}: без одиночных CR`).toBe(false);
			expect(text.endsWith('\n'), `${file}: финальный перевод строки`).toBe(true);
		}
	});
});
