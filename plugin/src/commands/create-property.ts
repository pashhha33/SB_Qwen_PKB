/**
 * Команда create-property (реестр команд MVP, mvp-scope §2.3; ADR-004 —
 * элементы метамодели создаются только командами). B1.1 часть 2 (DL-261/266).
 *
 * Тонкая обёртка (DL-244/9.5): форма собирает ввод, всю работу делает
 * core/creation.ts#createPropertyDefinition (проверки уровня 1 — до записи).
 *
 * UI — vanilla (мера против риска «новичок + фреймворк», 09-modules §4.1):
 * Svelte подключается в B1.2; модалка повторяет подход create-object-type.
 * `required` не вводится — выводится из cardinality (04-attributes §4);
 * `service: true` не предлагается (служебные свойства объявляет плагин —
 * 08-views §7; в MVP одно — sb_issues, сеется бутстрапом).
 */

import { Modal, Notice, Setting } from 'obsidian';
import { SbError } from '../core/errors';
import { createPropertyDefinition } from '../core/creation';
import type { PluginContext } from './context';

const VALUE_TYPE_OPTIONS: [string, string][] = [
	['text', 'text — текст (в т.ч. перечисление через allowed_values)'],
	['number', 'number — число'],
	['date', 'date — дата (YYYY-MM-DD, частичные — «00»)'],
	['datetime', 'datetime — дата и время (YYYY-MM-DDTHH:mm)'],
	['boolean', 'boolean — да/нет'],
	['object_reference', 'object_reference — ссылка на объект'],
	['media_reference', 'media_reference — ссылка на медиа'],
];

const CARDINALITY_OPTIONS: [string, string][] = [
	['1', '1 — ровно одно значение (обязательное)'],
	['0..1', '0..1 — не более одного (необязательное)'],
	['1..N', '1..N — одно или несколько (обязательное)'],
	['0..N', '0..N — любое количество (необязательное)'],
];

const SCOPE_OPTIONS: [string, string][] = [
	['universal', 'universal — доступно всем типам'],
	['family', 'family — семейству типов (один абстрактный предок)'],
	['specific', 'specific — конкретным типам'],
];

const OPERATION_OPTIONS: [string, string][] = [
	['', '— без условия (видно всегда) —'],
	['equals', 'equals — значение триггера равно одному из списка'],
	['in_category', 'in_category — объекту назначена категория из списка (id категорий)'],
	['includes_any', 'includes_any — хотя бы одно значение триггера входит в список'],
];

function splitList(value: string): string[] {
	return value
		.split(',')
		.map((item) => item.trim())
		.filter((item) => item !== '');
}

class CreatePropertyModal extends Modal {
	private key = '';
	private label = '';
	private valueType = 'text';
	private cardinality = '0..1';
	private propertyScope = 'specific';
	private objectTypeKeys = '';
	private targetTypeKeys = '';
	private linkMode = '';
	private mediaTarget = '';
	private allowedValues = '';
	private triggerProperty = '';
	private triggerOperation = '';
	private triggerValues = '';
	private displayRenderer = '';
	private displayScaleMax = '';
	private displayUnit = '';
	private definition = '';

	constructor(private readonly context: PluginContext) {
		super(context.app);
	}

	onOpen(): void {
		this.titleEl.setText('Новое свойство');

		new Setting(this.contentEl).setName('Ключ (key)').setDesc('Английский snake_case: ^[a-z][a-z0-9_]*$ — например, published_year').addText((text) =>
			text.onChange((value) => {
				this.key = value.trim();
			}),
		);

		new Setting(this.contentEl).setName('Подпись (label)').setDesc('Название по-русски — показывается в интерфейсе').addText((text) =>
			text.onChange((value) => {
				this.label = value;
			}),
		);

		new Setting(this.contentEl).setName('Тип значения (value_type)').setDesc('Закрытый набор из семи (ADR-006)').addDropdown((dropdown) => {
			for (const [value, caption] of VALUE_TYPE_OPTIONS) {
				dropdown.addOption(value, caption);
			}
			dropdown.setValue('text');
			dropdown.onChange((value) => {
				this.valueType = value;
			});
		});

		new Setting(this.contentEl).setName('Кардинальность').setDesc('Обязательность (required) выводится из кардинальности: 1 и 1..N — обязательное').addDropdown((dropdown) => {
			for (const [value, caption] of CARDINALITY_OPTIONS) {
				dropdown.addOption(value, caption);
			}
			dropdown.setValue('0..1');
			dropdown.onChange((value) => {
				this.cardinality = value;
			});
		});

		new Setting(this.contentEl).setName('Область (scope)').setDesc('Кому доступно свойство (04-attributes §4.1)').addDropdown((dropdown) => {
			for (const [value, caption] of SCOPE_OPTIONS) {
				dropdown.addOption(value, caption);
			}
			dropdown.setValue('specific');
			dropdown.onChange((value) => {
				this.propertyScope = value;
			});
		});

		new Setting(this.contentEl).setName('Типы (object_types)').setDesc('Ключи типов через запятую: family — один абстрактный предок; specific — конкретные типы; universal — пусто').addText((text) =>
			text.onChange((value) => {
				this.objectTypeKeys = value;
			}),
		);

		new Setting(this.contentEl).setName('Значения перечисления (allowed_values)').setDesc('Закрытый список через запятую: строчная латиница, цифры, «_» — например, hardcover, ebook, audiobook').addText((text) =>
			text.onChange((value) => {
				this.allowedValues = value;
			}),
		);

		new Setting(this.contentEl).setName('Цели ссылки (target_types)').setDesc('Ключи типов через запятую — обязательно для object_reference и media_reference').addText((text) =>
			text.onChange((value) => {
				this.targetTypeKeys = value;
			}),
		);

		new Setting(this.contentEl).setName('Хранение связи (link_mode)').setDesc('Обязательно для object_reference: direct — значение в поле, reified — отношение-объект (ADR-009/010)').addDropdown((dropdown) => {
			dropdown.addOption('', '— не задан —');
			dropdown.addOption('direct', 'direct — ссылка прямо в поле');
			dropdown.addOption('reified', 'reified — реифицированное отношение');
			dropdown.onChange((value) => {
				this.linkMode = value;
			});
		});

		new Setting(this.contentEl).setName('Цель медиа-ссылки (media_target)').setDesc('Обязательно для media_reference: object — обёртки media, file — вложения, both — и то и другое (ADR-008)').addDropdown((dropdown) => {
			dropdown.addOption('', '— не задан —');
			dropdown.addOption('object', 'object — обёртки media');
			dropdown.addOption('file', 'file — файлы-вложения');
			dropdown.addOption('both', 'both — оба варианта');
			dropdown.onChange((value) => {
				this.mediaTarget = value;
			});
		});

		new Setting(this.contentEl).setName('Условие показа: свойство-триггер').setDesc('Ключ свойства того же типа — например, format (04-attributes §11, М1–М7)').addText((text) =>
			text.onChange((value) => {
				this.triggerProperty = value.trim();
			}),
		);

		new Setting(this.contentEl).setName('Условие показа: операция').addDropdown((dropdown) => {
			for (const [value, caption] of OPERATION_OPTIONS) {
				dropdown.addOption(value, caption);
			}
			dropdown.onChange((value) => {
				this.triggerOperation = value;
			});
		});

		new Setting(this.contentEl).setName('Условие показа: значения').setDesc('Через запятую (М7 — несколько групп значений); для in_category — id категорий (ULID)').addText((text) =>
			text.onChange((value) => {
				this.triggerValues = value;
			}),
		);

		new Setting(this.contentEl).setName('Показ числа (display.renderer)').setDesc('Только для number: звёзды или прогресс (04-attributes §12); в данных хранится число, символы рисует форма (DL-117)').addDropdown((dropdown) => {
			dropdown.addOption('', '— plain (число как есть) —');
			dropdown.addOption('stars', 'stars — звёзды (рейтинг)');
			dropdown.addOption('progress', 'progress — шкала прогресса');
			dropdown.onChange((value) => {
				this.displayRenderer = value;
			});
		});

		new Setting(this.contentEl).setName('Предел шкалы (display.scale_max)').setDesc('Число больше 0; по умолчанию 10').addText((text) =>
			text.onChange((value) => {
				this.displayScaleMax = value.trim();
			}),
		);

		new Setting(this.contentEl).setName('Единица измерения (display.unit)').setDesc('Например: стр., мин., ₽').addText((text) =>
			text.onChange((value) => {
				this.displayUnit = value;
			}),
		);

		new Setting(this.contentEl).setName('Пояснение (definition)').setDesc('Смысл свойства, примеры значений').addTextArea((area) =>
			area.onChange((value) => {
				this.definition = value;
			}),
		);

		new Setting(this.contentEl).addButton((button) =>
			button
				.setButtonText('Создать свойство')
				.setCta()
				.onClick(async () => {
					try {
						const result = await createPropertyDefinition(
							this.context.adapter,
							this.context.registry,
							{
								key: this.key,
								label: this.label,
								valueType: this.valueType,
								cardinality: this.cardinality,
								scope: this.propertyScope,
								objectTypeKeys: splitList(this.objectTypeKeys),
								targetTypeKeys: splitList(this.targetTypeKeys),
								linkMode: this.linkMode === '' ? null : this.linkMode,
								mediaTarget: this.mediaTarget === '' ? null : this.mediaTarget,
								allowedValues: splitList(this.allowedValues),
								appliesWhen:
									this.triggerOperation === ''
										? null
										: {
												property: this.triggerProperty,
												operation: this.triggerOperation,
												value: splitList(this.triggerValues),
											},
								display:
									this.displayRenderer === ''
										? null
										: {
												renderer: this.displayRenderer,
												scaleMax: this.displayScaleMax === '' ? null : Number(this.displayScaleMax.replace(',', '.')),
												unit: this.displayUnit.trim() === '' ? null : this.displayUnit.trim(),
											},
								definition: this.definition,
							},
							this.context.logger.fn,
						);
						await this.context.reloadRegistry();
						new Notice(`Свойство создано: ${result.path}`);
						this.close();
					} catch (error) {
						// Отказ формы ВИДЕН В ЖУРНАЛЕ (урок инцидента 2026-10-25: отказ
						// уровня 1 без записи в журнал трудно диагностировать — copy-log).
						const message = error instanceof SbError ? error.message : `Не удалось создать свойство: ${String(error)}`;
						this.context.logger.log('error', 'creation', message, { key: this.key });
						new Notice(message);
					}
				}),
		);
	}
}

export function registerCreatePropertyCommand(context: PluginContext, addCommand: (cmd: { id: string; name: string; callback: () => void }) => void): void {
	addCommand({
		id: 'create-property',
		name: 'Создать свойство (create-property)',
		callback: () => {
			new CreatePropertyModal(context).open();
		},
	});
}
