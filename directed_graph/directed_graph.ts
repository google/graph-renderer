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
import {LitElement, html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {
  BehaviorSubject,
  combineLatest,
  type Observable,
  type Subscription,
} from 'rxjs';
import {map, tap} from 'rxjs/operators';

import {
  BaseEdge,
  BaseNode,
  EdgeAnimation,
  EdgeDash,
  EdgeOpacity,
  EdgeStyle,
  EndpointMarker,
  Point,
  RenderableEdge,
  RenderableLabel,
  RenderableTentativeEdge,
  TentativeEdge,
  type CustomEndpointMarker,
} from '../common/interfaces';
import {convertToMapById, isPoint} from '../common/utils';
import {EdgePathService} from '../edge_path_service/edge_path_service';
import sheet from './directed_graph.css' with { type: 'css' };

import '../edge_canvas/edge_canvas';
import '../edge_label_render/edge_label_render';
import '../node_render/node_render';

/**
 * ID used in the nodeTemplates map to provide a template for edge labels.
 */
export const EDGE_LABEL_TEMPLATE_ID = 'edgeLabel';

// Default edge style
const CM_SYS_COLOR_STATUS_NEUTRAL = 'gray';
/**
 * Exported for testing only
 */
export const DEFAULT_EDGE_STYLE: EdgeStyle = {
  color: CM_SYS_COLOR_STATUS_NEUTRAL,
  width: 1,
  dash: EdgeDash.SOLID,
  animation: EdgeAnimation.NONE,
  opacity: EdgeOpacity.DEFAULT,
  fromMarker: EndpointMarker.NONE,
  toMarker: EndpointMarker.NONE,
  interactive: true,
};

const EMPTY_PATH_DATA = {path: '', labelPosition: {x: 0, y: 0}};

/**
 * Stacking order for nodes.
 * Must be kept in sync with gr-node-render z-index in directed_graph.css.
 */
const NODE_Z_INDEX = 2;

/**
 * Renders the graph elements, including nodes, edges, and labels.
 * It orchestrates child components for rendering specific parts of the graph.
 */
@customElement('gr-directed-graph')
export class DirectedGraph extends LitElement {
  static override styles = [sheet];

  /**
   * An array of `TentativeEdge` objects to be rendered.
   * Optional. Default: `[]`.
   */
  @property({type: Array})
  set tentativeEdges(edges: TentativeEdge[]) {
    this.tentativeEdges$.next(edges);
  }
  get tentativeEdges(): TentativeEdge[] {
    return this.tentativeEdges$.value;
  }

  /**
   * The array of `BaseNode` objects to render on the graph.
   * Required to display nodes.
   */
  @property({type: Array})
  set nodes(nodes: BaseNode[]) {
    this.nodes$.next(nodes);
  }
  get nodes(): BaseNode[] {
    return this.nodes$.value;
  }

  /**
   * The array of `BaseEdge` objects to render as connections.
   * Required to display edges.
   */
  @property({type: Array})
  set edges(e: BaseEdge[]) {
    this.edges$.next(e);
  }
  get edges(): BaseEdge[] {
    return this.edges$.value;
  }

  /**
   * The current zoom level of the graph, used to correctly scale interactions.
   * Optional. Default: `1`.
   */
  @property({type: Number})
  set zoom(zoom: number) {
    if (zoom === this.zoom$.value) return;
    this.zoom$.next(zoom);
  }
  get zoom(): number {
    return this.zoom$.value;
  }

  /**
   * A map of template IDs to Lit template functions for rendering custom content.
   * Optional.
   */
  @property({type: Object}) nodeTemplates: Record<string, Function> = {};

  /**
   * The total height of the graph's drawable area.
   * Optional.
   */
  @property({type: Number}) graphHeight = 0;

  /**
   * The total width of the graph's drawable area.
   * Optional.
   */
  @property({type: Number}) graphWidth = 0;

  /**
   * If true, nodes cannot be dragged outside the graph boundaries.
   * Optional.
   */
  @property({type: Boolean}) constrainNodeDrag = false;

  /**
   * If true, disables user interactions on the graph.
   * Optional.
   */
  @property({type: Boolean}) lockGraphViewport = false;

  /**
   * The service used to calculate the SVG `d` path attribute for edges.
   * Required for rendering edges.
   */
  @property({type: Object}) edgePathService!: EdgePathService;

  /**
   * An array of `CustomEndpointMarker` objects for defining custom endpoint markers.
   * Optional.
   */
  @property({type: Array}) customEndpointMarkers: CustomEndpointMarker[] = [];

  /**
   * The final array of nodes to be rendered, after processing. This includes
   * incorporating the position of a node being dragged and its z-index for
   * stacking.
   */
  @state() private renderableNodes: Array<BaseNode & {zIndex: number}> = [];

  /**
   * The final array of edges to be rendered. This is derived from the input
   * `edges` property and enriched with calculated path data and default styles.
   */
  @state() private renderableEdges: RenderableEdge[] = [];

  /**
   * The final array of tentative edges to be rendered, enriched with calculated
   * path data and default styles.
   */
  @state() private renderableTentativeEdges: RenderableTentativeEdge[] = [];

  /**
   * An array of labels derived from edges that have a `label` property.
   * This state isolates the label data needed for rendering by the
   * `gr-edge-label-render` component.
   */
  @state() private renderableEdgeLabels: RenderableLabel[] = [];

  private readonly nodes$ = new BehaviorSubject<BaseNode[]>([]);
  private readonly edges$ = new BehaviorSubject<BaseEdge[]>([]);
  private readonly tentativeEdges$ = new BehaviorSubject<TentativeEdge[]>([]);
  private readonly zoom$ = new BehaviorSubject<number>(1);
  private readonly zIndexMap$ = new BehaviorSubject<Map<string, number>>(
    new Map(),
  );
  private zIndexCounter = NODE_Z_INDEX;

  private readonly draggingNode$ = new BehaviorSubject<null | {
    id: string;
    x: number;
    y: number;
  }>(null);

  private readonly subscriptions: Subscription[] = [];

  private dispatchNodeDragStart() {
    this.dispatchEvent(new CustomEvent('node-drag-start'));
  }

  private dispatchNodeDragMove(detail: Point & {id: string}) {
    this.dispatchEvent(new CustomEvent('node-drag-move', {detail}));
  }

  private dispatchNodeDragEnd(detail: Point & {id: string}) {
    this.dispatchEvent(new CustomEvent('node-drag-end', {detail}));
  }

  private handleEdgeClick(event: CustomEvent<RenderableEdge>) {
    event.stopPropagation();
    this.dispatchEvent(new CustomEvent('edge-click', {detail: event.detail}));
  }

  private handleNodeDragStart(event: CustomEvent<BaseNode>) {
    event.stopPropagation();
    const node = event.detail;

    // Clear any lingering drag state from a previous operation before
    // starting a new one.
    this.draggingNode$.next(null);

    this.updateZIndex(node);
    this.dispatchNodeDragStart();
  }

  private handleNodeDragMove(event: CustomEvent<Point & {id: string}>) {
    event.stopPropagation();
    const dragData = event.detail;
    this.draggingNode$.next(dragData);
    this.dispatchNodeDragMove(dragData);
  }

  private handleNodeDragEnd(event: CustomEvent<Point & {id: string}>) {
    event.stopPropagation();
    const dragData = event.detail;

    // Update the internal state with the FINAL coordinates from the event.
    // This ensures that any immediate re-render uses the correct drop position.
    this.draggingNode$.next(dragData);

    this.dispatchNodeDragEnd(dragData);
  }

  override connectedCallback() {
    super.connectedCallback();

    const renderableNodes$: Observable<Array<BaseNode & {zIndex: number}>> =
      combineLatest([this.nodes$, this.draggingNode$, this.zIndexMap$]).pipe(
        tap(([nodes]) => {
          // Initialize zIndexMap from node options
          const currentZIndexMap = this.zIndexMap$.value;
          let maxZ = this.zIndexCounter;
          nodes.forEach((node) => {
            if (!currentZIndexMap.has(node.id) && node.options?.initialZIndex) {
              const initialZIndex = node.options.initialZIndex;
              currentZIndexMap.set(node.id, initialZIndex);
              if (initialZIndex > maxZ) {
                maxZ = initialZIndex;
              }
            }
          });
          this.zIndexCounter = maxZ;
        }),
        map(([nodes, draggingNode, zIndexMap]) => {
          return DirectedGraph.replaceDraggingNode(nodes, draggingNode).map(
            (n) => ({
              ...n,
              zIndex: zIndexMap.get(n.id) ?? NODE_Z_INDEX,
            }),
          );
        }),
      );

    const idToRenderableNode$ = renderableNodes$.pipe(
      map((nodes) => convertToMapById(nodes)),
    );

    const renderableEdges$: Observable<RenderableEdge[]> = combineLatest([
      this.edges$,
      idToRenderableNode$,
      this.zoom$,
    ]).pipe(
      map(([edges, nodeMap]) =>
        edges.map((edge: BaseEdge): RenderableEdge => {
          const {labelPosition, path} = this.buildPath(edge, nodeMap);
          const {style = {} as Partial<EdgeStyle>} = edge;
          return {
            ...edge,
            path,
            labelPosition,
            style: DirectedGraph.getStyleWithDefaults(style),
            id: DirectedGraph.getIdForEdge(edge),
          };
        }),
      ),
    );

    const renderableTentativeEdges$: Observable<RenderableTentativeEdge[]> =
      combineLatest([this.tentativeEdges$, idToRenderableNode$]).pipe(
        map(([tentativeEdges, nodeMap]) =>
          tentativeEdges.map((edge: TentativeEdge): RenderableTentativeEdge => {
            const {style = {} as Partial<EdgeStyle>} = edge;
            return {
              ...edge,
              path: this.buildTentativePath(edge, nodeMap).path,
              style: DirectedGraph.getStyleWithDefaults(style),
              id: DirectedGraph.getIdForEdge(edge),
            };
          }),
        ),
      );

    const renderableEdgeLabels$: Observable<RenderableLabel[]> =
      renderableEdges$.pipe(
        map((edges) => DirectedGraph.convertEdgesToRenderableLabels(edges)),
      );

    this.subscriptions.push(
      renderableNodes$.subscribe((nodes) => {
        this.renderableNodes = nodes;
      }),
      renderableEdges$.subscribe((edges) => {
        this.renderableEdges = edges;
      }),
      renderableTentativeEdges$.subscribe((edges) => {
        this.renderableTentativeEdges = edges;
      }),
      renderableEdgeLabels$.subscribe((labels) => {
        this.renderableEdgeLabels = labels;
      }),
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.subscriptions.forEach((sub) => {
      sub.unsubscribe();
    });
  }

  override render() {
    return html`
      <div class="graph-container">
        ${this.renderableEdgeLabels.map(
          (label) => html`
            <gr-edge-label-render .label=${label}>
              ${this.nodeTemplates[EDGE_LABEL_TEMPLATE_ID]
                ? this.nodeTemplates[EDGE_LABEL_TEMPLATE_ID](label.id)
                : ''}
            </gr-edge-label-render>
          `,
        )}

        <gr-edge-canvas
          .edges=${this.renderableEdges}
          .tentativeEdges=${this.renderableTentativeEdges}
          .customEndpointMarkers=${this.customEndpointMarkers}
          @edge-click=${this.handleEdgeClick}></gr-edge-canvas>

        ${this.renderableNodes.map(
          (node) => html`
            <gr-node-render
              .node=${node}
              .zoom=${this.zoom$.value}
              .graphWidth=${this.graphWidth}
              .graphHeight=${this.graphHeight}
              .constrainNodeDrag=${this.constrainNodeDrag}
              .locked=${this.lockGraphViewport}
              .zIndex=${node.zIndex}
              @node-drag-start=${this.handleNodeDragStart}
              @node-drag-move=${this.handleNodeDragMove}
              @node-drag-end=${this.handleNodeDragEnd}>
              ${this.nodeTemplates[node.templateId]
                ? this.nodeTemplates[node.templateId](node.id)
                : html`<div>${node.id}</div>`}
            </gr-node-render>
          `,
        )}
      </div>
    `;
  }

  private updateZIndex(node: BaseNode) {
    const currentMap = this.zIndexMap$.value;
    this.zIndexCounter++;
    currentMap.set(node.id, this.zIndexCounter);
    this.zIndexMap$.next(currentMap);
  }

  private buildTentativePath(
    edge: TentativeEdge,
    nodeMap: Map<string, BaseNode>,
  ): {path: string; labelPosition: Point} {
    const fromNodeId = edge.from.nodeId;
    const to = edge.to;
    const from = nodeMap.get(fromNodeId);
    if (!from || !to) return EMPTY_PATH_DATA;
    return this.edgePathService.buildPath(edge, from, to);
  }

  private buildPath(
    edge: BaseEdge,
    nodeMap: Map<string, BaseNode>,
  ): {path: string; labelPosition: Point} {
    // Check if edgePathService has been provided. Due to the asynchronous
    // nature of Web Component  property updates, especially when nested within
    // frameworks like Angular, this property might be undefined
    // when the component first attempts to render edges. Returning
    // EMPTY_PATH_DATA prevents a runtime error and allows the graph to render
    // correctly once edgePathService is set in a subsequent update cycle
    // by the host environment.
    if (!this.edgePathService) {
      return EMPTY_PATH_DATA;
    }
    const from = nodeMap.get(edge.from.nodeId);
    const to = nodeMap.get(edge.to.nodeId);
    if (!from || !to) return EMPTY_PATH_DATA;
    return this.edgePathService.buildPath(edge, from, to);
  }

  static replaceDraggingNode(
    nodes: BaseNode[],
    draggingNode: {id: string; x: number; y: number} | null,
  ): BaseNode[] {
    if (!draggingNode) return nodes;
    return nodes.map((node) =>
      node.id === draggingNode.id
        ? {...node, x: draggingNode.x, y: draggingNode.y}
        : node,
    );
  }

  static getStyleWithDefaults(style: Partial<EdgeStyle>): EdgeStyle {
    return {
      color: style.color || DEFAULT_EDGE_STYLE.color,
      width: style.width || DEFAULT_EDGE_STYLE.width,
      dash: style.dash || DEFAULT_EDGE_STYLE.dash,
      animation: style.animation || DEFAULT_EDGE_STYLE.animation,
      opacity: style.opacity || DEFAULT_EDGE_STYLE.opacity,
      fromMarker: style.fromMarker || DEFAULT_EDGE_STYLE.fromMarker,
      toMarker: style.toMarker || DEFAULT_EDGE_STYLE.toMarker,
      interactive: style.interactive ?? DEFAULT_EDGE_STYLE.interactive,
    };
  }

  static getEndpointId(endpoint: {nodeId: string; portId?: string}): string {
    return endpoint.portId
      ? `${endpoint.nodeId},${endpoint.portId}`
      : endpoint.nodeId;
  }

  static getIdForEdge(edge: BaseEdge | TentativeEdge): string {
    if (edge.id) return edge.id;
    const {from, to} = edge;
    const fromId = isPoint(from)
      ? `${from.x}-${from.y}`
      : DirectedGraph.getEndpointId(from);
    const toId = isPoint(to)
      ? `${to.x}-${to.y}`
      : DirectedGraph.getEndpointId(to);
    return `${fromId}-${toId}`;
  }

  static convertEdgesToRenderableLabels(
    edges: RenderableEdge[],
  ): RenderableLabel[] {
    return edges
      .filter((edge) => !!edge.label)
      .map((edge) => ({
        height: edge.label!.height,
        width: edge.label!.width,
        x: edge.labelPosition.x,
        y: edge.labelPosition.y,
        id: DirectedGraph.getIdForEdge(edge),
      }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gr-directed-graph': DirectedGraph;
  }
}
