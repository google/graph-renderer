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
import { customElement, query, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';

import { computeFitToScreen } from './common/compute_fit_to_screen';
import {
  BaseEdge,
  BaseNode,
  EdgeSection,
  EndpointMarker,
  Graph,
  Port,
  Side,
} from './common/interfaces';
import { EDGE_LABEL_TEMPLATE_ID } from './directed_graph/directed_graph';
import { EdgePathService } from './edge_path_service/edge_path_service';
import {
  ElkEdgePathService,
  ElkLabelPositioning,
} from './edge_path_service/elk_edge_path_service';
import './graph_renderer';
import { GraphRenderer, ZoomStepConfig } from './graph_renderer';
import ELK, { type ElkExtendedEdge, type ElkNode } from 'elkjs';

const NODE_TEMPLATE_ID = 'default';

/**
 * Graph data demonstrating a balanced three-way branching tree.
 */
const INITIAL_GRAPH: Graph = {
  nodes: [
    {
      id: 'root-node',
      x: 0,
      y: 0,
      width: 120,
      height: 60,
      templateId: NODE_TEMPLATE_ID,
      dragDisabled: true,
      ports: [{ id: 'root-out', side: Side.BOTTOM }],
    },
    {
      id: 'parent-L',
      x: 0,
      y: 0,
      width: 120,
      height: 60,
      templateId: NODE_TEMPLATE_ID,
      dragDisabled: true,
      ports: [
        { id: 'parent-L-in', side: Side.TOP },
        { id: 'parent-L-out', side: Side.BOTTOM },
      ],
    },
    {
      id: 'parent-M',
      x: 0,
      y: 0,
      width: 120,
      height: 60,
      templateId: NODE_TEMPLATE_ID,
      dragDisabled: true,
      ports: [
        { id: 'parent-M-in', side: Side.TOP },
        { id: 'parent-M-out', side: Side.BOTTOM },
      ],
    },
    {
      id: 'parent-R',
      x: 0,
      y: 0,
      width: 120,
      height: 60,
      templateId: NODE_TEMPLATE_ID,
      dragDisabled: true,
      ports: [
        { id: 'parent-R-in', side: Side.TOP },
        { id: 'parent-R-out', side: Side.BOTTOM },
      ],
    },
    {
      id: 'child-LL',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      templateId: NODE_TEMPLATE_ID,
      dragDisabled: true,
      ports: [{ id: 'c1', side: Side.TOP }],
    },
    {
      id: 'child-LR',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      templateId: NODE_TEMPLATE_ID,
      dragDisabled: true,
      ports: [{ id: 'c2', side: Side.TOP }],
    },
    {
      id: 'child-ML',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      templateId: NODE_TEMPLATE_ID,
      dragDisabled: true,
      ports: [{ id: 'c3', side: Side.TOP }],
    },
    {
      id: 'child-RL',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      templateId: NODE_TEMPLATE_ID,
      dragDisabled: true,
      ports: [{ id: 'c4', side: Side.TOP }],
    },
    {
      id: 'child-RR',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      templateId: NODE_TEMPLATE_ID,
      dragDisabled: true,
      ports: [{ id: 'c5', side: Side.TOP }],
    },
  ],
  edges: [
    {
      id: 'e1',
      from: { nodeId: 'root-node', portId: 'root-out' },
      to: { nodeId: 'parent-L', portId: 'parent-L-in' },
      label: { width: 40, height: 20 },
    },
    {
      id: 'e-mid',
      from: { nodeId: 'root-node', portId: 'root-out' },
      to: { nodeId: 'parent-M', portId: 'parent-M-in' },
      label: { width: 40, height: 20 },
    },
    {
      id: 'e2',
      from: { nodeId: 'root-node', portId: 'root-out' },
      to: { nodeId: 'parent-R', portId: 'parent-R-in' },
      label: { width: 40, height: 20 },
    },
    {
      id: 'e3',
      from: { nodeId: 'parent-L', portId: 'parent-L-out' },
      to: { nodeId: 'child-LL', portId: 'c1' },
    },
    {
      id: 'e4',
      from: { nodeId: 'parent-L', portId: 'parent-L-out' },
      to: { nodeId: 'child-LR', portId: 'c2' },
    },
    {
      id: 'e5',
      from: { nodeId: 'parent-M', portId: 'parent-M-out' },
      to: { nodeId: 'child-ML', portId: 'c3' },
    },
    {
      id: 'e6',
      from: { nodeId: 'parent-R', portId: 'parent-R-out' },
      to: { nodeId: 'child-RL', portId: 'c4' },
    },
    {
      id: 'e7',
      from: { nodeId: 'parent-R', portId: 'parent-R-out' },
      to: { nodeId: 'child-RR', portId: 'c5' },
    },
  ],
};

function mapSideToElk(side: Side): string {
  switch (side) {
    case Side.TOP:
      return 'NORTH';
    case Side.BOTTOM:
      return 'SOUTH';
    case Side.LEFT:
      return 'WEST';
    case Side.RIGHT:
      return 'EAST';
    default:
      throw new Error(`Unsupported side value: ${side}`);
  }
}

/**
 * A component demonstrating a static graph layout using ELKjs with a balanced
 * symmetric tree and rounded orthogonal routing.
 *
 * This demo highlights:
 * 1. Symmetric horizontal node placement using ELK's 'layered' algorithm.
 * 2. Visual softening of orthogonal 'bus' routing via rounded Bezier corners.
 * 3. Interactive minimap and zoom controls synced with the renderer state.
 * 4. Geometric midpoint calculation for edge labels on any polyline path.
 * 5. Live update of all ElkEdgePathConfig parameters.
 *
 * NOTE: This demo uses a static layout. Since ElkEdgePathService relies on
 * pre-calculated orthogonal points (sections) from ELK, node dragging is
 * disabled to prevent the edge paths from becoming visually disconnected.
 */
@customElement('gr-graph-renderer-elkjs-demo')
export class GraphRendererElkjsDemo extends LitElement {
  static override styles = css`
    :host {
      position: relative;
      width: 100%;
      height: 100%;
    }

    gr-graph-renderer {
      width: 100%;
      height: 100%;
    }

    .controls {
      position: absolute;
      bottom: 16px;
      left: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid #ccc;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      max-height: 80vh;
      width: 260px;
      overflow-y: auto;
      z-index: 1;
    }

    .controls.collapsed {
      width: fit-content;
      padding: 8px;
    }

    .controls button {
      width: 32px;
      height: 32px;
      font-size: 18px;
      cursor: pointer;
      border: 1px solid #ccc;
      border-radius: 4px;
      background-color: white;
      font-family: sans-serif;
    }

    .controls button.minimap {
      width: fit-content;
      min-width: 32px;
      padding: 0 12px;
      font-size: 12px;
      white-space: nowrap;
    }

    .controls .toggle-button {
      align-self: flex-start;
      font-size: 14px;
      margin-bottom: 4px;
    }

    .control-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .control-group label {
      font-size: 11px;
      font-weight: bold;
      color: #555;
      font-family: sans-serif;
    }

    .controls select,
    .controls input {
      width: 100%;
      height: 28px;
      cursor: pointer;
      border: 1px solid #ccc;
      border-radius: 4px;
      background-color: white;
      box-sizing: border-box;
      font-size: 12px;
      padding: 0 8px;
    }

    .zoom-row {
      display: flex;
      gap: 8px;
      flex-wrap: nowrap;
      align-items: center;
    }
  `;

  @query('gr-graph-renderer') private readonly renderer!: GraphRenderer;

  @state()
  private labelPositioning: ElkLabelPositioning =
    ElkLabelPositioning.LAST_SEGMENT_MIDPOINT;
  @state() private originSplitRadius = 8;
  @state() private terminalBendRadius = 16;
  @state() private defaultBendRadius = 12;
  @state() private targetMarkerClearance = 4;
  @state() private snapThreshold = 3;

  @state() private zoom = 1;
  @state() private graphX = 0;
  @state() private graphY = 0;
  @state() private showMinimap = true;
  @state() private showControls = true;

  private readonly zoomConfiguration: ZoomStepConfig = {
    min: 0.5,
    max: 3,
    step: 0.3,
    enableSmoothZoom: true,
    animateZoom: true,
    zoomAnimationTransition: 'transform 0.3s ease-out',
  };

  /**
   * The ElkEdgePathService handles the visual conversion of ELK points.
   *
   * NOTE: ELK's port alignment can result in edges that are slightly off-center
   * (sub-pixel) due to routing optimizations. The snapThreshold is used to
   * flatten these small offsets, preventing the rounding logic from
   * creating visual jitter on nearly-straight lines.
   */
  @state()
  private edgePathService: EdgePathService = this.createEdgePathService();

  @state() private graphNodes: BaseNode[] = [];
  @state() private graphEdges: BaseEdge[] = [];

  private createEdgePathService(): EdgePathService {
    return new ElkEdgePathService({
      originSplitRadius: this.originSplitRadius,
      terminalBendRadius: this.terminalBendRadius,
      defaultBendRadius: this.defaultBendRadius,
      targetMarkerClearance: this.targetMarkerClearance,
      snapThreshold: this.snapThreshold,
      labelPositioning: this.labelPositioning,
    });
  }

  private handleConfigChange(prop: string, e: Event) {
    const target = e.target as HTMLSelectElement | HTMLInputElement;
    const value = target.value;

    switch (prop) {
      case 'labelPositioning':
        this.labelPositioning = value as ElkLabelPositioning;
        break;
      default: {
        const numValue = Number(value);
        if (isNaN(numValue)) return;

        switch (prop) {
          case 'originSplitRadius':
            this.originSplitRadius = numValue;
            break;
          case 'terminalBendRadius':
            this.terminalBendRadius = numValue;
            break;
          case 'defaultBendRadius':
            this.defaultBendRadius = numValue;
            break;
          case 'targetMarkerClearance':
            this.targetMarkerClearance = numValue;
            break;
          case 'snapThreshold':
            this.snapThreshold = numValue;
            break;
        }
      }
    }

    // Recreate the service to apply the configuration changes live.
    this.edgePathService = this.createEdgePathService();
  }

  override connectedCallback() {
    super.connectedCallback();
    void this.runLayout(INITIAL_GRAPH.nodes, INITIAL_GRAPH.edges);
  }

  private handleZoomIn() {
    const nextZoom = this.zoom + this.zoomConfiguration.step;
    this.zoom = Math.min(this.zoomConfiguration.max, nextZoom);
  }

  private handleZoomOut() {
    const nextZoom = this.zoom - this.zoomConfiguration.step;
    this.zoom = Math.max(this.zoomConfiguration.min, nextZoom);
  }

  private handleFitToScreen() {
    if (!this.renderer) return;
    const { width, height } = this.renderer.getBoundingClientRect();
    const fit = computeFitToScreen(this.graphNodes, width, height);
    this.zoom = fit.zoom;
    this.graphX = fit.graphX;
    this.graphY = fit.graphY;
  }

  /**
   * Configures the layout using ELK's layered algorithm.
   * Uses orthogonal routing to generate segments used by the path service.
   */
  private async runLayout(nodes: BaseNode[], edges: BaseEdge[]) {
    const elk = new ELK();
    const originalNodesMap = new Map<string, BaseNode>(
      nodes.map(n => [n.id, n])
    );

    const layoutOptions: { [key: string]: string } = {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.portConstraints': 'FIXED_SIDE',
      'elk.portAlignment.default': 'CENTER',
      'elk.layered.mergeEdges': 'true',
      'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      'elk.spacing.nodeNode': '80',
      'elk.layered.spacing.edgeNodeBetweenLayers': '40',
      'elk.spacing.edgeNode': '40',
    };

    const elkGraph: ElkNode = {
      id: 'root',
      layoutOptions,
      children: nodes.map((n: BaseNode) => ({
        id: n.id,
        width: n.width,
        height: n.height,
        layoutOptions: { 'elk.portAlignment.default': 'CENTER' },
        ports: n.ports?.map((p: Port) => ({
          id: p.id,
          layoutOptions: { 'elk.port.side': mapSideToElk(p.side) },
        })),
      })),
      edges: edges.map((e: BaseEdge) => ({
        id: e.id ?? `${e.from.nodeId}-${e.to.nodeId}`,
        sources: [e.from.nodeId],
        targets: [e.to.nodeId],
        sourcePort: e.from.portId,
        targetPort: e.to.portId,
        labels: e.label
          ? [{ width: e.label.width, height: e.label.height }]
          : [],
      })),
    };

    const laidOutGraph = await elk.layout(elkGraph);
    this.graphNodes = (laidOutGraph.children || []).map(laidOutNode => {
      const originalNode = originalNodesMap.get(laidOutNode.id)!;
      return {
        ...originalNode,
        x: laidOutNode.x ?? 0,
        y: laidOutNode.y ?? 0,
        dragDisabled: true,
      };
    });

    this.graphEdges = (laidOutGraph.edges || []).map(
      (
        edge: ElkExtendedEdge & { sourcePort?: string; targetPort?: string }
      ): BaseEdge => ({
        id: edge.id,
        from: { nodeId: edge.sources[0], portId: edge.sourcePort },
        to: { nodeId: edge.targets[0], portId: edge.targetPort },
        sections: edge.sections as EdgeSection[] | undefined,
        label: edge.labels?.[0]
          ? {
              width: edge.labels[0].width ?? 0,
              height: edge.labels[0].height ?? 0,
            }
          : undefined,
        style: { toMarker: EndpointMarker.ARROW },
      })
    );
  }

  private readonly nodeTemplates = {
    [NODE_TEMPLATE_ID]: (nodeId: string) => html`
      <style>
        .node-template {
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid black;
          background-color: lightblue;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          font-size: 12px;
        }
      </style>
      <div class="node-template">${nodeId}</div>
    `,
    [EDGE_LABEL_TEMPLATE_ID]: (edgeId: string) => html`
      <div
        style="
          background: white;
          border: 1px solid #ccc;
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 11px;
          white-space: nowrap;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        "
      >
        Label: ${edgeId}
      </div>
    `,
  };

  override render() {
    return html`
      <gr-graph-renderer
        .edgePathService=${this.edgePathService}
        .graphNodes=${this.graphNodes}
        .graphEdges=${this.graphEdges}
        .nodeTemplates=${this.nodeTemplates}
        .graphWidth=${1400}
        .graphHeight=${1000}
        .zoom=${this.zoom}
        .graphX=${this.graphX}
        .graphY=${this.graphY}
        .showMinimap=${this.showMinimap}
        .zoomStepConfig=${this.zoomConfiguration}
        @graph-pan=${(e: CustomEvent) => {
          this.graphX = -e.detail.topLeftCorner.x;
          this.graphY = -e.detail.topLeftCorner.y;
        }}
        @graph-zoom=${(e: CustomEvent) => (this.zoom = e.detail.zoom)}
      >
      </gr-graph-renderer>

      <div class="controls ${this.showControls ? '' : 'collapsed'}">
        <button
          class="toggle-button"
          @click=${() => (this.showControls = !this.showControls)}
          title="Toggle Controls"
        >
          ${this.showControls ? '⌄' : '⌃'}
        </button>

        ${when(
          this.showControls,
          () => html`
            <div class="zoom-row">
              <button @click=${this.handleFitToScreen} title="Fit to Screen">
                ⛶
              </button>
              <button @click=${this.handleZoomIn} title="Zoom In">+</button>
              <button @click=${this.handleZoomOut} title="Zoom Out">-</button>
              <button
                class="minimap"
                @click=${() => (this.showMinimap = !this.showMinimap)}
                title="Toggle Minimap"
              >
                ${this.showMinimap ? 'Hide' : 'Show'} Minimap
              </button>
            </div>

            <div class="control-group">
              <label for="label-positioning">Label Positioning:</label>
              <select
                id="label-positioning"
                @change=${(e: Event) =>
                  this.handleConfigChange('labelPositioning', e)}
              >
                <option
                  value=${ElkLabelPositioning.LAST_SEGMENT_MIDPOINT}
                  ?selected=${this.labelPositioning ===
                  ElkLabelPositioning.LAST_SEGMENT_MIDPOINT}
                >
                  Last Segment Midpoint
                </option>
                <option
                  value=${ElkLabelPositioning.PATH_MIDPOINT}
                  ?selected=${this.labelPositioning ===
                  ElkLabelPositioning.PATH_MIDPOINT}
                >
                  Path Midpoint
                </option>
                <option
                  value=${ElkLabelPositioning.CENTRAL_VERTEX}
                  ?selected=${this.labelPositioning ===
                  ElkLabelPositioning.CENTRAL_VERTEX}
                >
                  Central Vertex
                </option>
              </select>
            </div>

            <div class="control-group">
              <label for="origin-split">Origin Split Radius:</label>
              <input
                id="origin-split"
                type="number"
                .value=${String(this.originSplitRadius)}
                @input=${(e: Event) =>
                  this.handleConfigChange('originSplitRadius', e)}
              />
            </div>

            <div class="control-group">
              <label for="terminal-bend">Terminal Bend Radius:</label>
              <input
                id="terminal-bend"
                type="number"
                .value=${String(this.terminalBendRadius)}
                @input=${(e: Event) =>
                  this.handleConfigChange('terminalBendRadius', e)}
              />
            </div>

            <div class="control-group">
              <label for="snap-threshold">Snap Threshold (px):</label>
              <input
                id="snap-threshold"
                type="number"
                .value=${String(this.snapThreshold)}
                @input=${(e: Event) =>
                  this.handleConfigChange('snapThreshold', e)}
              />
            </div>

            <div class="control-group">
              <label for="marker-clearance">Marker Clearance:</label>
              <input
                id="marker-clearance"
                type="number"
                .value=${String(this.targetMarkerClearance)}
                @input=${(e: Event) =>
                  this.handleConfigChange('targetMarkerClearance', e)}
              />
            </div>
          `
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gr-graph-renderer-elkjs-demo': GraphRendererElkjsDemo;
  }
}
