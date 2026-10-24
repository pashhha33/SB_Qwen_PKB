import { describe, expect, it } from 'vitest';
import { extractWikilinks } from '../../src/core/markdown-parser';

describe('markdown-parser — extractWikilinks (тело заметки)', () => {
	it('простая ссылка и ссылка с подписью', () => {
		const links = extractWikilinks('Читал [[BOOK-01J8Z6M4K2Q7V9X3N5B0C1D2EF.md]] и [[PERSON-01J8Z6M4K2Q7V9X3N5B0C1D2EF.md|М.Булгаков]].');
		expect(links).toHaveLength(2);
		expect(links[0]).toEqual({
			target: 'BOOK-01J8Z6M4K2Q7V9X3N5B0C1D2EF.md',
			displayText: null,
			heading: null,
			blockId: null,
			isEmbed: false,
		});
		expect(links[1].displayText).toBe('М.Булгаков');
	});

	it('встраивание ![[...]] (инвариант И8 у media)', () => {
		const links = extractWikilinks('![[photo.jpg|Обложка]]');
		expect(links[0].isEmbed).toBe(true);
		expect(links[0].target).toBe('photo.jpg');
		expect(links[0].displayText).toBe('Обложка');
	});

	it('заголовок и блок: # и ^ не попадают в target (раздел 12: часть после # в title не попадает)', () => {
		const links = extractWikilinks('[[Заметка#Раздел два]] и [[Заметка^ab12]] и [[Заметка#Р^b|подпись]]');
		expect(links[0]).toMatchObject({ target: 'Заметка', heading: 'Раздел два', blockId: null });
		expect(links[1]).toMatchObject({ target: 'Заметка', heading: null, blockId: 'ab12' });
		expect(links[2]).toMatchObject({ target: 'Заметка', heading: 'Р', blockId: 'b', displayText: 'подпись' });
	});

	it('fenced-код-блоки пропускаются (включая ```sb-chapter-nav у глав, DL-129)', () => {
		const body = [
			'До [[A]]',
			'```sb-chapter-nav',
			'[[prev]] [[next]]',
			'```',
			'После [[B]]',
		].join('\n');
		const targets = extractWikilinks(body).map((link) => link.target);
		expect(targets).toEqual(['A', 'B']);
	});

	it('~~~-ограждения тоже работают', () => {
		const body = '~~~\n[[X]]\n~~~\n[[Y]]';
		expect(extractWikilinks(body).map((l) => l.target)).toEqual(['Y']);
	});

	it('инлайн-код пропускается', () => {
		const links = extractWikilinks('Используй `[[не-ссылка]]` и [[ссылка]].');
		expect(links).toHaveLength(1);
		expect(links[0].target).toBe('ссылка');
	});

	it('пустые и вырожденные цели пропускаются', () => {
		expect(extractWikilinks('[[]] и [[   ]] и [[|только подпись]]')).toHaveLength(0);
	});

	it('несколько ссылок в одной строке и разные типы', () => {
		const links = extractWikilinks('[[A]], [[B|b]] и ![[img.png]]');
		expect(links.map((l) => l.target)).toEqual(['A', 'B', 'img.png']);
	});

	it('незакрытый код-блок: остальной текст ссылками не считается (защита от мусора)', () => {
		const body = '```\n[[X]]\n[[Y]]';
		expect(extractWikilinks(body)).toHaveLength(0);
	});
});
