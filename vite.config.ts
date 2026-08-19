import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative base so the built bundle loads from file:// inside Electron and
  // from the WKWebView bundle on iOS.
  base: './',
  // No public/ dir: assets/ stays the single source of truth and everything is
  // pulled in through imports so Vite bundles it for every platform.
  publicDir: false,
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
