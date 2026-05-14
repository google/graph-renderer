# 1.1.0

## Highlights

The npm package is now feature-equivalent to building from source. Consumers
no longer need to clone the repository to get a first-class TypeScript
experience, and consumers who don't need ELK layout no longer pay its
bundle cost.

## Added

- **Full TypeScript definitions.** The published package now ships per-file
  `.d.ts` declarations covering the entire public API, with entry-shaped
  facade files for each subpath:
  - `dist/public_api.d.ts` for the default `@google/graph-renderer` subpath
    (`GraphRenderer`, `BaseNode`/`BaseEdge`/`Side`/`EndpointMarker` and
    friends, `DefaultEdgePathService`, `EdgePathService`,
    `BUILT_IN_MARKER_DEFINITIONS`, `EDGE_LABEL_TEMPLATE_ID`,
    `computeFitToScreen`, `MouseWheelBehavior`, `ZoomStepConfig`,
    `DEFAULT_ZOOM_CONFIG`, etc.).
  - `dist/public_api_elk.d.ts` for the optional
    `@google/graph-renderer/elk` subpath (`ElkEdgePathService`,
    `ElkLabelPositioning`, `ElkEdgePathConfig`).
- **`@google/graph-renderer/elk` subpath.** The ELK-backed edge path service
  is exposed under a dedicated subpath so consumers who use only the
  built-in `DefaultEdgePathService` never pull `elkjs` into their bundle.
- **`elkjs` is now an optional peer dependency** via
  `peerDependenciesMeta`. npm no longer warns consumers who don't install
  it.
- **Source maps.** `dist/graph-renderer.js.map` and
  `dist/graph-renderer-elk.js.map` are published so consumers can step into
  the original TypeScript sources from their devtools.
- **Public entry points (`public_api.ts`, `public_api_elk.ts`).** Two
  barrel modules. The core barrel side-effect imports `graph_renderer.ts`
  (registering the custom element) and re-exports the documented public
  API. The ELK barrel is opt-in and re-exports only the ELK pieces.
  Consumers can now write
  `import { BaseNode } from '@google/graph-renderer'` instead of reaching
  into nested paths. The barrels are named `public_api*.ts` (rather than
  `index.ts`) to avoid visual confusion with the sibling `index.html` demo
  entry at the repository root.
- **`sideEffects` field in `package.json`** so bundlers preserve the custom
  element registration during tree-shaking.
- **`prepublishOnly` script** runs `typecheck`, `test:run`, and `build:lib`
  before publish, preventing a future regression that would ship a broken
  or type-less artifact.

## Changed

- **README**: "Getting Started" reordered so **Option 1 is now "Via npm
  (Recommended)"** and Option 2 is "From Source (For Contributors)". The
  caveat that the npm package "currently lacks full TypeScript definitions"
  has been removed. A new "Optional: ELK-backed layout" subsection
  documents the `/elk` subpath. A new "TypeScript" subsection documents
  the published `.d.ts` files and minimum supported TS version (5.4).
- **README code examples** — every example has been rewritten to use
  bare-specifier imports (`from '@google/graph-renderer'`) instead of the
  previous deep relative imports (`from './common/interfaces'`).
- **`graph_renderer_demo.ts` and `graph_renderer_elkjs_demo.ts`** — the
  in-repo demos now import from the same `./public_api` (and
  `./public_api_elk`) barrels that external consumers use, so the demo
  source reflects the recommended import style.

## Fixed

- `vite-plugin-dts` was previously configured with `include: ['src/**/*.ts',
  ...]`, but the repository has no `src/` directory. As a result, the
  emitted `.d.ts` was effectively empty for everything outside
  `graph_renderer.ts`. The plugin now uses a dedicated `tsconfig.lib.json`
  and an `include` glob that matches the actual source layout.
- `tsconfig.json`: the `extends` field was nested inside `compilerOptions`,
  which modern TypeScript (5.x) reports as
  `TS5023: Unknown compiler option 'extends'`. Moved to the top level;
  every other `compilerOptions` value is preserved verbatim.
- `.eslintignore`: added `dist-demo/` so `gts lint` does not attempt to
  parse the demo build output, which contains modern syntax that the
  parser bundled with `gts@5.3.1` does not understand.

## Compatibility

Purely additive at the package boundary. There are no runtime API changes.
The only `peerDependencies` change is marking `elkjs` as **optional** via
`peerDependenciesMeta`, which is a strict relaxation. Consumers can
upgrade without code changes.
