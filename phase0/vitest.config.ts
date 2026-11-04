import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'https://www.instagram.com/direct/t/synthetic-thread/' } },
    clearMocks: true,
    restoreMocks: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
