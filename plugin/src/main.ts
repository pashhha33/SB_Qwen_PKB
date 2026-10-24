/**
 * Second Brain — точка входа плагина Obsidian.
 *
 * Этап A, под-батч A1 (каркас): плагин загружается, создаёт адаптер хранилища
 * и сообщает о загрузке. Бутстрап метамодели (папка Metamodel/ + 7 системных
 * типов), реестр типов и команды create-object-type / create-object /
 * validate-object — под-батч A2; генерация TS-типов (D2) и адаптер Front Matter
 * Title — под-батч A3 (решение о разбиении: DL-244 / F5-5 = А).
 *
 * Архитектура: main.ts — один из двух файлов, которым разрешено импортировать
 * 'obsidian' (второй — adapter/obsidian-adapter.ts). Всё ядро зависит только от
 * интерфейса VaultAdapter (правило слоёв, 09-modules §3; тест layering).
 */

import { Notice, Plugin } from 'obsidian';
import { ObsidianVaultAdapter } from './adapter/obsidian-adapter';

export default class SecondBrainPlugin extends Plugin {
	/** Единственный мост к API Obsidian для всего плагина (слой 0). */
	vaultAdapter!: ObsidianVaultAdapter;

	async onload(): Promise<void> {
		this.vaultAdapter = new ObsidianVaultAdapter(this.app);

		// A1: видимый сигнал, что плагин установился и загрузился (DoD «плагин
		// загружается в пустом хранилище»). В A2 Notice заменится на осмысленные
		// сообщения бутстрапа и команд.
		new Notice(`Second Brain ${this.manifest.version}: плагин загружен (этап A1 — каркас)`);
		console.info(`[second-brain] ${this.manifest.version} loaded`);
	}

	onunload(): void {
		console.info('[second-brain] unloaded');
	}
}
