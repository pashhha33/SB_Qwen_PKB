/**
 * Команда validate-object (реестр 18 команд; ADR-004, ADR-011 — уровни контроля 2–4).
 * Тонкая обёртка над core/validation.ts#validateObject: проверяет активную заметку
 * и показывает диагностики форматом из 11 полей (severity-policy §4) в модалке.
 */

import { Modal, Notice } from 'obsidian';
import type { SbDiagnostic } from '../core/diagnostics';
import { validateObject } from '../core/validation';
import type { PluginContext } from './context';

const SEVERITY_LABEL: Record<SbDiagnostic['severity'], string> = {
	error: 'Ошибка',
	warning: 'Предупреждение',
	info: 'Заметка',
};

class ValidationResultModal extends Modal {
	constructor(context: PluginContext, private readonly path: string, private readonly diagnostics: SbDiagnostic[]) {
		super(context.app);
	}

	onOpen(): void {
		this.titleEl.setText(`Проверка: ${this.path}`);
		if (this.diagnostics.length === 0) {
			this.contentEl.createEl('p', { text: 'Нарушений не найдено (проверены системные атрибуты и инварианты И1–И5; свойства и связи — этапы B/C).' });
			return;
		}
		const order: SbDiagnostic['severity'][] = ['error', 'warning', 'info'];
		for (const severity of order) {
			const group = this.diagnostics.filter((d) => d.severity === severity);
			if (group.length === 0) {
				continue;
			}
			this.contentEl.createEl('h4', { text: `${SEVERITY_LABEL[severity]}: ${group.length}` });
			const list = this.contentEl.createEl('ul');
			for (const d of group) {
				const item = list.createEl('li');
				item.createEl('div', { text: d.message });
				item.createEl('small', {
					text: `${d.rule_id} · уровень ${d.level}${d.property_key ? ` · поле ${d.property_key}` : ''}${d.fix_available ? ` · автоисправление: ${d.fix_description}` : ''}`,
				});
				if (d.hint) {
					item.createEl('small', { text: d.hint }).addClass('sb-hint');
				}
			}
		}
	}
}

export function registerValidateObjectCommand(context: PluginContext, addCommand: (cmd: { id: string; name: string; callback: () => void }) => void): void {
	addCommand({
		id: 'validate-object',
		name: 'Проверить объект (validate-object)',
		callback: () => {
			void (async () => {
				const file = context.app.workspace.getActiveFile();
				if (!file) {
					new Notice('Нет активной заметки — откройте объект и повторите команду');
					return;
				}
				try {
					const registry = await context.reloadRegistry();
					const result = await validateObject(context.adapter, registry, context.labels, file.path);
					if (result.diagnostics.length === 0) {
						new Notice(`Проверка «${file.path}»: нарушений нет (уровни 2–4, группа A)`);
					} else {
						new ValidationResultModal(context, result.path, result.diagnostics).open();
					}
				} catch (error) {
					new Notice(`Не удалось проверить объект: ${String(error)}`);
				}
			})();
		},
	});
}
