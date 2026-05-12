import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/helpers/db.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    // Exclude agent worktree scratch dirs — each contains a full repo copy and
    // causes port conflicts (EADDRINUSE) + noisy FAIL output when discovered.
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/worktrees/**', '.worktrees/**'],
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
