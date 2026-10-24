import { defineConfig } from 'vitest/config';

// Тесты плагина Second Brain (решение DL-244, вопрос 9.3 = А):
// - юнит-тесты модулей и интеграционные тесты живут в plugin/tests/;
// - интеграционные идут на FakeVault (tests/support/fake-vault.ts) — реальная папка
//   во временном каталоге за интерфейсом VaultAdapter, без запуска Obsidian;
// - материал для парсера — примеры репозитория (../examples/instances/).
export default defineConfig({
	test: {
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		testTimeout: 20000,
	},
});
