/**
 * Бутстрап метамодели (модуль metamodel-bootstrap, 09-modules §4; этап A2 часть 2).
 *
 * Главный риск этапа A (phases.md §4): метамодель описывает саму себя, поэтому типы
 * `object_type` и `property` нужны ДО того, как их можно прочитать из хранилища.
 * Решение (ADR-004): определения системных типов поставляются ВНУТРИ плагина как
 * данные и выгружаются в хранилище при первом запуске.
 *
 * Принятые решения (DL-250):
 *   - F5-9 = А — фиксированные «известные» ULID: семенные файлы статичны и
 *     байт-стабильны, перекрёстные ссылки — константы, идемпотентность бутстрапа —
 *     проверка существования файла. Осознанное исключение из правила «id не
 *     переиспользуется» (ADR-001, примечание ревизии 0.2.1): системные константы
 *     не «переиспользуются» — они никогда не выдавались другим объектам и одинаковы
 *     во всех хранилищах.
 *   - F5-10 = Б — объём семени: 7 OBJECT_TYPE-заметок системных типов
 *     (object_type, property, relation_type, relation, taxonomy, facet, category).
 *     Определения свойств системных типов появятся в B1.3 (статические PROPERTY-сиды,
 *     B1-4 = А); предметная библиотека (book, person, …) — отдельной командой
 *     «установить основные типы» в B1.3. `property_type` не сеется: абстрактный,
 *     без карточки (ADR-004), 8 значений закрыты и заданы кодом (слой 1).
 *   - Часть 2 (DL-266): добавлено ОДНО семя PROPERTY — служебное свойство
 *     `sb_issues` (08-views §7, DL-168): без него не работает служебный слой
 *     диагностик (service-flags, правило diagnostics.service_property.declared).
 *     Механизм тот же, что примет B1.3 (B1-4 = А): фиксированный ULID по рецепту
 *     SHA-256 от «second-brain/system-property/{type_key}.{property_key}»
 *     (для универсального свойства type_key = «universal»), временная часть та же —
 *     2026-10-23; байт-стабильное содержимое; идемпотентность по существованию.
 *
 * РЕЦЕПТ фиксированных ULID (воспроизводим, проверен тестом bootstrap.test.ts):
 *   - временная часть: Date.UTC(2026, 9, 23) = 1792713600000 — дата утверждения
 *     метамодели 1.0.0 (DL-242); одна на все 7 констант;
 *   - случайная часть: первые 16 байт SHA-256 от строки
 *     «second-brain/system-type/{type_key}» → generateUlid(timeMs, bytes) (ulid.ts).
 *   Константы зашиты здесь как данные — рантайм не пересчитывает их и не зависит
 *   от часов и локали (семя байт-стабильно).
 *
 * Идемпотентность: файл существует → пропускаем и НЕ перезаписываем (пользователь
 * мог отредактировать определение — источник истины хранилище, ADR-002).
 *
 * Слой: ядро (1) — среда-независим (М2), зависит только от VaultAdapter;
 * вызывается из main.ts при загрузке плагина, ПЕРЕД чтением реестра.
 */

import type { VaultAdapter } from '../adapter/vault-adapter';
import type { LogFn } from './activity-log';
import { METAMODEL_SUBFOLDERS, SYSTEM_TYPE_PREFIXES } from './registry';

/** Каноническая метка семенных заметок: дата утверждения метамодели 1.0.0 (DL-242). */
export const SEED_TIMESTAMP = '2026-10-23T00:00';

/** Временная часть семенных ULID (мс): 2026-10-23T00:00:00.000Z. См. рецепт в шапке. */
export const SEED_TIME_MS = 1792713600000;

/** Одно семя — статичное определение системного типа (F5-9 = А, F5-10 = Б). */
export interface SystemTypeSeed {
	/** Ключ типа (ADR-003: английский, snake_case). */
	readonly typeKey: string;
	/** Русская подпись (реестр 02-entities §3). */
	readonly label: string;
	/** TYPE_PREFIX (реестр 02-entities §6; совпадает с SYSTEM_TYPE_PREFIXES). */
	readonly typePrefix: string;
	/** Фиксированный «известный» ULID (системная константа, рецепт — в шапке модуля). */
	readonly ulid: string;
	/** Имя файла: OBJECT_TYPE-{ulid}.md (ADR-001). */
	readonly fileName: string;
	/** Путь в хранилище: Metamodel/ObjectTypes/{fileName} (DL-029). */
	readonly path: string;
	/** Полное содержимое заметки (frontmatter + тело), LF, без BOM. */
	readonly content: string;
}

/** Назначение каждого из 7 системных типов (тело заметки; источник — 02-entities §3, карточки типов). */
const SEED_PURPOSES: Record<string, { description: string; body: string }> = {
	object_type: {
		description: 'Тип объекта: описание другого типа. Основа самоопределяющейся модели.',
		body: 'Экземпляр этого типа — описание другого типа (например, тип «Книга»). Метауровень модели: метамодель описывает саму себя (ADR-004).',
	},
	property: {
		description: 'Свойство: описание поля объекта (тип значения, кардинальность, обязательность).',
		body: 'Экземпляр этого типа — описание свойства (поля) объекта: тип значения, кардинальность, обязательность, русская подпись (например, свойство `author`).',
	},
	relation_type: {
		description: 'Тип отношения: семантика и правила связи между объектами.',
		body: 'Экземпляр этого типа задаёт семантику и правила связи между объектами: допустимые типы концов, кардинальности, симметричность (например, тип `contains`).',
	},
	relation: {
		description: 'Отношение: реифицированная связь; экземпляры — строки JSONL в .sb/relations/ (ADR-010).',
		body: 'Экземпляр этого типа — конкретная связь между двумя объектами (реифицированное отношение). Экземпляры хранятся строками JSON Lines в `.sb/relations/`, а не заметками (ADR-010).',
	},
	taxonomy: {
		description: 'Таксономия: необязательная группировка фасетов (ADR-007).',
		body: 'Экземпляр этого типа — необязательная группировка фасетов классификации (ADR-005, ADR-007).',
	},
	facet: {
		description: 'Фасет: самостоятельное измерение классификации (ADR-005, ADR-007).',
		body: 'Экземпляр этого типа — самостоятельное измерение классификации, группирующее категории (например, фасет «Жанр»). Фасет независим от таксономии (ADR-005, ADR-007).',
	},
	category: {
		description: 'Категория: значение классификации внутри фасета или таксономии (ADR-005).',
		body: 'Экземпляр этого типа — значение классификации внутри фасета или таксономии (например, категория «Роман» в фасете «Жанр»). У категории ровно один родитель-фасет (правило П8, ADR-007).',
	},
};

/** Порядок семян — канонический порядок реестра 02-entities §3. */
const SEED_ORDER = ['object_type', 'property', 'relation_type', 'relation', 'taxonomy', 'facet', 'category'] as const;

/**
 * Фиксированные «известные» ULID семи системных типов (F5-9 = А, DL-250).
 * Сгенерированы по рецепту в шапке модуля и зашиты как константы:
 * НЕ МЕНЯТЬ — на них стоят перекрёстные ссылки примеров и документации.
 */
export const SYSTEM_TYPE_ULIDS: Readonly<Record<(typeof SEED_ORDER)[number], string>> = {
	object_type: '01M5K0XB00HX9XWND1C4WYZEYW',
	property: '01M5K0XB00ZCAD7KJ8Z5R4F346',
	relation_type: '01M5K0XB007JDGH8AH4N89YSRC',
	relation: '01M5K0XB00YRHHGDQ60WJACEWD',
	taxonomy: '01M5K0XB006NG3CT8WX11Z9R2D',
	facet: '01M5K0XB00YK6T08S1MAA312YQ',
	category: '01M5K0XB006CG18SWHZW3C3KC8',
};

/** Русские подписи (реестр 02-entities §3; `label` свободен — ключ стабилен, ADR-003). */
const SEED_LABELS: Readonly<Record<(typeof SEED_ORDER)[number], string>> = {
	object_type: 'Тип объекта',
	property: 'Свойство',
	relation_type: 'Тип отношения',
	relation: 'Отношение',
	taxonomy: 'Таксономия',
	facet: 'Фасет',
	category: 'Категория',
};

/**
 * Сборка содержимого семенной заметки — детерминированная (чистая конкатенация,
 * без среды и часов): результат байт-стабилен между запусками и платформами.
 * Формат — тот же, что у команды create-object-type (creation.ts): title = type_key,
 * aliases[0] == title (инвариант И4), даты в кавычках (конвенция шага 9, DL-228).
 */
function renderSeedContent(typeKey: string, label: string, ulid: string): string {
	const purpose = SEED_PURPOSES[typeKey];
	const frontmatter = [
		'---',
		`id: ${ulid}`,
		'type: object_type',
		`title: ${typeKey}`,
		'aliases:',
		`  - ${typeKey}`,
		`created_at: "${SEED_TIMESTAMP}"`,
		`updated_at: "${SEED_TIMESTAMP}"`,
		`type_key: ${typeKey}`,
		`label: ${label}`,
		`type_prefix: ${SYSTEM_TYPE_PREFIXES[typeKey]}`,
		'abstract: false',
		'lifecycle: standard',
		`description: "${purpose.description}"`,
		'---',
	].join('\n');
	const body = [
		'',
		purpose.body,
		'',
		'---',
		'',
		'Определение создано бутстрапом плагина Second Brain при первом запуске (ADR-004;',
		'фиксированный ULID — F5-9 = А, объём семени — F5-10 = Б; DL-250).',
		'',
		'- `id` — системная константа: одинакова во всех хранилищах и не выдаётся заново.',
		'  Не меняйте `id` и имя файла — на них строятся перекрёстные ссылки',
		'  (примечание-исключение — ADR-001, ревизия 0.2.1).',
		'- Заметка — источник истины (ADR-002): правки остальных полей подхватываются',
		'  плагином при следующей загрузке.',
		'',
	].join('\n');
	return `${frontmatter}\n${body}`;
}

function buildSeed(typeKey: (typeof SEED_ORDER)[number]): SystemTypeSeed {
	const ulid = SYSTEM_TYPE_ULIDS[typeKey];
	const label = SEED_LABELS[typeKey];
	const typePrefix = SYSTEM_TYPE_PREFIXES[typeKey];
	const fileName = `OBJECT_TYPE-${ulid}.md`;
	return {
		typeKey,
		label,
		typePrefix,
		ulid,
		fileName,
		path: `${METAMODEL_SUBFOLDERS.objectTypes}/${fileName}`,
		content: renderSeedContent(typeKey, label, ulid),
	};
}

/** Семь семенных определений системных типов — данные плагина (ADR-004). */
export const SYSTEM_TYPE_SEEDS: readonly SystemTypeSeed[] = SEED_ORDER.map(buildSeed);

// ---------------------------------------------------------------------------
// Семена PROPERTY (часть 2 — служебное свойство sb_issues; полный набор сидов
// системных типов — B1.3, механизм B1-4 = А тот же)
// ---------------------------------------------------------------------------

/** Одно семя-определение свойства (PROPERTY-заметка). */
export interface SystemPropertySeed {
	/** Ключ свойства (ADR-003). */
	readonly key: string;
	/** Русская подпись (08-views §7). */
	readonly label: string;
	/** Фиксированный «известный» ULID (рецепт — в шапке модуля). */
	readonly ulid: string;
	/** Имя файла: PROPERTY-{ulid}.md (ADR-001). */
	readonly fileName: string;
	/** Путь: Metamodel/Properties/{fileName} (DL-029). */
	readonly path: string;
	/** Полное содержимое заметки (frontmatter + тело), LF, без BOM. */
	readonly content: string;
}

/**
 * Фиксированный ULID служебного свойства `sb_issues` (B1-4 = А).
 * Рецепт: SHA-256 от «second-brain/system-property/universal.sb_issues»,
 * первые 16 байт → generateUlid(SEED_TIME_MS, bytes). НЕ МЕНЯТЬ — константа
 * воспроизводится тестом (bootstrap.test.ts) и одинакова во всех хранилищах.
 */
export const SB_ISSUES_PROPERTY_ULID = '01M5K0XB00T6WT7SFWZBG4M9NB';

/**
 * Содержимое семени `sb_issues` — детерминированная конкатенация (байт-стабильно).
 * Нормы: 08-views §7 (ключ, подпись «Проблемы», text, 0..N, universal, service: true,
 * формат значения «{rule_id}: {severity}»); формат полей — как у create-property
 * (creation.ts) и PROPERTY-примеров шага 9.
 */
function renderSbIssuesSeedContent(): string {
	const frontmatter = [
		'---',
		`id: ${SB_ISSUES_PROPERTY_ULID}`,
		'type: property',
		'title: sb_issues',
		'aliases:',
		'  - sb_issues',
		`created_at: "${SEED_TIMESTAMP}"`,
		`updated_at: "${SEED_TIMESTAMP}"`,
		'key: sb_issues',
		'label: Проблемы',
		'value_type: text',
		'cardinality: 0..N',
		'required: false',
		'scope: universal',
		'service: true',
		'lifecycle: standard',
		'definition: "Служебный список диагностик последней проверки в формате «rule_id: severity». Ведёт плагин; вручную не редактируется (08-views §7, DL-168)."',
		'---',
	].join('\n');
	const body = [
		'',
		'Служебное свойство: колонка «Проблемы» в таблицах и карточках представлений (Bases).',
		'Заполняется плагином по результатам проверки (уровни 2–4, 6) синхронно со служебными',
		'метками `sb/error`, `sb/warning`, `sb/info` в `tags` (08-views §7).',
		'',
		'---',
		'',
		'Определение создано бутстрапом плагина Second Brain (ADR-004; фиксированный ULID —',
		'рецепт B1-4 = А: SHA-256 от «second-brain/system-property/universal.sb_issues»; DL-266).',
		'',
		'- `service: true` — свойство не предлагается в формах ввода (08-views §7).',
		'- Не удаляйте заметку: без неё правило `diagnostics.service_property.declared`',
		'  выдаст ошибку, а колонка «Проблемы» перестанет работать.',
		'- Заметка — источник истины (ADR-002): правки подписи подхватываются при перечитывании реестра.',
		'',
	].join('\n');
	return `${frontmatter}\n${body}`;
}

const SB_ISSUES_SEED: SystemPropertySeed = {
	key: 'sb_issues',
	label: 'Проблемы',
	ulid: SB_ISSUES_PROPERTY_ULID,
	fileName: `PROPERTY-${SB_ISSUES_PROPERTY_ULID}.md`,
	path: `${METAMODEL_SUBFOLDERS.properties}/PROPERTY-${SB_ISSUES_PROPERTY_ULID}.md`,
	content: renderSbIssuesSeedContent(),
};

/** Семена-определения свойств (часть 2: только `sb_issues`; системные PROPERTY-сиды — B1.3). */
export const SYSTEM_PROPERTY_SEEDS: readonly SystemPropertySeed[] = [SB_ISSUES_SEED];

/** Итог бутстрапа: что создано, что уже существовало, что не удалось. */
export interface BootstrapReport {
	/** Пути созданных файлов (сначала типы в порядке SEED_ORDER, затем семена свойств). */
	created: string[];
	/** Пути пропущенных файлов: уже существовали — не перезаписываются (идемпотентность F5-9). */
	skipped: string[];
	/** Ошибки записи (файл не создан; подробности — в журнале). */
	failed: { path: string; error: string }[];
}

/**
 * Бутстрап Metamodel/: создаёт отсутствующие семенные определения — 7 системных
 * типов и служебное свойство `sb_issues` (часть 2).
 *
 * Идемпотентен: существующие файлы не трогает (проверка существования — F5-9 = А).
 * Ошибка записи одного семени не прерывает остальные (отказоустойчивость как у
 * реестра: ADR-002 «работаем с последней корректной версией и показываем ошибку»).
 *
 * Вызывается из main.ts при загрузке плагина, до TypeRegistry.load — тогда реестр
 * сразу перечитывается и видит все 7 типов (Notice «типов в реестре: 7»).
 */
export async function bootstrapMetamodel(adapter: VaultAdapter, log?: LogFn): Promise<BootstrapReport> {
	const report: BootstrapReport = { created: [], skipped: [], failed: [] };
	const typeEntries = SYSTEM_TYPE_SEEDS.map((seed) => ({
		path: seed.path,
		content: seed.content,
		label: seed.label,
		folder: METAMODEL_SUBFOLDERS.objectTypes,
	}));
	const propertyEntries = SYSTEM_PROPERTY_SEEDS.map((seed) => ({
		path: seed.path,
		content: seed.content,
		label: seed.label,
		folder: METAMODEL_SUBFOLDERS.properties,
	}));
	const allSeeds = [...typeEntries, ...propertyEntries];
	const toCreate: typeof allSeeds = [];

	for (const seed of allSeeds) {
		if (await adapter.exists(seed.path)) {
			report.skipped.push(seed.path);
		} else {
			toCreate.push(seed);
		}
	}

	if (toCreate.length === 0) {
		log?.('debug', 'bootstrap', `Бутстрап Metamodel/: все ${allSeeds.length} семян уже существуют — пропуск`, {
			skipped: report.skipped.length,
		});
		return report;
	}

	// Папки создаются один раз (createFolder идемпотентен и создаёт промежуточные — контракт интерфейса).
	const folders = [...new Set(toCreate.map((seed) => seed.folder))];
	for (const folder of folders) {
		try {
			await adapter.createFolder(folder);
		} catch (error) {
			log?.('error', 'bootstrap', `Не удалось создать папку ${folder}: ${String(error)}`);
		}
	}

	for (const seed of toCreate) {
		try {
			await adapter.create(seed.path, seed.content);
			report.created.push(seed.path);
		} catch (error) {
			report.failed.push({ path: seed.path, error: String(error) });
			log?.('error', 'bootstrap', `Не удалось создать определение «${seed.label}»: ${String(error)}`, {
				path: seed.path,
			});
		}
	}

	log?.('info', 'bootstrap', `Бутстрап Metamodel/: создано семян определений — ${report.created.length}`, {
		created: report.created.length,
		skipped: report.skipped.length,
		failed: report.failed.length,
		folders,
	});
	return report;
}
