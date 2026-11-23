import { defineConfig } from 'vite';

// base './' lets the built site run from any folder (school server, USB stick, GitHub Pages…)
export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2019' },
});
