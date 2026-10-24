import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ActivityLog, DEFAULT_LOG_SETTINGS, LOG_PATH, type LogEntry } from '../../src/core/activity-log';
import { FakeVault } from '../support/fake-vault';

function makeSettings(overrides: Partial<typeof DEFAULT_LOG_SETTINGS> = {}) {
	return { ...DEFAULT_LOG_SETTINGS, levels: { ...DEFAULT_LOG_SETTINGS.levels }, ...overrides };
}

describe('activity-log — журнал плагина (DL-251)', () => {
	let vault: FakeVault;

	beforeEach(async () => {
		vault = await FakeVault.create();
	});
	afterEach(async () => {
		await vault.cleanup();
	});

	it('запись проходит в буфер и (после flush) в файл .sb/logs/plugin-log.jsonl — построчный JSON', async () => {
		const log = new ActivityLog(vault, makeSettings());
		log.log('info', 'creation', 'Создан объект «Книга»', { id: 'X1' });
		log.log('error', 'validation', 'Проверка провалена');
		expect(log.tail(10)).toHaveLength(2);

		await log.flush();
		expect(await vault.dataExists(LOG_PATH)).toBe(true);
		const lines = (await vault.dataRead(LOG_PATH)).trim().split('\n');
		expect(lines).toHaveLength(2);
		const first = JSON.parse(lines[0]) as LogEntry;
		expect(first.level).toBe('info');
		expect(first.area).toBe('creation');
		expect(first.message).toContain('Книга');
		expect(first.data).toEqual({ id: 'X1' });
		expect(first.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/); // локальное время с секундами
	});

	it('выключатели уровней: debug по умолчанию не пишется; включённый — пишется', async () => {
		const log = new ActivityLog(vault, makeSettings());
		log.log('debug', 'registry', 'технические детали');
		expect(log.tail(10)).toHaveLength(0);

		log.settings.levels.debug = true;
		log.log('debug', 'registry', 'технические детали');
		expect(log.tail(10)).toHaveLength(1);
	});

	it('главный выключатель: enabled=false — журнал не ведётся', () => {
		const log = new ActivityLog(vault, makeSettings({ enabled: false }));
		log.log('error', 'plugin', 'эта запись не должна попасть в журнал');
		expect(log.tail(10)).toHaveLength(0);
	});

	it('живой режим (live): подписчик получает записи мгновенно, отписка работает', () => {
		const log = new ActivityLog(vault, makeSettings());
		const received: LogEntry[] = [];
		const unsubscribe = log.subscribe((entry) => received.push(entry));
		log.log('info', 'plugin', 'первое');
		log.log('warning', 'registry', 'второе');
		unsubscribe();
		log.log('info', 'plugin', 'третье — подписчик уже не получит');
		expect(received).toHaveLength(2);
		expect(received[1].level).toBe('warning');
	});

	it('сбой подписчика не ломает логирование', () => {
		const log = new ActivityLog(vault, makeSettings());
		log.subscribe(() => {
			throw new Error('подписчик упал');
		});
		log.log('info', 'plugin', 'запись всё равно создана');
		expect(log.tail(10)).toHaveLength(1);
	});

	it('init() поднимает хвост файла в буфер; битые строки пропускаются', async () => {
		await vault.dataWrite(
			LOG_PATH,
			[
				JSON.stringify({ ts: '2026-10-24T10:00:00', level: 'info', area: 'plugin', message: 'старая запись' }),
				'{ это не json',
				JSON.stringify({ ts: '2026-10-24T10:00:01', level: 'error', area: 'creation', message: 'старая ошибка' }),
				'',
			].join('\n'),
		);
		const log = new ActivityLog(vault, makeSettings());
		await log.init();
		const entries = log.tail(10);
		expect(entries).toHaveLength(2);
		expect(entries[0].message).toBe('старая запись');
	});

	it('flush обрезает файл по maxLines (хвост сохраняется)', async () => {
		const log = new ActivityLog(vault, makeSettings({ maxLines: 100 }));
		// предзаполним файл «историей»
		await vault.dataWrite(LOG_PATH, Array.from({ length: 95 }, (_, i) => JSON.stringify({ ts: `t${i}`, level: 'info', area: 'x', message: `old-${i}` })).join('\n'));
		for (let i = 0; i < 10; i++) {
			log.log('info', 'plugin', `new-${i}`);
		}
		await log.flush();
		const lines = (await vault.dataRead(LOG_PATH)).trim().split('\n');
		expect(lines).toHaveLength(100); // 95 + 10 → обрезано до лимита
		expect(lines[99]).toContain('new-9'); // хвост — свежее
		expect(lines[0]).toContain('old-5'); // голова отброшена
	});

	it('clear() очищает файл и буфер', async () => {
		const log = new ActivityLog(vault, makeSettings());
		log.log('info', 'plugin', 'что-то');
		await log.flush();
		await log.clear();
		expect(log.tail(10)).toHaveLength(0);
		expect((await vault.dataRead(LOG_PATH)).trim()).toBe('');
	});

	it('fn-обёртка передаётся в сервисы и работает как log', () => {
		const log = new ActivityLog(vault, makeSettings());
		const fn = log.fn;
		fn('info', 'creation', 'через обёртку');
		expect(log.tail(10)[0].message).toBe('через обёртку');
	});
});
