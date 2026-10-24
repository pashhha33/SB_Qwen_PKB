/**
 * validate-object — проверка одного объекта (этап A2).
 *
 * Объём A2: группа A реестра правил (docs/validation/rules.md) — системные атрибуты
 * и инварианты И1–И5, плюс И6-правило для определений свойств. Уровни контроля 2–4
 * (ADR-011). Группа B/C и полные свойства — этап B (schema-engine); связи — этап C.
 *
 * Правило `object.created_at.immutable` (И5, «не изменился относительно предыдущей
 * версии») в A2 НЕ проверяется: нужна история/снимок предыдущего состояния —
 * появится с backup-service (этап C). Осознанный пропуск, зафиксирован в architecture.md.
 *
 * `object.frontmatter.broken` — временный id: в реестре 167 правил нет id для
 * «frontmatter не разбирается» у заметки-объекта (у .base есть view.base.parsable).
 * Регистрация нового id — вместе с батчем F5-7/F5-8 (MINOR: правило-предупреждение).
 */

import type { VaultAdapter } from '../adapter/vault-adapter';
import type { LogFn } from './activity-log';
import { diagnostic, type SbDiagnostic } from './diagnostics';
import { findDuplicateIds, fileNameMatchesId, parseFileName, repairFileNameById } from './identity';
import type { LabelResolver } from './label-resolver';
import { parseNote } from './markdown-parser';
import { SYSTEM_KEYS } from './model';
import type { TypeRegistry } from './registry';
import { isValidUlid } from './ulid';

export interface ValidateObjectResult {
	path: string;
	diagnostics: SbDiagnostic[];
	/** true, если frontmatter не применим (дальнейшие проверки невозможны). */
	unparsable: boolean;
	errors: number;
	warnings: number;
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

	// ---- И6: определения свойств не занимают системные ключи (property.key.no_system_conflict, error, уровень 4) ----
	if (typeKey === 'property') {
		const key = typeof note.properties.key === 'string' ? note.properties.key : null;
		if (key !== null && (SYSTEM_KEYS as readonly string[]).includes(key)) {
			diagnostics.push(
				diagnostic({
					...base,
					rule_id: 'property.key.no_system_conflict',
					severity: 'error',
					level: 4,
					property_key: 'key',
					actual_value: key,
					message: `Ключ свойства «${key}» занят системным атрибутом (И6)`,
					hint: 'Выберите другой ключ: системные атрибуты (id, type, title, aliases, created_at, updated_at, categories, tags) не переопределяются',
				}),
			);
		}
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
	return finish(path, diagnostics, false);
}

function finish(path: string, diagnostics: SbDiagnostic[], unparsable: boolean): ValidateObjectResult {
	return {
		path,
		diagnostics,
		unparsable,
		errors: diagnostics.filter((d) => d.severity === 'error').length,
		warnings: diagnostics.filter((d) => d.severity === 'warning').length,
	};
}
