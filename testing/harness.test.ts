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
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cleanState } from '../testing/test_utils';
import { html } from 'lit';
import { BaseNode } from '../common/interfaces';
import { DefaultEdgePathService } from '../edge_path_service/default_edge_path_service';
import { GraphRendererHarness } from './harness';

const NODE_A: BaseNode = {
  id: 'node-a',
  templateId: 'test-node',
  x: 50,
  y: 50,
  width: 150,
  height: 75,
};

const NODE_B: BaseNode = {
  id: 'node-b',
  templateId: 'test-node',
  x: 300,
  y: 150,
  width: 150,
  height: 75,
};

describe('GraphRendererHarness', () => {
  const state = cleanState(async () => {
    const harness = await GraphRendererHarness.create({
      graphNodes: [NODE_A, NODE_B],
      edgePathService: new DefaultEdgePathService(),
      nodeTemplates: {
        'test-node': (nodeId: string) =>
          html`<div class="test-node-content">${nodeId}</div>`,
      },
    });

    const nodeDragEndSpy = vi.fn();
    harness.element.addEventListener('node-drag-end', nodeDragEndSpy);

    return { harness, nodeDragEndSpy };
  }, beforeEach);

  it('getRenderedNodeElement should find a slotted node element', async () => {
    const nodeElement = await state.harness.getRenderedNodeElement(NODE_A.id);
    expect(nodeElement).not.toBeNull();
    expect(nodeElement!.classList.contains('test-node-content')).toBe(true);
    expect(nodeElement!.textContent).toBe(NODE_A.id);
  });

  it('getAllRenderedNodeElements should find all slotted nodes', async () => {
    const nodeElements = await state.harness.getAllRenderedNodeElements();
    expect(nodeElements.length).toBe(2);
    expect(nodeElements[0].textContent).toBe(NODE_A.id);
    expect(nodeElements[1].textContent).toBe(NODE_B.id);
  });

  it('dragNode should simulate a drag and dispatch a node-drag-end event', async () => {
    const dragDelta = { dx: 100, dy: 50 };
    await state.harness.dragNode(NODE_B.id, dragDelta);

    expect(state.nodeDragEndSpy).toHaveBeenCalledTimes(1);

    const eventDetail = state.nodeDragEndSpy.mock.calls[0][0].detail;

    expect(eventDetail.id).toBe(NODE_B.id);
    expect(eventDetail.x).toBe(NODE_B.x + dragDelta.dx);
    expect(eventDetail.y).toBe(NODE_B.y + dragDelta.dy);
  });

  it('clickNode should simulate a click on a node', async () => {
    const nodeElement = await state.harness.getRenderedNodeElement(NODE_A.id);
    const clickSpy = vi.fn();
    nodeElement!.addEventListener('click', clickSpy);

    await state.harness.clickNode(NODE_A.id);

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
