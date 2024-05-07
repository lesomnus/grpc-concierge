import { resolve } from 'node:path'

import dts from 'vite-plugin-dts'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

import thisPackage from './package.json'

export default defineConfig({
	plugins: [
		tsconfigPaths(),
		dts({
			exclude: ['vite.config.ts', '**/tests'],
		}),
	],
	build: {
		minify: false,
		lib: {
			entry: {
				main: resolve(__dirname, 'src/index.ts'),
				react: resolve(__dirname, 'src/react/index.ts'),
			},
			name: 'grpc-concierge',
			fileName: (format, entryName) => {
				return `${entryName}.${format}.js`
			},
			formats: ['es', 'cjs'],
		},
		rollupOptions: {
			external: [
				...Object.keys(thisPackage.peerDependencies),
				...Object.keys(thisPackage.optionalDependencies),
			],
		},
	},
	test: {
		environment: 'jsdom',
		coverage: {
			enabled: true,
			provider: 'v8',
			reporter: ['html'],
			exclude: ['src/echo/*'],
		},
	},
})
