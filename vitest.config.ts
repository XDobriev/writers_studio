import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^https:\/\/esm\.sh\/ts-md5(@.*)?$/, replacement: 'ts-md5' },
      { find: /^https:\/\/esm\.sh\/@supabase\/supabase-js(@.*)?$/, replacement: '@supabase/supabase-js' },
      // edge-код тянет ts-md5 по URL (Deno); в тестах — тот же пакет из npm.
      { find: 'https://esm.sh/ts-md5@1.3.1', replacement: 'ts-md5' },
    ],
  },
  test: {
    // Тесты lib — чистые функции, jsdom не нужен (его подъём занимал почти всё время прогона).
    // Тестам с DOM/хуками — докблок `// @vitest-environment jsdom` в начале файла.
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'supabase/functions/_shared/**/*.test.ts',
    ],
  },
});
