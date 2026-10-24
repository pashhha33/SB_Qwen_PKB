/**
 * Команда copy-log — скопировать ВЕСЬ журнал в буфер обмена (DL-256).
 *
 * Зачем отдельная команда, если в окне show-log есть кнопка «Скопировать»:
 * кнопка копирует то, что видно (с учётом фильтра по уровню и лимита отрисовки),
 * а разработчику для разбора инцидента нужен весь буфер независимо от
 * выключателей — одно действие из палитры команд (Ctrl+P).
 * Формат дампа — core/activity-log#formatEntriesForCopy (тестируется там же).
 */

import { Notice } from 'obsidian';
import { formatEntriesForCopy } from '../core/activity-log';
import { formatDateTimeWithSecondsLocal } from '../core/datetime';
import { copyTextToClipboard } from '../ui/clipboard';
import type { PluginContext } from './context';

export function registerCopyLogCommand(
	context: PluginContext,
	addCommand: (cmd: { id: string; name: string; callback: () => void }) => void,
): void {
	addCommand({
		id: 'copy-log',
		name: 'Скопировать журнал в буфер обмена (copy-log)',
		callback: () => {
			void (async () => {
				const entries = context.logger.tail(Number.MAX_SAFE_INTEGER);
				const text = formatEntriesForCopy(entries, formatDateTimeWithSecondsLocal(new Date()));
				const ok = await copyTextToClipboard(text);
				if (ok) {
					new Notice(`Журнал скопирован в буфер обмена: ${entries.length} запис(ей)`);
					context.logger.log('info', 'log', 'Журнал скопирован в буфер обмена (команда copy-log)', {
						entries: entries.length,
					});
				} else {
					new Notice('Не удалось скопировать журнал — подробности в консоли (Ctrl+Shift+I)');
					console.error('[second-brain] copyTextToClipboard вернул false (оба пути копирования отказали)');
				}
			})();
		},
	});
}
