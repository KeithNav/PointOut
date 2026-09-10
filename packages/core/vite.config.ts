import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Builds the SDK into three formats so it works everywhere:
// - IIFE (window.PointOut) for plain <script> tags on any static site
// - ESM / CJS for bundler-based projects (React, Vue, Next.js, ...)
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PointOut',
      fileName: (format) => {
        if (format === 'es') return 'pointout.mjs';
        if (format === 'cjs') return 'pointout.cjs';
        return 'pointout.iife.js';
      },
      formats: ['es', 'cjs', 'iife'],
    },
    sourcemap: true,
    minify: 'esbuild',
  },
});
