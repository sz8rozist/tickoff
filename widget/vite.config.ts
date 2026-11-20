import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// A kód React-szintaxissal íródik, a build Preactre aliasolja (preset-vite: react -> preact/compat).
export default defineConfig({
  plugins: [preact()],
  build: {
    lib: {
      entry: 'src/main.tsx',
      name: 'Tickoff',
      formats: ['iife'],
      fileName: () => 'tickoff-widget.js',
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
