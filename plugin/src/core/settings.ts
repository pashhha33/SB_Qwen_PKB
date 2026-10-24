/**
 * Настройки плагина (первая инкарнация модуля settings-ui; DL-251).
 *
 * Норма ADR-002: «кэш, счётчики, журнал, резервные копии, НАСТРОЙКИ, черновики
 * миграций — в `.sb/` (JSON)». Поэтому настройки живут в `.sb/settings.json`,
 * а НЕ в data.json (стандартное место Obsidian) — осознанное следование норме;
 * data.json остаётся пустым и в .gitignore хранилища не нужен.
 *
 * Формат файла — плоский JSON с секциями; отсутствующие ключи дополняются
 * значениями по умолчанию (настройки переживают расширение формата).
 */

import type { VaultAdapter } from '../adapter/vault-adapter';
import { DEFAULT_LOG_SETTINGS, type ActivityLogSettings } from './activity-log';

export const SETTINGS_PATH = '.sb/settings.json';

export interface PluginSettings {
	logging: ActivityLogSettings;
	/** Режим подписей LabelResolver (view/source) — сохраняется между сессиями (ADR-003). */
	labelMode: 'view' | 'source';
}

export const DEFAULT_SETTINGS: PluginSettings = {
	logging: { ...DEFAULT_LOG_SETTINGS, levels: { ...DEFAULT_LOG_SETTINGS.levels } },
	labelMode: 'view',
};

/** Читает настройки из .sb/settings.json, дополняя отсутствующее значениями по умолчанию. */
export async function loadSettings(adapter: VaultAdapter): Promise<PluginSettings> {
	const settings: PluginSettings = {
		logging: { ...DEFAULT_SETTINGS.logging, levels: { ...DEFAULT_SETTINGS.logging.levels } },
		labelMode: DEFAULT_SETTINGS.labelMode,
	};
	try {
		if (await adapter.dataExists(SETTINGS_PATH)) {
			const parsed = JSON.parse(await adapter.dataRead(SETTINGS_PATH)) as Partial<PluginSettings>;
			if (parsed.logging && typeof parsed.logging === 'object') {
				settings.logging = {
					enabled: typeof parsed.logging.enabled === 'boolean' ? parsed.logging.enabled : settings.logging.enabled,
					levels: { ...settings.logging.levels, ...(parsed.logging.levels ?? {}) },
					maxLines:
						typeof parsed.logging.maxLines === 'number' && parsed.logging.maxLines >= 100
							? Math.floor(parsed.logging.maxLines)
							: settings.logging.maxLines,
					logValidation:
						typeof parsed.logging.logValidation === 'boolean'
							? parsed.logging.logValidation
							: settings.logging.logValidation,
				};
			}
			if (parsed.labelMode === 'view' || parsed.labelMode === 'source') {
				settings.labelMode = parsed.labelMode;
			}
		}
	} catch {
		// Битый файл настроек — не катастрофа: работаем с значениями по умолчанию
		// и сообщаем (журнал ещё не создан — консоль).
		console.warn('[second-brain] настройки в .sb/settings.json не прочитались — использую значения по умолчанию');
	}
	return settings;
}

/** Сохраняет настройки в .sb/settings.json (создавая папку при необходимости). */
export async function saveSettings(adapter: VaultAdapter, settings: PluginSettings): Promise<void> {
	await adapter.dataCreateFolder('.sb');
	await adapter.dataWrite(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`);
}
