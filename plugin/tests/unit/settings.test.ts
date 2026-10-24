import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_PATH, loadSettings, saveSettings } from '../../src/core/settings';
import { FakeVault } from '../support/fake-vault';

describe('settings — .sb/settings.json (ADR-002: настройки в .sb/, не в data.json)', () => {
	let vault: FakeVault;

	beforeEach(async () => {
		vault = await FakeVault.create();
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	it('файла нет — значения по умолчанию (журнал включён, debug выключен)', async () => {
		const settings = await loadSettings(vault);
		expect(settings).toEqual(DEFAULT_SETTINGS);
		expect(settings.logging.enabled).toBe(true);
		expect(settings.logging.levels.debug).toBe(false);
		expect(settings.labelMode).toBe('view');
	});

	it('roundtrip: save → load сохраняет изменения', async () => {
		const settings = await loadSettings(vault);
		settings.logging.levels.debug = true;
		settings.logging.maxLines = 777;
		settings.labelMode = 'source';
		await saveSettings(vault, settings);
		expect(await vault.dataExists(SETTINGS_PATH)).toBe(true);

		const reloaded = await loadSettings(vault);
		expect(reloaded.logging.levels.debug).toBe(true);
		expect(reloaded.logging.maxLines).toBe(777);
		expect(reloaded.labelMode).toBe('source');
	});

	it('неполный файл дополняется значениями по умолчанию (формат расширяем)', async () => {
		await vault.dataWrite(SETTINGS_PATH, JSON.stringify({ logging: { enabled: false } }));
		const settings = await loadSettings(vault);
		expect(settings.logging.enabled).toBe(false);
		expect(settings.logging.levels).toEqual(DEFAULT_SETTINGS.logging.levels);
		expect(settings.labelMode).toBe('view');
	});

	it('битый файл — не катастрофа: работаем с дефолтами', async () => {
		await vault.dataWrite(SETTINGS_PATH, '{ не json');
		const settings = await loadSettings(vault);
		expect(settings).toEqual(DEFAULT_SETTINGS);
	});

	it('maxLines ниже 100 отклоняется (защита от вырожденных значений)', async () => {
		await vault.dataWrite(SETTINGS_PATH, JSON.stringify({ logging: { maxLines: 5 } }));
		const settings = await loadSettings(vault);
		expect(settings.logging.maxLines).toBe(DEFAULT_SETTINGS.logging.maxLines);
	});
});
