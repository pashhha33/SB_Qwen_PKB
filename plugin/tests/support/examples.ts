/**
 * Доступ к примерам репозитория (../examples/instances/) из тестов плагина.
 *
 * Примеры шага 9 — готовый тестовый материал для универсального парсера
 * (62 Markdown-файла, 12 типов; экземпляры relation — .jsonl, парсер их не читает).
 * Пути строим через fileURLToPath — урок DL-232: никакой ручной склейки
 * file://+путь, на Windows это падает.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Корень примеров: <repo>/examples/instances (тесты — в <repo>/plugin/tests/). */
export const EXAMPLES_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'..',
	'examples',
	'instances',
);

/**
 * Реестр TYPE_PREFIX ядра (источник: docs/metamodel/02-entities.md §6).
 * Используется тестами для проверки канонического имени {TYPE_PREFIX}-{ULID}.md.
 */
export const TYPE_PREFIX_BY_TYPE: Record<string, string> = {
	book: 'BOOK',
	chapter: 'CHP',
	person: 'PERSON',
	media: 'MEDIA',
	project: 'PROJECT',
	knowledge: 'KNOWLEDGE',
	object_type: 'OBJECT_TYPE',
	property: 'PROPERTY',
	relation_type: 'RELATION_TYPE',
	taxonomy: 'TAXONOMY',
	facet: 'FACET',
	category: 'CATEGORY',
};

export interface ExampleFile {
	/** Абсолютный путь. */
	absPath: string;
	/** Путь от EXAMPLES_ROOT: '<type>/<имя>.md'. */
	relative: string;
	/** Тип из имени папки. */
	type: string;
	/** Ожидание файла: корректный или некорректный пример. */
	validity: 'valid' | 'invalid';
	/** Содержимое файла. */
	content: string;
}

/** Читает все Markdown-примеры (рекурсивно), сортируя по относительному пути. */
export async function loadExamples(): Promise<ExampleFile[]> {
	const results: ExampleFile[] = [];
	const walk = async (dirAbs: string, dirRel: string): Promise<void> => {
		const entries = await fs.readdir(dirAbs, { withFileTypes: true });
		for (const entry of entries) {
			const abs = path.join(dirAbs, entry.name);
			const rel = dirRel === '' ? entry.name : `${dirRel}/${entry.name}`;
			if (entry.isDirectory()) {
				await walk(abs, rel);
			} else if (entry.name.endsWith('.md') && dirRel !== '') {
				const typeName = dirRel.split('/')[0];
				const validity: 'valid' | 'invalid' = entry.name.startsWith('invalid')
					? 'invalid'
					: 'valid';
				results.push({
					absPath: abs,
					relative: rel,
					type: typeName,
					validity,
					content: await fs.readFile(abs, 'utf8'),
				});
			}
		}
	};
	await walk(EXAMPLES_ROOT, '');
	return results.sort((a, b) => a.relative.localeCompare(b.relative));
}
