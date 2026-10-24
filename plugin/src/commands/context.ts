/**
 * Контекст плагина для команд (слой 4). Команды — ТОНКИЕ обёртки над ядром
 * (DL-244, вопрос 9.5 = А): весь контекст, который им нужен, — здесь.
 */

import type { App } from 'obsidian';
import type { ActivityLog } from '../core/activity-log';
import type { VaultAdapter } from '../adapter/vault-adapter';
import type { LabelResolver } from '../core/label-resolver';
import type { TypeRegistry } from '../core/registry';
import type { PluginSettings } from '../core/settings';

export interface PluginContext {
	app: App;
	adapter: VaultAdapter;
	labels: LabelResolver;
	registry: TypeRegistry;
	/** Журнал плагина (DL-251): команды пишут события и показывают их в модалке. */
	logger: ActivityLog;
	settings: PluginSettings;
	/** Перечитать реестр из заметок Metamodel/ (источник истины — заметки, не кэш). */
	reloadRegistry(): Promise<TypeRegistry>;
	/** Сохранить настройки в .sb/settings.json (ADR-002). */
	saveSettings(): Promise<void>;
}
