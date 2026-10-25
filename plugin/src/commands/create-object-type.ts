/**
 * Команда create-object-type (реестр 18 команд, mvp-scope §2.3; ADR-004 —
 * элементы метамодели создаются только командами).
 *
 * Тонкая обёртка (DL-244/9.5): форма собирает ввод, всю работу делает
 * core/creation.ts#createObjectTypeDefinition.
 *
 * UI — vanilla (мера против риска «новичок + фреймворк», 09-modules §4.1):
 * Svelte подключается на этапе B, первая рабочая модалка делается вручную.
 */

import { Modal, Notice, Setting } from 'obsidian';
import { SbError } from '../core/errors';
import { createObjectTypeDefinition } from '../core/creation';
import type { PluginContext } from './context';

class CreateObjectTypeModal extends Modal {
	private typeKey = '';
	private label = '';
	private typePrefix = '';
	private isAbstract = false;
	private parentId: string | null = null;
	private lifecycle = 'standard';
	private description = '';

	constructor(private readonly context: PluginContext) {
		super(context.app);
	}

	onOpen(): void {
		this.titleEl.setText('Новый тип объекта');

		new Setting(this.contentEl).setName('Ключ типа (type_key)').setDesc('Английский snake_case: ^[a-z][a-z0-9_]*$ — например, book').addText((text) =>
			text.onChange((value) => {
				this.typeKey = value.trim();
			}),
		);

		new Setting(this.contentEl).setName('Подпись (label)').setDesc('Название по-русски — показывается в интерфейсе').addText((text) =>
			text.onChange((value) => {
				this.label = value;
			}),
		);

		new Setting(this.contentEl).setName('Префикс (TYPE_PREFIX)').setDesc('3–20 символов: A–Z, 0–9, дефис, «_» — например, BOOK или WEB_PAGE').addText((text) =>
			text.onChange((value) => {
				this.typePrefix = value.trim().toUpperCase();
			}),
		);

		new Setting(this.contentEl).setName('Абстрактный тип').setDesc('Экземпляры создавать нельзя (И3); используется как родитель').addToggle((toggle) =>
			toggle.onChange((value) => {
				this.isAbstract = value;
			}),
		);

		new Setting(this.contentEl).setName('Родительский тип').setDesc('Непосредственный родитель (07-hierarchy); пусто = без родителя').addDropdown((dropdown) => {
			dropdown.addOption('', '— без родителя —');
			for (const def of this.context.registry.types) {
				dropdown.addOption(def.id, `${def.label} (${def.typeKey})`);
			}
			dropdown.onChange((value) => {
				this.parentId = value === '' ? null : value;
			});
		});

		new Setting(this.contentEl).setName('Жизненный цикл').addDropdown((dropdown) => {
			dropdown.addOption('standard', 'standard — обычный');
			dropdown.addOption('experimental', 'experimental — экспериментальный');
			dropdown.onChange((value) => {
				this.lifecycle = value;
			});
		});

		new Setting(this.contentEl).setName('Описание').addTextArea((area) =>
			area.onChange((value) => {
				this.description = value;
			}),
		);

		new Setting(this.contentEl).addButton((button) =>
			button
				.setButtonText('Создать тип')
				.setCta()
				.onClick(async () => {
					try {
						const result = await createObjectTypeDefinition(
							this.context.adapter,
							this.context.registry,
							{
								typeKey: this.typeKey,
								label: this.label,
								typePrefix: this.typePrefix,
								abstract: this.isAbstract,
								parentTypeId: this.parentId,
								lifecycle: this.lifecycle,
								description: this.description,
							},
							this.context.logger.fn,
						);
						await this.context.reloadRegistry();
						new Notice(`Тип создан: ${result.path}`);
						this.close();
					} catch (error) {
						// Все отказы создания (включая формат ключа — раньше это был
						// незалогируемый пред-чек формы, инцидент 2026-10-25) проходят
						// через ядро и ВИДНЫ В ЖУРНАЛЕ: уровень 1 контроля (ADR-011).
						const message = error instanceof SbError ? error.message : `Не удалось создать тип: ${String(error)}`;
						this.context.logger.log('error', 'creation', message, { typeKey: this.typeKey });
						new Notice(message);
					}
				}),
		);
	}
}

export function registerCreateObjectTypeCommand(context: PluginContext, addCommand: (cmd: { id: string; name: string; callback: () => void }) => void): void {
	addCommand({
		id: 'create-object-type',
		name: 'Создать тип объекта (create-object-type)',
		callback: () => {
			new CreateObjectTypeModal(context).open();
		},
	});
}
