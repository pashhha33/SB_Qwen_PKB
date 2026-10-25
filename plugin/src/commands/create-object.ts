/**
 * Команда create-object (реестр 18 команд; ADR-004). Тонкая обёртка над
 * core/creation.ts#createObjectInstance.
 *
 * Два шага: выбор типа (SuggestModal по неабстрактным типам реестра) → ввод
 * названия. Экземпляр создаётся с минимальным корректным каркасом: 6 системных
 * атрибутов + И4 (aliases[0] == title); обязательные предметные свойства не
 * заполняются — недостающее покажет validate-object (принцип DL-183).
 */

import { Modal, Notice, Setting, SuggestModal, TFile } from 'obsidian';
import { SbError } from '../core/errors';
import { createObjectInstance } from '../core/creation';
import { parseNote } from '../core/markdown-parser';
import { buildFormModel } from '../core/object-service';
import type { TypeDef } from '../core/registry';
import { PropertyEditorModal } from '../ui/property-editor-modal';
import type { PluginContext } from './context';

class ChooseTypeModal extends SuggestModal<TypeDef> {
	constructor(private readonly context: PluginContext) {
		super(context.app);
		this.setPlaceholder('Выберите тип объекта (поиск по подписи и ключу)…');
	}

	getSuggestions(query: string): TypeDef[] {
		const all = this.context.registry.instantiableTypes();
		const normalized = query.trim().toLowerCase();
		if (normalized === '') {
			return all;
		}
		return all.filter(
			(def) => def.label.toLowerCase().includes(normalized) || def.typeKey.includes(normalized),
		);
	}

	renderSuggestion(def: TypeDef, el: HTMLElement): void {
		el.createEl('div', { text: def.label });
		el.createEl('small', { text: `${def.typeKey} · ${def.typePrefix}` });
	}

	onChooseSuggestion(def: TypeDef): void {
		new TitleModal(this.context, def).open();
	}
}

class TitleModal extends Modal {
	private title = '';

	constructor(private readonly context: PluginContext, private readonly def: TypeDef) {
		super(context.app);
	}

	onOpen(): void {
		this.titleEl.setText(`Новый объект: ${this.def.label}`);
		new Setting(this.contentEl).setName('Название (title)').addText((text) => {
			text.onChange((value) => {
				this.title = value;
			});
			// Фокус — сразу на поле ввода (window: 'load' для надёжности в тестах не нужен).
			void text.inputEl.focus();
		});
		new Setting(this.contentEl).addButton((button) =>
			button
				.setButtonText('Создать')
				.setCta()
				.onClick(async () => {
					try {
						const result = await createObjectInstance(
							this.context.adapter,
							this.context.registry,
							{ typeKey: this.def.typeKey, title: this.title },
							this.context.logger.fn,
						);
						new Notice(`Объект создан: ${result.path}`);
						this.close();
						// Открыть созданную заметку (слой 4 — имеет право на workspace).
						const file = this.app.vault.getAbstractFileByPath(result.path);
						if (file instanceof TFile) {
							await this.app.workspace.getLeaf().openFile(file);
						}
						// object-service (B1.2): сразу предложить форму свойств.
						// Сбой формы не отменяет создание (объект уже записан).
						try {
							const content = await this.context.adapter.read(result.path);
							const note = parseNote({ path: result.path, content }, this.context.adapter);
							const model = buildFormModel(this.context.registry, this.context.labels, note);
							if (model !== null) {
								new PropertyEditorModal(this.context, model, note).open();
							}
						} catch (error) {
							this.context.logger.log('warning', 'edit', `Форма после создания не открылась (объект создан): ${String(error)}`);
						}
					} catch (error) {
						const message = error instanceof SbError ? error.message : `Не удалось создать объект: ${String(error)}`;
						this.context.logger.log('error', 'creation', message, { typeKey: this.def.typeKey, title: this.title });
						new Notice(message);
					}
				}),
		);
	}
}

export function registerCreateObjectCommand(context: PluginContext, addCommand: (cmd: { id: string; name: string; callback: () => void }) => void): void {
	addCommand({
		id: 'create-object',
		name: 'Создать объект (create-object)',
		callback: () => {
			if (context.registry.instantiableTypes().length === 0) {
				new Notice('В реестре нет ни одного неабстрактного типа. Сначала создайте тип (create-object-type) или дождитесь бутстрапа Metamodel/.');
				return;
			}
			new ChooseTypeModal(context).open();
		},
	});
}
