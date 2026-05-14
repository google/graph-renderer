/// <reference types="vitest" />
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import litCss from 'vite-plugin-lit-css';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

// Manually define __dirname for ES Modules
const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * Library entry definitions. Each describes a single subpath of the
 * published npm package (`@google/graph-renderer` and
 * `@google/graph-renderer/elk`).
 *
 * Vite is invoked once per entry, selected by the `LIB_ENTRY` environment
 * variable. Running both passes in sequence (see the `build:lib` script in
 * `package.json`) populates `dist/` with the JS bundles and per-file `.d.ts`
 * declarations for both subpaths.
 */
const LIB_ENTRIES = {
  // Default subpath (`@google/graph-renderer`).
  //   Source entry: public_api.ts (which side-effect imports graph_renderer.ts)
  //   JS output:    dist/graph-renderer.js (+ .map)
  //   Types entry:  dist/public_api.d.ts (the dts plugin names the entry
  //                 declaration file after the source entry's basename;
  //                 package.json `exports` points at this filename directly)
  core: {
    entry: 'public_api.ts',
    fileName: 'graph-renderer',
    globalName: 'GraphRenderer',
  },
  // ELK subpath (`@google/graph-renderer/elk`).
  //   Source entry: public_api_elk.ts (re-exports ElkEdgePathService etc.)
  //   JS output:    dist/graph-renderer-elk.js (+ .map)
  //   Types entry:  dist/public_api_elk.d.ts
  elk: {
    entry: 'public_api_elk.ts',
    fileName: 'graph-renderer-elk',
    globalName: 'GraphRendererElk',
  },
} as const;

type LibEntryKey = keyof typeof LIB_ENTRIES;

function resolveLibEntry(): (typeof LIB_ENTRIES)[LibEntryKey] {
  const requested = (process.env['LIB_ENTRY'] ?? 'core') as LibEntryKey;
  if (!(requested in LIB_ENTRIES)) {
    throw new Error(
      `Unknown LIB_ENTRY="${requested}". Expected one of: ${Object.keys(
        LIB_ENTRIES
      ).join(', ')}`
    );
  }
  return LIB_ENTRIES[requested];
}

export default defineConfig(({ mode }) => {
  // Determine if we are building the distributable library or the demo pages.
  // Usage: `vite build --mode plugin` for npm; `vite build` for GitHub Pages.
  const isLib = mode === 'plugin';

  // Use the subfolder base only for production demo builds on GitHub Pages deployment.
  // This allows 'npm run dev' to stay at the root 'http://localhost:5173/'
  const base = mode === 'production' && !isLib ? '/graph-renderer/' : '/';

  const libEntry = isLib ? resolveLibEntry() : null;

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
      // Generate TypeScript declaration files only when building the library.
      // The dedicated `tsconfig.lib.json` enables `declaration` and walks the
      // entire source tree; the root `tsconfig.json` sets `noEmit: true`
      // because Vite handles JS emission.
      isLib &&
        libEntry &&
        dts({
          tsconfigPath: resolve(__dirname, 'tsconfig.lib.json'),
          // Emit per-file declarations that mirror the source tree (e.g.
          // `dist/public_api.d.ts`, `dist/common/interfaces.d.ts`,
          // `dist/edge_path_service/elk_edge_path_service.d.ts`, ...).
          // `package.json`'s `exports` map points at the entry-shaped facade
          // files (`./dist/public_api.d.ts` and `./dist/public_api_elk.d.ts`),
          // and TypeScript follows their per-file re-exports natively.
          //
          // `rollupTypes: true` is incompatible with Lit's `CSSStyleSheet`
          // typing (api-extractor cannot resolve the symbol).
          rollupTypes: false,
          include: [
            'public_api.ts',
            'public_api_elk.ts',
            'graph_renderer.ts',
            'common/**/*.ts',
            'directed_graph/**/*.ts',
            'edge_canvas/**/*.ts',
            'edge_label_render/**/*.ts',
            'edge_path_service/**/*.ts',
            'minimap/**/*.ts',
            'node_render/**/*.ts',
            'vite-env.d.ts',
          ],
          exclude: [
            '**/*.test.ts',
            'testing/**',
            'graph_renderer_demo.ts',
            'graph_renderer_elkjs_demo.ts',
          ],
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

      // Emit sourcemaps for the published library so downstream consumers can
      // debug into the original TypeScript sources.
      sourcemap: isLib,

      // Don't clear `dist/` between LIB_ENTRY passes so the second pass
      // doesn't blow away the first pass's output.
      emptyOutDir: !isLib || libEntry?.entry === LIB_ENTRIES.core.entry,

      // Library mode configuration: outputs a clean ES module for npm consumption.
      lib:
        isLib && libEntry
          ? {
              entry: resolve(__dirname, libEntry.entry),
              name: libEntry.globalName,
              fileName: libEntry.fileName,
              formats: ['es'],
            }
          : false,

      rollupOptions: {
        // In library mode, externalize peer dependencies to avoid bundling
        // multiple instances of Lit or RxJS at the consumer. In demo mode,
        // bundle them for the browser.
        external: isLib
          ? ['lit', 'rxjs', 'elkjs', 'web-worker', /^lit\//, /^rxjs\//]
          : [],

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
