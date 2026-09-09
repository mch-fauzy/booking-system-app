import { defineConfig, coverageConfigDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  'server-only': fileURLToPath(new URL('./tests/stubs/server-only.js', import.meta.url)),
};

// Neon round trips cost ~300ms from a dev machine and the confirm transaction makes six, so a
// DB-backed test clears Vitest's 5s unit-test default. The ceiling is 60s rather than 30s because a
// free-tier Neon compute can cold-start mid-suite and slow every query for that file. Still low
// enough to catch a genuine hang. Unit tests keep the 5s default.
const INTEGRATION_TIMEOUT_MS = 60_000;

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
      include: ['src'],
      exclude: [
        ...coverageConfigDefaults.exclude,
        'src/shared/components/ui/**',
        'src/app/**',
        'src/shared/db/migrations/**',
        'src/shared/lib/db/**',
        'src/shared/lib/next/**',
        'src/**/*.integration.test.*',
      ],
    },
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.{ts,tsx}'],
          exclude: ['**/*.integration.test.{ts,tsx}', '**/node_modules/**'],
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['src/**/*.integration.test.{ts,tsx}'],
          fileParallelism: false,
          testTimeout: INTEGRATION_TIMEOUT_MS,
          hookTimeout: INTEGRATION_TIMEOUT_MS,
        },
      },
    ],
  },
});
