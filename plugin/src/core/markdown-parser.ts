/**
 * Универсальный парсер (модуль markdown-parser, этап A) — ОДИН механизм чтения
 * для всех видов заметок: и экземпляров объектов, и определений метамодели
 * (следствие самоопределяемости, phases.md §4; «один универсальный механизм
 * чтения вместо девяти частных» — CHECKPOINT §4).
 *
 * Markdown-заметка → объект модели SbNote:
 *   1. снятие BOM и нормализация переводов строк (Windows CRLF — среда пользователя,
 *      урок DL-232: никогда не предполагать одну ОС);
 *   2. выделение блока frontmatter (--- … ---) — структурное разбиение;
 *   3. разбор YAML — ТОЛЬКО через adapter.parseYaml (ADR-002: «чтение frontmatter —
 *      только через API Obsidian, не самописным разбором YAML»; в тестах adapter —
 *      FakeVault на js-yaml, та же библиотека, что и в прогонщике примеров);
 *   4. разделение полей: 8 системных атрибутов (ADR-006) vs предметные свойства;
 *   5. нормализация: списки (aliases/categories/tags) → массивы строк,
 *      Date-объекты YAML → локальные строки (конвенция DL-228);
 *   6. извлечение wikilink-ов тела (код-блоки и инлайн-код пропускаются).
 *
 * Что НЕ делает парсер (осознанно, этап A1):
 *   - не валидирует значения (схема + validation-runner, A2/B);
 *   - не извлекает wikilink-и из ЗНАЧЕНИЙ свойств (это link-context-resolver, этап B);
 *   - не проверяет И3 (нужен реестр типов, A2) и уникальность id (findDuplicateIds).
 *
 * Ошибка YAML — не исключение: по ADR-002 «некорректное определение не применяется»,
 * парсер возвращает SbNote с frontmatterBroken + issue, решение принимает вызывающий.
 */

import type { VaultAdapter } from '../adapter/vault-adapter';
import { normalizeDateValue, normalizeSystemDateTime } from './datetime';
import type { ParseIssue, SbNote, SystemAttributes, WikilinkRef } from './model';
import { SYSTEM_KEYS } from './model';
import { parseFileName } from './identity';

/** BOM (байт порядка байтов) — невидимый маркер в начале файла; прогонщик примеров его тоже проверяет. */
const BOM = '\uFEFF';

/**
 * Блок frontmatter: файл НАЧИНАЕТся с '---', блок закрывается строкой '---'
 * (допускаются хвостовые пробелы). Пустой блок '---\n---' законен (capture '').
 * Тело — всё, что после.
 */
const FRONTMATTER_PATTERN = /^---[ \t]*\n([\s\S]*?)\n?---[ \t]*(?:\n|$)/;

export interface SplitFrontmatterResult {
	/** Текст YAML между '---' (null, если блока нет или он не в начале файла). */
	frontmatterText: string | null;
	/** Тело заметки (без блока frontmatter). */
	body: string;
}

/**
 * Структурное разбиение заметки: frontmatter + тело.
 * Ожидает уже нормализованный текст (без BOM, LF). Не парсит сам YAML.
 */
export function splitFrontmatter(content: string): SplitFrontmatterResult {
	const match = FRONTMATTER_PATTERN.exec(content);
	if (!match) {
		return { frontmatterText: null, body: content };
	}
	return { frontmatterText: match[1], body: content.slice(match[0].length) };
}

export interface ParseNoteInput {
	/** Путь от корня хранилища. */
	path: string;
	/** Полное текстовое содержимое файла. */
	content: string;
}

/** Значение → массив строк (YAML может дать и скаляр, и список). */
function toStringArray(value: unknown): string[] | null {
	if (typeof value === 'string') {
		return [value];
	}
	if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
		return value as string[];
	}
	if (value === null || value === undefined) {
		return null;
	}
	// Не строка и не список строк (число, вложенные объекты…) — оставляем как есть,
	// проблему увидит валидация (группа A), парсер не «чинит молча» (спецификация §19).
	return null;
}

/**
 * Главная точка входа: разобрать заметку в SbNote.
 * adapter используется только для parseYaml (норма ADR-002).
 */
export function parseNote(input: ParseNoteInput, adapter: Pick<VaultAdapter, 'parseYaml'>): SbNote {
	const issues: ParseIssue[] = [];
	const fileName = input.path.includes('/')
		? input.path.slice(input.path.lastIndexOf('/') + 1)
		: input.path;

	// 1. BOM и переводы строк.
	let content = input.content;
	if (content.startsWith(BOM)) {
		content = content.slice(1);
		issues.push({ code: 'bom_stripped', message: 'В начале файла был BOM — снят при чтении' });
	}
	content = content.replace(/\r\n?/g, '\n');

	// 2. Frontmatter + тело.
	const { frontmatterText, body } = splitFrontmatter(content);

	const note: SbNote = {
		path: input.path,
		fileName,
		fileNameIdentity: parseFileName(fileName),
		frontmatterPresent: frontmatterText !== null,
		system: {},
		properties: {},
		body,
		wikilinks: [],
		issues,
		frontmatterBroken: false,
	};

	// 3–5. YAML → системные атрибуты + свойства.
	if (frontmatterText !== null) {
		let parsed: unknown;
		try {
			parsed = adapter.parseYaml(frontmatterText);
		} catch (error) {
			note.frontmatterBroken = true;
			issues.push({
				code: 'yaml_error',
				message: `Frontmatter не применим (ошибка YAML): ${error instanceof Error ? error.message : String(error)}`,
			});
			note.wikilinks = extractWikilinks(body);
			return note;
		}

		if (parsed === null || parsed === undefined) {
			// Пустой блок '---\n---' законен: frontmatter есть, полей нет.
		} else if (typeof parsed !== 'object' || Array.isArray(parsed)) {
			note.frontmatterBroken = true;
			issues.push({
				code: 'frontmatter_not_mapping',
				message: 'Frontmatter не применим: ожидался набор полей «ключ: значение», а не список или скаляр',
			});
			note.wikilinks = extractWikilinks(body);
			return note;
		} else {
			const record = parsed as Record<string, unknown>;
			const system: Partial<SystemAttributes> = {};

			for (const [key, rawValue] of Object.entries(record)) {
				if (!isSystemKey(key)) {
					// Предметное свойство: нормализуем только Date-объекты (DL-228).
					const normalized = normalizeDateValue(rawValue);
					if (normalized.normalized) {
						issues.push({
							code: 'date_normalized',
							message: `Поле «${key}»: дата из YAML нормализована в строку «${String(normalized.value)}»`,
						});
					}
					note.properties[key] = normalized.value;
					continue;
				}

				// Системные атрибуты (закрытый набор из 8, ADR-006).
				switch (key) {
					case 'id':
					case 'type':
					case 'title':
					case 'created_at':
					case 'updated_at': {
						if (key === 'created_at' || key === 'updated_at') {
							const normalized = normalizeSystemDateTime(rawValue);
							if (normalized.normalized) {
								issues.push({
									code: 'date_normalized',
									message: `Поле «${key}»: метка времени из YAML нормализована в «${String(normalized.value)}»`,
								});
							}
							if (typeof normalized.value === 'string') {
								system[key] = normalized.value;
							}
						} else if (typeof rawValue === 'string') {
							system[key] = rawValue;
						}
						break;
					}
					case 'aliases':
					case 'categories':
					case 'tags': {
						const array = toStringArray(rawValue);
						if (array !== null) {
							system[key] = array;
						}
						break;
					}
				}
			}
			note.system = system;
		}
	}

	// 6. Wikilink-и тела.
	note.wikilinks = extractWikilinks(body);
	return note;
}

function isSystemKey(key: string): key is SystemAttributesKey {
	return (SYSTEM_KEYS as readonly string[]).includes(key);
}

type SystemAttributesKey = (typeof SYSTEM_KEYS)[number];

// ---- Wikilink-и ----

/**
 * Извлекает wikilink-и из тела заметки, пропуская:
 *   - fenced-код-блоки (``` и ~~~) — там [[...]] это текст, например блок
 *     sb-chapter-nav у глав (DL-129);
 *   - инлайн-код `...`.
 * Формат: [[цель#заголовок^блок|подпись]], встраивание: ![[...]].
 * Вложенные/пустые цели ([]]) пропускаются.
 */
export function extractWikilinks(body: string): WikilinkRef[] {
	const links: WikilinkRef[] = [];
	const lines = body.split('\n');
	let fence: string | null = null; // активный fenced-блок: '```' или '~~~'

	for (const line of lines) {
		const fenceMatch = /^(\s{0,3})(`{3,}|~{3,})/.exec(line);
		if (fenceMatch) {
			const marker = fenceMatch[2][0];
			if (fence === null) {
				fence = marker;
			} else if (marker === fence) {
				fence = null;
			}
			continue; // сама строка-ограждение ссылок не содержит
		}
		if (fence !== null) {
			continue;
		}

		// Инлайн-код: режем строку на сегменты вне обратных кавычек.
		for (const segment of splitOutsideInlineCode(line)) {
			const linkPattern = /(!?)\[\[([^\[\]]+)\]\]/g;
			let match: RegExpExecArray | null;
			while ((match = linkPattern.exec(segment)) !== null) {
				const ref = parseWikilinkInner(match[2], match[1] === '!');
				if (ref !== null) {
					links.push(ref);
				}
			}
		}
	}
	return links;
}

/** Режет строку на части, исключая содержимое `инлайн-кода`. */
function splitOutsideInlineCode(line: string): string[] {
	const segments: string[] = [];
	const parts = line.split('`');
	// части с чётными индексами — ВНЕ инлайн-кода
	for (let i = 0; i < parts.length; i += 2) {
		segments.push(parts[i]);
	}
	return segments;
}

/** Разбирает внутренность wikilink-а: цель#заголовок^блок|подпись. */
function parseWikilinkInner(inner: string, isEmbed: boolean): WikilinkRef | null {
	let rest = inner;
	let displayText: string | null = null;

	const pipeIndex = rest.indexOf('|');
	if (pipeIndex >= 0) {
		displayText = rest.slice(pipeIndex + 1).trim();
		rest = rest.slice(0, pipeIndex);
		if (displayText === '') {
			displayText = null;
		}
	}

	let heading: string | null = null;
	let blockId: string | null = null;

	const blockIndex = rest.indexOf('^');
	if (blockIndex >= 0) {
		blockId = rest.slice(blockIndex + 1).trim() || null;
		rest = rest.slice(0, blockIndex);
	}
	const headingIndex = rest.indexOf('#');
	if (headingIndex >= 0) {
		heading = rest.slice(headingIndex + 1).trim() || null;
		rest = rest.slice(0, headingIndex);
	}

	const target = rest.trim();
	if (target === '') {
		return null; // пустая цель — не ссылка
	}
	return { target, displayText, heading, blockId, isEmbed };
}
