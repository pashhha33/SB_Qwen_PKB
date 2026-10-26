/**
 * validate-object / validate-vault — проверка объектов (этапы A2 + B1.1).
 *
 * Объём: группа A реестра правил (docs/validation/rules.md) — системные атрибуты и
 * инварианты И1–И5 (этап A2), плюс schema-engine (этап B1.1): группа B —
 * определения свойств (16 правил), группы C/G — значения и перечисления, группа H —
 * даты (date-engine), группа E — определения типов (`object_type.*`, часть 2).
 * Уровни контроля 2–4 (ADR-011); уровень 1 (модалка) — B1.2.
 *
 * Часть 2 (DL-266): условные свойства (`applies_when`) проверяются движком
 * applies-when (М1–М7: скрытое свойство не проверяется на обязательность — М6,
 * качество сохранённых значений проверяется — М2); служебный слой диагностик —
 * правила группы K (`diagnostics.*`) и запись служебных меток + `sb_issues`
 * (service-flags, 08-views §7); validate-vault — прогон всего хранилища с общим
 * индексом (один на прогон) и сводкой. Связи — этап C.
 *
 * Правило `object.created_at.immutable` (И5, «не изменился относительно предыдущей
 * версии») в A2 НЕ проверяется: нужна история/снимок предыдущего состояния —
 * появится с backup-service (этап C). Осознанный пропуск, зафиксирован в architecture.md.
 *
 * `object.frontmatter.broken` — постоянный id: зарегистрирован в реестре правил
 * (rules.md v0.13.0, группа A, error, уровень 2; DL-254). До регистрации в 0.2.0–0.3.0
 * id был временным (у .base аналог — view.base.parsable).
 */

import type { VaultAdapter } from '../adapter/vault-adapter';
import type { LogFn } from './activity-log';
import { loadClassification, saveClassificationCache, type ClassificationSnapshot } from './classification';
import { validateClassificationAssignments, validateClassificationDefinition } from './classification-engine';
import { diagnostic, type SbDiagnostic } from './diagnostics';
import { findDuplicateIds, fileNameMatchesId, parseFileName, repairFileNameById } from './identity';
import type { LabelResolver } from './label-resolver';
import { parseNote } from './markdown-parser';
import type { SbNote } from './model';
import { METAMODEL_SUBFOLDERS, type TypeRegistry } from './registry';
import {
	buildVaultIndex,
	validateInstanceValues,
	validateObjectTypeDefinition,
	validatePropertyDefinition,
	type VaultIndex,
} from './schema-engine';
import {
	applyServiceFlags,
	baseIssues,
	checkServiceFlags,
	expectedTagFor,
	isSbObjectNote,
	SB_ISSUES_KEY,
	sbIssuesDeclarationProblem,
} from './service-flags';
import { isValidUlid } from './ulid';

export interface ValidateObjectResult {
	path: string;
	diagnostics: SbDiagnostic[];
	/** true, если frontmatter не применим (дальнейшие проверки невозможны). */
	unparsable: boolean;
	errors: number;
	warnings: number;
	/** Служебные метки/`sb_issues` были перезаписаны по итогам этой проверки (часть 2). */
	flagsWritten: boolean;
}

/** Опции проверки одного объекта (часть 2). */
export interface ValidateObjectOptions {
	/**
	 * Записать служебные метки и `sb_issues` по итогам проверки (08-views §7).
	 * По умолчанию false — ядро ничего не пишет; запись включают команды
	 * (validate-object, validate-vault).
	 */
	applyServiceFlags?: boolean;
	/**
	 * Выдавать ли `diagnostics.service_property.declared` на этой заметке.
	 * По умолчанию true; validate-vault передаёт false — проверка объявления
	 * делается один раз на прогон (vault-уровень), а не на каждой заметке.
	 */
	checkServiceDeclaration?: boolean;
	/**
	 * Общий снимок классификации (B1.3 часть 2). validate-vault строит один на
	 * прогон; без него каждая проверка читала бы определения классификации заново
	 * (урок DL-255/259 — никаких повторных сканов в цикле). `null` — проверки
	 * группы E пропущены (вызывающий снимок не построил).
	 */
	classification?: ClassificationSnapshot | null;
}

/**
 * Нужны ли этой заметке проверки классификации (группа E) и снимок для движка
 * `applies_when` (`in_category` с предками). Проверка дешёвая: снимок строится
 * только там, где он действительно нужен.
 */
function needsClassification(typeKey: string | null, note: SbNote, registry: TypeRegistry): boolean {
	if (typeKey === 'category' || typeKey === 'facet' || typeKey === 'taxonomy') {
		return true; // определения классификации
	}
	if ((note.system.categories ?? []).length > 0) {
		return true; // назначения: assignment.*, facet.genre.*
	}
	if (typeKey === null) {
		return false;
	}
	if (typeKey === 'book' || registry.ancestorsOf(typeKey).some((t) => t.typeKey === 'book')) {
		return true; // facet.genre.required_for_book срабатывает и при пустых назначениях
	}
	return registry.getPropertiesForType(typeKey).some((p) => p.appliesWhen?.operation === 'in_category');
}

/** Сравнивает метки 'YYYY-MM-DDTHH:mm[:ss]' лексически по минутам. */
function compareStamps(a: string, b: string): number {
	return a.slice(0, 16) < b.slice(0, 16) ? -1 : a.slice(0, 16) > b.slice(0, 16) ? 1 : 0;
}

/**
 * Проверяет одну заметку. Не бросает исключений на «плохих» данных — всё
 * возвращается диагностиками (система не должна молча переписывать неправильное).
 */
/** Сколько строк уровня error писать в журнал на одну проверку (защита от флуда). */
const MAX_ERROR_LINES_PER_RUN = 10;

export async function validateObject(
	adapter: VaultAdapter,
	registry: TypeRegistry,
	labels: LabelResolver,
	path: string,
	log?: LogFn,
	logValidation = true,
	/** Общий индекс хранилища (validate-vault строит один на прогон; здесь — по потребности). */
	sharedIndex?: VaultIndex | null,
	options?: ValidateObjectOptions,
): Promise<ValidateObjectResult> {
	const content = await adapter.read(path);
	const note = parseNote({ path, content }, adapter);
	const diagnostics: SbDiagnostic[] = [];
	const objectId = typeof note.system.id === 'string' ? note.system.id : null;
	const base = { object_id: objectId, object_path: path };

	if (note.frontmatterBroken) {
		diagnostics.push(
			diagnostic({
				...base,
				rule_id: 'object.frontmatter.broken',
				severity: 'error',
				level: 2,
				message: 'Служебный блок (frontmatter) не разбирается — объект не применён',
				hint: 'Исправьте YAML между строками --- в начале файла (или пересоздайте объект командой плагина)',
			}),
		);
		if (logValidation) {
			log?.('error', 'validation', `Проверка «${path}»: frontmatter не разбирается — объект не применён`, {
				rule_id: 'object.frontmatter.broken',
			});
		}
		return finish(path, diagnostics, true);
	}

	// ---- И1: id — валидный ULID (object.id.format, error, уровень 2) ----
	if (objectId === null) {
		diagnostics.push(
			diagnostic({
				...base,
				rule_id: 'object.id.format',
				severity: 'error',
				level: 2,
				property_key: 'id',
				message: 'У записи нет идентификатора (id)',
				hint: 'Создайте объект командой плагина — она выдаст id автоматически; существующий файл можно пересоздать',
			}),
		);
	} else if (!isValidUlid(objectId)) {
		diagnostics.push(
			diagnostic({
				...base,
				rule_id: 'object.id.format',
				severity: 'error',
				level: 2,
				property_key: 'id',
				actual_value: objectId,
				message: 'Идентификатор не соответствует формату ULID (26 символов Crockford Base32)',
				hint: 'Не меняйте id вручную; пересоздайте объект командой плагина',
			}),
		);
	} else {
		// И1: уникальность (object.id.unique, error, уровень 2)
		const duplicates = await findDuplicateIds(adapter, objectId, path);
		if (duplicates.length > 0) {
			diagnostics.push(
				diagnostic({
					...base,
					rule_id: 'object.id.unique',
					severity: 'error',
					level: 2,
					property_key: 'id',
					actual_value: objectId,
					message: `Такой же идентификатор встречается ещё в ${duplicates.length} файл(ах): ${duplicates.join(', ')}`,
					hint: 'Один из файлов — копия: удалите дубль или выдайте ему новый id (пересозданием)',
				}),
			);
		}

		// И2: id совпадает с ULID в имени файла (object.id.filename_match, error, уровень 2)
		const identity = parseFileName(note.fileName);
		if (identity !== null) {
			if (!fileNameMatchesId(note.fileName, objectId)) {
				diagnostics.push(
					diagnostic({
						...base,
						rule_id: 'object.id.filename_match',
						severity: 'error',
						level: 2,
						actual_value: note.fileName,
						message: 'Идентификатор в файле не совпадает с идентификатором в имени файла',
						hint: 'Имя файла будет исправлено по id (id первичен, мера M5 ADR-001)',
						fix_available: true,
						fix_description: `Переименовать файл в ${repairFileNameById(path, objectId)}`,
					}),
				);
			}
		} else {
			// Имя файла не каноническое ({TYPE_PREFIX}-{ULID}.md). Починка возможна,
			// если тип известен (префикс берётся из реестра).
			const typeDef = typeof note.system.type === 'string' ? registry.getType(note.system.type) : null;
			diagnostics.push(
				diagnostic({
					...base,
					rule_id: 'object.id.filename_match',
					severity: 'error',
					level: 2,
					actual_value: note.fileName,
					message: 'Имя файла не соответствует формату {TYPE_PREFIX}-{ULID}.md',
					hint: typeDef
						? 'Переименуйте файл по id — плагин может сделать это сам'
						: 'Укажите корректный type и переименуйте файл по id',
					fix_available: typeDef !== null,
					fix_description: typeDef
						? `Переименовать в ${repairFileNameById(path, objectId, typeDef.typePrefix)}`
						: null,
				}),
			);
		}
	}

	// ---- И3: type существует и не абстрактный (уровни 3/4) ----
	const typeKey = typeof note.system.type === 'string' ? note.system.type : null;
	if (typeKey === null) {
		diagnostics.push(
			diagnostic({
				...base,
				rule_id: 'object.type.exists',
				severity: 'error',
				level: 3,
				property_key: 'type',
				message: 'У записи не указан тип (type)',
				hint: 'Добавьте поле type с ключом существующего типа (создание объектов — командой плагина)',
			}),
		);
	} else {
		const typeDef = registry.getType(typeKey);
		if (!typeDef) {
			diagnostics.push(
				diagnostic({
					...base,
					rule_id: 'object.type.exists',
					severity: 'error',
					level: 3,
					property_key: 'type',
					actual_value: typeKey,
					message: `Тип «${typeKey}» не найден среди определений в ${'Metamodel/'}`,
					hint: 'Создайте тип командой create-object-type или исправьте значение type',
				}),
			);
		} else if (typeDef.abstract) {
			diagnostics.push(
				diagnostic({
					...base,
					rule_id: 'object.type.not_abstract',
					severity: 'error',
					level: 4,
					property_key: 'type',
					actual_value: typeKey,
					message: `Тип «${labels.forTypeKey(typeKey)}» абстрактный — его экземпляров не существует (И3)`,
					hint: 'Выберите конкретный подтип (потомка этого типа)',
				}),
			);
		}
	}

	// ---- title обязателен (object.title.required, error, уровень 2) ----
	const title = typeof note.system.title === 'string' ? note.system.title : null;
	if (title === null || title.trim() === '') {
		diagnostics.push(
			diagnostic({
				...base,
				rule_id: 'object.title.required',
				severity: 'error',
				level: 2,
				property_key: 'title',
				actual_value: title,
				message: typeKey
					? `У объекта типа «${labels.forTypeKey(typeKey)}» не заполнено название`
					: 'У объекта не заполнено название',
				hint: `Заполните поле «${labels.forPropertyKey('title')}»`,
			}),
		);
	}

	// ---- И4: aliases[0] == title (object.aliases.first_is_title, warning, уровень 4) ----
	if (title !== null && title.trim() !== '') {
		const aliases = note.system.aliases;
		if (aliases === undefined || aliases.length === 0) {
			diagnostics.push(
				diagnostic({
					...base,
					rule_id: 'object.aliases.first_is_title',
					severity: 'warning',
					level: 4,
					property_key: 'aliases',
					message: 'Список псевдонимов пуст: первым псевдонимом должно стоять название (И4)',
					hint: 'Плагин может добавить название первым псевдонимом автоматически',
					fix_available: true,
					fix_description: `Добавить aliases[0] = «${title}» (случай 2 автоисправления, severity-policy §2)`,
				}),
			);
		} else if (aliases[0] !== title) {
			diagnostics.push(
				diagnostic({
					...base,
					rule_id: 'object.aliases.first_is_title',
					severity: 'warning',
					level: 4,
					property_key: 'aliases',
					actual_value: aliases[0],
					message: 'Первый псевдоним не совпадает с названием (И4)',
					hint: 'Плагин может восстановить соответствие автоматически',
					fix_available: true,
					fix_description: `Заменить aliases[0] на «${title}» (остальные псевдонимы сохраняются)`,
				}),
			);
		}
	}

	// ---- created_at (object.created_at.required, warning, уровень 2) ----
	const createdAt = typeof note.system.created_at === 'string' ? note.system.created_at : null;
	if (createdAt === null) {
		diagnostics.push(
			diagnostic({
				...base,
				rule_id: 'object.created_at.required',
				severity: 'warning',
				level: 2,
				property_key: 'created_at',
				message: 'Не заполнена дата создания',
				hint: 'Дата будет добавлена при сохранении через плагин',
				fix_available: true,
				fix_description: 'Дописать created_at текущей датой (случай 1 автоисправления для заметок, созданных вне плагина)',
			}),
		);
	}

	// ---- И5 (часть): updated_at ≥ created_at (object.updated_at.order, error, уровень 4) ----
	const updatedAt = typeof note.system.updated_at === 'string' ? note.system.updated_at : null;
	if (createdAt !== null && updatedAt !== null && compareStamps(updatedAt, createdAt) < 0) {
		diagnostics.push(
			diagnostic({
				...base,
				rule_id: 'object.updated_at.order',
				severity: 'error',
				level: 4,
				property_key: 'updated_at',
				actual_value: updatedAt,
				message: 'Дата обновления раньше даты создания',
				hint: 'Проверьте updated_at: она не может быть раньше created_at',
			}),
		);
	}

	// ---- B1.3 часть 2: снимок классификации (один на проверку; validate-vault передаёт общий) ----
	const classification: ClassificationSnapshot | null = needsClassification(typeKey, note, registry)
		? (options?.classification !== undefined ? options.classification : await loadClassification(adapter))
		: null;

	// ---- B1.1: schema-engine — группы B (определения свойств), E (определения типов),
	// C/G (значения), H (даты) ----
	// Определение проверяется как определение, даже если соответствующий метатип
	// сам не зарегистрирован (дух ADR-002: битое определение не мешает проверкам;
	// object.type.exists на это уже пожаловался). Значения экземпляра — только для
	// зарегистрированного неабстрактного типа.
	{
		const typeDefForValues = typeKey === null ? null : registry.getType(typeKey);
		const needsPropertyDefinitionCheck = typeKey === 'property';
		const needsObjectTypeDefinitionCheck = typeKey === 'object_type';
		const needsValueCheck = typeDefForValues !== null && !typeDefForValues.abstract;
		if (needsPropertyDefinitionCheck || needsObjectTypeDefinitionCheck || needsValueCheck) {
			const index = sharedIndex !== undefined ? sharedIndex : await buildVaultIndex(adapter);
			const ctx = { registry, labels, index, classification };
			if (needsPropertyDefinitionCheck) {
				// Группа B — определение свойства (включая И6: property.key.no_system_conflict).
				diagnostics.push(...validatePropertyDefinition(note, ctx));
			}
			if (needsObjectTypeDefinitionCheck) {
				// Группа E (object_type.*) — определение типа (часть 2).
				diagnostics.push(...validateObjectTypeDefinition(note, ctx));
			}
			if (needsValueCheck && typeKey !== null) {
				// Группы C/G/H — значения предметных полей экземпляра (условные свойства —
				// с движком applies-when: М1–М7, часть 2).
				diagnostics.push(...validateInstanceValues(note, typeKey, ctx));
			}
		}
	}

	// ---- B1.3 часть 2: группа E — определения классификации и назначения категорий ----
	if (classification !== null) {
		const classificationCtx = { registry, labels, snapshot: classification };
		diagnostics.push(...validateClassificationDefinition(note, classificationCtx));
		const typeDefForAssignments = typeKey === null ? null : registry.getType(typeKey);
		if (typeDefForAssignments !== null && !typeDefForAssignments.abstract && typeKey !== null) {
			diagnostics.push(...validateClassificationAssignments(note, typeKey, classificationCtx));
		}
	}

	// ---- B1.1 часть 2: служебный слой диагностик (группа K) и служебные метки ----
	// Порядок (service-flags, решение 1): «базовые» диагностики (все, кроме diagnostics.*)
	// определяют содержимое sb_issues и метку; проверки readonly/synced сравнивают с
	// текущим состоянием заметки; запись — когда команды её включили (applyServiceFlags).
	let flagsWritten = false;
	if (isSbObjectNote(note)) {
		const issues = baseIssues(diagnostics);
		const declaredProblem = sbIssuesDeclarationProblem(registry);
		if (declaredProblem !== null && options?.checkServiceDeclaration !== false) {
			diagnostics.push(
				diagnostic({
					...base,
					rule_id: 'diagnostics.service_property.declared',
					severity: 'error',
					level: 3,
					property_key: SB_ISSUES_KEY,
					message: declaredProblem,
					hint: 'Свойство объявляется бутстрапом плагина (B1-4 = А): перезагрузите плагин — определение PROPERTY-…sb_issues будет восстановлено в Metamodel/Properties/',
				}),
			);
		}
		if (options?.applyServiceFlags === true) {
			flagsWritten = await applyServiceFlags(adapter, note, issues, declaredProblem === null);
			if (flagsWritten) {
				log?.('debug', 'service-flags', `Служебные метки и sb_issues обновлены по итогам проверки «${path}»`, {
					issues: issues.length,
					tag: expectedTagFor(issues),
				});
			}
		}
		diagnostics.push(...checkServiceFlags(note, issues, declaredProblem, flagsWritten));
	}

	if (logValidation) {
		const errors = diagnostics.filter((d) => d.severity === 'error');
		const warnings = diagnostics.filter((d) => d.severity === 'warning');
		log?.(
			errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'info',
			'validation',
			`Проверка «${path}»: ошибок ${errors.length}, предупреждений ${warnings.length}`,
			{ rules: diagnostics.slice(0, MAX_ERROR_LINES_PER_RUN).map((d) => d.rule_id) },
		);
	}
	return finish(path, diagnostics, false, flagsWritten);
}

function finish(path: string, diagnostics: SbDiagnostic[], unparsable: boolean, flagsWritten = false): ValidateObjectResult {
	return {
		path,
		diagnostics,
		unparsable,
		errors: diagnostics.filter((d) => d.severity === 'error').length,
		warnings: diagnostics.filter((d) => d.severity === 'warning').length,
		flagsWritten,
	};
}

// ---------------------------------------------------------------------------
// validate-vault — проверка всего хранилища (команда реестра, mvp-scope §2.3)
// ---------------------------------------------------------------------------

/** Сводка прогона validate-vault (команда показывает Notice + окно сводки). */
export interface VaultValidationSummary {
	/** Сколько заметок-объектов проверено (заметки без `id`/`type` во frontmatter не входят). */
	checked: number;
	/** Сколько заметок имеют хотя бы одну диагностику. */
	withIssues: number;
	errors: number;
	warnings: number;
	infos: number;
	/** Скольким заметкам обновлены служебные метки/`sb_issues`. */
	flagsWritten: number;
	/** Диагностики уровня хранилища (не привязаны к одной заметке): объявленность sb_issues. */
	vaultDiagnostics: SbDiagnostic[];
	/** Самые проблемные заметки (не более 10) — для окна сводки. */
	worst: { path: string; errors: number; warnings: number }[];
}

/**
 * Проверяет все объекты Second Brain в хранилище (уровни 2–4, 6 — mvp-scope §2.3).
 *
 * Общий индекс хранилища строится ОДИН на прогон (с типами заметок — задел для
 * `object_type.abstract.no_instance`); каждая заметка читается проверкой отдельно
 * (двойное чтение — осознанное упрощение MVP, architecture.md §5, B1.1-8).
 * Область прогона — заметки с признаком объекта (`id` или `type` во frontmatter):
 * произвольные заметки пользователя (дневники, MOC) не проверяются и служебными
 * метками не помечаются (service-flags, решение 3).
 * Журнал: одна сводная запись (записи на каждую заметку подавлены — защита от флуда).
 */
export async function validateVault(
	adapter: VaultAdapter,
	registry: TypeRegistry,
	labels: LabelResolver,
	log?: LogFn,
	options?: { logPerNote?: boolean },
): Promise<VaultValidationSummary> {
	const index = await buildVaultIndex(adapter, { readTypes: true });
	// Снимок классификации — ОДИН на прогон (как индекс хранилища); после прогона
	// пишется кэш `.sb/cache/classification.json` (производные данные, ADR-002).
	const classification = await loadClassification(adapter);
	const vaultDiagnostics: SbDiagnostic[] = [];

	// diagnostics.service_property.declared — один раз на прогон (уровень хранилища).
	const declaredProblem = sbIssuesDeclarationProblem(registry);
	if (declaredProblem !== null) {
		vaultDiagnostics.push(
			diagnostic({
				rule_id: 'diagnostics.service_property.declared',
				severity: 'error',
				level: 3,
				object_path: METAMODEL_SUBFOLDERS.properties,
				property_key: SB_ISSUES_KEY,
				message: declaredProblem,
				hint: 'Свойство объявляется бутстрапом плагина (B1-4 = А): перезагрузите плагин — определение будет восстановлено',
			}),
		);
	}

	const targets = [...(index.sbObjectPaths ?? new Set<string>())].sort();
	let checked = 0;
	let withIssues = 0;
	let errors = 0;
	let warnings = 0;
	let infos = 0;
	let flagsWritten = 0;
	const worst: { path: string; errors: number; warnings: number }[] = [];

	for (const path of targets) {
		const result = await validateObject(adapter, registry, labels, path, log, options?.logPerNote ?? false, index, {
			applyServiceFlags: true,
			checkServiceDeclaration: false,
			classification,
		});
		checked += 1;
		errors += result.errors;
		warnings += result.warnings;
		infos += result.diagnostics.filter((d) => d.severity === 'info').length;
		if (result.diagnostics.length > 0) {
			withIssues += 1;
		}
		if (result.flagsWritten) {
			flagsWritten += 1;
		}
		if (result.errors > 0 || result.warnings > 0) {
			worst.push({ path, errors: result.errors, warnings: result.warnings });
		}
	}

	for (const d of vaultDiagnostics) {
		if (d.severity === 'error') {
			errors += 1;
			withIssues += 1;
		} else if (d.severity === 'warning') {
			warnings += 1;
		} else {
			infos += 1;
		}
	}
	worst.sort((a, b) => b.errors - a.errors || b.warnings - a.warnings || a.path.localeCompare(b.path));

	try {
		await saveClassificationCache(adapter, classification);
		log?.('debug', 'classification', 'Кэш снимка классификации сохранён', {
			taxonomies: classification.taxonomies.length,
			facets: classification.facets.length,
			categories: classification.categories.length,
		});
	} catch (error) {
		// Кэш — не источник истины (ADR-002): сбой записи не ломает проверку.
		log?.('warning', 'cache', `Не удалось сохранить кэш классификации: ${String(error)}`);
	}

	log?.(
		errors > 0 ? 'error' : warnings > 0 ? 'warning' : 'info',
		'validation',
		`Проверка хранилища: заметок ${checked}, ошибок ${errors}, предупреждений ${warnings}`,
		{ checked, with_issues: withIssues, errors, warnings, infos, flags_written: flagsWritten },
	);
	return {
		checked,
		withIssues,
		errors,
		warnings,
		infos,
		flagsWritten,
		vaultDiagnostics,
		worst: worst.slice(0, 10),
	};
}
