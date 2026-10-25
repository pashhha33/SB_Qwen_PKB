/**
 * Команда toggle-label-mode (реестр 20 команд MVP; ADR-003): переключает режим
 * подписей view (русские подписи) / source (технические ключи). Режим хранится
 * в .sb/settings.json (ADR-002) и применяется к LabelResolver сразу.
 *
 * Гарантированные места показа подписей (ADR-003): наша модалка свойств,
 * наши представления, сообщения валидации, команды и меню.
 */

import { Notice } from 'obsidian';
import type { PluginContext } from './context';

export function registerToggleLabelModeCommand(context: PluginContext, addCommand: (cmd: { id: string; name: string; callback: () => void }) => void): void {
	addCommand({
		id: 'toggle-label-mode',
		name: 'Переключить режим подписей (toggle-label-mode)',
		callback: () => {
			void (async () => {
				const next = context.settings.labelMode === 'view' ? 'source' : 'view';
				context.settings.labelMode = next;
				context.labels.setMode(next);
				try {
					await context.saveSettings();
				} catch (error) {
					context.logger.log('warning', 'settings', `Режим подписей переключён, но сохранить настройки не удалось: ${String(error)}`);
				}
				context.logger.log('info', 'settings', `Режим подписей: ${next}`, { mode: next });
				new Notice(
					next === 'view'
						? 'Подписи: русские названия (view). Формы и сообщения показывают label'
						: 'Подписи: технические ключи (source). Формы и сообщения показывают key',
				);
			})();
		},
	});
}
