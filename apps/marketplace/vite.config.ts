import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { generatePluginsPlugin } from './plugins/vite-plugin-generate-plugins.js';

export default defineConfig({
	plugins: [generatePluginsPlugin(), tailwindcss(), sveltekit()],
	resolve: {
		alias: {
			'$types': '../../../packages/shard-installer/src/marketplace/types'
		}
	}
});
