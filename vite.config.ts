import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// Source maps нужны только для Sentry: без токена загрузки их не генерируем вовсе,
// с токеном — 'hidden' (без ссылки //# sourceMappingURL в бандле) и удаляем из dist
// после загрузки, чтобы они не попали на прод. Тесты настраиваются в vitest.config.ts.
const uploadSourcemaps = !!process.env.SENTRY_AUTH_TOKEN;

export default defineConfig({
  plugins: [
    react(),
    ...(uploadSourcemaps
      ? [sentryVitePlugin({
          url: 'https://de.sentry.io',
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
        })]
      : []),
  ],
  optimizeDeps: {
    include: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
  },
  server: {
    port: 5273,
    strictPort: true,
    host: '127.0.0.1',
  },
  build: {
    sourcemap: uploadSourcemaps ? 'hidden' : false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@tiptap') || id.includes('prosemirror')) return 'vendor-tiptap';
          if (id.includes('@dnd-kit')) return 'vendor-dnd';
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('@tanstack')) return 'vendor-query';
          // До react-правила: иначе '/react/' ловит node_modules/@sentry/react/.
          if (id.includes('@sentry')) return 'vendor-sentry';
          if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/')) return 'vendor-react';
        },
      },
    },
  },
});
