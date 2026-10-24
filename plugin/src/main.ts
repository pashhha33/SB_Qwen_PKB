/**
 * Second Brain — точка входа плагина Obsidian.
 *
 * Этап A, под-батч A2 (части 1+2) + журнализация (A2.5, DL-251) + фикс 0.3.2:
 *   - БУТСТРАП Metamodel/ (A2 часть 2, DL-250/257): при загрузке плагин создаёт
 *     отсутствующие определения 7 системных типов (F5-9 = А — фиксированные ULID,
 *     F5-10 = Б — 7 OBJECT_TYPE-заметок); идемпотентен по существованию файлов;
 *   - реестр типов из Metamodel/ + кэш .sb/cache/registry.json;
 *   - LabelResolver (режим из настроек);
 *   - ЖУРНАЛ: .sb/logs/plugin-log.jsonl + настройки .sb/settings.json (ADR-002:
 *     настройки в .sb/, не в data.json); уровни error/warning/info/debug с
 *     выключателями; команда show-log — окно журнала с живым режимом (live);
 *   - 0.3.2 (DL-255): dataWrite прод-адаптера создаёт родительские папки .sb/ —
 *     DataAdapter.write сам этого не делает, из-за чего кэш реестра и файл
 *     журнала не записывались в свежем хранилище («не удалось сохранить кэш»);
 *   - 0.3.2 (DL-256): копирование журнала в буфер обмена — кнопка «Скопировать»
 *     в окне show-log (копирует видимое) + команда copy-log (копирует весь буфер);
 *   - команды: create-object-type, create-object, validate-object, show-log,
 *     copy-log (тонкие обёртки над ядром — DL-244/9.5).
 * Дальше — A3: D2 (генератор TS-типов из схем + тест свежести, конструкция DL-222)
 * и front-matter-title-adapter; закрытие DoD этапа A (phases.md §4).
 *
 * Архитектура: 'obsidian' импортируют только main.ts, adapter/obsidian-adapter.ts,
 * commands/* и ui/* (слои 4–5); ядро (core/**) — среда-независимо (правило М2,
 * тест tests/integration/layering.test.ts).
 */

import { Notice, Plugin } from 'obsidian';
import { ObsidianVaultAdapter } from './adapter/obsidian-adapter';
import { registerCopyLogCommand } from './commands/copy-log';
import { registerCreateObjectCommand } from './commands/create-object';
import { registerCreateObjectTypeCommand } from './commands/create-object-type';
import type { PluginContext } from './commands/context';
import { registerShowLogCommand } from './commands/show-log';
import { registerValidateObjectCommand } from './commands/validate-object';
import { ActivityLog } from './core/activity-log';
import { bootstrapMetamodel } from './core/bootstrap';
import { LabelResolver } from './core/label-resolver';
import { TypeRegistry } from './core/registry';
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

		// Бутстрап — ДО чтения реестра: в свежем хранилище появляются 7 системных типов.
		const bootstrap = await bootstrapMetamodel(this.adapter, (level, area, message, data) =>
			this.logger.log(level, area, message, data),
		);
		if (bootstrap.created.length > 0 || bootstrap.failed.length > 0) {
			new Notice(
				`Second Brain: бутстрап Metamodel/ — создано ${bootstrap.created.length}, ` +
					`уже было ${bootstrap.skipped.length}, ошибок ${bootstrap.failed.length}`,
			);
		}

		this.registry = await this.reloadRegistry();
		this.labels = new LabelResolver(this.registry);
		this.labels.setMode(this.settings.labelMode);

		// Команды получают сам плагин как контекст (он реализует PluginContext).
		registerCreateObjectTypeCommand(this, (cmd) => this.addCommand(cmd));
		registerCreateObjectCommand(this, (cmd) => this.addCommand(cmd));
		registerValidateObjectCommand(this, (cmd) => this.addCommand(cmd));
		registerShowLogCommand(this, (cmd) => this.addCommand(cmd));
		registerCopyLogCommand(this, (cmd) => this.addCommand(cmd));

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
			// После бутстрапа это аномалия: либо определения не создались (см. ошибки
			// бутстрапа в журнале), либо Metamodel/ не читается.
			this.logger.log('warning', 'bootstrap', 'После бутстрапа в реестре 0 типов — проверьте папку Metamodel/ и журнал (show-log)');
			console.info(`[second-brain] ${this.manifest.version} loaded; реестр пуст после бутстрапа — см. журнал`);
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
