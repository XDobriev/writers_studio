import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5273,
    strictPort: true,
    host: '127.0.0.1',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@tiptap') || id.includes('prosemirror')) return 'vendor-tiptap';
          if (id.includes('@dnd-kit')) return 'vendor-dnd';
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('@tanstack')) return 'vendor-query';
          if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/')) return 'vendor-react';
        },
      },
    },
  },
});
