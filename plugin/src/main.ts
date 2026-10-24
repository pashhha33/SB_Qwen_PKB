/**
 * Second Brain — точка входа плагина Obsidian.
 *
 * Этап A, под-батч A2 (часть 1) + журнализация (A2.5, DL-251):
 *   - реестр типов из Metamodel/ + кэш .sb/cache/registry.json;
 *   - LabelResolver (режим из настроек);
 *   - ЖУРНАЛ: .sb/logs/plugin-log.jsonl + настройки .sb/settings.json (ADR-002:
 *     настройки в .sb/, не в data.json); уровни error/warning/info/debug с
 *     выключателями; команда show-log — окно журнала с живым режимом (live);
 *   - команды: create-object-type, create-object, validate-object, show-log
 *     (тонкие обёртки над ядром — DL-244/9.5).
 * Бутстрап Metamodel/ (7 системных типов) — часть 2 под-батча A2: все решения
 * приняты — F5-7 = А (префиксы: '_' и 3–20 легализованы, DL-253), F5-9 = А
 * (фиксированные ULID), F5-10 = Б (7 OBJECT_TYPE-заметок, DL-250); следующий батч.
 *
 * Архитектура: 'obsidian' импортируют только main.ts, adapter/obsidian-adapter.ts,
 * commands/* и ui/* (слои 4–5); ядро (core/**) — среда-независимо (правило М2,
 * тест tests/integration/layering.test.ts).
 */

import { Notice, Plugin } from 'obsidian';
import { ObsidianVaultAdapter } from './adapter/obsidian-adapter';
import { registerCreateObjectCommand } from './commands/create-object';
import { registerCreateObjectTypeCommand } from './commands/create-object-type';
import type { PluginContext } from './commands/context';
import { registerShowLogCommand } from './commands/show-log';
import { registerValidateObjectCommand } from './commands/validate-object';
import { ActivityLog } from './core/activity-log';
import { LabelResolver } from './core/label-resolver';
import { METAMODEL_FOLDER, TypeRegistry } from './core/registry';
import { loadSettings, saveSettings as persistSettings, type PluginSettings } from './core/settings';
import { SecondBrainSettingTab, type SettingsHost } from './ui/settings-tab';

export default class SecondBrainPlugin extends Plugin implements PluginContext, SettingsHost {
	/** Единственный мост к API Obsidian для всего плагина (слой 0). */
	adapter!: ObsidianVaultAdapter;
	registry!: TypeRegistry;
	labels!: LabelResolver;
	logger!: ActivityLog;
	settings!: PluginSettings;

	async onload(): Promise<void> {
		this.adapter = new ObsidianVaultAdapter(this.app);

		// Настройки — из .sb/settings.json (ADR-002), журнал — следом (уровни из настроек).
		this.settings = await loadSettings(this.adapter);
		this.logger = new ActivityLog(this.adapter, this.settings.logging);
		await this.logger.init();

		this.registry = await this.reloadRegistry();
		this.labels = new LabelResolver(this.registry);
		this.labels.setMode(this.settings.labelMode);

		// Команды получают сам плагин как контекст (он реализует PluginContext).
		registerCreateObjectTypeCommand(this, (cmd) => this.addCommand(cmd));
		registerCreateObjectCommand(this, (cmd) => this.addCommand(cmd));
		registerValidateObjectCommand(this, (cmd) => this.addCommand(cmd));
		registerShowLogCommand(this, (cmd) => this.addCommand(cmd));

		// Настройки (первая инкарнация settings-ui; полный модуль — этап E).
		this.addSettingTab(new SecondBrainSettingTab(this.app, this));

		const typesCount = this.registry.types.length;
		this.logger.log('info', 'plugin', `Плагин загружен (версия ${this.manifest.version})`, {
			types: typesCount,
			properties: this.registry.properties.length,
			issues: this.registry.issues.length,
		});
		for (const issue of this.registry.issues) {
			this.logger.log('warning', 'registry', `Проблема определения: ${issue.message}`, {
				path: issue.path,
				code: issue.code,
			});
		}
		if (typesCount === 0) {
			console.info(
				`[second-brain] ${this.manifest.version} loaded; ${METAMODEL_FOLDER}/ пуста — реестр пуст (бутстрап появится в A2-части 2)`,
			);
		}
		new Notice(`Second Brain ${this.manifest.version}: загружен (типов в реестре: ${typesCount})`);
	}

	async onunload(): Promise<void> {
		// Успеть сбросить накопленные записи журнала до выгрузки.
		try {
			await this.logger?.flush();
		} catch {
			// выгрузка не должна падать из-за журнала
		}
		console.info('[second-brain] unloaded');
	}

	/** Перечитать реестр из заметок (источник истины — Markdown, ADR-002) и сохранить кэш. */
	async reloadRegistry(): Promise<TypeRegistry> {
		const registry = await TypeRegistry.load(this.adapter);
		this.registry = registry;
		try {
			await registry.saveCache(this.adapter, new Date().toISOString());
			this.logger?.log('debug', 'registry', 'Реестр перечитан из Metamodel/, кэш сохранён', {
				types: registry.types.length,
				properties: registry.properties.length,
				issues: registry.issues.length,
			});
		} catch (error) {
			// Кэш — не источник истины (М5): сбой записи не ломает загрузку.
			this.logger?.log('warning', 'cache', `Не удалось сохранить кэш реестра: ${String(error)}`);
			console.warn('[second-brain] не удалось сохранить кэш реестра:', error);
		}
		return registry;
	}

	/** Сохранить настройки (ADR-002: .sb/settings.json). */
	async saveSettings(): Promise<void> {
		await persistSettings(this.adapter, this.settings);
		this.logger?.log('debug', 'settings', 'Настройки сохранены в .sb/settings.json');
	}
}
