import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        '**/*.stories.*',
        '**/test/**',
        '**/*.config.*',
        '**/layout.tsx',
        '**/.next/**',
      ],
      // Thresholds raised incrementally as new pages/components gain tests
      thresholds: {},
    },
  },
});
