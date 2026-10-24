/**
 * Генератор TypeScript-типов из JSON Schema (пункт D2 чек-листа, конструкция DL-222).
 *
 * Единственный источник истины — схемы `schema/**` в корне репозитория (DL-213:
 * типы не пишутся руками). Инструмент — `json-schema-to-typescript` (dev-зависимость);
 * сгенерированные файлы КОММИТЯТСЯ в `src/generated/`, а тест свежести
 * `tests/unit/generated-freshness.test.ts` сверяет «перегенерированное == зафиксированное»
 * (расхождение «схема ↔ типы» исключено конструкцией).
 *
 * Запуск (из plugin/):
 *   npm run generate:types          — перегенерировать src/generated/
 *   node scripts/generate-schema-types.mjs --check   — только сверка (код возврата 1 при расхождении)
 *
 * Детали:
 *   - имя корневого типа каждой схемы подставляется каноническое (TITLE в схеме содержит
 *     «(слой N)» — генератор построил бы имя вроде ObjectType2); описание схемы остаётся JSDoc;
 *   - общие `$defs` из `schema/common/defs.json` ИНЛАЙНЯТСЯ в каждый файл (SystemCore и др.) —
 *     дубли между файлами допустимы: это типы (стираются при компиляции), а barrel-index
 *     не создаётся сознательно (избегаем коллизий имён);
 *   - условные блоки if/then/else генератор уплощает: типы — ПРИЛОЖЕНИЕ к схеме, норма —
 *     сама схема и рантайм-валидация плагина (честность границ — мера M6);
 *   - вывод детерминирован (без меток времени) — иначе тест свежести всегда «красный»;
 *   - в репозиторий пишется LF, UTF-8 без BOM, финальный перевод строки;
 *   - сверка --check НЕЧУСТВИТЕЛЬНА к переводам строк (урок DL-259/DL-232): у пользователя
 *     Windows git с core.autocrlf=true кладёт в рабочую копию CRLF — сравниваем после
 *     нормализации CRLF→LF, иначе тест свежести краснеет ложно на всех файлах.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { compile } from 'json-schema-to-typescript';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const pluginDir = path.dirname(scriptsDir);
const repoRoot = path.dirname(pluginDir);
const schemaDir = path.join(repoRoot, 'schema');
const outDir = path.join(pluginDir, 'src', 'generated');

/** Нормализует переводы строк к LF (для сравнения: рабочая копия Windows может быть CRLF). */
function normalizeEol(text) {
	return text.replace(/\r\n/g, '\n');
}

/** Схема → каноническое имя типа → имя выходного файла. Порядок фиксирован (стабильность вывода). */
const TARGETS = [
	{ schema: 'metamodel/object_type.schema.json', name: 'ObjectTypeNote', out: 'object_type.ts' },
	{ schema: 'metamodel/property.schema.json', name: 'PropertyNote', out: 'property.ts' },
	{ schema: 'metamodel/relation_type.schema.json', name: 'RelationTypeNote', out: 'relation_type.ts' },
	{ schema: 'metamodel/taxonomy.schema.json', name: 'TaxonomyNote', out: 'taxonomy.ts' },
	{ schema: 'metamodel/facet.schema.json', name: 'FacetNote', out: 'facet.ts' },
	{ schema: 'metamodel/category.schema.json', name: 'CategoryNote', out: 'category.ts' },
	{ schema: 'entities/book.schema.json', name: 'BookNote', out: 'book.ts' },
	{ schema: 'entities/person.schema.json', name: 'PersonNote', out: 'person.ts' },
	{ schema: 'entities/media.schema.json', name: 'MediaNote', out: 'media.ts' },
	{ schema: 'entities/chapter.schema.json', name: 'ChapterNote', out: 'chapter.ts' },
	{ schema: 'entities/project.schema.json', name: 'ProjectNote', out: 'project.ts' },
	{ schema: 'entities/knowledge.schema.json', name: 'KnowledgeNote', out: 'knowledge.ts' },
	{ schema: 'relations/relation-line.schema.json', name: 'RelationLine', out: 'relation_line.ts' },
];

/** Детерминированный баннер (без даты — иначе тест свежести всегда красный). */
function banner(schemaRel, name) {
	return [
		'/**',
		' * СГЕНЕРИРОВАНО — не править руками (D2, конструкция DL-222).',
		' *',
		` * Источник (единственная истина): schema/${schemaRel}`,
		` * Корневой тип: ${name}. Перегенерация: npm run generate:types (в plugin/).`,
		' * Свежесть контролирует тест tests/unit/generated-freshness.test.ts.',
		' *',
		' * Ограничения (честно, мера M6): if/then/else-блоки схемы уплощены — типы являются',
		' * приближением; норма — сама схема и рантайм-валидация плагина. Общие $defs',
		' * (SystemCore и др.) инлайнятся в каждый файл — дубли типов между файлами нормальны.',
		' */',
		'',
	].join('\n');
}

async function generateOne(target) {
	const schemaPath = path.join(schemaDir, target.schema);
	const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
	const body = await compile({ ...schema, title: target.name }, target.name, {
		cwd: path.dirname(schemaPath),
		bannerComment: '',
		style: { singleQuote: true, semi: true, printWidth: 120 },
	});
	const text = `${banner(target.schema, target.name)}${body.endsWith('\n') ? body : `${body}\n`}`;
	return text.replace(/\r\n/g, '\n');
}

const checkMode = process.argv.includes('--check');

if (!checkMode) {
	mkdirSync(outDir, { recursive: true });
}

let drift = 0;
for (const target of TARGETS) {
	const text = await generateOne(target);
	const outFile = path.join(outDir, target.out);
	if (checkMode) {
		if (!existsSync(outFile)) {
			console.error(`НЕТ ФАЙЛА: src/generated/${target.out} (запустите npm run generate:types)`);
			drift++;
		} else if (normalizeEol(readFileSync(outFile, 'utf8')) !== text) {
			console.error(`РАСХОЖДЕНИЕ: src/generated/${target.out} — схема schema/${target.schema} новее зафиксированного типа`);
			drift++;
		}
	} else {
		writeFileSync(outFile, text, 'utf8');
		console.log(`OK src/generated/${target.out} <- schema/${target.schema}`);
	}
}

if (checkMode) {
	if (drift > 0) {
		console.error(`ИТОГ: ${drift} файл(ов) с расхождением — выполните npm run generate:types и закоммитьте результат`);
		process.exit(1);
	}
	console.log(`ИТОГ: ${TARGETS.length} файлов свежи (перегенерация == зафиксированное)`);
}
