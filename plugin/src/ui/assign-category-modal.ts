/**
 * Модалка назначения категорий (команда `assign-category`, mvp-scope §2.3 — этап B;
 * поставлена в 0.12.0 вместе с правилами группы E — урок DL-282: правило уровня error
 * обязано поставляться вместе с инструментом его устранения).
 *
 * UI — vanilla (как create-object-type/create-property): Svelte-компоненты не
 * проверяются `tsc --noEmit` (граница B1.2-2), а здесь логика выбора проста и вся
 * проверка вынесена в ядро (`classification.ts#assignCategories`).
 *
 * Вся логика — в ядре: модалка лишь показывает фасеты, применимые к типу объекта
 * (`facetsForType`), категории фасета сверху вниз (`categoriesInHierarchy`),
 * живой счётчик кардинальности (`cardinalityViolation`) и вызывает запись.
 */

import { Modal, Notice, Setting } from 'obsidian';
import {
	assignCategories,
	cardinalityOverflow,
	cardinalityShortfall,
	categoryIdOf,
	categoriesInHierarchy,
	classificationName,
	effectiveSettings,
	facetsForType,
	type ClassificationSnapshot,
	type FacetInfo,
} from '../core/classification';
import { SbError } from '../core/errors';
import type { SbNote } from '../core/model';
import type { PluginContext } from '../commands/context';

export class AssignCategoryModal extends Modal {
	private facetId: string | null = null;
	private readonly selected = new Set<string>();
	private listEl: HTMLElement | null = null;
	private statusEl: HTMLElement | null = null;
	private saveButton: { setDisabled: (disabled: boolean) => void } | null = null;
	private facets: FacetInfo[] = [];

	constructor(
		private readonly context: PluginContext,
		private readonly note: SbNote,
		private readonly typeKey: string,
		private readonly snapshot: ClassificationSnapshot,
	) {
		super(context.app);
	}

	onOpen(): void {
		const title = typeof this.note.system.title === 'string' && this.note.system.title !== '' ? this.note.system.title : this.note.fileName;
		this.titleEl.setText(`Назначить категорию: ${title}`);
		this.facets = facetsForType(this.snapshot, this.context.registry, this.typeKey);

		if (this.facets.length === 0) {
			this.contentEl.createDiv().setText(
				'Нет фасетов, применимых к этому типу объекта. Фасет создаётся командой «Создать объект» (тип — Фасет); ' +
					'область применения задаётся полем allowed_object_types.',
			);
			return;
		}

		new Setting(this.contentEl).setName('Фасет').setDesc('Измерение классификации (жанр, форма, страна, язык…)').addDropdown((dropdown) => {
			dropdown.addOption('', '— выберите фасет —');
			for (const facet of this.facets) {
				dropdown.addOption(facet.id, classificationName(facet));
			}
			dropdown.onChange((value) => {
				this.selectFacet(value === '' ? null : value);
			});
		});

		this.listEl = this.contentEl.createDiv({ cls: 'sb-assign-category-list' });
		this.statusEl = this.contentEl.createDiv({ cls: 'sb-assign-category-status' });

		new Setting(this.contentEl)
			.addButton((button) => {
				this.saveButton = button;
				button
					.setButtonText('Сохранить назначение')
					.setCta()
					.setDisabled(true)
					.onClick(async () => {
						await this.save();
					});
			})
			.addButton((button) =>
				button.setButtonText('Отмена').onClick(() => {
					this.close();
				}),
			);

		// Фасет по умолчанию — первый применимый (обычно «Жанр» у книги): меньше кликов.
		this.selectFacet(this.facets.length === 1 ? this.facets[0].id : null);
		this.updateStatus();
	}

	/** Выбранный фасет: уже назначенные категории этого фасета отмечаются сразу. */
	private selectFacet(facetId: string | null): void {
		this.facetId = facetId;
		this.selected.clear();
		if (facetId !== null) {
			for (const entry of this.note.system.categories ?? []) {
				const id = categoryIdOf(entry);
				const category = id === null ? undefined : this.snapshot.categoryById.get(id);
				if (category !== undefined && category.facetIds[0] === facetId) {
					this.selected.add(category.id);
				}
			}
		}
		this.renderList();
		this.updateStatus();
	}

	private renderList(): void {
		if (this.listEl === null) {
			return;
		}
		this.listEl.empty();
		if (this.facetId === null) {
			this.listEl.createDiv().setText('Выберите фасет — список категорий появится здесь.');
			return;
		}
		const rows = categoriesInHierarchy(this.snapshot, this.facetId);
		if (rows.length === 0) {
			this.listEl
				.createDiv()
				.setText('В этом фасете пока нет категорий. Создайте их командой «Создать объект» (тип — Категория) и вернитесь к назначению.');
			return;
		}
		for (const { category, depth } of rows) {
			const row = this.listEl.createDiv({ cls: 'sb-assign-category-row' });
			row.style.marginLeft = `${depth * 16}px`;
			const label = row.createEl('label');
			const checkbox = label.createEl('input', { type: 'checkbox' });
			checkbox.checked = this.selected.has(category.id);
			checkbox.addEventListener('change', () => {
				if (checkbox.checked) {
					this.selected.add(category.id);
				} else {
					this.selected.delete(category.id);
				}
				this.updateStatus();
			});
			const text = classificationName(category);
			label.createSpan({ text: depth > 0 ? `↳ ${text}` : text });
			if (category.label !== null && category.label !== category.title) {
				label.createSpan({ text: ` (${category.title})`, cls: 'sb-assign-category-technical' });
			}
		}
	}

	/** Живой счётчик и отказ уровня 1 (ADR-011): несоответствие кардинальности не сохранится. */
	private updateStatus(): void {
		if (this.statusEl === null || this.facetId === null) {
			this.saveButton?.setDisabled(true);
			return;
		}
		const facet = this.snapshot.facetById.get(this.facetId);
		if (facet === undefined) {
			return;
		}
		const settings = effectiveSettings(this.snapshot, facet);
		// Отказ уровня 1 — только превышение (ADR-011); недобор сохраняется с
		// предупреждением (DL-183: неполный объект допустим, ошибку покажет проверка).
		const overflow = cardinalityOverflow(settings.assignmentCardinality, this.selected.size);
		const shortfall = cardinalityShortfall(settings.assignmentCardinality, this.selected.size);
		const note = overflow ?? shortfall;
		this.statusEl.setText(
			`Выбрано: ${this.selected.size} · кардинальность фасета «${classificationName(facet)}»: ${settings.assignmentCardinality}` +
				(note === null ? '' : ` · ${note}`),
		);
		this.statusEl.style.color = overflow !== null ? 'var(--text-error)' : shortfall !== null ? 'var(--text-warning, #b8860b)' : 'var(--text-muted)';
		this.saveButton?.setDisabled(overflow !== null);
	}

	private async save(): Promise<void> {
		if (this.facetId === null) {
			new Notice('Выберите фасет');
			return;
		}
		try {
			const report = await assignCategories(
				this.context.adapter,
				this.note,
				this.typeKey,
				this.snapshot,
				this.context.registry,
				{ facetId: this.facetId, categoryIds: [...this.selected] },
				this.context.logger.fn,
			);
			new Notice(
				`Фасет «${report.facetName}»: назначено ${report.added.length}, снято ${report.removed.length}` +
					(report.warning === null ? '' : `. ${report.warning}`),
			);
			this.close();
		} catch (error) {
			// Отказы уровня 1 логируются (урок DL-264): причина видна в журнале и в copy-log.
			const message = error instanceof SbError ? error.message : `Не удалось сохранить назначение: ${String(error)}`;
			this.context.logger.log('error', 'classification', message, { object_path: this.note.path, facet: this.facetId });
			new Notice(message);
		}
	}
}
