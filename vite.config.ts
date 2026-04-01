import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import tsconfigPaths from 'vite-tsconfig-paths';
import litCss from 'vite-plugin-lit-css';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  // Determine if we are building the distributable library or the demo pages.
  // Usage: `vite build --mode plugin` for npm; `vite build` for GitHub Pages.
  const isLib = mode === 'plugin';

  return {
    // Base path for GitHub Pages deployment.
    // Ensure this matches your repository name.
    base: mode === 'production' ? '/graph-renderer/' : '/',

    plugins: [
      tsconfigPaths(),
      // Transforms CSS imports into Lit-compatible CSSResult objects.
      litCss({ include: ['**/*.css'] }),
      // Generate TypeScript declaration files only for the library build.
      isLib && dts({ insertTypesEntry: true }),
    ],

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
      lib: isLib ? {
        entry: resolve(__dirname, 'graph_renderer.ts'),
        name: 'GraphRenderer',
        fileName: 'graph-renderer',
        formats: ['es'],
      } : false,

      rollupOptions: {
        // In library mode, externalize peer dependencies to avoid bundling multiple
        // instances of Lit or RxJS. In demo mode, bundle them for the browser.
        external: isLib
          ? ['lit', 'rxjs', 'elkjs', 'web-worker']
          : ['web-worker'],

        // Entry points for the multi-page demo site (ignored in library mode).
        input: isLib ? undefined : {
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
