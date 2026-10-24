/**
 * Копирование текста в системный буфер обмена (слой UI; DL-256).
 *
 * Почему не в core: это браузерные API (navigator.clipboard, document), которых
 * нет в Node — ядро обязано оставаться среда-независимым (правило М2), поэтому
 * «грязная» обёртка живёт в ui/, а чистое форматирование — в core/activity-log
 * (formatEntriesForCopy).
 *
 * Основной путь — navigator.clipboard.writeText (стандартный Clipboard API).
 * Запасной — скрытый textarea + document.execCommand('copy'): Clipboard API
 * отказывает в отдельных ситуациях (окно без фокуса, ограничения Electron),
 * а потерять копирование журнала для пользователя хуже, чем применить
 * устаревший, но работающий метод.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
	try {
		if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		// не получилось — пробуем запасной путь
	}
	try {
		const area = document.createElement('textarea');
		area.value = text;
		area.setAttribute('readonly', '');
		area.style.cssText = 'position: fixed; top: 0; left: 0; opacity: 0;';
		document.body.appendChild(area);
		area.select();
		const ok = document.execCommand('copy');
		document.body.removeChild(area);
		return ok;
	} catch {
		return false;
	}
}
