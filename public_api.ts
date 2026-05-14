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
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Public entry point for the @google/graph-renderer npm package.
 *
 * Importing this module has the side effect of registering the
 * `<gr-graph-renderer>` and supporting custom elements; it also re-exports
 * the public TypeScript surface.
 */

// --- Side-effect imports: register custom elements --------------------------
// `graph_renderer.ts` itself imports the supporting components
// (directed_graph, minimap), so a single import is enough to register the
// full element tree.
import './graph_renderer';

// --- Root component ---------------------------------------------------------
export {
  GraphRenderer,
  MouseWheelBehavior,
  DEFAULT_ZOOM_CONFIG,
  PAN_THRESHOLD,
  type ZoomStepConfig,
} from './graph_renderer';

// --- Core data interfaces ---------------------------------------------------
// `common/interfaces.ts` defines a `BoundingBox` type with a different shape
// than the one in `common/compute_fit_to_screen.ts`. Only the latter (which
// matches the documented `computeFitToScreen` API) is re-exported below; the
// former is intentionally omitted to avoid a name collision.
export type {
  BaseEdge,
  BaseNode,
  ClampConfig,
  CanvasDimensionCalculationConfig,
  CustomEndpointMarker,
  Dimension,
  EdgeSection,
  EdgeStyle,
  Endpoint,
  Graph,
  LabelConfiguration,
  Options,
  PanningContext,
  Point,
  Port,
  Renderable,
  RenderableEdge,
  RenderableLabel,
  RenderableTentativeEdge,
  TentativeEdge,
  PositionedGraph,
  // Pan/drag event discriminated union members
  ClickPanEvent,
  DragEndEvent,
  DragEvent,
  DragMoveEvent,
  DragStartEvent,
  MinimapPanEvent,
  NullPanEvent,
  WheelPanEvent,
} from './common/interfaces';
export {
  EdgeAnimation,
  EdgeDash,
  EdgeOpacity,
  EndpointMarker,
  PanningBehavior,
  Side,
} from './common/interfaces';

// --- Edge path services -----------------------------------------------------
export {
  BendDirection,
  EdgePathService,
  Quadrant,
} from './edge_path_service/edge_path_service';
export {
  DefaultEdgePathService,
  FixedEnd,
  FloatingBehavior,
  MarkerOrientation,
  type FloatingEdgeConfiguration,
  type Line,
  type ShortEdgeLabelOffsetConfiguration,
} from './edge_path_service/default_edge_path_service';
// `ElkEdgePathService` and related symbols are intentionally not re-exported
// here. They depend on the `elkjs` peer dependency, which is optional for
// consumers using the built-in default edge layout. The ELK-backed service
// is exposed from the dedicated `@google/graph-renderer/elk` subpath; see
// `public_api_elk.ts`.

// --- Renderer building blocks ----------------------------------------------
export {
  BUILT_IN_MARKER_DEFINITIONS,
  EdgeCanvas,
} from './edge_canvas/edge_canvas';
export {
  DEFAULT_EDGE_STYLE,
  DirectedGraph,
  EDGE_LABEL_TEMPLATE_ID,
} from './directed_graph/directed_graph';

// --- Utility functions ------------------------------------------------------
export {
  computeFitToScreen,
  getBoundingBox,
  INFINITE_BOUNDING_BOX,
  type BoundingBox,
} from './common/compute_fit_to_screen';
