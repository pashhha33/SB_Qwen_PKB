/**
 * Команда install-base-types (реестр команд MVP §2.3 — 22-я, DL-276; B1.3 часть 1).
 *
 * «Установить основные типы» — ставит базовую библиотеку определений: OBJECT_TYPE
 * `book` и `person` (+ структурные `work`, `media`), их PROPERTY-сиды, PROPERTY-сиды
 * системных типов и FACET `genre`/`literary_form`/`country`/`language`/`sport`.
 * Категории НЕ создаются (Ч3-3 = Б, DL-276) — содержимое хранилища за пользователем.
 *
 * Тонкая обёртка (DL-244/9.5): всю работу делает core/seed-library.ts#installBaseLibrary.
 * Идемпотентна (пропуск по ключу): повторный запуск ничего не меняет — как бутстрап.
 * Модалки нет: команда запускается явно пользователем, результат — Notice + журнал.
 */

import { Notice } from 'obsidian';
import { installBaseLibrary } from '../core/seed-library';
import type { PluginContext } from './context';

export function registerInstallBaseTypesCommand(
	context: PluginContext,
	addCommand: (cmd: { id: string; name: string; callback: () => void }) => void,
): void {
	addCommand({
		id: 'install-base-types',
		name: 'Установить основные типы (book, person)',
		callback: () => {
			void (async () => {
				try {
					const report = await installBaseLibrary(context.adapter, context.registry, context.logger.fn);
					await context.reloadRegistry();
					if (report.failed.length > 0) {
						context.logger.log('error', 'creation', `Установка базовой библиотеки завершена с ошибками: ${report.failed.length} (подробности выше в журнале)`, {
							failed: report.failed.length,
						});
					}
					const parts = [
						`создано ${report.created.length} (типов ${report.counts.objectTypes}, фасетов ${report.counts.facets}, свойств ${report.counts.properties})`,
						`пропущено существующих ${report.skipped.length}`,
					];
					if (report.failed.length > 0) {
						parts.push(`ошибок ${report.failed.length} — см. журнал (copy-log)`);
					}
					new Notice(`Second Brain: базовая библиотека — ${parts.join(', ')}`);
				} catch (error) {
					// Отказ ВИДЕН В ЖУРНАЛЕ (урок DL-264 «наблюдаемость отказов»).
					const message = `Не удалось установить базовую библиотеку: ${String(error)}`;
					context.logger.log('error', 'creation', message);
					new Notice(message);
				}
			})();
		},
	});
}
