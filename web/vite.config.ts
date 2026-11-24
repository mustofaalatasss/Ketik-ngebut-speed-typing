import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Saat dev, /api/* diteruskan ke backend .NET (lihat launchSettings.json), jadi tidak perlu CORS.
    proxy: {
      '/api': {
        target: 'http://localhost:5288',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    // Default Node: modul core/ murni dites tanpa browser. Test UI memakai komentar `@vitest-environment jsdom`.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
