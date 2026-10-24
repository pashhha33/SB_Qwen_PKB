/**
 * Second Brain — точка входа плагина Obsidian.
 *
 * Этап A, под-батч A2 (часть 1): загрузка реестра типов из Metamodel/ + кэш
 * .sb/cache/registry.json, LabelResolver, три команды: create-object-type,
 * create-object, validate-object (тонкие обёртки над ядром — DL-244/9.5).
 * Бутстрап Metamodel/ (7 системных типов) — часть 2 под-батча A2: ждёт решений
 * F5-7 (префиксы), F5-9 (стратегия ULID системных определений), F5-10 (объём
 * семенных данных). Пока Metamodel/ пуста — реестр пуст, команды об этом сообщают.
 *
 * Архитектура: 'obsidian' импортируют только main.ts, adapter/obsidian-adapter.ts
 * и commands/* (слой 4 — UI-обёртки); ядро (core/**) — среда-независимо
 * (правило М2, тест tests/integration/layering.test.ts).
 */

import { Notice, Plugin } from 'obsidian';
import { ObsidianVaultAdapter } from './adapter/obsidian-adapter';
import { registerCreateObjectCommand } from './commands/create-object';
import { registerCreateObjectTypeCommand } from './commands/create-object-type';
import { registerValidateObjectCommand } from './commands/validate-object';
import { LabelResolver } from './core/label-resolver';
import { METAMODEL_FOLDER, TypeRegistry } from './core/registry';
import type { PluginContext } from './commands/context';

export default class SecondBrainPlugin extends Plugin implements PluginContext {
	/** Единственный мост к API Obsidian для всего плагина (слой 0). */
	adapter!: ObsidianVaultAdapter;
	registry!: TypeRegistry;
	labels!: LabelResolver;

	async onload(): Promise<void> {
		this.adapter = new ObsidianVaultAdapter(this.app);
		this.registry = await this.reloadRegistry();
		this.labels = new LabelResolver(this.registry);

		// Команды получают сам плагин как контекст (он реализует PluginContext).
		registerCreateObjectTypeCommand(this, (cmd) => this.addCommand(cmd));
		registerCreateObjectCommand(this, (cmd) => this.addCommand(cmd));
		registerValidateObjectCommand(this, (cmd) => this.addCommand(cmd));

		const typesCount = this.registry.types.length;
		if (typesCount === 0) {
			console.info(
				`[second-brain] ${this.manifest.version} loaded; ${METAMODEL_FOLDER}/ пуста — реестр пуст (бутстрап появится в A2-части 2)`,
			);
		} else {
			console.info(`[second-brain] ${this.manifest.version} loaded; типов в реестре: ${typesCount}`);
		}
		new Notice(`Second Brain ${this.manifest.version}: загружен (типов в реестре: ${typesCount})`);
	}

	/** Перечитать реестр из заметок (источник истины — Markdown, ADR-002) и сохранить кэш. */
	async reloadRegistry(): Promise<TypeRegistry> {
		const registry = await TypeRegistry.load(this.adapter);
		this.registry = registry;
		try {
			await registry.saveCache(this.adapter, new Date().toISOString());
		} catch (error) {
			// Кэш — не источник истины (М5): сбой записи не ломает загрузку.
			console.warn('[second-brain] не удалось сохранить кэш реестра:', error);
		}
		return registry;
	}

	onunload(): void {
		console.info('[second-brain] unloaded');
	}
}
