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
 * @fileoverview Interfaces for the graph renderer
 */

/** Parameters to pass a clamping function */
export interface ClampConfig {
  num: number;
  min: number;
  max: number;
}

/**
 * Represents the a coordinate object type
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Represents the dimensions of a rectangle
 */
export interface Dimension {
  height: number;
  width: number;
}

/**
 * Interface for an element that can be positioned on the canvas
 */
export interface Renderable extends Point, Dimension {}

/**
 * Arbitrary key value storage per node
 */
export interface Options {
  // tslint:disable-next-line:no-any Allows any type to be stored in a node's payload.
  [s: string]: any;
  initialZIndex?: number; // zIndex to set the node to when it is first added to the graph (updated when a node is dragged)
}

/**
 * Represents the panning state
 */
export interface PanningContext {
  panning: boolean;
  point?: Point;
}

/**
 * Interface for a node in the graph
 */
export interface BaseNode extends Renderable {
  id: string;
  templateId: string;
  ports?: Port[]; // Index relative to other ports on same side determines order
  dragDisabled?: boolean;
  options?: Options;
}

/**
 * Interface for a label configuration
 */
export interface LabelConfiguration extends Dimension {}

/**
 * Interface for a renderable edge label
 */
export interface RenderableLabel extends LabelConfiguration, Renderable {
  id: string; // ID of the edge associated with the label
}

/**
 * Interface for an edge section
 */
export interface EdgeSection {
  id: string;
  startPoint?: Point;
  endPoint?: Point;
  bendPoints?: Point[];
  incomingShape?: string;
  outgoingShape?: string;
  incomingSections?: string[];
  outgoingSections?: string[];
}

/**
 * Interface for a edge in the graph with two endpoints. Assumes directed.
 */
export interface BaseEdge {
  from: Endpoint;
  to: Endpoint;
  id?: string;
  weight?: number;
  label?: LabelConfiguration;
  style?: Partial<EdgeStyle>;
  sections?: EdgeSection[];
}

/**
 * Interface for a tentative edge in the graph - uses a point for the "To" so
 * that it can be dragged across canvas
 */
export interface TentativeEdge extends Omit<BaseEdge, 'to'> {
  to: Point;
}

/**
 * Interface for a renderable tentative edge in the graph
 */
export interface RenderableTentativeEdge extends Omit<TentativeEdge, 'style'> {
  id: string;
  path: string;
  style: EdgeStyle;
}

/**
 * Interface for a edge in the graph with two endpoints. Assumes directed.
 */
export interface RenderableEdge extends Omit<BaseEdge, 'id' | 'style'> {
  id: string;
  path: string;
  labelPosition: Point;
  style: EdgeStyle;
}

/**
 * Interface for an endpoint of an edge
 */
export interface Endpoint {
  nodeId: string;
  portId?: string;
}

/**
 * Interface for a port on a node. Can be specified as an endpoint to an edge.
 */
export interface Port {
  id: string;
  side: Side;
}

/**
 * Side of a rectangle. Used to specify location of a port on a node.
 */
export enum Side {
  TOP = 'top',
  RIGHT = 'right',
  BOTTOM = 'bottom',
  LEFT = 'left',
}

/**
 * Describes the dash style of the edge
 */
export enum EdgeDash {
  SOLID = 'solid',
  SMALL_DASH = 'small_dash',
  LARGE_DASH = 'large_dash',
}

/**
 * Describes the panning behavior of the graph
 */
export enum PanningBehavior {
  FAST = 'fast',
  SMOOTH = 'smooth',
}

/**
 * Describes the animation of the edge (can be used to make a flow look "active")
 */
export enum EdgeAnimation {
  NONE = 'none',
  FLOW_SLOW = 'flow_slow',
  FLOW_FAST = 'flow_fast',
}

/**
 * Describes the opacity of the edge (can be used to decrease prominence)
 */
export enum EdgeOpacity {
  LOW = 'low',
  DEFAULT = 'default',
}

/**
 * Describes the markers that can be placed at an endpoint of an edge
 */
export enum EndpointMarker {
  NONE,
  ARROW,
  TRIANGLE,
  SQUARE,
  CIRCLE,
}

/**
 * Describes the style of an edge
 */
export interface EdgeStyle {
  dash: EdgeDash;
  animation: EdgeAnimation;
  color: string;
  width: number;
  opacity: EdgeOpacity;
  fromMarker: EndpointMarker | string;
  toMarker: EndpointMarker | string;
  interactive: boolean; // determines if the edge can be clicked on and if it has hover effect; defaults to true
}

/**
 * Defines a custom marker for the endpoints of connecting edges. The properties
 * of this interface correspond directly to the attributes of the standard SVG
 * `<marker>` element, providing full control over its appearance.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/marker
 */
export interface CustomEndpointMarker {
  id: string;
  color: string;
  /**
   * The SVG path data ('d' attribute) that defines the custom shape of the marker.
   * This is ignored if the 'type' property is set.
   */
  path?: string;
  /**
   * An optional convenience for rendering simple pre-defined shapes. For any
   * complex shapes, use the `path` property instead.
   */
  type?: 'circle' | 'square';
  refX: number;
  refY: number;
  markerWidth: number;
  markerHeight: number;
  orient: string;
}

/**
 * Interface for dragEnd event with type property for use in discriminated union
 */
export declare interface DragEndEvent {
  type: 'end';
  event: PointerEvent;
}

/**
 * Interface for dragMove event with type property for use in discriminated union
 */
export declare interface DragMoveEvent {
  type: 'move';
  event: PointerEvent;
}

/**
 * Interface for dragStart event with type property for use in discriminated union
 */
export declare interface DragStartEvent {
  type: 'start';
  event: PointerEvent;
}

/**
 * Interface for wheel pan event with type property for use in discriminated union
 */
export declare interface WheelPanEvent {
  type: 'wheel';
  event: WheelEvent;
}

/**
 * Interface for click pan event with type property for use in discriminated union
 */
export declare interface ClickPanEvent {
  type: 'click';
  event: MouseEvent;
}

/**
 * Interface for pan event originating from the minimap.
 */
export declare interface MinimapPanEvent {
  type: 'minimap-pan';
  event: CustomEvent;
}

/**
 * Interface for null pan event with type property for use in discriminated union
 */
export declare interface NullPanEvent {
  type: 'null';
  event: null;
}

/**
 * Union of the various drag events
 */
export type DragEvent =
  | DragEndEvent
  | DragMoveEvent
  | DragStartEvent
  | WheelPanEvent
  | ClickPanEvent
  | MinimapPanEvent
  | NullPanEvent;

/**t
 * Interface for a bounding box
 */
export declare interface BoundingBox {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

/**
 * Interface for parameters used to determine a minimum size canvas to fit a bounding box
 */
export declare interface CanvasDimensionCalculationConfig {
  padding: number; // uniform padding to place around the graph
}

/**
 * Generic interface for a graph with positions
 */
export interface PositionedGraph<T, M> {
  nodes: Array<T & {x: number; y: number}>;
  edges: M[];
}

/** Nodes and Edges together */
export interface Graph {
  nodes: BaseNode[];
  edges: BaseEdge[];
}
