/**
 * Контракт-тесты LinkPickerModal — регрессия дефекта 0.9.0 (DL-274).
 *
 * Дефект (отчёт пользователя из ручной проверки): «Выбрать…» открывает окно,
 * объекты видны, но клик по кандидату НЕ вставляет ссылку в поле формы.
 * Причина — гонка порядка вызовов Obsidian: SuggestModal.selectSuggestion()
 * вызывает close() РАНЬШЕ onChooseSuggestion(), т.е. onClose срабатывает ДО
 * передачи выбора; немедленный onPick(null) («отказ») «съедал» выбор.
 * Фикс 0.9.1: отказ фиксируется ОТЛОЖЕННО (setTimeout 0) — выбор успевает
 * зарегистрироваться синхронно; фикс от порядка вызовов не зависит.
 *
 * Стаб модуля 'obsidian' (tests/support/obsidian-stub.ts, алиас vitest.config.ts)
 * воспроизводит реальный порядок close → choose; журнал stubCalls фиксирует
 * этот порядок как контракт стаба.
 */

import { describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { LinkPickerModal } from '../../src/ui/link-picker-modal';
import type { PluginContext } from '../../src/commands/context';
import type { ActivityLog } from '../../src/core/activity-log';
import type { PropertyDef, TypeRegistry } from '../../src/core/registry';
import { FakeVault } from '../support/fake-vault';

// Crockford-ULID: без I/L/O/U.
const P1 = '01J8Z6M4K2Q7V9X3N5B0C1D2A1';
const B1 = '01J8Z6M4K2Q7V9X3N5B0C1D2A3';

/** Один макротаск: к этому моменту отложенный setTimeout(0) гарантированно отработал. */
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Журнал вызовов стаба SuggestModal (контракт порядка). */
interface StubCalls {
	readonly stubCalls: string[];
}

function makeDef(): PropertyDef {
	return { key: 'author', label: 'Автор', valueType: 'object_reference', targetTypeKeys: ['person'] } as unknown as PropertyDef;
}

function makeContext(vault: FakeVault): { context: PluginContext; log: ReturnType<typeof vi.fn> } {
	const log = vi.fn();
	const registry = {
		getType: (key: string) => {
			if (key === 'person') {
				return { key: 'person', label: 'Человек' };
			}
			if (key === 'book') {
				return { key: 'book', label: 'Книга' };
			}
			return null;
		},
	} as unknown as TypeRegistry;
	const context = {
		app: {} as App,
		adapter: vault,
		registry,
		logger: { log } as unknown as ActivityLog,
	} as unknown as PluginContext;
	return { context, log };
}

/** Хранилище-фикстура: человек и книга (типы в frontmatter, заголовки там же). */
async function seedVault(): Promise<FakeVault> {
	const vault = await FakeVault.create();
	await vault.put(`Persons/PERSON-${P1}.md`, `---\ntype: person\ntitle: Аркадий Стругацкий\n---\nТело\n`);
	await vault.put(`Books/BOOK-${B1}.md`, `---\ntype: book\ntitle: Понедельник начинается в субботу\n---\nТело\n`);
	return vault;
}

function makeModal(context: PluginContext, picked: Array<string | null>, def = makeDef(), excludePath: string | null = null): LinkPickerModal {
	return new LinkPickerModal(context, def, excludePath, (link) => {
		picked.push(link);
	});
}

describe('LinkPickerModal — порядок close/choose (контракт Obsidian, DL-274)', () => {
	it('стаб воспроизводит Obsidian: close() вызывается РАНЬШЕ onChooseSuggestion()', async () => {
		const vault = await seedVault();
		try {
			const { context } = makeContext(vault);
			const picked: Array<string | null> = [];
			const modal = makeModal(context, picked);
			const candidates = await modal.getSuggestions('');
			expect(candidates).toHaveLength(1);
			modal.selectSuggestion(candidates[0], {} as MouseEvent);
			expect((modal as unknown as StubCalls).stubCalls).toEqual(['close', 'choose']);
		} finally {
			await vault.cleanup();
		}
	});

	it('регрессия DL-274: выбор кандидата → onPick сразу получает каноническую ссылку (НЕ null)', async () => {
		const vault = await seedVault();
		try {
			const { context } = makeContext(vault);
			const picked: Array<string | null> = [];
			const modal = makeModal(context, picked);
			const candidates = await modal.getSuggestions('');
			modal.selectSuggestion(candidates[0], {} as MouseEvent);
			// Выбор регистрируется синхронно — до всяких отложенных «отказов».
			expect(picked).toEqual([`[[PERSON-${P1}.md|Аркадий Стругацкий]]`]);
			await tick();
			// Отложенный отказ (onClose) НЕ перезатёр выбор вторым вызовом.
			expect(picked).toHaveLength(1);
		} finally {
			await vault.cleanup();
		}
	});

	it('закрытие без выбора (Esc/клик мимо) → onPick(null) ОТЛОЖЕННО, ровно один раз', async () => {
		const vault = await seedVault();
		try {
			const { context } = makeContext(vault);
			const picked: Array<string | null> = [];
			const modal = makeModal(context, picked);
			await modal.getSuggestions(''); // дожидаемся индекс (иначе гонка с cleanup)
			modal.close();
			// Сразу после close() отказа ещё нет — окно выбора как раз может его догнать.
			expect(picked).toEqual([]);
			await tick();
			expect(picked).toEqual([null]);
		} finally {
			await vault.cleanup();
		}
	});
});

describe('LinkPickerModal — связка с ядром (индекс, фильтр, журнал)', () => {
	it('getSuggestions: индекс из хранилища, фильтр target_types, каноническая ссылка', async () => {
		const vault = await seedVault();
		try {
			const { context } = makeContext(vault);
			const picked: Array<string | null> = [];
			const modal = makeModal(context, picked);
			const candidates = await modal.getSuggestions('');
			// def нацелен на person — книга не предлагается.
			expect(candidates).toHaveLength(1);
			expect(candidates[0].typeKey).toBe('person');
			expect(candidates[0].canonicalLink).toBe(`[[PERSON-${P1}.md|Аркадий Стругацкий]]`);
		} finally {
			await vault.cleanup();
		}
	});

	it('getSuggestions: запрос фильтрует по подстроке, excludePath исключает саму заметку', async () => {
		const vault = await seedVault();
		try {
			const { context } = makeContext(vault);
			const picked: Array<string | null> = [];
			const anyDef = { key: 'related', label: 'Связано с', valueType: 'object_reference', targetTypeKeys: [] } as unknown as PropertyDef;
			const modal = makeModal(context, picked, anyDef);
			expect(await modal.getSuggestions('понедельник')).toHaveLength(1);
			expect(await modal.getSuggestions('стругацкий')).toHaveLength(1);
			expect(await modal.getSuggestions('нет-такого')).toHaveLength(0);
			const excluding = makeModal(context, picked, anyDef, `Persons/PERSON-${P1}.md`);
			expect(await excluding.getSuggestions('')).toHaveLength(1); // осталась только книга
		} finally {
			await vault.cleanup();
		}
	});

	it('наблюдаемость (урок DL-264): выбор и отказ пишутся в журнал (info/edit)', async () => {
		const vault = await seedVault();
		try {
			const { context, log } = makeContext(vault);
			const picked: Array<string | null> = [];
			const modal = makeModal(context, picked);
			const candidates = await modal.getSuggestions('');
			modal.selectSuggestion(candidates[0], {} as MouseEvent);
			expect(log).toHaveBeenCalledWith('info', 'edit', expect.stringContaining(`PERSON-${P1}.md`));

			const refused = makeModal(context, picked);
			await refused.getSuggestions('');
			refused.close();
			await tick();
			expect(log).toHaveBeenCalledWith('info', 'edit', expect.stringContaining('без выбора'));
		} finally {
			await vault.cleanup();
		}
	});
});
