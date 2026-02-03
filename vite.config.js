import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    port: 3000,
    open: '/host.html'
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        host: 'host.html',
        client: 'client.html'
      }
    }
  }
});
