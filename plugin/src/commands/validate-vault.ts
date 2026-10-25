/**
 * Команда validate-vault (реестр команд MVP, mvp-scope §2.3): проверяет всё
 * хранилище (уровни 2–4, 6). B1.1 часть 2 (DL-261/266).
 *
 * Тонкая обёртка над core/validation.ts#validateVault: один общий индекс на
 * прогон, служебные метки и `sb_issues` обновляются (08-views §7), сводка —
 * Notice + окно (итоги, vault-диагностики, самые проблемные заметки) + запись
 * в журнал. Область прогона — заметки с признаком объекта Second Brain
 * (`id` или `type` во frontmatter); произвольные заметки не помечаются.
 */

import { Modal, Notice, TFile } from 'obsidian';
import { formatDiagnostic } from '../core/diagnostics';
import type { VaultValidationSummary } from '../core/validation';
import { validateVault } from '../core/validation';
import type { PluginContext } from './context';

class VaultSummaryModal extends Modal {
	constructor(context: PluginContext, private readonly summary: VaultValidationSummary) {
		super(context.app);
	}

	onOpen(): void {
		const s = this.summary;
		this.titleEl.setText('Проверка хранилища: сводка');

		const totals = this.contentEl.createEl('p');
		totals.createEl('strong', { text: `Проверено заметок: ${s.checked}` });
		totals.appendText(` · с проблемами: ${s.withIssues} · ошибок: ${s.errors} · предупреждений: ${s.warnings} · заметок: ${s.infos}`);
		this.contentEl.createEl('p', {
			text: `Служебные метки и «Проблемы» (sb_issues) обновлены у заметок: ${s.flagsWritten} (08-views §7).`,
		});

		if (s.vaultDiagnostics.length > 0) {
			this.contentEl.createEl('h4', { text: 'Хранилище в целом' });
			const list = this.contentEl.createEl('ul');
			for (const d of s.vaultDiagnostics) {
				const item = list.createEl('li');
				item.createEl('div', { text: formatDiagnostic(d) });
				item.createEl('small', { text: d.hint });
			}
		}

		if (s.worst.length === 0 && s.vaultDiagnostics.length === 0) {
			this.contentEl.createEl('p', { text: 'Нарушений не найдено — хранилище корректно (уровни 2–4, 6).' });
			return;
		}

		if (s.worst.length > 0) {
			this.contentEl.createEl('h4', { text: `Самые проблемные заметки (до 10 из ${s.withIssues})` });
			const list = this.contentEl.createEl('ul');
			for (const entry of s.worst) {
				const item = list.createEl('li');
				item.createEl('div', { text: entry.path });
				item.createEl('small', { text: `ошибок: ${entry.errors} · предупреждений: ${entry.warnings}` });
				const open = item.createEl('button', { text: 'Открыть' });
				open.addEventListener('click', () => {
					const file = this.app.vault.getAbstractFileByPath(entry.path);
					if (file instanceof TFile) {
						void this.app.workspace.getLeaf().openFile(file);
						this.close();
					}
				});
			}
			this.contentEl.createEl('p', {
				text: 'Подробности по заметке — команда «Проверить объект» (validate-object) на открытой заметке.',
			});
		}
	}
}

export function registerValidateVaultCommand(context: PluginContext, addCommand: (cmd: { id: string; name: string; callback: () => void }) => void): void {
	addCommand({
		id: 'validate-vault',
		name: 'Проверить хранилище (validate-vault)',
		callback: () => {
			void (async () => {
				try {
					const registry = await context.reloadRegistry();
					const summary = await validateVault(context.adapter, registry, context.labels, context.logger.fn);
					const headline = `Проверка хранилища: заметок ${summary.checked}, ошибок ${summary.errors}, предупреждений ${summary.warnings}`;
					new Notice(headline);
					if (summary.errors > 0 || summary.warnings > 0 || summary.vaultDiagnostics.length > 0) {
						new VaultSummaryModal(context, summary).open();
					}
				} catch (error) {
					context.logger.log('error', 'validation', `Проверка хранилища не выполнена: ${String(error)}`);
					new Notice(`Не удалось проверить хранилище: ${String(error)}`);
				}
			})();
		},
	});
}
