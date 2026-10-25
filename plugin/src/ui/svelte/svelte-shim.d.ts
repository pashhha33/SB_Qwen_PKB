/**
 * Декларация модулей Svelte для TypeScript (B1.2): tsc не разбирает `.svelte`
 * напрямую — компонент типизирован как Svelte 5 `Component` (mount/unmount API).
 * Сборкой занимается esbuild + esbuild-svelte (B1-2 = А, DL-261).
 */
declare module '*.svelte' {
	import type { Component } from 'svelte';
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const component: Component<any, any, any>;
	export default component;
}
