import { defineConfig } from 'vitest/config'

import dts from 'vite-plugin-dts'

export default defineConfig({
	plugins: [
		dts({
			exclude: ['vite.config.ts', '**/tests'],
			rollupTypes: true,
		}),
	],
	test: {
		environment: 'jsdom',
		coverage: {
			enabled: true,
			provider: 'v8',
			reporter: ['html'],
			exclude: ['packages/echo/*'],
		},
	},
})
