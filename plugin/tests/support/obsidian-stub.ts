/**
 * Стаб модуля 'obsidian' для тестов (алиас в vitest.config.ts).
 *
 * Реальный npm-пакет 'obsidian' содержит только типы ("main": "") — в рантайме
 * импортировать нечего: настоящий модуль инъектируется приложением при загрузке
 * плагина. Для юнит-теста ObsidianVaultAdapter (контракт DL-255) достаточно
 * минимальной рантайм-поверхности, которую использует файл адаптера:
 * классы TFile/TFolder (проверки instanceof) и функции normalizePath /
 * parseYaml / stringifyYaml. Поведение нарочно примитивное: vault в тесте
 * подменяется собственным фейком, задача стаба — дать модулю загрузиться.
 *
 * На типы это не влияет: tsc берёт их из настоящего obsidian.d.ts,
 * а esbuild помечает 'obsidian' как external (сборка стаб не видит).
 */

export class TFile {
	path = '';
	name = '';
	basename = '';
	extension = 'md';
	stat = { ctime: 0, mtime: 0, size: 0 };
}

export class TFolder {
	path = '';
	name = '';
	children: unknown[] = [];
}

/** Достаточно близко к normalizePath Obsidian для тестов: обратные слэши, дубли, края. */
export function normalizePath(path: string): string {
	return path
		.replace(/\\/g, '/')
		.replace(/\/{2,}/g, '/')
		.replace(/^\/+|\/+$/g, '');
}

export function parseYaml(_text: string): unknown {
	throw new Error('obsidian-stub: parseYaml не реализован (тесты разбирают YAML через FakeVault)');
}

export function stringifyYaml(_value: unknown): string {
	throw new Error('obsidian-stub: stringifyYaml не реализован');
}
