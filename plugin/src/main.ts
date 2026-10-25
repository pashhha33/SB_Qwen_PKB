/**
 * Second Brain — точка входа плагина Obsidian.
 *
 * Состояние (B1.1 часть 2, DL-266): этап A закрыт (каркас, реестр, бутстрап,
 * D2, front-matter-title-adapter); этап B — под-батч B1.1 «определения и
 * валидация» доставлен обеими частями:
 *   - часть 1 (0.6.0): schema-engine (группы правил B/C/G) + date-engine (H);
 *   - часть 2 (0.7.0): движок условных свойств applies-when (М1–М7), служебный
 *     слой диагностик service-flags (метки sb/* + свойство sb_issues, группа K),
 *     команда create-property (vanilla-модалка, ADR-004), команда validate-vault
 *     (общий индекс на прогон, сводка), правила группы E (object_type.*),
 *     правило П2 — date.all_unknown.optional_only (rules.md v0.14.0, DL-265);
 *   - бутстрап Metamodel/ сеёт 7 системных типов и служебное свойство sb_issues
 *     (B1-4 = А: фиксированные ULID, байт-стабильность, идемпотентность);
 *   - журнал .sb/logs/plugin-log.jsonl + настройки .sb/settings.json (ADR-002);
 *   - команды: create-object-type, create-object, create-property, validate-object,
 *     validate-vault, show-log, copy-log (тонкие обёртки над ядром — DL-244/9.5).
 * Дальше — B1.2 «формы и контролы»: первое включение Svelte (B1-2 = А, DL-261).
 *
 * Архитектура: 'obsidian' импортируют только main.ts, adapter/obsidian-adapter.ts,
 * commands/* и ui/* (слои 4–5); ядро (core/**) — среда-независимо (правило М2,
 * тест tests/integration/layering.test.ts).
 */

import { Notice, Plugin, type App } from 'obsidian';
import { ObsidianVaultAdapter } from './adapter/obsidian-adapter';
import { registerCopyLogCommand } from './commands/copy-log';
import { registerCreateObjectCommand } from './commands/create-object';
import { registerCreateObjectTypeCommand } from './commands/create-object-type';
import { registerCreatePropertyCommand } from './commands/create-property';
import type { PluginContext } from './commands/context';
import { registerShowLogCommand } from './commands/show-log';
import { registerValidateObjectCommand } from './commands/validate-object';
import { registerValidateVaultCommand } from './commands/validate-vault';
import { ActivityLog } from './core/activity-log';
import { bootstrapMetamodel } from './core/bootstrap';
import {
	FRONT_MATTER_TITLE_ID,
	frontMatterTitleAdvice,
	NO_FRONT_MATTER_TITLE,
	type ExternalPluginSnapshot,
} from './core/front-matter-title';
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

		// Front Matter Title — необязательная рекомендуемая интеграция (ADR-001 уровень 2,
		// карточка docs/integrations/front-matter-title.md). Адаптер изолирован (М3):
		// любой сбой проверки деградирует молча, плагин продолжает работать (М4).
		try {
			const fmtSnapshot = detectFrontMatterTitle(this.app);
			const advice = frontMatterTitleAdvice(fmtSnapshot, this.settings.fmtAdviceShown);
			this.logger.log(advice.logLevel, 'front-matter-title', advice.logMessage, {
				installed: fmtSnapshot.installed,
				enabled: fmtSnapshot.enabled,
				version: fmtSnapshot.version,
			});
			if (advice.recommend) {
				new Notice(`Second Brain: ${advice.message}`);
				this.settings.fmtAdviceShown = true;
				await this.saveSettings();
			}
		} catch (error) {
			this.logger.log('debug', 'front-matter-title', `Проверка Front Matter Title пропущена (сбой адаптера, М3): ${String(error)}`);
		}

		// Команды получают сам плагин как контекст (он реализует PluginContext).
		registerCreateObjectTypeCommand(this, (cmd) => this.addCommand(cmd));
		registerCreateObjectCommand(this, (cmd) => this.addCommand(cmd));
		registerCreatePropertyCommand(this, (cmd) => this.addCommand(cmd));
		registerValidateObjectCommand(this, (cmd) => this.addCommand(cmd));
		registerValidateVaultCommand(this, (cmd) => this.addCommand(cmd));
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

/**
 * Снимок состояния Front Matter Title из среды — БЕЗ его API (публичного API у FMT нет,
 * и он нам не нужен — карточка интеграции). `app.plugins` не входит в документированный
 * интерфейс App, поэтому чтение защитное: любая неожиданность — NO_FRONT_MATTER_TITLE,
 * плагин продолжает работать (М3 — изоляция адаптера, М4 — резервное поведение: имена файлов).
 */
function detectFrontMatterTitle(app: App): ExternalPluginSnapshot {
	try {
		const plugins = (
			app as unknown as {
				plugins?: {
					manifests?: Record<string, { version?: string } | undefined>;
					enabledPlugins?: { has(id: string): boolean };
				};
			}
		).plugins;
		const manifest = plugins?.manifests?.[FRONT_MATTER_TITLE_ID];
		return {
			installed: manifest !== undefined && manifest !== null,
			enabled: typeof plugins?.enabledPlugins?.has === 'function' ? plugins.enabledPlugins.has(FRONT_MATTER_TITLE_ID) : false,
			version: typeof manifest?.version === 'string' ? manifest.version : null,
		};
	} catch {
		return NO_FRONT_MATTER_TITLE;
	}
}
