import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'src/client',
  build: { outDir: '../../dist/client' },
  server: {
    port: 4200,
    proxy: { '/api': { target: 'http://localhost:4099', changeOrigin: true } },
  },
});
