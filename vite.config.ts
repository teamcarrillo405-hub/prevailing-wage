import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: '.',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectManifest: {
        rollupFormat: 'iife',
      },
      manifest: {
        name: 'PrevailingWage',
        short_name: 'PrevWage',
        theme_color: '#1E3A5F',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  root: 'src/client',
  build: { outDir: '../../dist/client', emptyOutDir: true },
  server: {
    port: 4200,
    proxy: { '/api': { target: 'http://localhost:4099', changeOrigin: true } },
  },
});
