/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Compile-time smoke test for the public API barrel. Fails
 * `tsc --noEmit` (run via `npm run typecheck` or `npm run typecheck:smoke`)
 * if a documented public symbol disappears from `public_api.ts`. The module
 * has no runtime behavior and is never imported by tests or production code.
 */

import {
  // Root component
  GraphRenderer,
  MouseWheelBehavior,
  DEFAULT_ZOOM_CONFIG,
  PAN_THRESHOLD,
  type ZoomStepConfig,

  // Core data
  type BaseEdge,
  type BaseNode,
  type CustomEndpointMarker,
  type Dimension,
  type EdgeStyle,
  type Endpoint,
  type Point,
  type Port,
  type RenderableEdge,
  EdgeAnimation,
  EdgeDash,
  EdgeOpacity,
  EndpointMarker,
  Side,

  // Edge path services. The ELK-backed service is intentionally absent from
  // the core barrel; see `public_api_elk_smoke.ts` for its smoke test.
  EdgePathService,
  DefaultEdgePathService,
  FixedEnd,
  FloatingBehavior,
  type FloatingEdgeConfiguration,

  // Building blocks
  BUILT_IN_MARKER_DEFINITIONS,
  EDGE_LABEL_TEMPLATE_ID,
  DirectedGraph,
  EdgeCanvas,

  // Utilities
  computeFitToScreen,
  type BoundingBox,
} from '../public_api';

// Reference every imported symbol in a single tuple type so the compiler
// retains them under `noUnusedLocals`. The tuple is exported (rather than
// declared as a local type alias) so the same `noUnusedLocals` rule does
// not flag the alias itself; the export is otherwise unused, since this
// file is never imported at runtime.
export type _AllUsed = [
  typeof GraphRenderer,
  typeof MouseWheelBehavior,
  typeof DEFAULT_ZOOM_CONFIG,
  typeof PAN_THRESHOLD,
  ZoomStepConfig,
  BaseEdge,
  BaseNode,
  CustomEndpointMarker,
  Dimension,
  EdgeStyle,
  Endpoint,
  Point,
  Port,
  RenderableEdge,
  typeof EdgeAnimation,
  typeof EdgeDash,
  typeof EdgeOpacity,
  typeof EndpointMarker,
  typeof Side,
  typeof EdgePathService,
  typeof DefaultEdgePathService,
  typeof FixedEnd,
  typeof FloatingBehavior,
  FloatingEdgeConfiguration,
  typeof BUILT_IN_MARKER_DEFINITIONS,
  typeof EDGE_LABEL_TEMPLATE_ID,
  typeof DirectedGraph,
  typeof EdgeCanvas,
  typeof computeFitToScreen,
  BoundingBox,
];
