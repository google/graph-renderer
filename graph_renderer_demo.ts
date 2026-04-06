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
import { LitElement, css, html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { when } from 'lit/directives/when.js';

import { computeFitToScreen } from './common/compute_fit_to_screen';
import {
  BaseEdge,
  BaseNode,
  EdgeDash,
  EndpointMarker,
  LabelConfiguration,
  Point,
  Side,
  type CustomEndpointMarker,
} from './common/interfaces';
import { BUILT_IN_MARKER_DEFINITIONS } from './edge_canvas/edge_canvas';
import { EDGE_LABEL_TEMPLATE_ID } from './directed_graph/directed_graph';
import { DefaultEdgePathService } from './edge_path_service/default_edge_path_service';
import { EdgePathService } from './edge_path_service/edge_path_service';
import './graph_renderer';
import {
  GraphRenderer,
  MouseWheelBehavior,
  ZoomStepConfig,
} from './graph_renderer';

const NODE_TEMPLATE_ID = 'default-node-id';
const DRAG_DISABLED_NODE_TEMPLATE_ID = 'drag-disabled-node-id';
const INTERACTIVE_NODE_TEMPLATE_ID = 'interactive-node-id';
const INTERACTIVE_NODE_TEMPLATE_DRAG_DISABLED_ID =
  'interactive-node-drag-disabled-id';
const SCROLLABLE_NODE_TEMPLATE_ID = 'scrollable-node-id';
const EDGE_LABEL_DIMENSIONS: LabelConfiguration = { width: 80, height: 30 };
const CUSTOM_ENDPOINT_MARKER_DIAMOND = 'diamond';
const CUSTOM_ENDPOINT_MARKER_ARROW = 'custom-thin-arrow';

interface ElementRefLike {
  nativeElement?: HTMLElement;
}

/**
 * An example custom node component that can be selected.
 *
 * This component demonstrates how to create interactive node content that
 * can manage a visual "selected" state. It toggles its appearance on click
 * and dispatches a custom `node-click` event to notify the host application
 * of the state change.
 */
@customElement('interactive-node')
export class InteractiveNode extends LitElement {
  static override styles = css`
    .interactive-node-template {
      display: flex;
      text-align: center;
      align-items: center;
      justify-content: center;
      border: 1px solid black;
      background-color: lightskyblue;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      overflow: hidden;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.2s ease-in;
    }
    .interactive-node-template:hover {
      border-color: cornflowerblue;
    }
    .interactive-node-template.selected {
      background-color: lightgreen;
      border-color: cornflowerblue;
    }
  `;
  @property({ type: String }) nodeId = '';
  @property({ type: Boolean }) selected = false;
  @property({ type: Boolean }) dragDisabled = false;

  private handleNodeClick() {
    this.dispatchEvent(
      new CustomEvent('node-click', {
        detail: { nodeId: this.nodeId, selected: !this.selected },
        bubbles: true,
        composed: true,
      })
    );
  }

  override render() {
    const classes = {
      'interactive-node-template': true,
      selected: this.selected,
    };
    return html`
      <div class=${classMap(classes)} @click=${this.handleNodeClick}>
        ${when(this.dragDisabled, () => html`(Drag disabled)`)} Selectable Node:
        <br />
        ${this.selected ? 'Selected' : 'Not selected'}
      </div>
    `;
  }
}

/**
 * A component for demonstrating graph-renderer
 * with dummy data for development reference.
 */
@customElement('gr-graph-renderer-demo')
export class GraphRendererDemo extends LitElement {
  static override styles = css`
    :host {
      position: relative;
      width: 100%;
      height: 100%;

      /* Example of how to specify the minimap's position */
      --minimap-top: auto;
      --minimap-left: auto;
      --minimap-bottom: 16px;
      --minimap-right: 16px;
    }
    graph-renderer {
      width: 100%;
      height: 100%;
    }
    .controls {
      position: absolute;
      bottom: 16px;
      left: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .controls button {
      width: 32px;
      height: 32px;
      font-size: 18px;
      cursor: pointer;
      border: 1px solid #ccc;
      border-radius: 4px;
      background-color: white;
      z-index: 1;
      font-family: sans-serif;
    }
    .controls button.minimap {
      width: auto;
    }
    .controls .minimap,
    .controls select {
      font-size: 14px;
      padding: 0 8px;
    }
    .control-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .control-group label {
      font-size: 12px;
      color: #555;
      font-family: sans-serif;
    }
    .controls select {
      width: 100%;
      height: 32px;
      cursor: pointer;
      border: 1px solid #ccc;
      border-radius: 4px;
      background-color: white;
      z-index: 1;
    }
  `;

  @property({ type: Object }) observeResizeElement?: ElementRefLike;

  private readonly edgePathServiceInstance: EdgePathService =
    new DefaultEdgePathService();

  private readonly zoomConfiguration: ZoomStepConfig = {
    min: 0.5,
    max: 3,
    step: 0.3,
    enableSmoothZoom: true,
    animateZoom: true,
    zoomAnimationTransition: 'transform 0.3s ease-out',
  };

  @query('gr-graph-renderer') private readonly renderer!: GraphRenderer;

  @state() private zoom = 1;
  @state() private graphX = 0;
  @state() private graphY = 0;
  @state() private showMinimap = true;
  @state() private mouseWheelBehavior: MouseWheelBehavior =
    MouseWheelBehavior.ZOOM;

  @state() private selectedNodeId: string | null = null;

  private readonly customEndpointMarkers: CustomEndpointMarker[] = [
    {
      id: CUSTOM_ENDPOINT_MARKER_DIAMOND,
      color: 'teal',
      path: 'M 5 0 L 10 5 L 5 10 L 0 5 Z',
      refX: 7,
      refY: 5,
      markerWidth: 6,
      markerHeight: 6,
      orient: 'auto-start-reverse',
    },
    {
      id: CUSTOM_ENDPOINT_MARKER_ARROW,
      ...BUILT_IN_MARKER_DEFINITIONS[EndpointMarker.ARROW],
      color: 'gray',
      path: 'M5.4 3.6L2.2 0.5L1.5 1.2L4.3 4L1.5 6.8L2.2 7.5L5.4 4.4Z',
      refX: 4,
      refY: 4,
      markerWidth: 8,
      markerHeight: 8,
      orient: 'auto-start-reverse',
    },
  ];

  private handleMouseWheelBehaviorChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    this.mouseWheelBehavior = Number(select.value) as MouseWheelBehavior;
  }

  private handleZoomIn() {
    const nextZoom = this.zoom + this.zoomConfiguration.step;
    this.zoom = Math.min(this.zoomConfiguration.max, nextZoom);
  }

  private handleZoomOut() {
    const nextZoom = this.zoom - this.zoomConfiguration.step;
    this.zoom = Math.max(this.zoomConfiguration.min, nextZoom);
  }

  private toggleMinimap() {
    this.showMinimap = !this.showMinimap;
  }

  private handleInteractiveNodeClick(
    e: CustomEvent<{ nodeId: string; selected: boolean }>
  ) {
    const { nodeId, selected } = e.detail;

    if (selected) {
      this.selectedNodeId = nodeId;
    } else if (this.selectedNodeId === nodeId) {
      this.selectedNodeId = null;
    }
  }

  /**
   * Handles the 'graph-pan' event dispatched by the renderer. This method
   * keeps the demo component's local position state (`graphX`, `graphY`)
   * synchronized with the renderer's internal state.
   *
   * This is necessary because interactions like mouse-wheel panning can change
   * the renderer's position, and this event informs the parent component of
   * that change.
   */
  private handleGraphPan(e: CustomEvent<{ topLeftCorner: Point }>) {
    // The renderer's internal state (`graphX`, `graphY`) and the emitted
    // `topLeftCorner` have an inverse relationship. `topLeftCorner` represents
    // the "world" coordinate visible at the top-left of the viewport.
    //
    // For example, if you pan the view 100px to the right, you are now
    // looking at the world coordinate x=100, so `topLeftCorner.x` is 100.
    // To achieve this, the graph content itself must be moved 100px to the
    // left, meaning `graphX` must be -100.
    // Therefore, graphX = -topLeftCorner.x.
    this.graphX = -e.detail.topLeftCorner.x;
    this.graphY = -e.detail.topLeftCorner.y;
  }

  /**
   * Calculates and applies the optimal zoom and position to fit all nodes
   * on screen.
   */
  private handleFitToScreen() {
    if (!this.renderer) return;
    const { width, height } = this.renderer.getBoundingClientRect();
    const fit = computeFitToScreen(this.graphNodes, width, height);

    this.zoom = fit.zoom;
    this.graphX = fit.graphX;
    this.graphY = fit.graphY;
  }

  /**
   * Handles the graph-zoom event from the renderer (e.g., scrollwheel zooming)
   * to keep the local zoom state synchronized.
   */
  private handleGraphZoom(e: CustomEvent<{ zoom: number }>) {
    this.zoom = e.detail.zoom;
  }

  /**
   * Handles the node-drag-end event from the renderer to keep
   * local `graphNodes` state synchronized with the renderer's internal state.
   */
  private handleNodeDragEnd(
    e: CustomEvent<{ id: string; x: number; y: number }>
  ) {
    const { id, x, y } = e.detail;
    this.graphNodes = this.graphNodes.map(node =>
      node.id === id ? { ...node, x, y } : node
    );
  }

  // Dummy data for GraphRenderer
  @state() graphNodes: BaseNode[] = [
    {
      id: 'node1-drag-disabled',
      x: 150,
      y: 150,
      width: 120,
      height: 60,
      templateId: DRAG_DISABLED_NODE_TEMPLATE_ID,
      dragDisabled: true,
      ports: [
        { id: 'node1-right', side: Side.RIGHT },
        { id: 'node1-bottom', side: Side.BOTTOM },
        { id: 'node1-out', side: Side.BOTTOM },
      ],
    },
    {
      id: 'node2',
      x: 450,
      y: 150,
      width: 120,
      height: 60,
      templateId: NODE_TEMPLATE_ID,
      ports: [
        { id: 'node2-left', side: Side.LEFT },
        { id: 'node2-right', side: Side.RIGHT },
      ],
    },
    {
      id: 'node3',
      x: 150,
      y: 300,
      width: 120,
      height: 60,
      templateId: NODE_TEMPLATE_ID,
      ports: [
        { id: 'node3-top', side: Side.TOP },
        { id: 'node5-top', side: Side.TOP },
      ],
    },
    {
      id: 'node4',
      x: 750,
      y: 150,
      width: 120,
      height: 60,
      templateId: NODE_TEMPLATE_ID,
      ports: [{ id: 'node4-left', side: Side.LEFT }],
    },
    {
      id: 'node5',
      x: 350,
      y: 300,
      width: 120,
      height: 60,
      templateId: NODE_TEMPLATE_ID,
      ports: [{ id: 'node5-top', side: Side.TOP }],
    },
    {
      id: 'interactive-node1',
      x: 550,
      y: 300,
      width: 120,
      height: 60,
      templateId: INTERACTIVE_NODE_TEMPLATE_ID,
      ports: [{ id: 'interactive-node1-top', side: Side.TOP }],
    },
    {
      id: 'interactive-node2',
      x: 750,
      y: 300,
      width: 120,
      height: 60,
      dragDisabled: true,
      templateId: INTERACTIVE_NODE_TEMPLATE_DRAG_DISABLED_ID,
      ports: [{ id: 'interactive-node1-top', side: Side.TOP }],
    },
    {
      id: 'scroll-node',
      x: 550,
      y: 420,
      width: 250,
      height: 200,
      templateId: SCROLLABLE_NODE_TEMPLATE_ID,
    },
  ];
  @state() graphEdges: BaseEdge[] = [
    {
      from: { nodeId: 'node1-drag-disabled', portId: 'node1-right' },
      to: { nodeId: 'node2', portId: 'node2-left' },
      style: {
        fromMarker: CUSTOM_ENDPOINT_MARKER_DIAMOND,
        toMarker: CUSTOM_ENDPOINT_MARKER_ARROW,
      },
      label: { ...EDGE_LABEL_DIMENSIONS },
      id: 'edge1-2',
    },
    {
      from: { nodeId: 'node2', portId: 'node2-right' },
      to: { nodeId: 'node4', portId: 'node4-left' },
      style: {
        fromMarker: EndpointMarker.SQUARE,
        toMarker: EndpointMarker.ARROW,
      },
      label: { ...EDGE_LABEL_DIMENSIONS },
      id: 'edge2-4',
    },
    {
      from: { nodeId: 'node1-drag-disabled', portId: 'node1-bottom' },
      to: { nodeId: 'node3', portId: 'node3-top' },
      style: {
        fromMarker: EndpointMarker.CIRCLE,
        toMarker: CUSTOM_ENDPOINT_MARKER_ARROW,
      },
      label: { ...EDGE_LABEL_DIMENSIONS },
      id: 'edge1-3',
    },
    {
      from: { nodeId: 'node1-drag-disabled', portId: 'node1-bottom' },
      to: { nodeId: 'node5', portId: 'node5-top' },
      style: {
        dash: EdgeDash.LARGE_DASH,
        toMarker: EndpointMarker.ARROW,
        color: 'lightblue',
      },
      label: { ...EDGE_LABEL_DIMENSIONS },
      id: 'edge1-5',
    },
    {
      from: { nodeId: 'node1-drag-disabled', portId: 'node1-bottom' },
      to: { nodeId: 'interactive-node1', portId: 'interactive-node1-top' },
      style: {
        fromMarker: EndpointMarker.CIRCLE,
        toMarker: EndpointMarker.TRIANGLE,
      },
      label: { ...EDGE_LABEL_DIMENSIONS },
      id: 'edge1-interactive1',
    },
    {
      from: { nodeId: 'node1-drag-disabled', portId: 'node1-bottom' },
      to: { nodeId: 'interactive-node2', portId: 'interactive-node1-top' },
      style: {
        fromMarker: EndpointMarker.CIRCLE,
        toMarker: EndpointMarker.SQUARE,
      },
      label: { ...EDGE_LABEL_DIMENSIONS },
      id: 'edge1-interactive2',
    },
  ];

  // Templates to pass to graph-renderer
  private get nodeTemplates() {
    return {
      [DRAG_DISABLED_NODE_TEMPLATE_ID]: (nodeId: string) => html`
        <style>
          .drag-disabled-node-template {
            display: flex;
            text-align: center;
            align-items: center;
            justify-content: center;
            border: 1px solid lightgray;
            background-color: whitesmoke;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            overflow: hidden;
          }
        </style>
        <div class="drag-disabled-node-template">${nodeId}</div>
      `,
      [NODE_TEMPLATE_ID]: (nodeId: string) => html`
        <style>
          .node-template {
            display: flex;
            text-align: center;
            align-items: center;
            justify-content: center;
            border: 1px solid black;
            background-color: aliceblue;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            overflow: hidden;
          }
          .node-template:hover {
            border-color: cornflowerblue;
          }
        </style>
        <div class="node-template">${nodeId}</div>
      `,
      [INTERACTIVE_NODE_TEMPLATE_ID]: (nodeId: string) => html`
        <interactive-node
          .nodeId=${nodeId}
          .selected=${this.selectedNodeId === nodeId}
          @node-click=${(e: CustomEvent) => {
            this.handleInteractiveNodeClick(e);
          }}
        ></interactive-node>
      `,
      [INTERACTIVE_NODE_TEMPLATE_DRAG_DISABLED_ID]: (nodeId: string) => html`
        <interactive-node
          .nodeId=${nodeId}
          .dragDisabled=${true}
          .selected=${this.selectedNodeId === nodeId}
          @node-click=${(e: CustomEvent) => {
            this.handleInteractiveNodeClick(e);
          }}
        ></interactive-node>
      `,
      [SCROLLABLE_NODE_TEMPLATE_ID]: () => html`
        <style>
          .scrollable-node-template {
            border: 2px dashed #666;
            background-color: #f0f0f0;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            overflow: auto;
            font-size: 12px;
            padding: 8px;
            text-align: left;
          }
          .scrollable-node-template p {
            margin-top: 0;
            margin-bottom: 1em;
          }
        </style>
        <div class="scrollable-node-template">
          <p><b>Scrollable Content</b></p>
          <p>Try using the mouse wheel here.</p>
          <p>
            In <b>PAN</b> or <b>ZOOM</b> mode, this content will scroll
            normally.
          </p>
          <p>
            In <b>ZOOM_CAPTURES</b> mode, the graph will zoom instead of this
            content scrolling.
          </p>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
            aliquip ex ea commodo consequat. Duis aute irure dolor in
            reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
            pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
            culpa qui officia deserunt mollit anim id est laborum.
          </p>
        </div>
      `,
      [EDGE_LABEL_TEMPLATE_ID]: (edgeId: string) => html`
        <style>
          .edge-label-template {
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: lightgray;
            border: 1px solid gray;
            border-radius: 4px;
            padding: 2px 4px;
            font-size: 10px;
            white-space: nowrap;
          }
        </style>
        <div class="edge-label-template">Label for ${edgeId}</div>
      `,
    };
  }

  override render() {
    return html`
      <gr-graph-renderer
        .observeResizeElement=${this.observeResizeElement?.nativeElement}
        .constrainNodeDrag=${true}
        .edgePathService=${this.edgePathServiceInstance}
        .graphNodes=${this.graphNodes}
        .graphEdges=${this.graphEdges}
        .customEndpointMarkers=${this.customEndpointMarkers}
        .nodeTemplates=${this.nodeTemplates}
        .graphWidth=${2000}
        .graphHeight=${1600}
        .graphX=${this.graphX}
        .graphY=${this.graphY}
        .zoom=${this.zoom}
        .zoomStepConfig=${this.zoomConfiguration}
        .mouseWheelBehavior=${this.mouseWheelBehavior}
        .showMinimap=${this.showMinimap}
        .minimapSize=${200}
        @graph-pan=${this.handleGraphPan}
        @graph-zoom=${this.handleGraphZoom}
        @node-drag-end=${this.handleNodeDragEnd}
      >
      </gr-graph-renderer>
      <div class="controls">
        <button @click=${this.handleFitToScreen} title="Fit to Screen">
          ⛶
        </button>
        <button @click=${this.handleZoomIn} title="Zoom In">+</button>
        <button @click=${this.handleZoomOut} title="Zoom Out">-</button>
        <button
          class="minimap"
          @click=${this.toggleMinimap}
          title="Toggle Minimap"
        >
          ${this.showMinimap ? 'Hide' : 'Show'} Minimap
        </button>
        <div class="control-group">
          <label for="mouse-wheel-behavior">Mouse Wheel:</label>
          <select
            id="mouse-wheel-behavior"
            @change=${this.handleMouseWheelBehaviorChange}
            title="Mouse Wheel Behavior"
          >
            <option
              value=${MouseWheelBehavior.PAN}
              ?selected=${this.mouseWheelBehavior === MouseWheelBehavior.PAN}
            >
              PAN
            </option>
            <option
              value=${MouseWheelBehavior.ZOOM}
              ?selected=${this.mouseWheelBehavior === MouseWheelBehavior.ZOOM}
            >
              ZOOM
            </option>
            <option
              value=${MouseWheelBehavior.ZOOM_CAPTURES}
              ?selected=${this.mouseWheelBehavior ===
              MouseWheelBehavior.ZOOM_CAPTURES}
            >
              ZOOM_CAPTURES
            </option>
          </select>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gr-graph-renderer-demo': GraphRendererDemo;
  }
}
