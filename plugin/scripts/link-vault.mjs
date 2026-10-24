/**
 * link-vault — копирует статические файлы плагина в хранилище Obsidian
 * («вариант Б» dev-связки, без junction; см. docs/plugin/dev-setup.md).
 *
 * Использование (PowerShell):
 *   $env:SB_VAULT_PATH = "C:\Путь\К\Хранилищу"
 *   npm run link:vault
 *
 * Копируются: manifest.json, versions.json, styles.css (если есть),
 * main.js (если собран; если нет — подсказка запустить сборку).
 * После этого `npm run dev` пишет main.js напрямую в хранилище
 * (esbuild.config.mjs читает ту же переменную SB_VAULT_PATH).
 */

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const pluginDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const vaultPath = process.env.SB_VAULT_PATH;

if (!vaultPath) {
	console.error('Переменная окружения SB_VAULT_PATH не задана.');
	console.error('PowerShell:  $env:SB_VAULT_PATH = "C:\\Путь\\К\\Хранилищу"');
	console.error('bash:        export SB_VAULT_PATH="/path/to/vault"');
	process.exit(1);
}

if (!existsSync(vaultPath)) {
	console.error(`Хранилище не найдено: ${vaultPath}`);
	process.exit(1);
}

const targetDir = path.join(vaultPath, '.obsidian', 'plugins', 'second-brain');
mkdirSync(targetDir, { recursive: true });

const required = ['manifest.json', 'versions.json'];
const optional = ['styles.css', 'main.js'];

for (const file of required) {
	copyFileSync(path.join(pluginDir, file), path.join(targetDir, file));
	console.info(`скопировано: ${file}`);
}
for (const file of optional) {
	const source = path.join(pluginDir, file);
	if (existsSync(source)) {
		copyFileSync(source, path.join(targetDir, file));
		console.info(`скопировано: ${file}`);
	} else if (file === 'main.js') {
		console.warn('main.js не найден — сначала выполните `npm run build` или запустите `npm run dev`');
	}
}

console.info('');
console.info(`Файлы плагина лежат в: ${targetDir}`);
console.info('Дальше: включите плагин в Obsidian (Настройки → Сторонние плагины) и');
console.info('запустите `npm run dev` — main.js будет пересобираться прямо в хранилище.');
