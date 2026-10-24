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
 * С F5-8 = А (DL-250) привязка свойства к типу кодируется полем `object_types`:
 * при указании typeKey подпись ищется среди свойств, применимых к этому типу
 * (универсальные + привязанные через предков), иначе — резервный поиск по ключу.
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

	/** Подпись свойства: view → label (fallback key), source → key. При typeKey — поиск среди свойств, применимых к типу (F5-8). */
	forPropertyKey(key: string, typeKey?: string): string {
		if (this.mode === 'source') {
			return key;
		}
		if (typeKey !== undefined) {
			const typed = this.registry.getPropertiesForType(typeKey).find((def) => def.key === key);
			if (typed) {
				return typed.label;
			}
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
