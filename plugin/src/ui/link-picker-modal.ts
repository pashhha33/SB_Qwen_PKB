/**
 * LinkPickerModal (B1.2 часть 2, DL-273): подбор цели ссылки для полей
 * `object_reference` / `media_reference` (media_target: object|both) в форме
 * свойств — закрывает границу B1.2-1 (контрол ссылки был текстовым полем).
 *
 * Слой 5 (UI): SuggestModal Obsidian даёт окно с поисковой строкой и клавиатурной
 * навигацией; весь поиск — в ядре (object-service#searchReferenceTargets), окно
 * лишь показывает кандидатов и возвращает каноническую ссылку (ADR-001 + DL-186).
 *
 * Индекс хранилища с типами и заголовками строится ОДИН раз на открытие окна
 * (лениво, до загрузки список пуст — SuggestModal.updateSuggestions() обновляет
 * его после построения). Псевдонимы в поиске не участвуют — alias-index это B2.
 *
 * Порядок вызовов Obsidian (урок DL-274, дефект 0.9.0): selectSuggestion()
 * вызывает close() РАНЬШЕ onChooseSuggestion() — onClose срабатывает до передачи
 * выбора, поэтому «отказ» (null) фиксируется отложенно (см. onClose).
 */

import { SuggestModal } from 'obsidian';
import type { PropertyDef } from '../core/registry';
import { searchReferenceTargets, type ReferenceCandidate } from '../core/object-service';
import { buildVaultIndex, type VaultIndex } from '../core/schema-engine';
import type { PluginContext } from '../commands/context';

export class LinkPickerModal extends SuggestModal<ReferenceCandidate> {
	private readonly context: PluginContext;
	/** Индекс строится один раз на открытие; getSuggestions ждёт его (API допускает Promise). */
	private readonly indexPromise: Promise<VaultIndex | null>;
	private settled = false;

	constructor(
		context: PluginContext,
		private readonly def: PropertyDef,
		private readonly excludePath: string | null,
		private readonly onPick: (link: string | null) => void,
	) {
		super(context.app);
		this.context = context;
		const targets = def.targetTypeKeys.length > 0 ? def.targetTypeKeys.join(', ') : 'любой тип';
		this.setPlaceholder(`Цель: ${def.label} — поиск по названию (типы: ${targets})…`);
		this.emptyStateText = 'Ничего не найдено (индекс строится или нет объектов допустимых типов)';
		this.indexPromise = this.loadIndex();
	}

	private async loadIndex(): Promise<VaultIndex | null> {
		try {
			return await buildVaultIndex(this.context.adapter, { readTypes: true });
		} catch (error) {
			this.context.logger.log('warning', 'edit', `Подбор ссылки: не удалось построить индекс хранилища: ${String(error)}`);
			return null;
		}
	}

	async getSuggestions(query: string): Promise<ReferenceCandidate[]> {
		const index = await this.indexPromise;
		if (index === null) {
			return [];
		}
		return searchReferenceTargets(index, this.context.registry, this.def.targetTypeKeys, query, {
			limit: 50,
			excludePath: this.excludePath,
		});
	}

	renderSuggestion(candidate: ReferenceCandidate, el: HTMLElement): void {
		el.createEl('div', { text: candidate.title });
		el.createEl('small', { text: `${candidate.typeLabel ?? candidate.typeKey} · ${candidate.path}` });
	}

	onChooseSuggestion(candidate: ReferenceCandidate): void {
		this.settled = true;
		this.context.logger.log('info', 'edit', `Подбор ссылки: выбрана цель «${candidate.title}» (${candidate.path}) — в поле вставлена ${candidate.canonicalLink}`);
		this.onPick(candidate.canonicalLink);
	}

	onClose(): void {
		// ДЕФЕКТ 0.9.0 (DL-274): Obsidian в selectSuggestion() вызывает close() РАНЬШЕ
		// onChooseSuggestion() — этот onClose срабатывает ДО передачи выбора. Немедленный
		// onPick(null) фиксировал «отказ» раньше выбора, и клик по кандидату «съедался»
		// (поле формы оставалось пустым). Поэтому отказ (Esc / клик мимо) фиксируем
		// ОТЛОЖЕННО, макротаском: выбор, если он был, регистрируется синхронно раньше,
		// и фикс не зависит от порядка вызовов. Поле при отказе сохраняет текущее значение.
		setTimeout(() => {
			if (!this.settled) {
				this.settled = true;
				this.context.logger.log('info', 'edit', 'Подбор ссылки: окно закрыто без выбора (Esc/клик мимо) — поле не изменено');
				this.onPick(null);
			}
		}, 0);
	}
}
