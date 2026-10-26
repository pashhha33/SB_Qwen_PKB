/**
 * Генератор фиксированных ULID семенных определений базовой библиотеки (B1.3 часть 1).
 *
 * Рецепт (B1-4 = А, DL-261/276; продолжение рецепта бутстрапа — bootstrap.ts):
 *   - временная часть: SEED_TIME_MS = Date.UTC(2026, 9, 23) = 1792713600000
 *     (дата утверждения метамодели 1.0.0, DL-242) — одна на все константы;
 *   - случайная часть: первые 16 байт SHA-256 от строки
 *     «second-brain/{recipe}» → generateUlid(SEED_TIME_MS, bytes) (core/ulid.ts);
 *   - пространства имён рецептов:
 *       system-type/{type_key}                 — OBJECT_TYPE-сиды (те же, что бутстрап);
 *       system-facet/{facet_key}               — FACET-сиды (genre, literary_form, country, language, sport);
 *       system-property/{owner}.{property_key} — PROPERTY-сиды (owner = type_key владельца,
 *                                                «universal» для всеобщих — прецедент sb_issues).
 *
 * Запуск:  node scripts/generate-seed-ulids.mjs          — перезаписать src/core/seeds/seed-ulids.ts
 *          node scripts/generate-seed-ulids.mjs --check   — проверить, что файл не устарел (exit 1)
 *
 * Результат КОММИТИТСЯ (как src/generated/): рантайм плагина не пересчитывает ULID и
 * не зависит от crypto — константы байт-стабильны и одинаковы во всех хранилищах
 * (системные константы, примечание ADR-001 рев. 0.2.1). Тест tests/unit/seed-ulids.test.ts
 * воспроизводит рецепт через node:crypto и сверяет каждую константу.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SEED_TIME_MS = 1792713600000; // 2026-10-23T00:00:00.000Z

function encodeBase32(value, length) {
	let rest = value;
	let out = '';
	for (let i = length - 1; i >= 0; i--) {
		out = CROCKFORD[rest % 32] + out;
		rest = Math.floor(rest / 32);
	}
	return out;
}

function ulidFromRecipe(recipe) {
	const digest = createHash('sha256').update(`second-brain/${recipe}`).digest();
	const timePart = encodeBase32(SEED_TIME_MS, 10);
	let randomPart = '';
	for (let i = 0; i < 16; i++) {
		randomPart += CROCKFORD[digest[i] % 32];
	}
	return timePart + randomPart;
}

// --- Пространства имён: типы и фасеты ---
const TYPE_KEYS = ['work', 'book', 'person', 'media'];
const FACET_KEYS = ['genre', 'literary_form', 'country', 'language', 'sport'];

// --- PROPERTY-сиды: owner → ключи (источник: schema/metamodel/*.json, schema/entities/*.json;
// системные атрибуты И6 не сеются; relation — этап C (JSONL, граница architecture §5 B1.3-1);
// book: без publisher (organization — этап 2), related_to (C), chapter_count (вычисляемое),
// cover_file (теневое, D), categories/tags (И6); person: без related_to (C), portrait_file (D) ---
const PROPERTY_KEYS = {
	object_type: ['type_key', 'label', 'type_prefix', 'abstract', 'parent_type', 'lifecycle', 'superseded_by', 'description'],
	// display и applies_when НЕ сеются: составные структуры вне семи типов значений
	// (граница B1.3-2, architecture §5) — под контролем property.schema.json.
	property: [
		'key', 'label', 'value_type', 'cardinality', 'required', 'scope', 'object_types', 'target_types',
		'target_facet', 'link_mode', 'media_target', 'media_kinds', 'media_folders', 'media_extensions',
		'media_display', 'media_thumbnail_size', 'media_roles', 'lifecycle', 'superseded_by', 'default_value',
		'allowed_values', 'definition', 'service', 'create_from_link',
	],
	relation_type: [
		'key', 'label', 'forward_label', 'reverse_label', 'direction', 'subject_to_object', 'object_to_subject',
		'uniqueness_rule', 'allowed_subject_types', 'allowed_object_types', 'suggested_subject_types',
		'suggested_object_types', 'definition',
	],
	// label у классификационной тройки — B1.3-6 = А (DL-278): подписи объявлены схемами
	// facet/category/taxonomy, поэтому сеются и PROPERTY-определения (иначе поле не
	// показывалось бы формой и не проверялось).
	taxonomy: ['label', 'facets', 'allowed_object_types', 'hierarchy_mode', 'assignment_cardinality', 'root_requirement_min', 'root_requirement_max', 'description'],
	facet: ['label', 'taxonomy', 'allowed_object_types', 'hierarchy_mode', 'assignment_cardinality', 'root_requirement_min', 'root_requirement_max', 'description'],
	category: ['label', 'facet', 'parent', 'description'],
	book: [
		'author', 'publication_year', 'first_published_on', 'isbn', 'pages', 'original_language', 'cover',
		'read_status', 'rating', 'format', 'finished_on', 'description',
		'platform', 'publication_status', 'release_cadence', 'last_chapter_on',
		'file_path', 'file_format', 'card_series', 'card_count', 'audio_duration', 'narrator',
	],
	person: [
		'role', 'birth_date', 'death_date', 'birth_name', 'original_name', 'pen_name', 'also_known_as',
		'sort_name', 'gender', 'nationality', 'country_of_residence', 'languages_spoken', 'links',
		'description', 'portrait',
		'known_for', 'field_of_work', 'active_years',
		'writing_genres', 'writing_languages', 'published_works',
		'art_movement', 'art_training', 'art_mediums',
		'instruments', 'performance_genres', 'ensembles',
		'sport', 'sport_position', 'sport_teams',
		'academic_degree', 'academic_institutions', 'doctoral_advisor', 'thesis_title',
		'medical_specialty', 'medical_institution',
		'programming_languages', 'software_projects',
		'business_positions',
		'office_held', 'military_rank', 'conflicts',
	],
};

const recipes = [];
for (const key of TYPE_KEYS) recipes.push(`system-type/${key}`);
for (const key of FACET_KEYS) recipes.push(`system-facet/${key}`);
for (const [owner, keys] of Object.entries(PROPERTY_KEYS)) {
	for (const key of keys) recipes.push(`system-property/${owner}.${key}`);
}

const lines = [
	'/**',
	' * ФИКСИРОВАННЫЕ ULID семенных определений базовой библиотеки (B1.3 часть 1, DL-276).',
	' *',
	' * ФАЙЛ СГЕНЕРИРОВАН: node scripts/generate-seed-ulids.mjs — НЕ редактировать вручную.',
	' * Рецепт — в шапке генератора (B1-4 = А): SHA-256 от «second-brain/{recipe}», первые 16 байт,',
	' * временная часть 2026-10-23T00:00:00.000Z (SEED_TIME_MS, bootstrap.ts). Тест seed-ulids.test.ts',
	' * воспроизводит рецепт и сверяет каждую константу; --check генератора сторожит свежесть.',
	' *',
	' * НЕ МЕНЯТЬ: на этих ULID строятся перекрёстные ссылки сидов (target_types, parent_type,',
	' * target_facet) и будущие семена этапа D (media ОБЯЗАН использовать system-type/media —',
	' * ссылка book.cover/file_path и person.portrait разрешится на него).',
	' */',
	'',
	'export const SEED_ULIDS: Readonly<Record<string, string>> = Object.freeze({',
];
for (const recipe of recipes) {
	lines.push(`\t'${recipe}': '${ulidFromRecipe(recipe)}',`);
}
lines.push('});', '', '/** ULID семени по рецепту; отсутствует — ошибка сборки данных (тест сверяет состав). */', 'export function seedUlid(recipe: string): string {', '\tconst ulid = SEED_ULIDS[recipe];', '\tif (ulid === undefined) {', "\t\tthrow new Error(`Семенной ULID не сгенерирован для рецепта «${recipe}» — запустите node scripts/generate-seed-ulids.mjs`);", '\t}', '\treturn ulid;', '}', '');

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'core', 'seeds', 'seed-ulids.ts');
const content = lines.join('\n');
/** Нормализует переводы строк к LF (урок DL-259: рабочая копия Windows c autocrlf — CRLF). */
const normalizeEol = (text) => text.replace(/\r\n/g, '\n');
if (process.argv.includes('--check')) {
	const current = normalizeEol(readFileSync(out, 'utf8'));
	if (current !== content) {
		console.error('seed-ulids.ts устарел — запустите node scripts/generate-seed-ulids.mjs');
		process.exit(1);
	}
	console.log('seed-ulids.ts свеж');
} else {
	writeFileSync(out, content, 'utf8');
	console.log(`Записано ${out}: рецептов — ${recipes.length}`);
}
