/**
 * VaultAdapter — интерфейс-«розетка» между ядром плагина и внешним миром (слой 0).
 *
 * Зачем: ядро (парсер, identity, реестр типов) не знает, работает оно внутри Obsidian
 * или в тестах. В проде интерфейс реализует ObsidianVaultAdapter (тонкая обёртка над
 * API Obsidian, ADR-003 — изоляция от API), в тестах — FakeVault (реальная папка
 * во временном каталоге, решение DL-244 / вопрос 9.3 = А).
 *
 * Правило слоёв (09-modules §3): модули ядра зависят ТОЛЬКО от этого интерфейса.
 * Импорт 'obsidian' разрешён лишь в adapter/obsidian-adapter.ts и main.ts
 * (проверяется тестом tests/integration/layering.test.ts).
 *
 * Важная норма (ADR-002): чтение и сериализация YAML — только через реализацию
 * «хозяина» среды (в Obsidian — его собственный parseYaml/stringifyYaml),
 * не самописным разбором. Поэтому parseYaml/stringifyYaml — часть интерфейса.
 */

/** Что лежит по пути: файл или папка. */
export type SbEntryKind = 'file' | 'folder';

export interface SbListResult {
	files: string[];
	folders: string[];
}

export interface VaultAdapter {
	// ---- Файлы хранилища (Markdown-заметки, обычные папки) ----

	/** Существует ли файл/папка по пути (относительно корня хранилища). */
	exists(path: string): Promise<boolean>;

	/** Прочитать текстовый файл целиком (UTF-8). */
	read(path: string): Promise<string>;

	/** Создать новый файл. Если файл уже есть — ошибка (как vault.create в Obsidian). */
	create(path: string, content: string): Promise<void>;

	/** Перезаписать содержимое существующего файла. */
	modify(path: string, content: string): Promise<void>;

	/** Переименовать/переместить файл. Obsidian при этом сам правит ссылки на него. */
	rename(oldPath: string, newPath: string): Promise<void>;

	/** Удалить файл. */
	remove(path: string): Promise<void>;

	/** Создать папку (включая промежуточные). */
	createFolder(path: string): Promise<void>;

	/** Все Markdown-файлы хранилища (пути от корня). Папки с точкой (.sb/) не входят — Obsidian их не индексирует. */
	listMarkdown(): Promise<string[]>;

	/** Содержимое папки: файлы и подпапки (имена путей от корня хранилища). */
	listFolder(folder: string): Promise<SbListResult>;

	/**
	 * Изменить только frontmatter заметки, не трогая тело (аналог vault.processFrontMatter).
	 * fn получает объект frontmatter и правит его на месте (добавляет/изменяет ключи).
	 */
	processFrontMatter(path: string, fn: (frontmatter: Record<string, unknown>) => void): Promise<void>;

	// ---- YAML (ADR-002: только через реализацию среды) ----

	/** Разобрать YAML-текст в значение JS. Ошибку не бросает — см. parseYamlSafe у парсера. */
	parseYaml(text: string): unknown;

	/** Сериализовать значение JS в YAML-текст. */
	stringifyYaml(value: unknown): string;

	// ---- Служебная область .sb/ (ADR-002, ADR-010: dot-папки недоступны vault.*, только низкоуровневому adapter.*) ----

	dataExists(path: string): Promise<boolean>;
	dataRead(path: string): Promise<string>;
	/** Записать файл служебной области. КОНТРАКТ (DL-255): создаёт родительские папки, если их нет (Obsidian DataAdapter.write сам этого не делает — см. obsidian-adapter). */
	dataWrite(path: string, content: string): Promise<void>;
	dataRemove(path: string): Promise<void>;
	dataCreateFolder(path: string): Promise<void>;
	dataList(folder: string): Promise<SbListResult>;
}
