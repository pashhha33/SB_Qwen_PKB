/**
 * Базовая библиотека метамодели — установка сидов командой install-base-types
 * (B1.3 часть 1 «библиотека», DL-276/277; модуль seed-library, 09-modules §4).
 *
 * Что устанавливает (охват Б — DL-261/276):
 *   - OBJECT_TYPE `book` и `person` (основные типы) + структурные `work` (родитель
 *     book, 07-hierarchy) и `media` (цель ссылок media_reference — без неё
 *     target_types cover/file_path/portrait были бы висячими, value.reference.exists);
 *   - PROPERTY-сиды системных типов (62; долг F5-10 = Б) и типов book (22) / person (42);
 *   - FACET `genre`, `literary_form`, `country`, `language`, `sport` — системные
 *     определения, на которые ссылаются словарные свойства (04-attributes §5).
 *     КАТЕГОРИИ НЕ СЕЮТСЯ (Ч3-3 = Б, DL-276): содержимое хранилища создаёт пользователь.
 *
 * Механизм (B1-4 = А): статические семена как данные плагина (seeds/library-specs.ts),
 * фиксированные ULID по рецепту SHA-256 (seeds/seed-ulids.ts — сгенерирован
 * scripts/generate-seed-ulids.mjs; воспроизводится тестом seed-ulids.test.ts).
 *
 * Идемпотентность — ПРОПУСК ПО КЛЮЧУ (DL-276), а не только по существованию файла:
 * в хранилище пользователя уже могут быть book/person, созданные командами при ручных
 * проверках (другие ULID) — дубли не создаются; ссылки сидов разрешаются в ULID
 * СУЩЕСТВУЮЩИХ определений (реестр), поэтому содержимое байт-стабильно в чистом
 * хранилище и корректно связывается в «живом». Существующие заметки НЕ перезаписываются
 * (источник истины — хранилище, ADR-002; пользователь мог править определения).
 *
 * Слой: ядро (1) — среда-независим (М2), зависит только от VaultAdapter и TypeRegistry.
 */

import type { VaultAdapter } from '../adapter/vault-adapter';
import type { LogFn } from './activity-log';
import { SEED_TIMESTAMP, SYSTEM_TYPE_ULIDS } from './bootstrap';
import { METAMODEL_SUBFOLDERS, SYSTEM_TYPE_PREFIXES, type TypeRegistry } from './registry';
import {
	FACET_SEED_SPECS,
	PROPERTY_SEED_SPECS,
	TYPE_SEED_SPECS,
	type FacetSeedSpec,
	type PropertySeedSpec,
	type TypeSeedSpec,
} from './seeds/library-specs';
import { seedUlid } from './seeds/seed-ulids';

/** Разрешение типа для ссылок: ULID + подпись + префикс (реестр важнее сида). */
interface TypeResolution {
	ulid: string;
	label: string;
	typePrefix: string;
	/** Ключ родительского типа (цепочка предков — для покрытия family). */
	parentKey: string | null;
	/** true — определение уже есть в хранилище (сид пропускается). */
	exists: boolean;
}

/** Разрешение фасета для target_facet. */
interface FacetResolution {
	ulid: string;
	title: string;
	exists: boolean;
}

export type SeedKind = 'object_type' | 'facet' | 'property';

export interface InstallReportEntry {
	kind: SeedKind;
	/** Ключ семени: type_key / facet_key / {owner}.{key}. */
	key: string;
	path: string;
}

export interface InstallSkipEntry {
	kind: SeedKind;
	key: string;
	/** 'existing-definition' — определение с таким ключом уже в реестре/хранилище; 'existing-file' — файл семени уже существует. */
	reason: 'existing-definition' | 'existing-file';
	/** Путь существующего определения (если известен). */
	existingPath: string | null;
}

/** Итог установки базовой библиотеки. */
export interface InstallLibraryReport {
	created: InstallReportEntry[];
	skipped: InstallSkipEntry[];
	failed: { path: string; error: string }[];
	/** Счётчики созданных по видам (для Notice). */
	counts: { objectTypes: number; facets: number; properties: number };
}

// ---------------------------------------------------------------------------
// Рендер содержимого (детерминированная конкатенация — байт-стабильно, LF, без BOM;
// формат полей — как у create-object-type / create-property (creation.ts) и примеров D3)
// ---------------------------------------------------------------------------

/** YAML-строка в двойных кавычках с экранированием (для свободных текстов). */
function yamlQuoted(text: string): string {
	return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Ссылка на OBJECT_TYPE-определение (каноническая, ADR-001/DL-186: псевдоним всегда). */
function typeLink(resolution: TypeResolution): string {
	return `"[[OBJECT_TYPE-${resolution.ulid}.md|${resolution.label}]]"`;
}

function renderTypeSeed(spec: TypeSeedSpec, ulid: string, parent: TypeResolution | null): string {
	const frontmatter: string[] = [
		'---',
		`id: ${ulid}`,
		'type: object_type',
		`title: ${spec.typeKey}`,
		'aliases:',
		`  - ${spec.typeKey}`,
		`created_at: "${SEED_TIMESTAMP}"`,
		`updated_at: "${SEED_TIMESTAMP}"`,
		`type_key: ${spec.typeKey}`,
		`label: ${spec.label}`,
		`type_prefix: ${spec.typePrefix}`,
		`abstract: ${spec.abstract ? 'true' : 'false'}`,
	];
	if (parent !== null) {
		frontmatter.push('parent_type:', `  - ${typeLink(parent)}`);
	}
	frontmatter.push(
		'lifecycle: standard',
		`description: ${yamlQuoted(spec.description)}`,
		'---',
	);
	const body = [
		'',
		spec.body,
		'',
		'---',
		'',
		'Определение установлено командой `install-base-types` плагина Second Brain (ADR-004;',
		'охват — B1-3 = Б, DL-261/276; фиксированный ULID — рецепт B1-4 = А).',
		'',
		'- `id` — системная константа: одинакова во всех хранилищах и не выдаётся заново',
		'  (примечание-исключение — ADR-001, ревизия 0.2.1). Не меняйте `id` и имя файла.',
		'- Заметка — источник истины (ADR-002): правки полей подхватываются при перечитывании реестра.',
		'',
	].join('\n');
	return `${frontmatter.join('\n')}\n${body}`;
}

function renderFacetSeed(spec: FacetSeedSpec, ulid: string, allowedTypes: readonly TypeResolution[]): string {
	const frontmatter: string[] = [
		'---',
		`id: ${ulid}`,
		'type: facet',
		`title: ${spec.title}`,
		'aliases:',
		`  - ${spec.title}`,
		`created_at: "${SEED_TIMESTAMP}"`,
		`updated_at: "${SEED_TIMESTAMP}"`,
		`label: ${spec.label}`,
		'taxonomy: []',
	];
	if (allowedTypes.length > 0) {
		frontmatter.push('allowed_object_types:', ...allowedTypes.map((t) => `  - ${typeLink(t)}`));
	}
	frontmatter.push(
		`hierarchy_mode: ${spec.hierarchyMode}`,
		`assignment_cardinality: ${spec.assignmentCardinality}`,
	);
	if (spec.rootRequirementMin > 0) {
		frontmatter.push(`root_requirement_min: ${spec.rootRequirementMin}`);
	}
	frontmatter.push(`description: ${yamlQuoted(spec.description)}`, '---');
	const body = [
		'',
		`Фасет «${spec.label}» — измерение классификации (ADR-005/007). Категории НЕ создаются`,
		'плагином (Ч3-3 = Б, DL-276): добавьте нужные категории командой `create-object`',
		'(тип — «Категория»); первые 2–3 категории жанров — часть UX-проверки B1.3.',
		'',
		'---',
		'',
		'Определение установлено командой `install-base-types` (фиксированный ULID —',
		'рецепт B1-4 = А: SHA-256 от «second-brain/system-facet/{facet_key}»).',
		'',
		'- Не меняйте `id` и имя файла: на них ссылаются словарные свойства (target_facet).',
		'- Заметка — источник истины (ADR-002): правки подхватываются при перечитывании реестра.',
		'',
	].join('\n');
	return `${frontmatter.join('\n')}\n${body}`;
}

function renderPropertySeed(spec: PropertySeedSpec, ulid: string, owner: TypeResolution, targets: readonly TypeResolution[], facet: FacetResolution | null): string {
	const required = spec.cardinality === '1' || spec.cardinality === '1..N';
	const frontmatter: string[] = [
		'---',
		`id: ${ulid}`,
		'type: property',
		`title: ${spec.key}`,
		'aliases:',
		`  - ${spec.key}`,
		`created_at: "${SEED_TIMESTAMP}"`,
		`updated_at: "${SEED_TIMESTAMP}"`,
		`key: ${spec.key}`,
		`label: ${spec.label}`,
		`value_type: ${spec.valueType}`,
		`cardinality: "${spec.cardinality}"`, // кавычки обязательны: «1» без кавычек YAML разобрал бы числом (шаблон D5)
		`required: ${required ? 'true' : 'false'}`,
		'scope: specific',
		'object_types:',
		`  - ${typeLink(owner)}`,
	];
	if (targets.length > 0) {
		frontmatter.push('target_types:', ...targets.map((t) => `  - ${typeLink(t)}`));
	}
	if (facet !== null) {
		frontmatter.push(`target_facet: "[[FACET-${facet.ulid}.md|${facet.title}]]"`);
	}
	if (spec.linkMode !== undefined) {
		frontmatter.push(`link_mode: ${spec.linkMode}`);
	}
	if (spec.mediaTarget !== undefined) {
		frontmatter.push(`media_target: ${spec.mediaTarget}`);
	}
	if (spec.mediaKinds !== undefined && spec.mediaKinds.length > 0) {
		frontmatter.push('media_kinds:', ...spec.mediaKinds.map((v) => `  - ${v}`));
	}
	if (spec.mediaRoles !== undefined && spec.mediaRoles.length > 0) {
		frontmatter.push('media_roles:', ...spec.mediaRoles.map((v) => `  - ${v}`));
	}
	if (spec.allowedValues !== undefined && spec.allowedValues.length > 0) {
		frontmatter.push('allowed_values:', ...spec.allowedValues.map((v) => `  - ${v}`));
	}
	if (spec.defaultValue !== undefined) {
		frontmatter.push(`default_value: ${spec.defaultValue}`);
	}
	if (spec.appliesWhen !== undefined) {
		frontmatter.push('applies_when:', `  property: ${spec.appliesWhen.property}`, `  operation: ${spec.appliesWhen.operation}`);
		const value = spec.appliesWhen.value;
		if (value.length === 1) {
			frontmatter.push(`  value: ${value[0]}`);
		} else {
			frontmatter.push('  value:', ...value.map((v) => `    - ${v}`));
		}
	}
	if (spec.display !== undefined) {
		frontmatter.push('display:', `  renderer: ${spec.display.renderer}`);
		if (spec.display.scaleMax !== undefined) {
			frontmatter.push(`  scale_max: ${spec.display.scaleMax}`);
		}
		if (spec.display.unit !== undefined) {
			frontmatter.push(`  unit: ${yamlQuoted(spec.display.unit)}`);
		}
	}
	frontmatter.push(`definition: ${yamlQuoted(spec.definition)}`, '---');
	const body = [
		'',
		'<!-- Смысл свойства, примеры значений, источник нормы (карточка типа / 04-attributes) -->',
		`Определение из базовой библиотеки плагина Second Brain (install-base-types; источник нормы —`,
		spec.owner === 'book' || spec.owner === 'person'
			? `карточка типа \`${spec.owner}\` и \`schema/entities/${spec.owner}.schema.json\`).`
			: `карточка типа \`${spec.owner}\` и \`schema/metamodel/${spec.owner}.schema.json\`).`,
		'',
		'- `id` — системная константа (рецепт B1-4 = А): не меняйте `id` и имя файла.',
		'- Заметка — источник истины (ADR-002): правки подписи/определения подхватываются плагином.',
		'',
	].join('\n');
	return `${frontmatter.join('\n')}\n${body}`;
}

// ---------------------------------------------------------------------------
// Установка
// ---------------------------------------------------------------------------

/** Прочитать frontmatter-«тип» и «заголовок/подпись» заметки фасета (для пропуска по ключу). */
async function scanExistingFacets(adapter: VaultAdapter): Promise<{ title: string; label: string | null; ulid: string | null; path: string }[]> {
	const paths = (await adapter.listMarkdown()).filter((path) => path.startsWith(`${METAMODEL_SUBFOLDERS.facets}/`) || /(^|\/)FACET-[0-9A-HJKMNP-TV-Z]{26}\.md$/.test(path));
	const found: { title: string; label: string | null; ulid: string | null; path: string }[] = [];
	for (const path of paths) {
		try {
			const content = await adapter.read(path);
			const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
			if (match === null) {
				continue;
			}
			const parsed = adapter.parseYaml(match[1]);
			if (parsed === null || typeof parsed !== 'object') {
				continue;
			}
			const fm = parsed as Record<string, unknown>;
			if (fm.type !== 'facet') {
				continue;
			}
			const fileNameUlid = /FACET-([0-9A-HJKMNP-TV-Z]{26})\.md$/.exec(path);
			found.push({
				title: typeof fm.title === 'string' ? fm.title.trim() : '',
				label: typeof fm.label === 'string' ? fm.label.trim() : null,
				ulid: typeof fm.id === 'string' && fm.id.trim() !== '' ? fm.id.trim() : fileNameUlid ? fileNameUlid[1] : null,
				path,
			});
		} catch {
			// Нечитаемая заметка не блокирует установку (отказоустойчивость как у реестра, ADR-002).
		}
	}
	return found;
}

/**
 * Установить базовую библиотеку: OBJECT_TYPE book+person (+структурные work, media),
 * FACET genre/literary_form/country/language/sport, PROPERTY-сиды системных типов,
 * book и person. Идемпотентна (пропуск по ключу), существующее не перезаписывает.
 *
 * Вызывается из команды install-base-types (реестр после установки перечитывает команда).
 */
export async function installBaseLibrary(adapter: VaultAdapter, registry: TypeRegistry, log?: LogFn): Promise<InstallLibraryReport> {
	const report: InstallLibraryReport = { created: [], skipped: [], failed: [], counts: { objectTypes: 0, facets: 0, properties: 0 } };

	// --- 1. Разрешения типов: реестр (существующие) → сиды (фиксированные ULID) ---
	const seedTypeByKey = new Map<string, TypeSeedSpec>(TYPE_SEED_SPECS.map((spec) => [spec.typeKey, spec]));
	const resolutions = new Map<string, TypeResolution>();
	const resolveType = (typeKey: string): TypeResolution => {
		const cached = resolutions.get(typeKey);
		if (cached !== undefined) {
			return cached;
		}
		const existing = registry.getType(typeKey);
		const seed = seedTypeByKey.get(typeKey);
		const resolution: TypeResolution = existing !== null
			? { ulid: existing.id, label: existing.label, typePrefix: existing.typePrefix, parentKey: null, exists: true }
			: {
				ulid: SYSTEM_TYPE_ULIDS[typeKey as keyof typeof SYSTEM_TYPE_ULIDS] ?? (seed !== undefined ? seedUlid(seed.recipe) : typeKey),
				label: seed?.label ?? typeKey,
				typePrefix: seed?.typePrefix ?? SYSTEM_TYPE_PREFIXES[typeKey] ?? typeKey.toUpperCase(),
				parentKey: seed?.parentKey ?? null,
				exists: false,
			};
		resolutions.set(typeKey, resolution);
		return resolution;
	};

	// Цепочка предков типа (для покрытия family у существующих свойств):
	// сид-спеки (book → work) и реестр (parentId → typeKey предка).
	const ancestorUlids = (typeKey: string): string[] => {
		const chain: string[] = [];
		const guard = new Set<string>();
		let currentKey: string | null = typeKey;
		while (currentKey !== null && !guard.has(currentKey)) {
			guard.add(currentKey);
			const seedParent: string | null = seedTypeByKey.get(currentKey)?.parentKey ?? null;
			const existingDef = registry.getType(currentKey);
			const registryParentKey = existingDef !== null && existingDef.parentId !== null
				? registry.getTypeById(existingDef.parentId)?.typeKey ?? null
				: null;
			currentKey = seedParent ?? registryParentKey;
			if (currentKey !== null) {
				chain.push(resolveType(currentKey).ulid);
			}
		}
		return chain;
	};

	// --- 2. OBJECT_TYPE-сиды ---
	for (const spec of TYPE_SEED_SPECS) {
		const ulid = seedUlid(spec.recipe);
		const fileName = `OBJECT_TYPE-${ulid}.md`;
		const path = `${METAMODEL_SUBFOLDERS.objectTypes}/${fileName}`;
		const existing = registry.getType(spec.typeKey);
		if (existing !== null) {
			report.skipped.push({ kind: 'object_type', key: spec.typeKey, reason: 'existing-definition', existingPath: existing.path });
			resolutions.set(spec.typeKey, { ulid: existing.id, label: existing.label, typePrefix: existing.typePrefix, parentKey: null, exists: true });
			continue;
		}
		if (await adapter.exists(path)) {
			report.skipped.push({ kind: 'object_type', key: spec.typeKey, reason: 'existing-file', existingPath: path });
			continue;
		}
		const parent = spec.parentKey !== null ? resolveType(spec.parentKey) : null;
		const content = renderTypeSeed(spec, ulid, parent);
		try {
			await adapter.createFolder(METAMODEL_SUBFOLDERS.objectTypes);
			await adapter.create(path, content);
			report.created.push({ kind: 'object_type', key: spec.typeKey, path });
			report.counts.objectTypes += 1;
		} catch (error) {
			report.failed.push({ path, error: String(error) });
			log?.('error', 'creation', `Не удалось установить тип «${spec.label}»: ${String(error)}`, { path });
		}
	}

	// --- 3. FACET-сиды (пропуск по title/label существующих фасетов) ---
	const existingFacets = await scanExistingFacets(adapter);
	const facetResolutions = new Map<string, FacetResolution>();
	for (const spec of FACET_SEED_SPECS) {
		const match = existingFacets.find((f) => {
			const title = f.title.toLowerCase();
			const label = (f.label ?? '').toLowerCase();
			return title === spec.title.toLowerCase() || label === spec.label.toLowerCase() || title === spec.label.toLowerCase() || label === spec.title.toLowerCase();
		});
		if (match !== undefined && match.ulid !== null) {
			// Фасет с таким названием/подписью уже есть — используем ЕГО ULID для target_facet.
			facetResolutions.set(spec.facetKey, { ulid: match.ulid, title: match.title !== '' ? match.title : spec.title, exists: true });
			report.skipped.push({ kind: 'facet', key: spec.facetKey, reason: 'existing-definition', existingPath: match.path });
			continue;
		}
		if (match !== undefined) {
			// Совпадение найдено, но id не читается (битое определение — группа A его уже
			// ловит): библиотеку не блокируем, ставим сид и предупреждаем в журнале.
			log?.('warning', 'creation', `Найден фасет «${match.title || match.label}» без читаемого id (${match.path}) — устанавливаю семенное определение; проверьте возможный дубль`, { path: match.path });
		}
		const ulid = seedUlid(spec.recipe);
		const path = `${METAMODEL_SUBFOLDERS.facets}/FACET-${ulid}.md`;
		if (await adapter.exists(path)) {
			facetResolutions.set(spec.facetKey, { ulid, title: spec.title, exists: true });
			report.skipped.push({ kind: 'facet', key: spec.facetKey, reason: 'existing-file', existingPath: path });
			continue;
		}
		const allowedTypes = spec.allowedObjectTypeKeys.map((key) => resolveType(key));
		const content = renderFacetSeed(spec, ulid, allowedTypes);
		try {
			await adapter.createFolder(METAMODEL_SUBFOLDERS.facets);
			await adapter.create(path, content);
			report.created.push({ kind: 'facet', key: spec.facetKey, path });
			report.counts.facets += 1;
			facetResolutions.set(spec.facetKey, { ulid, title: spec.title, exists: false });
		} catch (error) {
			report.failed.push({ path, error: String(error) });
			log?.('error', 'creation', `Не удалось установить фасет «${spec.label}»: ${String(error)}`, { path });
		}
	}

	// --- 4. PROPERTY-сиды (пропуск по ключу с учётом покрытия типа) ---
	const existingProperties = registry.properties;
	for (const spec of PROPERTY_SEED_SPECS) {
		const owner = resolveType(spec.owner);
		const covered = existingProperties.find((p) => {
			if (p.key !== spec.key) {
				return false;
			}
			if (p.scope === 'universal') {
				return true;
			}
			const ownerUlids = [owner.ulid, ...ancestorUlids(spec.owner)];
			return p.objectTypes.some((id) => ownerUlids.includes(id));
		});
		if (covered !== undefined) {
			report.skipped.push({ kind: 'property', key: `${spec.owner}.${spec.key}`, reason: 'existing-definition', existingPath: covered.path });
			continue;
		}
		const ulid = seedUlid(spec.recipe);
		const path = `${METAMODEL_SUBFOLDERS.properties}/PROPERTY-${ulid}.md`;
		if (await adapter.exists(path)) {
			report.skipped.push({ kind: 'property', key: `${spec.owner}.${spec.key}`, reason: 'existing-file', existingPath: path });
			continue;
		}
		const targets = (spec.targetTypes ?? []).map((key) => resolveType(key));
		const facet = spec.targetFacet !== undefined
			? facetResolutions.get(spec.targetFacet) ?? { ulid: seedUlid(`system-facet/${spec.targetFacet}`), title: spec.targetFacet, exists: false }
			: null;
		const content = renderPropertySeed(spec, ulid, owner, targets, facet);
		try {
			await adapter.createFolder(METAMODEL_SUBFOLDERS.properties);
			await adapter.create(path, content);
			report.created.push({ kind: 'property', key: `${spec.owner}.${spec.key}`, path });
			report.counts.properties += 1;
		} catch (error) {
			report.failed.push({ path, error: String(error) });
			log?.('error', 'creation', `Не удалось установить свойство «${spec.label}» (${spec.owner}.${spec.key}): ${String(error)}`, { path });
		}
	}

	log?.('info', 'creation', `Базовая библиотека установлена: создано ${report.created.length} определений (типов ${report.counts.objectTypes}, фасетов ${report.counts.facets}, свойств ${report.counts.properties}), пропущено существующих ${report.skipped.length}, ошибок ${report.failed.length}`, {
		created: report.created.length,
		skipped: report.skipped.length,
		failed: report.failed.length,
		counts: report.counts,
	});
	return report;
}
