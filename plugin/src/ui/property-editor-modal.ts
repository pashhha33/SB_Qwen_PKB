/**
 * Оболочка Modal для формы свойств (B1.2, DL-175/261: Svelte-компоненты живут
 * ВНУТРИ оболочки Modal; слой 5 — имеет право на 'obsidian').
 *
 * Разделение: оболочка монтирует Svelte-компонент (API mount/unmount Svelte 5),
 * передаёт модель и колбэки; всю логику делает ядро (object-service) — команда
 * и оболочка тонкие (DL-244/9.5).
 */

import { Modal, Notice } from 'obsidian';
import { mount, unmount } from 'svelte';
import type { ClassificationSnapshot } from '../core/classification';
import type { SbNote } from '../core/model';
import type { PropertyDef } from '../core/registry';
import { computeVisibleKeys, saveObjectForm, type FormModel, type FormValues } from '../core/object-service';
import type { PluginContext } from '../commands/context';
import { LinkPickerModal } from './link-picker-modal';
import PropertyEditor from './svelte/property-editor.svelte';

export class PropertyEditorModal extends Modal {
	private component: ReturnType<typeof mount> | null = null;

	constructor(
		private readonly context: PluginContext,
		private readonly model: FormModel,
		private readonly note: SbNote,
		/** Снимок классификации для условий `in_category` (строит команда). */
		private readonly classification: ClassificationSnapshot | null = null,
	) {
		super(context.app);
	}

	onOpen(): void {
		const heading = this.model.title.trim() !== '' ? this.model.title : this.model.typeLabel;
		this.titleEl.setText(`Объект: ${heading} (${this.model.typeKey})`);
		const categories = this.note.system.categories ?? [];
		this.component = mount(PropertyEditor, {
			target: this.contentEl,
			props: {
				model: this.model,
				categories,
				labelMode: this.context.settings.labelMode,
				computeVisibility: (values: FormValues) => computeVisibleKeys(this.model, values, categories, this.classification),
				// Подбор цели ссылки (B1.2 часть 2): окно SuggestModal, результат —
				// каноническая ссылка; null — отказ (Esc), поле остаётся как было.
				pickReference: (def: PropertyDef) =>
					new Promise<string | null>((resolve) => {
						new LinkPickerModal(this.context, def, this.model.path, resolve).open();
					}),
				onSave: async (title: string, values: FormValues) => {
					await saveObjectForm(this.context.adapter, this.model, this.note, { title, values }, this.context.logger.fn);
					new Notice(`Сохранено: ${this.model.path}`);
					this.close();
				},
			},
		});
	}

	onClose(): void {
		if (this.component !== null) {
			unmount(this.component);
			this.component = null;
		}
	}
}
