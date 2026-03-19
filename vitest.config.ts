import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/helpers/db.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/server/services/calculations.ts'],
      thresholds: {
        'src/server/services/calculations.ts': { 100: true },
      },
      reporter: ['text', 'html'],
    },
  },
});
