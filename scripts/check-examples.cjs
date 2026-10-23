#!/usr/bin/env node
/**
 * Second Brain — прогонщик примеров (шаг 9, батч 2, DL-227).
 *
 * Что делает:
 *  1. Компилирует все JSON Schema каталога schema/ (Draft 2020-12, ajv).
 *  2. Обходит examples/instances/{type_key}/*.md:
 *     - valid-*.md   — frontmatter обязан пройти схему {type_key};
 *     - invalid-*.md — frontmatter обязан НЕ пройти схему.
 *  3. Печатает отчёт; код возврата 0 — все ожидания совпали, 1 — есть расхождения.
 *
 * Запуск:  npm install && npm run check   (или: node scripts/check-examples.cjs)
 * Зависимости — dev: ajv, js-yaml. Офлайн, без внешних API (рамки проекта).
 *
 * Зачаток тестового харнеса Фазы 5: полный harness (витрина фикстур, генерация
 * TS-типов + тест свежести) подключается на этапе реализации плагина (DL-222).
 */
'use strict';

const Ajv = require('ajv/dist/2020.js');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const REPO = path.join(__dirname, '..');
const SCHEMA_DIRS = ['schema/common', 'schema/metamodel', 'schema/entities', 'schema/relations'];
const EXAMPLES_ROOT = path.join(REPO, 'examples', 'instances');

// --- 1. Загрузка и компиляция схем -----------------------------------------
const ajv = new Ajv({ strict: false, allErrors: true });
const schemaKeys = []; // 'file://...' ключи добавленных схем

function addSchemasFrom(dirRel) {
  const dir = path.join(REPO, dirRel);
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue;
    const abs = path.join(dir, name);
    const key = 'file://' + abs;
    if (ajv.getSchema(key)) continue;
    ajv.addSchema(JSON.parse(fs.readFileSync(abs, 'utf8')), key);
    schemaKeys.push(key);
  }
}

for (const d of SCHEMA_DIRS) addSchemasFrom(d);
console.log(`Скомпилировано схем: ${schemaKeys.length}`);

function schemaFor(typeKey) {
  for (const d of ['schema/entities', 'schema/metamodel']) {
    const abs = path.join(REPO, d, `${typeKey}.schema.json`);
    if (fs.existsSync(abs)) return 'file://' + abs;
  }
  return null;
}

// --- 2. Разбор frontmatter --------------------------------------------------
function readFrontmatter(mdPath) {
  const text = fs.readFileSync(mdPath, 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new Error('нет frontmatter');
  return yaml.load(m[1]);
}

// --- 3. Обход примеров -------------------------------------------------------
let pass = 0;
let fail = 0;
const problems = [];

for (const typeDir of fs.readdirSync(EXAMPLES_ROOT).sort()) {
  const dirAbs = path.join(EXAMPLES_ROOT, typeDir);
  if (!fs.statSync(dirAbs).isDirectory()) continue;
  const schemaKey = schemaFor(typeDir);
  const files = fs.readdirSync(dirAbs).filter((f) => f.endsWith('.md')).sort();

  if (!schemaKey) {
    console.log(`?? [${typeDir}] схема не найдена — ${files.length} файл(ов) пропущено`);
    problems.push(`${typeDir}: примеры есть, схемы нет`);
    continue;
  }
  const validate = ajv.getSchema(schemaKey);

  for (const f of files) {
    const expectValid = /^valid-/.test(f);
    const expectInvalid = /^invalid-/.test(f);
    if (!expectValid && !expectInvalid) {
      console.log(`?? [${typeDir}/${f}] имя не valid-* и не invalid-* — пропущен`);
      continue;
    }
    let data;
    try {
      data = readFrontmatter(path.join(dirAbs, f));
    } catch (e) {
      fail++;
      problems.push(`${typeDir}/${f}: ${e.message}`);
      console.log(`FAIL [${typeDir}/${f}] frontmatter не разбирается: ${e.message}`);
      continue;
    }
    const ok = validate(data);
    const good = expectValid ? ok : !ok;
    good ? pass++ : fail++;
    const verdict = ok ? 'valid' : 'invalid';
    console.log(`${good ? 'OK  ' : 'FAIL'} [${typeDir}/${f}] ожидали ${expectValid ? 'valid' : 'invalid'}, получили ${verdict}`);
    if (!good && ok === false && expectValid) {
      for (const e of (validate.errors || []).slice(0, 4)) {
        console.log(`       ${e.instancePath || '/'} ${e.message}`);
      }
      problems.push(`${typeDir}/${f}: корректный пример не прошёл схему`);
    }
    if (!good && ok === true) {
      problems.push(`${typeDir}/${f}: некорректный пример прошёл схему`);
    }
    if (expectInvalid && !ok) {
      // короткая сводка — чем именно пойман (педагогическая ценность D4)
      const summary = (validate.errors || []).slice(0, 3).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');
      console.log(`       пойман на: ${summary}`);
    }
  }
}

console.log(`\nИТОГ: ${pass} OK, ${fail} FAIL`);
if (problems.length) {
  console.log('Проблемы:');
  for (const p of problems) console.log(' - ' + p);
}
process.exit(fail || problems.length ? 1 : 0);
