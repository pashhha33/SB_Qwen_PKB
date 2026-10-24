/**
 * Контекст плагина для команд (слой 4). Команды — ТОНКИЕ обёртки над ядром
 * (DL-244, вопрос 9.5 = А): весь контекст, который им нужен, — здесь.
 */

import type { App } from 'obsidian';
import type { VaultAdapter } from '../adapter/vault-adapter';
import type { LabelResolver } from '../core/label-resolver';
import type { TypeRegistry } from '../core/registry';

export interface PluginContext {
	app: App;
	adapter: VaultAdapter;
	labels: LabelResolver;
	registry: TypeRegistry;
	/** Перечитать реестр из заметок Metamodel/ (источник истины — заметки, не кэш). */
	reloadRegistry(): Promise<TypeRegistry>;
}
