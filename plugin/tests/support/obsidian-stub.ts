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

/**
 * Стаб SuggestModal: воспроизводит ПОРЯДОК вызовов настоящего Obsidian — это и
 * есть контракт, который проверяют тесты `link-picker-modal.test.ts` (DL-274).
 *
 * В Obsidian `selectSuggestion()` сначала вызывает `close()` (тот синхронно
 * дёргает `onClose()`), и только ПОТОМ `onChooseSuggestion()`. Именно на этом
 * вырос дефект 0.9.0: немедленный «отказ» (resolve(null)) в onClose «съедал»
 * выбор — клик по кандидату не вставлял ссылку в поле формы.
 *
 * `stubCalls` — журнал вызовов ('open'/'close'/'choose'): тесты фиксируют порядок
 * как контракт. Если Obsidian порядок поменяет — фикс остаётся корректным
 * (отложенный отказ от порядка не зависит), а стаб обновляется по факту.
 */
export class SuggestModal<T> {
	/** Журнал вызовов для контракт-тестов: 'open' | 'close' | 'choose'. */
	readonly stubCalls: string[] = [];
	emptyStateText = '';
	limit = 100;

	constructor(readonly app: unknown) {}

	setPlaceholder(_placeholder: string): void {}

	open(): void {
		this.stubCalls.push('open');
	}

	/** Как Modal.close(): синхронно вызывает onClose(). */
	close(): void {
		this.stubCalls.push('close');
		this.onClose();
	}

	/** Как SuggestModal.selectSuggestion() в Obsidian: close() РАНЬШЕ onChooseSuggestion(). */
	selectSuggestion(value: T): void {
		this.close();
		this.stubCalls.push('choose');
		this.onChooseSuggestion(value);
	}

	onClose(): void {}

	getSuggestions(_query: string): T[] | Promise<T[]> {
		return [];
	}

	renderSuggestion(_value: T, _el: unknown): void {}

	onChooseSuggestion(_item: T): void {}
}
