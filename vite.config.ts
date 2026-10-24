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
    rolldownOptions: {
      output: {
        // Группа забирает и зависимости своих модулей, поэтому порядок задаёт priority:
        // иначе react-dom (зависимость @dnd-kit) уезжал в vendor-dnd и грузился на лендинге.
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/, priority: 60 },
            { name: 'vendor-sentry', test: /node_modules[\\/]@sentry[\\/]/, priority: 50 },
            { name: 'vendor-supabase', test: /node_modules[\\/]@supabase[\\/]/, priority: 40 },
            { name: 'vendor-query', test: /node_modules[\\/]@tanstack[\\/]/, priority: 40 },
            // Мелкие общие пакеты (recharts/redux в Admin, tiptap): без отдельной группы они оседали в vendor-tiptap и /admin тянул редактор.
            { name: 'vendor-shared', test: /node_modules[\\/](fast-equals|use-sync-external-store)[\\/]/, priority: 35 },
            { name: 'vendor-tiptap', test: /node_modules[\\/](@tiptap|prosemirror-[^\\/]+)[\\/]/, priority: 30 },
            { name: 'vendor-dnd', test: /node_modules[\\/]@dnd-kit[\\/]/, priority: 20 },
          ],
        },
      },
    },
  },
});
