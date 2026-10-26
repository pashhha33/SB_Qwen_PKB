/**
 * Команда assign-category (реестр MVP — 22 команды, mvp-scope §2.3; этап B).
 * Поставлена в 0.12.0 вместе с правилами группы E: правило уровня error
 * (`facet.genre.required_for_book`) обязано поставляться вместе с инструментом
 * его устранения (конвенция architecture §4, урок DL-282).
 *
 * Тонкая обёртка (DL-244/9.5): список фасетов/категорий, проверки и запись делает
 * ядро (`core/classification.ts`), окно — `ui/assign-category-modal`.
 */

import { Notice } from 'obsidian';
import { loadClassification } from '../core/classification';
import { parseNote } from '../core/markdown-parser';
import { AssignCategoryModal } from '../ui/assign-category-modal';
import type { PluginContext } from './context';

export function registerAssignCategoryCommand(context: PluginContext, addCommand: (cmd: { id: string; name: string; callback: () => void }) => void): void {
	addCommand({
		id: 'assign-category',
		name: 'Назначить категорию (assign-category)',
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
						new Notice('Служебный блок (frontmatter) не разбирается — назначение недоступно; исправьте YAML (validate-object подскажет)');
						return;
					}
					const typeKey = typeof note.system.type === 'string' ? note.system.type : null;
					if (typeKey === null) {
						new Notice('У заметки нет поля type — категории назначаются только объектам Second Brain');
						return;
					}
					const typeDef = registry.getType(typeKey);
					if (typeDef === null) {
						new Notice(`Тип «${typeKey}» не найден в реестре (Metamodel/) — назначение недоступно`);
						return;
					}
					if (typeDef.abstract) {
						new Notice(`Тип «${typeDef.label}» абстрактный — экземпляров не существует (И3)`);
						return;
					}
					const snapshot = await loadClassification(context.adapter);
					if (snapshot.facets.length === 0) {
						new Notice('В хранилище нет фасетов. Установите базовую библиотеку («Установить основные типы») или создайте фасет командой «Создать объект»');
						return;
					}
					new AssignCategoryModal(context, note, typeKey, snapshot).open();
				} catch (error) {
					context.logger.log('error', 'classification', `Не удалось открыть окно назначения категории: ${String(error)}`);
					new Notice(`Не удалось открыть окно назначения: ${String(error)}`);
				}
			})();
		},
	});
}
