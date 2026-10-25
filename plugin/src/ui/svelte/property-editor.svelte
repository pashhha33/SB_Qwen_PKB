<script lang="ts">
	/**
	 * property-editor (B1.2 часть 1, DL-261: Svelte 5 внутри оболочки Modal):
	 * форма свойств объекта с РУССКИМИ подписями (LabelResolver) и условными
	 * полями (applies_when, М1–М7).
	 *
	 * Принципы (нормы — 04-attributes §11, ADR-011, DL-183):
	 *   - уровень 1 контроля: некорректное ЗНАЧЕНИЕ не даёт сохранить (ошибка
	 *     под полем); отсутствие обязательного поля сохранению не мешает —
	 *     «сначала объект, потом поля», недостающее покажет validate-object;
	 *   - М1: видимость условных полей пересчитывается ЖИВЬЁМ при вводе;
	 *   - М2: значения скрытых полей сохраняются при записи (не удаляются);
	 *   - service-свойства в модель не попадают (08-views §7 — их ведёт плагин);
	 *   - display.* (DL-123): звёзды/прогресс рисуются в предпросмотре и НЕ
	 *     хранятся в данных (М1/DL-117).
	 */
	import { untrack } from 'svelte';
	import { nowStamp } from '../../core/datetime';
	import { renderNumberDisplay } from '../../core/display-renderer';
	import type { PropertyDef } from '../../core/registry';
	import { coerceFormInput, initialEditRows, validateFieldValues, type FormModel, type FormValues } from '../../core/object-service';

	interface Props {
		model: FormModel;
		categories: string[];
		labelMode: 'view' | 'source';
		computeVisibility: (values: FormValues) => Set<string>;
		/** Подбор цели ссылки окном поиска (оболочка передаёт link-picker); null — только ручной ввод. */
		pickReference?: ((def: PropertyDef) => Promise<string | null>) | null;
		onSave: (title: string, values: FormValues) => void | Promise<void>;
	}

	let { model, labelMode, computeVisibility, pickReference = null, onSave }: Props = $props();

	// Локальный режим подписей (B1.2 часть 2): переключается прямо в форме,
	// стартовое значение — глобальный режим (toggle-label-mode). Глобальная команда
	// применяется к вновь открываемым формам (открытая форма — снимок, DL-271).
	let localLabelMode = $state<'view' | 'source'>(untrack(() => labelMode));

	// Модель формы неизменна, пока модалка открыта: локальное состояние —
	// снимок начальных значений (untrack — осознанный захват, без подписки).
	let title = $state(untrack(() => model.title));
	let saving = $state(false);
	let saveError = $state<string | null>(null);

	// Весь ввод держим строками (единое состояние контролов); булевы — 'true'/'false'.
	// initialEditRows (фикс 0.8.1, DL-270): одиночное поле всегда получает одну строку —
	// пустую, если значения нет; иначе контрол не отрисуется ({#each []} рисует ничего).
	let edits = $state<Record<string, string[]>>(
		untrack(() => {
			const initial: Record<string, string[]> = {};
			for (const field of model.fields) {
				initial[field.def.key] = initialEditRows(field.values, field.multiple);
			}
			return initial;
		}),
	);

	function coerceField(key: string): { values: unknown[]; error: string | null } {
		const field = model.fields.find((f) => f.def.key === key);
		if (field === undefined) {
			return { values: [], error: null };
		}
		const out: unknown[] = [];
		for (const raw of edits[key] ?? []) {
			const result = coerceFormInput(field.def, raw);
			if (!result.ok) {
				return { values: out, error: result.error };
			}
			if (result.value !== '') {
				out.push(result.value);
			}
		}
		return { values: out, error: null };
	}

	let coerced = $derived.by(() => {
		const map: Record<string, { values: unknown[]; error: string | null }> = {};
		for (const field of model.fields) {
			map[field.def.key] = coerceField(field.def.key);
		}
		return map;
	});

	let typedValues = $derived.by(() => {
		const values: FormValues = {};
		for (const field of model.fields) {
			values[field.def.key] = coerced[field.def.key].values;
		}
		return values;
	});

	// М1: видимость условных полей — живой пересчёт по текущему вводу.
	let visible = $derived(computeVisibility(typedValues));

	let errors = $derived.by(() => {
		const map: Record<string, string | null> = {};
		for (const field of model.fields) {
			const c = coerced[field.def.key];
			map[field.def.key] = c.error ?? validateFieldValues(field.def, c.values);
		}
		return map;
	});

	let canSave = $derived(title.trim() !== '' && !saving && model.fields.every((f) => errors[f.def.key] === null));

	function updateRow(key: string, index: number, raw: string): void {
		const rows = edits[key] ?? [];
		rows[index] = raw;
		edits[key] = [...rows];
	}
	function addRow(key: string): void {
		edits[key] = [...(edits[key] ?? []), ''];
	}
	function removeRow(key: string, index: number): void {
		edits[key] = (edits[key] ?? []).filter((_, i) => i !== index);
	}

	async function handleSave(): Promise<void> {
		if (!canSave) {
			return;
		}
		saving = true;
		saveError = null;
		try {
			// Передаём ВСЕ значения, включая скрытые условные (М2 — не удаляются).
			await onSave(title.trim(), typedValues);
		} catch (error) {
			saveError = error instanceof Error ? error.message : String(error);
		} finally {
			saving = false;
		}
	}

	function labelOf(key: string, viewLabel: string): string {
		return localLabelMode === 'source' ? key : viewLabel;
	}

	/** Кнопка «Выбрать…» — для ссылок на объекты (media_target: file — этап D, граница B1.2-7). */
	function pickerAvailable(valueType: string, mediaTarget: string | null): boolean {
		if (pickReference === null) {
			return false;
		}
		if (valueType === 'object_reference') {
			return true;
		}
		return valueType === 'media_reference' && mediaTarget !== 'file';
	}

	async function pickInto(key: string, index: number, def: PropertyDef): Promise<void> {
		if (pickReference === null) {
			return;
		}
		const link = await pickReference(def);
		if (link !== null) {
			updateRow(key, index, link);
		}
	}

	function quickDate(kind: 'today' | 'unknown'): string {
		return kind === 'today' ? nowStamp().slice(0, 10) : '0000-00-00';
	}

	function placeholderFor(valueType: string): string {
		switch (valueType) {
			case 'date':
				return 'ГГГГ-ММ-ДД (неизвестная часть — «00»)';
			case 'datetime':
				return 'ГГГГ-ММ-ДДTЧЧ:мм';
			case 'number':
				return 'число, например 7 или 7.5';
			case 'object_reference':
			case 'media_reference':
				return '[[ПРЕФИКС-ULID.md|название]]';
			default:
				return '';
		}
	}
</script>

<div class="sb-form">
	<div class="sb-toolbar">
		<button
			type="button"
			class="sb-mode"
			title="Как показывать подписи полей в этой форме (глобальный режим — команда toggle-label-mode)"
			onclick={() => (localLabelMode = localLabelMode === 'view' ? 'source' : 'view')}
		>
			Подписи: {localLabelMode === 'view' ? 'русские' : 'ключи'}
		</button>
	</div>

	<div class="sb-field">
		<span class="sb-label">Название <span class="sb-required" title="Обязательный системный атрибут">*</span></span>
		<input type="text" value={title} oninput={(e) => (title = e.currentTarget.value)} />
	</div>

	{#each model.fields as field (field.def.key)}
		{#if visible.has(field.def.key)}
			<div class="sb-field">
				<span class="sb-label">
					{labelOf(field.def.key, field.label)}
					{#if field.def.required}
						<span class="sb-optional-hint" title="Сохранить без него можно: недостающее покажет проверка (validate-object)">обязательное</span>
					{:else}
						<span class="sb-optional-hint">необязательное</span>
					{/if}
					{#if localLabelMode === 'view' && field.label !== field.def.key}
						<span class="sb-key">{field.def.key}</span>
					{/if}
				</span>

				{#if field.def.allowedValues.length > 0 && !field.multiple}
					<select value={edits[field.def.key]?.[0] ?? ''} onchange={(e) => updateRow(field.def.key, 0, e.currentTarget.value)}>
						<option value="">— не выбрано —</option>
						{#each field.def.allowedValues as option}
							<option value={option}>{option}</option>
						{/each}
					</select>
				{:else if field.def.valueType === 'boolean' && !field.multiple}
					<label class="sb-check">
						<input
							type="checkbox"
							checked={(edits[field.def.key]?.[0] ?? '') === 'true'}
							onchange={(e) => updateRow(field.def.key, 0, e.currentTarget.checked ? 'true' : 'false')}
						/>
						<span>да</span>
					</label>
				{:else}
					{#each edits[field.def.key]?.length ? edits[field.def.key] : field.multiple ? [] : [''] as row, index}
						<div class="sb-row">
							{#if field.def.allowedValues.length > 0}
								<select value={row} onchange={(e) => updateRow(field.def.key, index, e.currentTarget.value)}>
									<option value="">— не выбрано —</option>
									{#each field.def.allowedValues as option}
										<option value={option}>{option}</option>
									{/each}
								</select>
							{:else if field.def.valueType === 'boolean'}
								<label class="sb-check">
									<input
										type="checkbox"
										checked={row === 'true'}
										onchange={(e) => updateRow(field.def.key, index, e.currentTarget.checked ? 'true' : 'false')}
									/>
									<span>да</span>
								</label>
							{:else}
								<input
									type={field.def.valueType === 'number' ? 'number' : 'text'}
									step="any"
									placeholder={placeholderFor(field.def.valueType)}
									value={row}
									oninput={(e) => updateRow(field.def.key, index, e.currentTarget.value)}
								/>
								{#if pickerAvailable(field.def.valueType, field.def.mediaTarget)}
									<button type="button" class="sb-pick" title="Найти объект хранилища и вставить каноническую ссылку" onclick={() => pickInto(field.def.key, index, field.def)}>Выбрать…</button>
								{/if}
								{#if field.def.valueType === 'date'}
									<button type="button" class="sb-pick" title="Текущая дата (локальное время, ADR-006)" onclick={() => updateRow(field.def.key, index, quickDate('today'))}>Сегодня</button>
									{#if !field.def.required}
										<button type="button" class="sb-pick" title="Дата неизвестна целиком — допустимо в необязательном поле (П2)" onclick={() => updateRow(field.def.key, index, quickDate('unknown'))}>Неизвестна</button>
									{/if}
								{:else if field.def.valueType === 'datetime'}
									<button type="button" class="sb-pick" title="Текущие дата и время (точность до минут)" onclick={() => updateRow(field.def.key, index, nowStamp())}>Сейчас</button>
								{/if}
							{/if}
							{#if field.multiple}
								<button type="button" class="sb-remove" title="Удалить значение" onclick={() => removeRow(field.def.key, index)}>×</button>
							{/if}
						</div>
					{/each}
					{#if field.multiple}
						<button type="button" class="sb-add" onclick={() => addRow(field.def.key)}>+ добавить значение</button>
					{/if}
				{/if}

				{#if field.def.valueType === 'number' && coerced[field.def.key]?.values.length > 0 && field.def.display !== null}
					{@const rendered = renderNumberDisplay(coerced[field.def.key].values[0], field.def.display)}
					{#if rendered.mode !== 'plain'}
						<span class="sb-preview">{rendered.text}</span>
					{/if}
				{/if}

				{#if errors[field.def.key]}
					<span class="sb-error">{errors[field.def.key]}</span>
				{/if}
			</div>
		{/if}
	{/each}

	{#if saveError}
		<div class="sb-error">{saveError}</div>
	{/if}

	<div class="sb-actions">
		<button type="button" class="mod-cta" disabled={!canSave} onclick={handleSave}>
			{saving ? 'Сохранение…' : 'Сохранить'}
		</button>
	</div>
</div>

<style>
	.sb-form {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 4px 0;
	}
	.sb-field {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.sb-label {
		font-weight: 600;
		font-size: 0.95em;
	}
	.sb-key {
		color: var(--text-muted, #888);
		font-weight: 400;
		font-size: 0.85em;
		margin-left: 6px;
	}
	.sb-required {
		color: var(--text-error, #e93147);
	}
	.sb-optional-hint {
		color: var(--text-muted, #999);
		font-weight: 400;
		font-size: 0.8em;
		margin-left: 6px;
	}
	.sb-error {
		color: var(--text-error, #e93147);
		font-size: 0.85em;
	}
	.sb-preview {
		color: var(--text-muted, #888);
		font-size: 0.95em;
	}
	.sb-row {
		display: flex;
		gap: 6px;
		align-items: center;
	}
	.sb-row input[type='text'],
	.sb-row input[type='number'],
	.sb-row select,
	.sb-field > input[type='text'],
	.sb-field > select {
		flex: 1;
		background: var(--background-modifier-form-field, transparent);
		color: var(--text-normal, inherit);
		border: 1px solid var(--background-modifier-border, #ccc);
		border-radius: 4px;
		padding: 4px 8px;
	}
	.sb-check {
		display: flex;
		gap: 6px;
		align-items: center;
		font-weight: 400;
	}
	.sb-add,
	.sb-remove,
	.sb-pick,
	.sb-mode {
		font-size: 0.85em;
		padding: 2px 8px;
	}
	.sb-toolbar {
		display: flex;
		justify-content: flex-end;
	}
	.sb-pick {
		white-space: nowrap;
	}
	.sb-actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 4px;
	}
</style>
