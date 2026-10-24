/**
 * Вкладка настроек плагина (первая инкарнация модуля settings-ui; слой 5).
 *
 * Хранение настроек — .sb/settings.json (норма ADR-002, НЕ data.json): см.
 * core/settings.ts. Здесь только vanilla-UI (Setting API Obsidian): выключатели
 * журнала по уровням (требование пользователя, DL-251), лимит строк, выключатель
 * «писать результаты проверок», кнопка очистки журнала.
 */

import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { LOG_LEVELS, type ActivityLog, type LogLevel } from '../core/activity-log';
import type { PluginSettings } from '../core/settings';

const LEVEL_LABELS: Record<LogLevel, string> = {
	error: 'Ошибки (error)',
	warning: 'Предупреждения (warning)',
	info: 'Сообщения (info)',
	debug: 'Отладка (debug)',
};

const LEVEL_DESCRIPTIONS: Record<LogLevel, string> = {
	error: 'Действие не выполнилось или данные под угрозой',
	warning: 'Выполнено, но есть повод обратить внимание',
	info: 'Обычные действия: создано, загружено, проверено',
	debug: 'Технические детали для разработчика (многословно)',
};

export interface SettingsHost {
	app: App;
	settings: PluginSettings;
	logger: ActivityLog;
	saveSettings(): Promise<void>;
}

export class SecondBrainSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly host: SettingsHost & Plugin) {
		super(app, host);
	}

	display(): void {
		this.containerEl.empty();
		this.containerEl.createEl('h2', { text: 'Second Brain — настройки' });

		// ---- Журнал ----
		this.containerEl.createEl('h3', { text: 'Журнал плагина' });
		new Setting(this.containerEl)
			.setName('Вести журнал')
			.setDesc(`Записывать события плагина в .sb/logs/plugin-log.jsonl. Просмотр — команда «Показать журнал плагина» (show-log)`)
			.addToggle((toggle) =>
				toggle.setValue(this.host.settings.logging.enabled).onChange(async (value) => {
					this.host.settings.logging.enabled = value;
					await this.host.saveSettings();
					this.display(); // уровни имеют смысл только при включённом журнале
				}),
			);

		if (this.host.settings.logging.enabled) {
			for (const level of LOG_LEVELS) {
				new Setting(this.containerEl)
					.setName(LEVEL_LABELS[level])
					.setDesc(LEVEL_DESCRIPTIONS[level])
					.addToggle((toggle) =>
						toggle.setValue(this.host.settings.logging.levels[level]).onChange(async (value) => {
							this.host.settings.logging.levels[level] = value;
							this.host.logger.settings.levels[level] = value;
							await this.host.saveSettings();
						}),
					);
			}

			new Setting(this.containerEl)
				.setName('Писать результаты проверок')
				.setDesc('validate-object: итог проверки (число ошибок и предупреждений) попадает в журнал')
				.addToggle((toggle) =>
					toggle.setValue(this.host.settings.logging.logValidation).onChange(async (value) => {
						this.host.settings.logging.logValidation = value;
						await this.host.saveSettings();
					}),
				);

			new Setting(this.containerEl)
				.setName('Лимит строк журнала')
				.setDesc('Файл обрезается по хвосту: последние N записей (100–50000)')
				.addText((text) =>
					text.setValue(String(this.host.settings.logging.maxLines)).onChange(async (value) => {
						const parsed = Number.parseInt(value, 10);
						if (Number.isFinite(parsed) && parsed >= 100 && parsed <= 50000) {
							this.host.settings.logging.maxLines = parsed;
							this.host.logger.settings.maxLines = parsed;
							await this.host.saveSettings();
						}
					}),
				);

			new Setting(this.containerEl)
				.setName('Очистить журнал')
				.setDesc('Удаляет содержимое .sb/logs/plugin-log.jsonl и буфер в памяти')
				.addButton((button) =>
					button.setButtonText('Очистить').setWarning().onClick(async () => {
						await this.host.logger.clear();
						new Notice('Журнал очищен');
					}),
				);
		}

		// ---- Подписи ----
		this.containerEl.createEl('h3', { text: 'Подписи (ADR-003)' });
		new Setting(this.containerEl)
			.setName('Режим подписей')
			.setDesc('view — русские подписи из определений; source — технические ключи (команда toggle-label-mode появится на этапе B)')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('view', 'view — подписи')
					.addOption('source', 'source — ключи')
					.setValue(this.host.settings.labelMode)
					.onChange(async (value) => {
						this.host.settings.labelMode = value === 'source' ? 'source' : 'view';
						await this.host.saveSettings();
					}),
			);
	}
}
