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
        name: 'HCC Prevailing Wage',
        short_name: 'PrevWage',
        description: 'Prevailing wage compliance for contractors',
        theme_color: '#F5C518',
        background_color: '#1a1a1a',
        display: 'standalone',
        orientation: 'portrait-primary',
        categories: ['business', 'productivity'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        shortcuts: [
          { name: 'Field Clock', url: '/field-clock', description: 'Clock in/out on job site' },
          { name: 'Dashboard', url: '/dashboard', description: 'View compliance dashboard' },
        ],
      },
    }),
  ],
  root: 'src/client',
  build: { outDir: '../../dist/client', emptyOutDir: true },
  server: {
    port: 4200,
    proxy: { '^/api(/|$)': { target: 'http://localhost:4099', changeOrigin: true } },
  },
});
