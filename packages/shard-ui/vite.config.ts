import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'styles/index': resolve(__dirname, 'src/styles/index.css')
      },
      formats: ['es']
    },
    rollupOptions: {
      external: ['svelte', 'svelte/internal', 'clsx', 'tailwind-merge'],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src'
      }
    },
    outDir: 'dist'
  },
  resolve: {
    alias: {
      '$lib': resolve(__dirname, 'src')
    }
  }
});
