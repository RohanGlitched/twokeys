import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Elliptic-curve work on 64-entry sets takes seconds on a busy laptop.
    testTimeout: 120_000,
    pool: 'forks',
  },
});
