/**
 * LabelResolver (модуль label-resolver, этап A; норма ADR-003).
 *
 * Два режима отображения:
 *   - view   — русские подписи (label) из определений;
 *   - source — технические ключи (snake_case).
 * Переключение — команда toggle-label-mode (этап B; в A2 режим хранится в памяти
 * и используется командами/валидацией для формирования сообщений).
 *
 * Подписи ГАРАНТИРОВАННО показываются в наших модалках, представлениях, сообщениях
 * валидации и командах (ADR-003). Резервное поведение (мера M4 ADR-001 по духу):
 * если label не найден — показывается ключ, а не пустота.
 *
 * Ограничение A2 (до решения F5-8): ключи свойств уникальны в пределах типа
 * (property.key.unique_in_type), но привязка свойства к типу в данных не кодируется —
 * подпись ищется по первому определению с таким key. После F5-8 поиск станет
 * типобластным.
 */

import type { TypeRegistry } from './registry';

export type LabelMode = 'view' | 'source';

export class LabelResolver {
	mode: LabelMode = 'view';

	constructor(private registry: TypeRegistry) {}

	setMode(mode: LabelMode): void {
		this.mode = mode;
	}

	toggle(): LabelMode {
		this.mode = this.mode === 'view' ? 'source' : 'view';
		return this.mode;
	}

	/** Подпись свойства: view → label (fallback key), source → key. */
	forPropertyKey(key: string): string {
		if (this.mode === 'source') {
			return key;
		}
		const defs = this.registry.getPropertiesByKey(key);
		return defs.length > 0 ? defs[0].label : key;
	}

	/** Подпись типа: view → label (fallback type_key), source → type_key. */
	forTypeKey(typeKey: string): string {
		if (this.mode === 'source') {
			return typeKey;
		}
		const def = this.registry.getType(typeKey);
		return def ? def.label : typeKey;
	}
}
