import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    lib: {
      entry: 'src/addon.tsx',
      fileName: () => 'addon.js',
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        '@tanstack/react-query',
        '@wealthfolio/addon-sdk',
        '@wealthfolio/ui',
        'date-fns',
        'lucide-react',
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'recharts',
      ],
    },
    outDir: 'dist',
    minify: false,
    sourcemap: false,
  },
});
