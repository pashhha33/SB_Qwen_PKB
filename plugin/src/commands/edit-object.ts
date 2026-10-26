/**
 * Команда edit-object (B1.2 часть 1): открыть форму свойств активной заметки
 * (property-editor — Svelte внутри оболочки Modal, DL-175/261).
 *
 * Тонкая обёртка: модель формы собирает core/object-service; оболочка —
 * ui/property-editor-modal; команда лишь проверяет, что форму можно открыть.
 */

import { Notice } from 'obsidian';
import { loadClassification } from '../core/classification';
import { parseNote } from '../core/markdown-parser';
import { buildFormModel } from '../core/object-service';
import { PropertyEditorModal } from '../ui/property-editor-modal';
import type { PluginContext } from './context';

export function registerEditObjectCommand(context: PluginContext, addCommand: (cmd: { id: string; name: string; callback: () => void }) => void): void {
	addCommand({
		id: 'edit-object',
		name: 'Редактировать объект (форма)',
		callback: () => {
			void (async () => {
				const file = context.app.workspace.getActiveFile();
				if (!file) {
					new Notice('Нет активной заметки — откройте объект и повторите команду');
					return;
				}
				try {
					const registry = await context.reloadRegistry();
					const content = await context.adapter.read(file.path);
					const note = parseNote({ path: file.path, content }, context.adapter);
					if (note.frontmatterBroken) {
						new Notice('Служебный блок (frontmatter) не разбирается — форма недоступна; исправьте YAML (validate-object подскажет)');
						return;
					}
					const model = buildFormModel(registry, context.labels, note);
					if (model === null) {
						const typeKey = typeof note.system.type === 'string' ? note.system.type : null;
						if (typeKey === null) {
							new Notice('У заметки нет поля type — форма доступна только объектам Second Brain');
						} else {
							const typeDef = registry.getType(typeKey);
							new Notice(
								typeDef?.abstract
									? `Тип «${typeDef.label}» абстрактный — экземпляров не существует (И3)`
									: `Тип «${typeKey}» не найден в реестре (Metamodel/) — форма недоступна`,
							);
						}
						return;
					}
					// Снимок классификации — для условных полей `in_category` с предками
					// (B1.3 часть 2). Сбой не мешает форме: без снимка условие
					// проверяется по прямому назначению.
					const classification = await loadClassification(context.adapter).catch(() => null);
					new PropertyEditorModal(context, model, note, classification).open();
				} catch (error) {
					context.logger.log('error', 'edit', `Не удалось открыть форму: ${String(error)}`);
					new Notice(`Не удалось открыть форму: ${String(error)}`);
				}
			})();
		},
	});
}
