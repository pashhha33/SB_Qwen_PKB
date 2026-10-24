/**
 * Журнал плагина (модуль activity-log; требование пользователя 2026-10-24, DL-251).
 *
 * Что это: «бортовой самописец» плагина — все значимые действия (загрузка, создание
 * объектов, проверки, ошибки) пишутся строками в .sb/logs/plugin-log.jsonl
 * (JSON Lines — как relations/migrations/alias-collections: по строке на запись,
 * UTF-8 без BOM, LF — ADR-010).
 *
 * Уровни (имена — по делегированию пользователя, DL-251; словарь согласован с
 * severity-policy, чтобы одни слова значили одно и то же):
 *   error   (ошибка)        — действие не выполнилось или данные под угрозой;
 *   warning (предупреждение)— выполнено, но есть повод обратить внимание;
 *   info    (сообщение)     — обычные действия: создано, загружено, проверено;
 *   debug   (отладка)       — технические детали для разработчика (по умолчанию выключен).
 *
 * Хранение и показ:
 *   - файл — история (переживает перезагрузку плагина);
 *   - кольцевой буфер в памяти — для модалки журнала и «живого режима» (live):
 *     подписчики получают записи мгновенно, не дожидаясь сброса в файл;
 *   - сброс в файл — пачками (debounce) и при выгрузке плагина; файл ограничен
 *     настройкой maxLines (хвост сохраняется, голова отбрасывается).
 *
 * Настройки (включённость, уровни, лимит) — в .sb/settings.json (ADR-002: настройки
 * плагина живут в .sb/, а не в data.json — осознанное следование норме, см. settings.ts).
 *
 * Ядро среда-независимо: только VaultAdapter (запись .sb/) и setTimeout — ни
 * импорта 'obsidian', ни UI. Модалка показа — src/commands/show-log.ts (слой 4/5).
 */

import type { VaultAdapter } from '../adapter/vault-adapter';
import { formatDateTimeWithSecondsLocal } from './datetime';

export const LOG_PATH = '.sb/logs/plugin-log.jsonl';

export type LogLevel = 'error' | 'warning' | 'info' | 'debug';

/** Порядок уровней для фильтров (строже → мягче). */
export const LOG_LEVELS: readonly LogLevel[] = ['error', 'warning', 'info', 'debug'];

export interface LogEntry {
	/** Локальная метка времени с секундами: YYYY-MM-DDTHH:mm:ss (без смещения — ADR-006 по духу). */
	ts: string;
	level: LogLevel;
	/** Область (подсистема): 'plugin', 'registry', 'creation', 'validation', 'bootstrap', 'cache', 'settings', 'log'. */
	area: string;
	message: string;
	/** Произвольные детали (id, пути, счётчики) — для debug-разбора. */
	data?: Record<string, unknown>;
}

export interface ActivityLogSettings {
	/** Главный выключатель журнала. */
	enabled: boolean;
	/** Какие уровни писать (отдельные выключатели в настройках плагина). */
	levels: Record<LogLevel, boolean>;
	/** Лимит строк в файле (хвост сохраняется). */
	maxLines: number;
	/** Писать ли результаты проверок (validate-object/validate-vault). */
	logValidation: boolean;
}

export const DEFAULT_LOG_SETTINGS: ActivityLogSettings = {
	enabled: true,
	levels: { error: true, warning: true, info: true, debug: false },
	maxLines: 5000,
	logValidation: true,
};

export type LogListener = (entry: LogEntry) => void;

/** Функция логирования, которую ядро передаёт в сервисы (creation, validation). */
export type LogFn = (level: LogLevel, area: string, message: string, data?: Record<string, unknown>) => void;

/** Сколько записей держать в памяти для модалки (не зависит от maxLines файла). */
const MEMORY_BUFFER_LIMIT = 2000;

/** Пауза пачкового сброса в файл (мс): частые записи склеиваются в один write. */
const FLUSH_DEBOUNCE_MS = 1500;

export class ActivityLog {
	private buffer: LogEntry[] = [];
	private listeners = new Set<LogListener>();
	private pending: LogEntry[] = [];
	private flushTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private readonly adapter: VaultAdapter,
		public settings: ActivityLogSettings,
	) {}

	/** Загрузить хвост файла в буфер (при старте плагина — модалка видит историю). */
	async init(): Promise<void> {
		try {
			if (await this.adapter.dataExists(LOG_PATH)) {
				const raw = await this.adapter.dataRead(LOG_PATH);
				const entries: LogEntry[] = [];
				for (const line of raw.split('\n')) {
					if (line.trim() === '') {
						continue;
					}
					try {
						entries.push(JSON.parse(line) as LogEntry);
					} catch {
						// Битая строка пропускается (повреждённая запись не применяется — дух M4 ADR-010).
					}
				}
				this.buffer = entries.slice(-MEMORY_BUFFER_LIMIT);
			}
		} catch {
			// Файл не читается — начинаем с чистого буфера; журнал операционный, не основные данные.
		}
	}

	/** Записать entry (учитывая выключатели). Также рассылает подписчикам (live-режим). */
	log(level: LogLevel, area: string, message: string, data?: Record<string, unknown>): void {
		if (!this.settings.enabled || !this.settings.levels[level]) {
			return;
		}
		const entry: LogEntry = {
			ts: formatDateTimeWithSecondsLocal(new Date()),
			level,
			area,
			message,
			...(data !== undefined ? { data } : {}),
		};
		this.buffer.push(entry);
		if (this.buffer.length > MEMORY_BUFFER_LIMIT) {
			this.buffer.splice(0, this.buffer.length - MEMORY_BUFFER_LIMIT);
		}
		this.pending.push(entry);
		for (const listener of this.listeners) {
			try {
				listener(entry);
			} catch {
				// сбой подписчика не ломает логирование
			}
		}
		this.scheduleFlush();
	}

	/** Удобная обёртка для передачи в сервисы (creation, validation). */
	readonly fn: LogFn = (level, area, message, data) => this.log(level, area, message, data);

	/** Последние записи из памяти (для модалки), опционально с фильтром по уровню. */
	tail(limit = 300, levelFilter?: LogLevel): LogEntry[] {
		const source = levelFilter ? this.buffer.filter((entry) => entry.level === levelFilter) : this.buffer;
		return source.slice(-limit);
	}

	/** Подписка для live-режима; возвращает функцию отписки. */
	subscribe(listener: LogListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private scheduleFlush(): void {
		if (this.flushTimer !== null) {
			return;
		}
		this.flushTimer = setTimeout(() => {
			this.flushTimer = null;
			void this.flush();
		}, FLUSH_DEBOUNCE_MS);
	}

	/** Сбросить накопленные записи в файл (пачкой), соблюдая лимит maxLines. */
	async flush(): Promise<void> {
		if (this.flushTimer !== null) {
			clearTimeout(this.flushTimer);
			this.flushTimer = null;
		}
		if (this.pending.length === 0) {
			return;
		}
		const batch = this.pending;
		this.pending = [];
		try {
			let existing: string[] = [];
			if (await this.adapter.dataExists(LOG_PATH)) {
				const raw = await this.adapter.dataRead(LOG_PATH);
				existing = raw.split('\n').filter((line) => line.trim() !== '');
			}
			const appended = [...existing, ...batch.map((entry) => JSON.stringify(entry))];
			const limit = Math.max(100, this.settings.maxLines);
			const trimmed = appended.length > limit ? appended.slice(appended.length - limit) : appended;
			await this.adapter.dataWrite(LOG_PATH, `${trimmed.join('\n')}\n`);
		} catch (error) {
			// Потеря записи журнала не должна ломать операцию, которую журналировали.
			// Возвращаем пачку в pending — следующая попытка повторит.
			this.pending.unshift(...batch);
			this.logDirectlyToConsole('warn', `[second-brain] не удалось записать журнал: ${String(error)}`);
		}
	}

	/** Очистить журнал (файл и буфер) — явное действие пользователя из модалки/настроек. */
	async clear(): Promise<void> {
		this.buffer = [];
		this.pending = [];
		try {
			await this.adapter.dataWrite(LOG_PATH, '');
		} catch {
			// не критично: буфер пуст, файл перетрётся при следующем flush
		}
	}

	/** Журнал не должен зависеть от самого журнала — ошибки сброса идут в консоль. */
	private logDirectlyToConsole(kind: 'warn' | 'error', message: string): void {
		if (kind === 'warn') {
			console.warn(message);
		} else {
			console.error(message);
		}
	}
}
