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
import 'jasmine';

import {cleanState} from '../testing/test_utils';
import {html} from 'lit';

import {
  type BaseEdge,
  type BaseNode,
  EdgeStyle,
  type Endpoint,
  type RenderableEdge,
  type RenderableLabel,
  type TentativeEdge,
} from '../common/interfaces';
import {DefaultEdgePathService} from '../edge_path_service/default_edge_path_service';
import {
  DEFAULT_EDGE_STYLE,
  DirectedGraph,
  EDGE_LABEL_TEMPLATE_ID,
} from './directed_graph';

const TASK_NODE_TEMPLATE_ID = 'taskNode';
const NODE1_ID = 'node1';
const NODE2_ID = 'node2';

const BASE_NODE: BaseNode = {
  id: NODE1_ID,
  templateId: TASK_NODE_TEMPLATE_ID,
  x: 500,
  y: 750,
  width: 100,
  height: 100,
};
const BASE_NODE_TWO: BaseNode = {
  id: NODE2_ID,
  templateId: TASK_NODE_TEMPLATE_ID,
  x: 500,
  y: 250,
  width: 100,
  height: 100,
};
const EDGE_ONE: BaseEdge = {
  id: 'edge1',
  from: {nodeId: NODE1_ID},
  to: {nodeId: NODE2_ID},
};

describe('DirectedGraph', () => {
  const state = cleanState(async () => {
    const element = new DirectedGraph();
    element.edgePathService = new DefaultEdgePathService();
    element.nodeTemplates = {
      [TASK_NODE_TEMPLATE_ID]: (nodeId: string) =>
        html`<div>Task ${nodeId}</div>`,
      [EDGE_LABEL_TEMPLATE_ID]: (edgeId: string) =>
        html`<div>Label ${edgeId}</div>`,
    };
    document.body.appendChild(element);
    await element.updateComplete;

    return {
      element,
    };
  }, beforeEach);

  afterEach(() => {
    document.body.removeChild(state.element);
  });

  it('renders the main graph container', async () => {
    state.element.nodes = [BASE_NODE, BASE_NODE_TWO];
    state.element.edges = [EDGE_ONE];
    await state.element.updateComplete;

    const container =
      state.element.shadowRoot!.querySelector('.graph-container');
    expect(container).toBeDefined();
    expect(container instanceof HTMLDivElement).toBeTrue();
  });

  it('should not throw error if edgePathService is null', async () => {
    const elementWithoutService = new DirectedGraph();
    elementWithoutService.nodes = [BASE_NODE, BASE_NODE_TWO];
    elementWithoutService.edges = [EDGE_ONE];
    document.body.appendChild(elementWithoutService);
    await elementWithoutService.updateComplete;

    // The test passes if no TypeError is thrown from buildPath
    expect(true).toBeTrue();
  });

  describe('static methods', () => {
    describe('#getStyleWithDefaults', () => {
      it('fills in the default values, if not provided', () => {
        const style: Partial<EdgeStyle> = {};
        expect(DirectedGraph.getStyleWithDefaults(style)).toEqual(
          DEFAULT_EDGE_STYLE,
        );
      });
      it('does not overwrite color, if provided', () => {
        const style: Partial<EdgeStyle> = {color: '#fff'};
        expect(DirectedGraph.getStyleWithDefaults(style).color).toEqual('#fff');
      });
      it('does not overwrite interactive, if provided', () => {
        const style: Partial<EdgeStyle> = {interactive: false};
        expect(
          DirectedGraph.getStyleWithDefaults(style).interactive,
        ).toBeFalse();
      });
    });
    describe('#getEndpointId', () => {
      it('returns the nodeId if there is not a portId provided', () => {
        const endpoint: Endpoint = {nodeId: 'nodeId1'};
        expect(DirectedGraph.getEndpointId(endpoint)).toEqual('nodeId1');
      });
      it('returns computed ID if there is a portId provided', () => {
        const endpoint: Endpoint = {nodeId: 'nodeId1', portId: 'portId1'};
        expect(DirectedGraph.getEndpointId(endpoint)).toEqual(
          'nodeId1,portId1',
        );
      });
    });
    describe('#getIdForEdge', () => {
      describe('if the edge has an ID', () => {
        it('returns the id', () => {
          const edge: BaseEdge = {
            id: 'edge1',
            from: {nodeId: 'nodeId1', portId: 'portId1'},
            to: {nodeId: 'nodeId2', portId: 'portId2'},
          };
          expect(DirectedGraph.getIdForEdge(edge)).toEqual('edge1');
        });
      });
      describe('if the edge has two endpoints and no id', () => {
        it('returns the correct computed id', () => {
          const edge: BaseEdge = {
            from: {nodeId: 'nodeId1', portId: 'portId1'},
            to: {nodeId: 'nodeId2', portId: 'portId2'},
          };
          expect(DirectedGraph.getIdForEdge(edge)).toEqual(
            'nodeId1,portId1-nodeId2,portId2',
          );
        });
      });
      describe('if the edge has one endpoints and goes to a point, and has no id', () => {
        it('returns the correct computed id', () => {
          const edge: TentativeEdge = {
            from: {nodeId: 'nodeId1', portId: 'portId1'},
            to: {x: 100, y: 200},
          };
          expect(DirectedGraph.getIdForEdge(edge)).toEqual(
            'nodeId1,portId1-100-200',
          );
        });
      });
    });
    describe('#replaceDraggingNode', () => {
      const nodes: BaseNode[] = [
        {
          id: 'node1',
          templateId: 'taskNode',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
        {
          id: 'node2',
          templateId: 'taskNode',
          x: 100,
          y: 100,
          width: 100,
          height: 100,
        },
      ];

      it('is noop if there is no dragging node', () => {
        expect(DirectedGraph.replaceDraggingNode(nodes, null)).toEqual(nodes);
      });
      it('replaces the node with the dragging node if it exists', () => {
        const draggingNode = {id: 'node1', x: 200, y: 200};
        const expectedNodes: BaseNode[] = [
          {...nodes[0], x: 200, y: 200},
          nodes[1],
        ];
        expect(DirectedGraph.replaceDraggingNode(nodes, draggingNode)).toEqual(
          expectedNodes,
        );
      });
    });
    describe('#convertEdgesToRenderableLabels', () => {
      const EDGES_WITH_LABELS: RenderableEdge[] = [
        {
          id: 'one',
          path: 'L100,100 L200,200',
          labelPosition: {x: 100, y: 100},
          label: {height: 10, width: 10},
          style: DEFAULT_EDGE_STYLE,
          from: {nodeId: 'node1'},
          to: {nodeId: 'node2'},
        },
        {
          id: 'two',
          path: 'L100,100 L200,200',
          labelPosition: {x: 250, y: 300},
          label: {height: 30, width: 20},
          style: DEFAULT_EDGE_STYLE,
          from: {nodeId: 'node1'},
          to: {nodeId: 'node2'},
        },
      ];
      const EDGES_WITHOUT_LABELS: RenderableEdge[] = [
        {
          id: 'three',
          path: 'L100,100 L200,200',
          labelPosition: {x: 900, y: 1100},
          style: DEFAULT_EDGE_STYLE,
          from: {nodeId: 'node1'},
          to: {nodeId: 'node2'},
        },
      ];
      it('converts a list of renderable edges to renderable labels', () => {
        const expectedLabels: RenderableLabel[] = [
          {id: 'one', height: 10, width: 10, x: 100, y: 100},
          {id: 'two', height: 30, width: 20, x: 250, y: 300},
        ];
        expect(
          DirectedGraph.convertEdgesToRenderableLabels(EDGES_WITH_LABELS),
        ).toEqual(expectedLabels);
      });
      it('removes the edges that do not have a label', () => {
        const expectedLabels: RenderableLabel[] = [
          {id: 'one', height: 10, width: 10, x: 100, y: 100},
          {id: 'two', height: 30, width: 20, x: 250, y: 300},
        ];
        expect(
          DirectedGraph.convertEdgesToRenderableLabels([
            ...EDGES_WITH_LABELS,
            ...EDGES_WITHOUT_LABELS,
          ]),
        ).toEqual(expectedLabels);
      });
    });
  });
});
