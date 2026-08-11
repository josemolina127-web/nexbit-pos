import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build de la version web (cPanel). No toca el vite.config.js de Electron.
export default defineConfig({
  plugins: [react()],
  root: __dirname,
  base: './',
  build: {
    outDir: '../dist-web',
    emptyOutDir: true,
    // Nombres FIJOS (sin hash): cada update solo sobreescribe los mismos archivos,
    // nada que borrar en cPanel. El .htaccess desactiva la cache del navegador.
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/app.js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  server: {
    port: 5877,
    strictPort: false,
  },
});