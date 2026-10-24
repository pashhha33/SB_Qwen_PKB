/**
 * FakeVault — тестовая реализация VaultAdapter (решение DL-244 / вопрос 9.3 = А).
 *
 * Что это: «поддельное хранилище» — настоящая папка во временном каталоге ОС,
 * к которой реализован тот же интерфейс, что и у ObsidianVaultAdapter. Тесты
 * проверяют ядро плагина (парсер, identity, будущие bootstrap и команды) БЕЗ
 * запуска Obsidian — офлайн, детерминированно, быстро.
 *
 * Почему настоящая папка, а не память: операции rename/create/remove ведут себя
 * как файловая система (пути, вложенность, Windows-переводы строк), и найденное
 * в тестах переносится на реальный vault без сюрпризов.
 *
 * Поведение намеренно повторяет семантику Obsidian:
 *   - create() на существующий файл — ошибка (как vault.create);
 *   - listMarkdown() не заходит в dot-папки (Obsidian их не индексирует);
 *   - processFrontMatter() меняет ТОЛЬКО YAML-блок, тело сохраняет байт-в-байт;
 *   - parseYaml/stringifyYaml — js-yaml 4.x (та же библиотека и версия, что
 *     в корневом прогонщике примеров `npm run check`, — поведение разбора
 *     совпадает с проверенным на 72 примерах);
 *   - data* работают с dot-папками (.sb/).
 *
 * Контракт-тесты: tests/integration/adapter-contract.test.ts. Прод-реализация
 * обязана вести себя так же (расхождение = баг прод-реализации или контракта).
 */

import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import type { SbListResult, VaultAdapter } from '../../src/adapter/vault-adapter';
import { SbError } from '../../src/core/errors';
import { splitFrontmatter } from '../../src/core/markdown-parser';

export class FakeVault implements VaultAdapter {
	/** Корень «хранилища» во временном каталоге. */
	readonly root: string;

	private constructor(root: string) {
		this.root = root;
	}

	/** Создать FakeVault в свежей временной папке. Не забывать await vault.cleanup(). */
	static async create(): Promise<FakeVault> {
		const root = await fs.mkdtemp(path.join(tmpdir(), 'sb-fake-vault-'));
		return new FakeVault(root);
	}

	/** Удалить временную папку со всем содержимым. */
	async cleanup(): Promise<void> {
		await fs.rm(this.root, { recursive: true, force: true });
	}

	/** Абсолютный путь по пути от «корня хранилища». */
	abs(relativePath: string): string {
		return path.join(this.root, ...relativePath.split('/').filter((part) => part !== ''));
	}

	/** Короткая запись файла в «хранилище» (создаёт промежуточные папки) — удобно в тестах. */
	async put(relativePath: string, content: string): Promise<void> {
		const abs = this.abs(relativePath);
		await fs.mkdir(path.dirname(abs), { recursive: true });
		await fs.writeFile(abs, content, 'utf8');
	}

	// ---- Файлы хранилища ----

	async exists(relativePath: string): Promise<boolean> {
		try {
			await fs.access(this.abs(relativePath));
			return true;
		} catch {
			return false;
		}
	}

	async read(relativePath: string): Promise<string> {
		try {
			return await fs.readFile(this.abs(relativePath), 'utf8');
		} catch {
			throw new SbError('file_not_found', `Файл не найден: ${relativePath}`);
		}
	}

	async create(relativePath: string, content: string): Promise<void> {
		if (await this.exists(relativePath)) {
			throw new SbError('file_exists', `Файл уже существует: ${relativePath}`);
		}
		const abs = this.abs(relativePath);
		await fs.mkdir(path.dirname(abs), { recursive: true });
		await fs.writeFile(abs, content, 'utf8');
	}

	async modify(relativePath: string, content: string): Promise<void> {
		if (!(await this.exists(relativePath))) {
			throw new SbError('file_not_found', `Файл не найден: ${relativePath}`);
		}
		await fs.writeFile(this.abs(relativePath), content, 'utf8');
	}

	async rename(oldPath: string, newPath: string): Promise<void> {
		if (!(await this.exists(oldPath))) {
			throw new SbError('file_not_found', `Файл не найден: ${oldPath}`);
		}
		const absNew = this.abs(newPath);
		await fs.mkdir(path.dirname(absNew), { recursive: true });
		await fs.rename(this.abs(oldPath), absNew);
	}

	async remove(relativePath: string): Promise<void> {
		if (!(await this.exists(relativePath))) {
			throw new SbError('file_not_found', `Файл не найден: ${relativePath}`);
		}
		await fs.rm(this.abs(relativePath));
	}

	async createFolder(relativePath: string): Promise<void> {
		await fs.mkdir(this.abs(relativePath), { recursive: true });
	}

	async listMarkdown(): Promise<string[]> {
		const results: string[] = [];
		const walk = async (dirAbs: string, dirRel: string): Promise<void> => {
			const entries = await fs.readdir(dirAbs, { withFileTypes: true });
			for (const entry of entries) {
				const rel = dirRel === '' ? entry.name : `${dirRel}/${entry.name}`;
				if (entry.isDirectory()) {
					// Obsidian не индексирует dot-папки (.sb/, .obsidian/, .trash/).
					if (!entry.name.startsWith('.')) {
						await walk(path.join(dirAbs, entry.name), rel);
					}
				} else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
					results.push(rel);
				}
			}
		};
		await walk(this.root, '');
		return results.sort();
	}

	async listFolder(folder: string): Promise<SbListResult> {
		const abs = this.abs(folder);
		try {
			const entries = await fs.readdir(abs, { withFileTypes: true });
			const files: string[] = [];
			const folders: string[] = [];
			for (const entry of entries) {
				const rel = folder === '' ? entry.name : `${folder}/${entry.name}`;
				if (entry.isDirectory()) {
					folders.push(rel);
				} else {
					files.push(rel);
				}
			}
			return { files: files.sort(), folders: folders.sort() };
		} catch {
			throw new SbError('file_not_found', `Папка не найдена: ${folder}`);
		}
	}

	async processFrontMatter(
		relativePath: string,
		fn: (frontmatter: Record<string, unknown>) => void,
	): Promise<void> {
		const raw = await this.read(relativePath);
		const normalized = raw.replace(/\r\n?/g, '\n');
		const { frontmatterText, body } = splitFrontmatter(normalized);
		const frontmatter: Record<string, unknown> =
			frontmatterText === null ? {} : ((yaml.load(frontmatterText) ?? {}) as Record<string, unknown>);
		fn(frontmatter);
		const yamlText = yaml.dump(frontmatter, { lineWidth: -1, noRefs: true }).replace(/\n$/, '');
		await this.modify(relativePath, `---\n${yamlText}\n---\n${body.replace(/^\n/, '')}`);
	}

	// ---- YAML (в Obsidian это делают parseYaml/stringifyYaml приложения) ----

	parseYaml(text: string): unknown {
		return yaml.load(text);
	}

	stringifyYaml(value: unknown): string {
		return yaml.dump(value, { lineWidth: -1, noRefs: true });
	}

	// ---- Служебная область .sb/ ----

	async dataExists(relativePath: string): Promise<boolean> {
		return this.exists(relativePath);
	}

	async dataRead(relativePath: string): Promise<string> {
		return this.read(relativePath);
	}

	async dataWrite(relativePath: string, content: string): Promise<void> {
		const abs = this.abs(relativePath);
		await fs.mkdir(path.dirname(abs), { recursive: true });
		await fs.writeFile(abs, content, 'utf8');
	}

	async dataRemove(relativePath: string): Promise<void> {
		await fs.rm(this.abs(relativePath), { force: true });
	}

	async dataCreateFolder(relativePath: string): Promise<void> {
		await fs.mkdir(this.abs(relativePath), { recursive: true });
	}

	async dataList(folder: string): Promise<SbListResult> {
		return this.listFolder(folder);
	}
}
