/**
 * Адаптер интеграции Front Matter Title (модуль `front-matter-title-adapter`,
 * 09-modules §2 слой 1; норма — ADR-001 уровень 2 + карточка
 * `docs/integrations/front-matter-title.md`).
 *
 * Что мы делаем и чего НЕ делаем. Front Matter Title (FMT) — сторонний плагин, который
 * подменяет отображаемое название заметки в интерфейсе Obsidian (проводник, вкладки,
 * поиск) значением `title` из frontmatter. Публичного API у него нет, и он нам не нужен:
 * адаптер = **обнаружение + рекомендация + мягкий отказ**, никакого управления чужим
 * плагином (карточка: «решение одной строкой»).
 *
 * Меры ADR-001, которые обеспечивает этот модуль:
 *   - М3 — адаптер изолирован: его сбой не ломает ядро (вызывающий код оборачивает
 *     проверку в try/catch и деградирует молча);
 *   - М4 — резервное поведение: без FMT показывается имя файла, а не пустота (это
 *     штатное поведение Obsidian, от нас ничего не требуется);
 *   - М6 — честная документация границ: рекомендация формулируется как необязательная,
 *     без обещаний по покрытию отображения (у FMT ~10 открытых мелочей — исследование
 *     `research-front-matter-title-stability.md`);
 *   - М1 — отображаемое название никогда не участвует в разрешении ссылок (ссылки
 *     разрешаются по `id` и каноническому пути — этот модуль данные не трогает вовсе).
 *
 * Слой 1 (ядро): файл не импортирует 'obsidian' (М2, тест layering.test.ts). Снимок
 * состояния плагинов среды передаётся снаружи — из main.ts.
 */

/** id плагина Front Matter Title в реестре сообществ (репозиторий snezhig/obsidian-front-matter-title). */
export const FRONT_MATTER_TITLE_ID = 'front-matter-title';

/**
 * Снимок состояния стороннего плагина — то, что main.ts может достать из среды
 * без его API: факт установки (наличие манифеста), факт включения, версия.
 */
export interface ExternalPluginSnapshot {
	/** Плагин установлен (есть в `app.plugins.manifests`). */
	installed: boolean;
	/** Плагин включён пользователем (есть в `app.plugins.enabledPlugins`). */
	enabled: boolean;
	/** Версия из манифеста, если установлена; иначе null. */
	version: string | null;
}

/** Отсутствие FMT (результат по умолчанию, если среда не отдала данных). */
export const NO_FRONT_MATTER_TITLE: ExternalPluginSnapshot = {
	installed: false,
	enabled: false,
	version: null,
};

/** Итог проверки: что сказать пользователю и что записать в журнал. */
export interface FrontMatterTitleAdvice {
	/** Рекомендовать ли установку/включение (показывать Notice). */
	recommend: boolean;
	/** Текст рекомендации (пустой, если recommend === false). */
	message: string;
	/** Уровень записи журнала (M6: не пугаем ошибкой то, что ошибкой не является). */
	logLevel: 'info' | 'debug';
	/** Строка для журнала. */
	logMessage: string;
}

/**
 * Решает, что сообщить о Front Matter Title.
 *
 * Рекомендация показывается, только если плагин не установлен ИЛИ установлен, но
 * выключен. Повторность контролирует вызывающий код (флаг `fmtAdviceShown` в
 * `.sb/settings.json`) — это UX-решение, а не логика адаптера.
 *
 * @param snapshot — состояние FMT в среде;
 * @param alreadyRecommended — рекомендовали ли раньше (флаг из настроек).
 */
export function frontMatterTitleAdvice(
	snapshot: ExternalPluginSnapshot,
	alreadyRecommended = false,
): FrontMatterTitleAdvice {
	if (snapshot.installed && snapshot.enabled) {
		const version = snapshot.version ? ` (версия ${snapshot.version})` : '';
		return {
			recommend: false,
			message: '',
			logLevel: 'debug',
			logMessage: `Front Matter Title${version} установлен и включён — отображаемые названия берёт на себя (уровень 2 ADR-001)`,
		};
	}

	if (snapshot.installed && !snapshot.enabled) {
		return {
			recommend: !alreadyRecommended,
			message:
				'Front Matter Title установлен, но выключен. Включите его в «Настройки → Сторонние плагины», ' +
				'чтобы видеть русские названия заметок вместо имён файлов. Работает и без него: ' +
				'псевдонимы (`aliases`) уже дают читаемое имя в автодополнении ссылок и быстром переключателе.',
			logLevel: 'info',
			logMessage: 'Front Matter Title установлен, но выключен — показаны имена файлов (уровень 1 ADR-001 работает)',
		};
	}

	return {
		recommend: !alreadyRecommended,
		message:
			'Рекомендуем необязательный плагин Front Matter Title: он показывает `title` из frontmatter ' +
			'вместо технического имени файла (BOOK-01J….md) в проводнике, вкладках и поиске. Second Brain ' +
			'полностью работает и без него — псевдонимы уже дают читаемое имя в ссылках и переключателе.',
		logLevel: 'info',
		logMessage:
			'Front Matter Title не установлен — показаны имена файлов (уровень 1 ADR-001 работает; уровень 2 необязателен)',
	};
}
