/// <reference types="vitest" />
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import litCss from 'vite-plugin-lit-css';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

// Manually define __dirname for ES Modules
const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  // Determine if we are building the distributable library or the demo pages.
  // Usage: `vite build --mode plugin` for npm; `vite build` for GitHub Pages.
  const isLib = mode === 'plugin';

  // Use the subfolder base only for production demo builds on GitHub Pages deployment.
  // This allows 'npm run dev' to stay at the root 'http://localhost:5173/'
  const base = mode === 'production' && !isLib ? '/graph-renderer/' : '/';

  return {
    base,

    resolve: {
      alias: {
        // Redirect Node-only 'web-worker' to a harmless browser-native string.
        // This fixes the 'Failed to resolve module specifier' error in production.
        'web-worker': 'data:text/javascript,export default class {}',
      },
    },

    plugins: [
      // Transforms CSS imports into Lit-compatible CSSResult objects.
      litCss({ include: ['**/*.css'] }),
      // Only generate TypeScript declaration .d.ts files when building the library
      isLib &&
        dts({
          insertTypesEntry: true,
          include: ['src/**/*.ts', 'graph_renderer.ts', 'vite-env.d.ts'],
          exclude: ['**/*.test.ts', 'testing/**'],
        }),
    ].filter(Boolean), // Filter out 'false' if isLib is false

    test: {
      globals: true,
      environment: 'jsdom', // Simulates the browser for Lit components
      include: ['**/*.test.ts'],
      exclude: ['node_modules', 'dist'],
    },

    optimizeDeps: {
      esbuildOptions: {
        plugins: [
          {
            // elkjs references the Node-only 'web-worker' package.
            // This shim prevents Esbuild from failing during dependency pre-bundling.
            name: 'ignore-web-worker-replace',
            setup(build) {
              build.onResolve({ filter: /^web-worker$/ }, () => ({
                path: 'web-worker',
                external: true,
              }));
            },
          },
        ],
      },
    },

    build: {
      // Target modern browsers to support Top-level Await and Import Attributes.
      target: 'esnext',

      // Library mode configuration: outputs a clean ES module for npm consumption.
      lib: isLib
        ? {
            entry: resolve(__dirname, 'graph_renderer.ts'),
            name: 'GraphRenderer',
            fileName: 'graph-renderer',
            formats: ['es'],
          }
        : false,

      rollupOptions: {
        // In library mode, externalize peer dependencies to avoid bundling multiple
        // instances of Lit or RxJS. In demo mode, bundle them for the browser.
        external: isLib ? ['lit', 'rxjs', 'elkjs', 'web-worker'] : [],

        // Entry points for the multi-page demo site (ignored in library mode).
        input: isLib
          ? undefined
          : {
              main: resolve(__dirname, 'index.html'),
              elk: resolve(__dirname, 'elk.html'),
            },

        output: {
          // Provide global variables for UMD/IIFE compatibility if needed.
          globals: {
            lit: 'Lit',
            rxjs: 'rxjs',
            elkjs: 'ELK',
          },
        },
      },
    },
  };
});
