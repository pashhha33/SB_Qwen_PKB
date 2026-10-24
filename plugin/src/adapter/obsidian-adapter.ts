/**
 * ObsidianVaultAdapter — ПРОДОВАЯ реализация VaultAdapter (слой 0, модуль
 * obsidian-adapter): тонкая обёртка над API Obsidian, без собственной логики.
 *
 * Зачем тонкая: ADR-003 требует изоляции от API Obsidian — если обновление
 * приложения что-то сломает, правка будет в одном файле. Ядро импортирует
 * только интерфейс (adapter/vault-adapter.ts), поэтому этот файл — один из двух,
 * которым разрешено импортировать 'obsidian' (второй — main.ts; проверяется
 * тестом layering).
 *
 * Что использует из API (проверено по obsidian.d.ts 1.14.x):
 *   app.vault.*          — файлы и папки хранилища (create/read/modify/rename/delete…);
 *   app.fileManager.processFrontMatter — правка frontmatter без перезаписи тела
 *                          (ВНИМАНИЕ: в текущем API метод живёт на fileManager, не на vault);
 *   parseYaml/stringifyYaml — экспортируемые функции Obsidian: YAML разбирает САМО
 *                          приложение (норма ADR-002: не самописным разбором);
 *   app.vault.adapter.*  — низкоуровневый доступ к файлам: только он видит dot-папки,
 *                          поэтому служебная область .sb/ (ADR-002/010) идёт через него.
 *
 * Тестов у этого файла нет осознанно (правило М4 формально требует тесты на модуль;
 * для тонкой обёртки автотесты означали бы мокирование самого Obsidian — ценность
 * нулевая). Замена: (1) контракт-тесты интерфейса прогоняются на FakeVault
 * (tests/integration/adapter-contract.test.ts) — прод-реализация обязана вести
 * себя так же; (2) ручная проверка в реальном хранилище — чек-боксы DoD этапа A
 * (phases.md §4). Отклонение от М4 зафиксировать в decision log (DL-244, примечание).
 */

import { App, TFile, TFolder, normalizePath, parseYaml, stringifyYaml } from 'obsidian';
import { SbError } from '../core/errors';
import type { SbListResult, VaultAdapter } from './vault-adapter';

export class ObsidianVaultAdapter implements VaultAdapter {
	constructor(private readonly app: App) {}

	private get vault() {
		return this.app.vault;
	}

	/** TFile по пути или ошибка file_not_found. */
	private requireFile(path: string): TFile {
		const entry = this.vault.getAbstractFileByPath(normalizePath(path));
		if (!(entry instanceof TFile)) {
			throw new SbError('file_not_found', `Файл не найден: ${path}`);
		}
		return entry;
	}

	async exists(path: string): Promise<boolean> {
		return this.vault.getAbstractFileByPath(normalizePath(path)) !== null;
	}

	async read(path: string): Promise<string> {
		return this.vault.read(this.requireFile(path));
	}

	async create(path: string, content: string): Promise<void> {
		await this.vault.create(normalizePath(path), content);
	}

	async modify(path: string, content: string): Promise<void> {
		await this.vault.modify(this.requireFile(path), content);
	}

	async rename(oldPath: string, newPath: string): Promise<void> {
		const file = this.requireFile(oldPath);
		// vault.rename сам обновляет ссылки на файл во всём хранилище (важно для
		// И2-починки имени и создания объекта из пустой ссылки — раздел 12).
		await this.vault.rename(file, normalizePath(newPath));
	}

	async remove(path: string): Promise<void> {
		const entry = this.vault.getAbstractFileByPath(normalizePath(path));
		if (entry === null) {
			throw new SbError('file_not_found', `Файл не найден: ${path}`);
		}
		await this.vault.delete(entry);
	}

	async createFolder(path: string): Promise<void> {
		const normalized = normalizePath(path);
		if (this.vault.getAbstractFileByPath(normalized) !== null) {
			return; // уже есть — идемпотентно
		}
		await this.vault.createFolder(normalized);
	}

	async listMarkdown(): Promise<string[]> {
		// getMarkdownFiles() не включает dot-папки (.sb/) — поведение Obsidian штатное.
		return this.vault.getMarkdownFiles().map((file) => file.path);
	}

	async listFolder(folder: string): Promise<SbListResult> {
		const listed = await this.vault.adapter.list(normalizePath(folder));
		return { files: listed.files, folders: listed.folders };
	}

	async processFrontMatter(
		path: string,
		fn: (frontmatter: Record<string, unknown>) => void,
	): Promise<void> {
		const file = this.requireFile(path);
		// Метод на fileManager (проверено по obsidian.d.ts 1.14.x): правит только
		// YAML-блок, тело и переводы строк сохраняет Obsidian.
		await this.app.fileManager.processFrontMatter(file, fn);
	}

	parseYaml(text: string): unknown {
		return parseYaml(text);
	}

	stringifyYaml(value: unknown): string {
		return stringifyYaml(value);
	}

	// ---- Служебная область .sb/ (dot-папка: vault.* её не видит, adapter.* — видит) ----

	private get data() {
		return this.vault.adapter;
	}

	async dataExists(path: string): Promise<boolean> {
		return this.data.exists(normalizePath(path));
	}

	async dataRead(path: string): Promise<string> {
		return this.data.read(normalizePath(path));
	}

	async dataWrite(path: string, content: string): Promise<void> {
		// ADR-010 M3: атомарная запись — ответственность сервисов .sb/ (этап C,
		// relation-store); здесь базовая запись через DataAdapter.write
		// (Obsidian сам пишет через временный файл).
		await this.data.write(normalizePath(path), content);
	}

	async dataRemove(path: string): Promise<void> {
		await this.data.remove(normalizePath(path));
	}

	async dataCreateFolder(path: string): Promise<void> {
		const normalized = normalizePath(path);
		if (await this.data.exists(normalized)) {
			return;
		}
		await this.data.mkdir(normalized);
	}

	async dataList(folder: string): Promise<SbListResult> {
		const listed = await this.data.list(normalizePath(folder));
		return { files: listed.files, folders: listed.folders };
	}

	/** Утилита для команд этапа A2: папка существует и это папка. */
	folderExists(path: string): boolean {
		return this.vault.getAbstractFileByPath(normalizePath(path)) instanceof TFolder;
	}
}
