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
import { BaseNode } from '../common/interfaces';
import '../directed_graph/directed_graph';
import { DirectedGraph } from '../directed_graph/directed_graph';
import { EdgePathService } from '../edge_path_service/edge_path_service';
import '../graph_renderer';
import { GraphRenderer } from '../graph_renderer';
import '../node_render/node_render';
import { NodeRender } from '../node_render/node_render';

/**
 * Configuration for creating a GraphRendererHarness instance for testing.
 */
export interface HarnessTestConfig {
  graphNodes: BaseNode[];
  edgePathService: EdgePathService;
  nodeTemplates: Record<string, (id: string) => unknown>;
  parentElement?: HTMLElement;
}

/**
 * A test harness for the <gr-graph-renderer> component.
 *
 * This class provides a stable API for interacting with the rendered elements
 * of the graph, such as nodes and edges, from within a test environment.
 * It abstracts away the complexities of the component's internal Shadow DOM
 * structure, making tests easier to write and more robust against internal
 * implementation changes.
 *
 * @example
 * ```typescript
 * import {GraphRendererHarness} from './harness';
 * import {DefaultEdgePathService} from '../edge_path_service/default_edge_path_service';
 *
 * describe('MyComponent with GraphRenderer', () => {
 *   it('should allow dragging a node', async () => {
 *     // 1. Create the harness, which handles all setup.
 *     const harness = await GraphRendererHarness.create({
 *       graphNodes: [{id: 'node-1', x: 50, y: 50, width: 100, height: 50, templateId: 'default'}],
 *       edgePathService: new DefaultEdgePathService(),
 *       nodeTemplates: {'default': (id) => html`<div>${id}</div>`},
 *     });
 *
 *     const dragEndSpy = jasmine.createSpy('node-drag-end');
 *     harness.element.addEventListener('node-drag-end', dragEndSpy);
 *
 *     // 2. Interact with the component through the harness API.
 *     await harness.dragNode('node-1', {dx: 100, dy: 50});
 *
 *     // 3. Make assertions.
 *     expect(dragEndSpy).toHaveBeenCalledTimes(1);
 *   });
 * });
 * ```
 */
export class GraphRendererHarness {
  private constructor(readonly element: GraphRenderer) {}

  /**
   * Creates and initializes an instance of the test harness.
   * It handles waiting for all necessary custom element definitions and
   * the initial render cycle.
   *
   * @param config The configuration for the graph renderer.
   * @return A promise that resolves to a fully initialized harness instance.
   */
  static async create(
    config: HarnessTestConfig
  ): Promise<GraphRendererHarness> {
    // 1. Wait for all internal custom elements to be defined. This abstracts
    // the implementation detail away from the consumer.
    await Promise.all([
      customElements.whenDefined('gr-graph-renderer'),
      customElements.whenDefined('gr-directed-graph'),
      customElements.whenDefined('gr-node-render'),
    ]);

    // 2. Create and connect the element to the DOM.
    const element = document.createElement(
      'gr-graph-renderer'
    ) as GraphRenderer;
    const parent = config.parentElement ?? document.body;
    parent.appendChild(element);

    // 3. Set properties to trigger reactive updates.
    element.graphNodes = config.graphNodes;
    element.edgePathService = config.edgePathService;
    element.nodeTemplates = config.nodeTemplates;
    await element.updateComplete;

    // 4. Instantiate the harness.
    const harness = new GraphRendererHarness(element);

    // 5. Wait for the async rendering pipeline to complete.
    await harness.waitForRender();

    return harness;
  }

  /**
   * Waits for the component and its sub-components to complete their render cycles.
   */
  async waitForRender(
    options: {
      timeoutMs?: number;
      expectedNodeCount?: number;
    } = {}
  ): Promise<void> {
    await this.element.updateComplete;
    const directedGraph = this.getDirectedGraph();
    if (directedGraph) {
      await directedGraph.updateComplete;
    }

    const {
      timeoutMs = 2000,
      expectedNodeCount = this.element.graphNodes.length,
    } = options;

    const startTime = Date.now();
    let nodeRenderers: NodeRender[] = [];

    while (Date.now() - startTime < timeoutMs) {
      nodeRenderers = this.getAllNodeRenderers();
      if (nodeRenderers.length === expectedNodeCount) {
        await Promise.all(nodeRenderers.map(n => n.updateComplete));
        return;
      }
      await new Promise(resolve => {
        setTimeout(resolve, 50);
      });
    }

    throw new Error(
      `Timed out after ${timeoutMs}ms waiting for ${expectedNodeCount} nodes to render. ` +
        `Found ${nodeRenderers.length}.`
    );
  }

  getDirectedGraph(): DirectedGraph | null {
    return this.element.shadowRoot?.querySelector('gr-directed-graph') ?? null;
  }

  getAllNodeRenderers(): NodeRender[] {
    const directedGraph = this.getDirectedGraph();
    if (!directedGraph?.shadowRoot) return [];
    return Array.from(
      directedGraph.shadowRoot.querySelectorAll('gr-node-render')
    );
  }

  getNodeRenderer(nodeId: string): NodeRender | null {
    const renderers = this.getAllNodeRenderers();
    return renderers.find(r => r.node?.id === nodeId) ?? null;
  }

  getRenderedNodeElement(nodeId: string): HTMLElement | null {
    const nodeRenderer = this.getNodeRenderer(nodeId);
    return (nodeRenderer?.firstElementChild as HTMLElement) ?? null;
  }

  getAllRenderedNodeElements(): HTMLElement[] {
    return this.getAllNodeRenderers()
      .map(r => r.firstElementChild as HTMLElement | undefined)
      .filter((el): el is HTMLElement => el !== undefined);
  }

  async clickNode(nodeId: string): Promise<void> {
    const nodeElement = this.getRenderedNodeElement(nodeId);
    if (!nodeElement) {
      throw new Error(`Node with ID "${nodeId}" not found for clicking.`);
    }
    nodeElement.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true })
    );
    await this.waitForRender();
  }

  async dragNode(
    nodeId: string,
    { dx, dy }: { dx: number; dy: number }
  ): Promise<void> {
    const nodeRenderer = this.getNodeRenderer(nodeId);
    if (!nodeRenderer) {
      throw new Error(`Node with ID "${nodeId}" not found for dragging.`);
    }

    const startRect = nodeRenderer.getBoundingClientRect();
    const startX = startRect.left + startRect.width / 2;
    const startY = startRect.top + startRect.height / 2;

    nodeRenderer.dispatchEvent(
      new PointerEvent('pointerdown', {
        isPrimary: true,
        clientX: startX,
        clientY: startY,
        pointerId: 1,
        bubbles: true,
        composed: true,
        buttons: 1, // Primary mouse button
      })
    );

    document.dispatchEvent(
      new PointerEvent('pointermove', {
        isPrimary: true,
        clientX: startX + dx,
        clientY: startY + dy,
        pointerId: 1,
        bubbles: true,
        composed: true,
        buttons: 1, // Primary mouse button
      })
    );

    document.dispatchEvent(
      new PointerEvent('pointerup', {
        isPrimary: true,
        clientX: startX + dx,
        clientY: startY + dy,
        pointerId: 1,
        bubbles: true,
        composed: true,
      })
    );

    await this.waitForRender({
      expectedNodeCount: this.element.graphNodes.length,
    });
  }
}
