/**
 * Команда show-log — окно журнала плагина (модуль log-viewer, слой 5; DL-251).
 *
 * Возможности: фильтр по уровню, последние 300 записей (буфер в памяти — он
 * включает хвост файла, загруженный при старте плагина), **живой режим (live)**:
 * подписка на события журнала — новые строки добавляются на лету, и кнопка
 * «Очистить журнал».
 */

import { Modal, Setting } from 'obsidian';
import { LOG_LEVELS, type ActivityLog, type LogEntry, type LogLevel } from '../core/activity-log';
import type { PluginContext } from './context';

const LEVEL_BADGE: Record<LogLevel, string> = {
	error: '✖',
	warning: '⚠',
	info: '•',
	debug: '…',
};

const LEVEL_TITLES: Record<LogLevel | 'all', string> = {
	all: 'Все уровни',
	error: 'Ошибки (error)',
	warning: 'Предупреждения (warning)',
	info: 'Сообщения (info)',
	debug: 'Отладка (debug)',
};

const MAX_RENDERED = 500;

class LogViewerModal extends Modal {
	private levelFilter: LogLevel | 'all' = 'all';
	private live = false;
	private unsubscribe: (() => void) | null = null;
	private listEl: HTMLElement | null = null;
	private statusEl: HTMLElement | null = null;

	constructor(private readonly context: PluginContext) {
		super(context.app);
	}

	onOpen(): void {
		this.titleEl.setText('Журнал плагина Second Brain');

		new Setting(this.contentEl)
			.addDropdown((dropdown) => {
				dropdown.addOption('all', LEVEL_TITLES.all);
				for (const level of LOG_LEVELS) {
					dropdown.addOption(level, LEVEL_TITLES[level]);
				}
				dropdown.setValue(this.levelFilter).onChange((value) => {
					this.levelFilter = value === 'all' ? 'all' : (value as LogLevel);
					this.renderEntries();
				});
			})
			.addButton((button) =>
				button.setButtonText('Живой режим: выкл').onClick(() => {
					this.toggleLive(button);
				}),
			)
			.addButton((button) =>
				button
					.setButtonText('Очистить')
					.setWarning()
					.onClick(async () => {
						await this.context.logger.clear();
						this.renderEntries();
					}),
			);

		this.statusEl = this.contentEl.createEl('div', { cls: 'setting-item-description' });
		this.listEl = this.contentEl.createEl('div');
		this.listEl.style.cssText = 'max-height: 55vh; overflow-y: auto; font-family: var(--font-monospace); font-size: 12px;';
		this.renderEntries();
	}

	onClose(): void {
		this.stopLive();
	}

	private toggleLive(button: import('obsidian').ButtonComponent): void {
		this.live = !this.live;
		button.setButtonText(this.live ? 'Живой режим: вкл' : 'Живой режим: выкл');
		if (this.live) {
			button.setCta();
			this.unsubscribe = this.context.logger.subscribe((entry) => {
				if (this.levelFilter === 'all' || entry.level === this.levelFilter) {
					this.appendEntry(entry);
				}
				this.updateStatus();
			});
		} else {
			this.stopLive();
		}
	}

	private stopLive(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
		this.live = false;
	}

	private renderEntries(): void {
		if (!this.listEl) {
			return;
		}
		this.listEl.empty();
		const entries = this.context.logger.tail(MAX_RENDERED, this.levelFilter === 'all' ? undefined : this.levelFilter);
		for (const entry of entries) {
			this.appendEntry(entry);
		}
		this.updateStatus();
	}

	private appendEntry(entry: LogEntry): void {
		if (!this.listEl) {
			return;
		}
		const line = this.listEl.createEl('div');
		line.style.cssText = 'padding: 1px 0; border-bottom: 1px solid var(--background-modifier-border);';
		line.createSpan({ text: `${LEVEL_BADGE[entry.level]} [${entry.ts}] ` });
		line.createSpan({ text: `${entry.area}: ${entry.message}` });
		if (entry.data !== undefined) {
			line.createEl('small', { text: ` ${JSON.stringify(entry.data)}` });
		}
		// Держим число отрисованных строк под контролем (защита от тормозов, риск-таблица CHECKPOINT §10).
		while (this.listEl.childElementCount > MAX_RENDERED) {
			this.listEl.removeChild(this.listEl.firstElementChild as HTMLElement);
		}
		this.listEl.scrollTop = this.listEl.scrollHeight;
	}

	private updateStatus(): void {
		if (!this.statusEl) {
			return;
		}
		const total = this.context.logger.tail(100000).length;
		this.statusEl.setText(
			`Показано последних ${Math.min(total, MAX_RENDERED)} из ${total} (буфер памяти); файл: .sb/logs/plugin-log.jsonl${this.live ? ' · ЖИВОЙ РЕЖИМ' : ''}`,
		);
	}
}

export function registerShowLogCommand(context: PluginContext, addCommand: (cmd: { id: string; name: string; callback: () => void }) => void): void {
	addCommand({
		id: 'show-log',
		name: 'Показать журнал плагина (show-log)',
		callback: () => {
			new LogViewerModal(context).open();
		},
	});
}
