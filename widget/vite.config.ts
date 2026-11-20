import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// A kód React-szintaxissal íródik, a build Preactre aliasolja (preset-vite: react -> preact/compat).
export default defineConfig({
  plugins: [preact()],
  // A demo oldal origin-jének (http://localhost:5174) egyeznie kell a projekt oldalával (CORS + origin-ellenőrzés).
  server: { port: 5174, strictPort: true },
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
