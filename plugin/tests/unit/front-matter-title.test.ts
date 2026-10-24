/**
 * Тесты адаптера Front Matter Title (A3, DL-258; нормы — ADR-001 уровень 2, М3/М4/М6,
 * карточка docs/integrations/front-matter-title.md).
 *
 * Проверяется ЧИСТАЯ логика рекомендации (core/front-matter-title.ts). Обвязка в main.ts
 * (чтение app.plugins, Notice, try/catch) — тонкая обёртка слоя 4 и по отклонению М4
 * проверяется вручную по чек-листу handoff.
 */

import { describe, expect, it } from 'vitest';
import {
	FRONT_MATTER_TITLE_ID,
	frontMatterTitleAdvice,
	NO_FRONT_MATTER_TITLE,
} from '../../src/core/front-matter-title';

describe('front-matter-title-adapter — рекомендация (M6: необязательность без обещаний)', () => {
	it('FMT установлен и включён: рекомендации нет, журнал — debug (штатный режим)', () => {
		const advice = frontMatterTitleAdvice({ installed: true, enabled: true, version: '4.2.1' });
		expect(advice.recommend).toBe(false);
		expect(advice.message).toBe('');
		expect(advice.logLevel).toBe('debug');
		expect(advice.logMessage).toContain('4.2.1');
	});

	it('FMT установлен, но выключен: рекомендация включить (один раз)', () => {
		const advice = frontMatterTitleAdvice({ installed: true, enabled: false, version: '4.2.1' });
		expect(advice.recommend).toBe(true);
		expect(advice.message).toContain('выключен');
		expect(advice.logLevel).toBe('info');

		const again = frontMatterTitleAdvice({ installed: true, enabled: false, version: '4.2.1' }, true);
		expect(again.recommend, 'флаг «уже рекомендовали» гасит повтор').toBe(false);
	});

	it('FMT не установлен: рекомендация поставить (один раз), тон — необязательность', () => {
		const advice = frontMatterTitleAdvice(NO_FRONT_MATTER_TITLE);
		expect(advice.recommend).toBe(true);
		expect(advice.message).toContain('Front Matter Title');
		expect(advice.message).toMatch(/работает и без него|полностью работает/i);
		expect(advice.logLevel).toBe('info');

		const again = frontMatterTitleAdvice(NO_FRONT_MATTER_TITLE, true);
		expect(again.recommend).toBe(false);
	});

	it('id плагина — «front-matter-title» (репозиторий snezhig/obsidian-front-matter-title)', () => {
		expect(FRONT_MATTER_TITLE_ID).toBe('front-matter-title');
	});
});
