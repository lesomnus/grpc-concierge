import { resolve } from 'path'
import { defineConfig, mergeConfig } from 'vite'
import react from '@vitejs/plugin-react'

import base from '../../vite.config'

export default mergeConfig(
	base,
	defineConfig({
		plugins: [react()],
		build: {
			lib: {
				entry: resolve(__dirname, 'src/index.ts'),
				name: 'grpc-concierge-react',
				fileName: 'index',
			},
		},
	}),
)
