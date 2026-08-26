import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // The heavy export libs (jspdf/docx/html2canvas) are already isolated in a
      // lazy `download` chunk; the warning is informational, so lift the limit.
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          // Split rarely-changing vendor code into stable, separately-cached
          // chunks so a UI change doesn't bust the whole vendor cache and the
          // browser can fetch them in parallel. Export libs are intentionally
          // left out — Rollup keeps them inside the async `download` chunk.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
            if (id.includes('motion') || id.includes('framer')) return 'motion';
            if (id.includes('lucide')) return 'icons';
            return undefined;
          },
        },
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          // Whisper transcription / OpenAI calls can take a while. Without these,
          // the dev proxy drops the socket on slow upstream responses, which the
          // browser reports as a generic "Failed to fetch".
          timeout: 180000,
          proxyTimeout: 180000,
        },
      },
    },
  };
});