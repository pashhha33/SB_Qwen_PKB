#!/usr/bin/env node
/**
 * Second Brain — проверка Markdown-таблиц на разрывы пустыми строками (DL-262).
 *
 * Зачем: замечание пользователя (2026-10-25) — в таблицах документов появились пустые
 * строки, из-за которых Markdown-рендер (Obsidian, GitHub) ломает представление: таблица
 * распадается на две, а «хвост» после пустой строки отрисовывается как обычный текст. Дефект
 * был долгожителем (12 разрывов существовали до 2026-10-25) и не ловился на глаз —
 * поэтому добавлена автоматическая защита по образцу контракт-тестов (урок DL-255).
 *
 * Что делает:
 *  1. Обходит все *.md репозитория (кроме node_modules и docs/inbox — исходные черновики
 *     заморожены и не редактируются никогда; если разрыв найдётся там, чинить его нельзя).
 *  2. Ищет разрывы: блок из ≥2 строк таблицы, затем пустая строка (или строка только из «>»
 *     внутри цитаты), затем снова строка таблицы с тем же числом колонок, и это НЕ начало
 *     новой таблицы (за следующей строкой нет разделителя |---|).
 *  3. Печатает отчёт; код возврата 0 — разрывов нет, 1 — найдены.
 *
 * Ложное срабатывание возможно только для двух РАЗНЫХ таблиц с одинаковым числом колонок,
 * стоящих вплотную через пустую строку без поясняющего текста между ними. Лечение — добавить
 * между таблицами заголовок/абзац (это в любом случае улучшает документ).
 *
 * Запуск:  npm run check:docs   (или: node scripts/check-docs-tables.cjs)
 * Зависимостей нет (чистый Node). Офлайн (рамки проекта).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'generated', '.obsidian']);
const SKIP_PATHS = [path.join('docs', 'inbox')]; // замороженные исходники — не редактируются

/** Строка таблицы Markdown (в т.ч. внутри цитаты «> | … |»). */
function isTableRow(line) {
	const t = line.replace(/^(>\s?)+/, '').trim();
	return t.startsWith('|') && t.endsWith('|') && t.length > 2;
}

/** Число колонок (по количеству «|») — для сравнения строк одной таблицы. */
function pipeCount(line) {
	return line.replace(/^(>\s?)+/, '').trim().split('|').length;
}

/** Разделитель-строка новой таблицы: |---|---| (возможно с : и пробелами). */
function isTableSeparator(line) {
	return /^\s*(>\s?)?\|[\s:|-]+\|\s*$/.test(line) && line.includes('-');
}

/** Пустая строка (или строка, содержащая только префикс цитаты «>»). */
function isBlankish(line) {
	return line.replace(/^(>\s?)+/, '').trim() === '';
}

function collectMarkdown(dir, out) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const abs = path.join(dir, entry.name);
		const rel = path.relative(REPO, abs);
		if (entry.isDirectory()) {
			if (SKIP_DIRS.has(entry.name) || SKIP_PATHS.includes(rel)) continue;
			collectMarkdown(abs, out);
		} else if (entry.name.endsWith('.md')) {
			out.push(abs);
		}
	}
	return out;
}

function findGaps(lines) {
	const gaps = [];
	let i = 0;
	while (i < lines.length) {
		if (isTableRow(lines[i])) {
			let j = i;
			while (j < lines.length && isTableRow(lines[j])) j++;
			let k = j;
			while (k < lines.length && isBlankish(lines[k])) k++;
			const tableHasBody = j - i >= 2;
			if (
				k > j &&
				k < lines.length &&
				tableHasBody &&
				isTableRow(lines[k]) &&
				pipeCount(lines[k]) === pipeCount(lines[j - 1]) &&
				!(k + 1 < lines.length && isTableSeparator(lines[k + 1]))
			) {
				gaps.push(j + 1); // 1-based номер первой пустой строки разрыва
			}
			i = k > j ? k : j;
		} else {
			i++;
		}
	}
	return gaps;
}

const files = collectMarkdown(REPO, []);
let total = 0;
for (const file of files) {
	const lines = fs.readFileSync(file, 'utf8').split('\n');
	const gaps = findGaps(lines);
	for (const lineNo of gaps) {
		console.error(`РАЗРЫВ ТАБЛИЦЫ: ${path.relative(REPO, file)}:${lineNo} — пустая строка внутри таблицы (удалить её)`);
		total++;
	}
}

if (total > 0) {
	console.error(`\nИТОГ: ${total} разрыв(ов) таблиц в ${files.length} проверенных .md-файлах`);
	console.error('Лечение: удалить пустые строки внутри таблиц (строки таблицы должны идти подряд).');
	process.exit(1);
}
console.log(`ИТОГ: ${files.length} .md-файлов проверено, разрывов таблиц нет — OK`);
