import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './', // Relative paths for GitHub Pages
  server: {
    port: 3000,
    open: '/'
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html'
      }
    }
  }
});
