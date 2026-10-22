import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Тесты lib — чистые функции, jsdom не нужен (его подъём занимал почти всё время прогона).
    // Тестам с DOM/хуками — докблок `// @vitest-environment jsdom` в начале файла.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
