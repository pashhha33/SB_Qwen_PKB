// Конфигурация сборки плагина Second Brain (esbuild).
//
// Два режима:
//   node esbuild.config.mjs            — dev: watch-пересборка при изменении src/ (sourcemap inline)
//   node esbuild.config.mjs production — финальная сборка (минификация, без sourcemap)
//
// Переменная окружения SB_VAULT_PATH (необязательная):
//   если задана — main.js пишется НАПРЯМУЮ в хранилище Obsidian:
//   {SB_VAULT_PATH}/.obsidian/plugins/second-brain/main.js
//   Это «вариант Б» dev-настройки (без junction); подробности — docs/plugin/dev-setup.md.

import esbuild from 'esbuild';
import esbuildSvelte from 'esbuild-svelte';
import sveltePreprocess from 'svelte-preprocess';
import process from 'node:process';
import path from 'node:path';

const production = process.argv[2] === 'production';

const vaultPath = process.env.SB_VAULT_PATH;
const outfile = vaultPath
	? path.join(vaultPath, '.obsidian', 'plugins', 'second-brain', 'main.js')
	: 'main.js';

const banner = `/*
Second Brain — СГЕНЕРИРОВАННЫЙ ФАЙЛ (esbuild). Не редактировать вручную.
Исходный код: plugin/src/ — https://github.com/pashhha33/SB_Qwen_PKB
*/
`;

// 'obsidian' и платформенные модули предоставляет само приложение Obsidian —
// в бандл они не упаковываются (external).
const external = [
	'obsidian',
	'electron',
	'@codemirror/autocomplete',
	'@codemirror/collab',
	'@codemirror/commands',
	'@codemirror/language',
	'@codemirror/lint',
	'@codemirror/search',
	'@codemirror/state',
	'@codemirror/view',
	'@lezer/common',
	'@lezer/highlight',
	'@lezer/lr',
];

const context = await esbuild.context({
	banner: { js: banner },
	entryPoints: ['src/main.ts'],
	bundle: true,
	external,
	format: 'cjs',
	target: 'es2018',
	platform: 'browser',
	logLevel: 'info',
	sourcemap: production ? false : 'inline',
	treeShaking: true,
	minify: production,
	outfile,
	// Svelte 5 (B1-2 = А, DL-261): компоненты компилируются в обычный JS и
	// упаковываются в тот же main.js (runtime-зависимостей ноль; стили —
	// css: 'injected', отдельный файл стилей не нужен).
	plugins: [
		esbuildSvelte({
			preprocess: sveltePreprocess(),
			compilerOptions: { css: 'injected' },
		}),
	],
	resolveExtensions: ['.svelte', '.ts', '.mjs', '.js', '.json'],
});

if (production) {
	await context.rebuild();
	await context.dispose();
	console.info(`[second-brain] сборка завершена → ${outfile}`);
} else {
	await context.watch();
	console.info(`[second-brain] watch-режим: пересборка при изменении src/ → ${outfile}`);
	if (!vaultPath) {
		console.info('[second-brain] SB_VAULT_PATH не задан — main.js пишется в папку plugin/.');
		console.info('[second-brain] Как связать с хранилищем: docs/plugin/dev-setup.md');
	}
}
