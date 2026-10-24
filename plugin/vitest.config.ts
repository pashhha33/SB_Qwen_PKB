import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Тесты плагина Second Brain (решение DL-244, вопрос 9.3 = А):
// - юнит-тесты модулей и интеграционные тесты живут в plugin/tests/;
// - интеграционные идут на FakeVault (tests/support/fake-vault.ts) — реальная папка
//   во временном каталоге за интерфейсом VaultAdapter, без запуска Obsidian;
// - материал для парсера — примеры репозитория (../examples/instances/).
export default defineConfig({
	resolve: {
		alias: {
			// Пакет 'obsidian' — только типы ("main": ""), рантайм-модуль инъектирует
			// приложение. Юнит-тесту прод-адаптера (контракт DL-255, obsidian-adapter.test.ts)
			// нужна загрузимая минимальная поверхность — её отдаёт стаб.
			// На сборку не влияет: esbuild помечает 'obsidian' как external.
			obsidian: fileURLToPath(new URL('./tests/support/obsidian-stub.ts', import.meta.url)),
		},
	},
	test: {
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		testTimeout: 20000,
	},
});
