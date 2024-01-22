import { resolve } from 'path'
import { defineConfig, mergeConfig } from 'vite'

import base from '../../vite.config'

export default mergeConfig(
	base,
	defineConfig({
		root: resolve(__dirname),
		build: {
			lib: {
				entry: resolve(__dirname, 'src/index.ts'),
				name: '@tests/echo',
				fileName: 'index',
			},
		},
	}),
)
