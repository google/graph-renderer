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
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { cleanState } from '../testing/test_utils';
import { type BaseNode } from '../common/interfaces';
import { DRAG_THRESHOLD_PX, NodeRender } from './node_render';

// A value greater than the internal DRAG_THRESHOLD_PX
const DRAG_MOVEMENT = DRAG_THRESHOLD_PX + 1;

const BASE_NODE: BaseNode = {
  id: 'node1',
  templateId: 'node',
  x: 100,
  y: 100,
  width: 120,
  height: 60,
};

describe('NodeRender', () => {
  const state = cleanState(async () => {
    const element = new NodeRender();
    element.node = BASE_NODE;
    document.body.appendChild(element);
    await element.updateComplete;

    const dragStartSpy = vi.fn();
    const dragMoveSpy = vi.fn();
    const dragEndSpy = vi.fn();

    element.addEventListener('node-drag-start', dragStartSpy);
    element.addEventListener('node-drag-move', dragMoveSpy);
    element.addEventListener('node-drag-end', dragEndSpy);

    return {
      element,
      dragStartSpy,
      dragMoveSpy,
      dragEndSpy,
    };
  }, beforeEach);

  afterEach(() => {
    if (state.element && state.element.parentNode) {
      document.body.removeChild(state.element);
    }
    vi.restoreAllMocks();
  });

  it('renders and positions the node correctly', () => {
    expect(state.element.style.transform).toBe(
      `translate(${BASE_NODE.x}px, ${BASE_NODE.y}px)`
    );
    expect(state.element.style.width).toBe(`${BASE_NODE.width}px`);
    expect(state.element.style.height).toBe(`${BASE_NODE.height}px`);
  });

  it('does not emit node-drag-start on pointerdown', () => {
    state.element.dispatchEvent(
      new PointerEvent('pointerdown', {
        isPrimary: true,
        clientX: BASE_NODE.x,
        clientY: BASE_NODE.y,
        pointerId: 1,
        buttons: 1, // Primary mouse button
      })
    );

    expect(state.dragStartSpy).not.toHaveBeenCalled();
    expect(state.element.isDragging).toBe(false);
  });

  it('emits node-drag-start on pointermove after exceeding threshold', () => {
    state.element.dispatchEvent(
      new PointerEvent('pointerdown', {
        isPrimary: true,
        clientX: BASE_NODE.x,
        clientY: BASE_NODE.y,
        pointerId: 1,
        buttons: 1, // Primary mouse button
      })
    );
    document.dispatchEvent(
      new PointerEvent('pointermove', {
        isPrimary: true,
        clientX: BASE_NODE.x + DRAG_MOVEMENT,
        clientY: BASE_NODE.y + DRAG_MOVEMENT,
        pointerId: 1,
        buttons: 1, // Primary mouse button
      })
    );

    expect(state.dragStartSpy).toHaveBeenCalledTimes(1);
    expect(state.dragStartSpy.mock.calls[0][0].detail).toEqual(BASE_NODE);
    expect(state.element.isDragging).toBe(true);
  });

  it('emits node-drag-move on pointermove after drag has started', async () => {
    const startX = BASE_NODE.x;
    const startY = BASE_NODE.y;
    state.element.dispatchEvent(
      new PointerEvent('pointerdown', {
        isPrimary: true,
        clientX: startX,
        clientY: startY,
        pointerId: 1,
        buttons: 1, // Primary mouse button
      })
    );

    let moveX = startX + DRAG_MOVEMENT;
    let moveY = startY + DRAG_MOVEMENT;
    document.dispatchEvent(
      new PointerEvent('pointermove', {
        isPrimary: true,
        clientX: moveX,
        clientY: moveY,
        pointerId: 1,
        buttons: 1, // Primary mouse button
      })
    );
    await state.element.updateComplete;

    expect(state.dragMoveSpy).toHaveBeenCalledTimes(1);
    let moveEventDetail = state.dragMoveSpy.mock.calls[0][0].detail;
    expect(moveEventDetail).toEqual({
      x: BASE_NODE.x + DRAG_MOVEMENT,
      y: BASE_NODE.y + DRAG_MOVEMENT,
      id: 'node1',
    });

    moveX += 20;
    moveY += 30;
    document.dispatchEvent(
      new PointerEvent('pointermove', {
        isPrimary: true,
        clientX: moveX,
        clientY: moveY,
        pointerId: 1,
        buttons: 1, // Primary mouse button
      })
    );
    await state.element.updateComplete;

    expect(state.dragMoveSpy).toHaveBeenCalledTimes(2);
    // Index 1 for the second call
    moveEventDetail = state.dragMoveSpy.mock.calls[1][0].detail;
    expect(moveEventDetail).toEqual({
      x: BASE_NODE.x + DRAG_MOVEMENT + 20,
      y: BASE_NODE.y + DRAG_MOVEMENT + 30,
      id: 'node1',
    });
  });

  it('emits node-drag-end on pointerup and resets dragging state immediately', async () => {
    const startX = BASE_NODE.x;
    const startY = BASE_NODE.y;
    state.element.dispatchEvent(
      new PointerEvent('pointerdown', {
        isPrimary: true,
        clientX: startX,
        clientY: startY,
        pointerId: 1,
        buttons: 1, // Primary mouse button
      })
    );
    const moveX = startX + DRAG_MOVEMENT;
    const moveY = startY + DRAG_MOVEMENT;
    document.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: moveX,
        clientY: moveY,
        pointerId: 1,
        buttons: 1, // Primary mouse button
      })
    );
    document.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: moveX,
        clientY: moveY,
        pointerId: 1,
      })
    );

    expect(state.dragEndSpy).toHaveBeenCalledTimes(1);
    const endEventDetail = state.dragEndSpy.mock.calls[0][0].detail;
    expect(endEventDetail).toEqual({
      x: BASE_NODE.x + DRAG_MOVEMENT,
      y: BASE_NODE.y + DRAG_MOVEMENT,
      id: 'node1',
    });
    expect(state.element.isDragging).toBe(false);
  });

  it('does not drag if pointer moves less than the threshold', () => {
    state.element.dispatchEvent(
      new PointerEvent('pointerdown', {
        isPrimary: true,
        clientX: BASE_NODE.x,
        clientY: BASE_NODE.y,
        pointerId: 1,
        buttons: 1, // Primary mouse button
      })
    );
    document.dispatchEvent(
      new PointerEvent('pointermove', {
        isPrimary: true,
        clientX: BASE_NODE.x + 1,
        clientY: BASE_NODE.y + 1,
        pointerId: 1,
        buttons: 1, // Primary mouse button
      })
    );
    document.dispatchEvent(
      new PointerEvent('pointerup', {
        isPrimary: true,
        clientX: BASE_NODE.x + 1,
        clientY: BASE_NODE.y + 1,
        pointerId: 1,
      })
    );

    expect(state.dragStartSpy).not.toHaveBeenCalled();
    expect(state.dragEndSpy).not.toHaveBeenCalled();
    expect(state.element.isDragging).toBe(false);
  });

  it('does not drag if locked', async () => {
    state.element.locked = true;
    await state.element.updateComplete;

    state.element.dispatchEvent(
      new PointerEvent('pointerdown', {
        isPrimary: true,
        clientX: BASE_NODE.x,
        clientY: BASE_NODE.y,
        pointerId: 1,
        buttons: 1, // Primary mouse button
      })
    );

    expect(state.dragStartSpy).not.toHaveBeenCalled();
    expect(state.element.isDragging).toBe(false);
  });

  it('does not drag if node.dragDisabled is true', async () => {
    state.element.node = { ...BASE_NODE, dragDisabled: true };
    await state.element.updateComplete;

    state.element.dispatchEvent(
      new PointerEvent('pointerdown', {
        isPrimary: true,
        clientX: BASE_NODE.x,
        clientY: BASE_NODE.y,
        pointerId: 1,
        buttons: 1, // Primary mouse button
      })
    );

    expect(state.dragStartSpy).not.toHaveBeenCalled();
    expect(state.element.isDragging).toBe(false);
  });

  it('constrains drag within bounds if constrainNodeDrag is true', async () => {
    state.element.graphWidth = 200;
    state.element.graphHeight = 200;
    state.element.constrainNodeDrag = true;
    await state.element.updateComplete;

    state.element.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: BASE_NODE.x,
        clientY: BASE_NODE.y,
        pointerId: 1,
        buttons: 1, // Primary mouse button
      })
    );

    // Try to drag out of bounds (exceeding threshold)
    document.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 300,
        clientY: 300,
        pointerId: 1,
        buttons: 1, // Primary mouse button
      })
    );
    await state.element.updateComplete;

    const moveEventDetail = state.dragMoveSpy.mock.calls[0][0].detail;
    const expectedX = state.element.graphWidth - BASE_NODE.width;
    const expectedY = state.element.graphHeight - BASE_NODE.height;
    expect(moveEventDetail.x).toBe(expectedX);
    expect(moveEventDetail.y).toBe(expectedY);
  });

  it('adjusts drag distance based on zoom', async () => {
    state.element.zoom = 2; // Zoomed in, drag effect should be halved
    await state.element.updateComplete;

    const startX = BASE_NODE.x;
    const startY = BASE_NODE.y;
    state.element.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: startX,
        clientY: startY,
        pointerId: 1,
        buttons: 1, // Primary mouse button
      })
    );
    // Move screen pixels by 100 (exceeding threshold)
    document.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: startX + 100,
        clientY: startY + 100,
        pointerId: 1,
        buttons: 1, // Primary mouse button
      })
    );
    await state.element.updateComplete;

    // Expected movement in world coordinates is 100 / 2 = 50
    const moveEventDetail = state.dragMoveSpy.mock.calls[0][0].detail;
    expect(moveEventDetail.x).toBe(BASE_NODE.x + 50);
    expect(moveEventDetail.y).toBe(BASE_NODE.y + 50);
  });

  it('resets dragging state if a pointermove event is fired without the primary button pressed', async () => {
    const startX = BASE_NODE.x;
    const startY = BASE_NODE.y;
    state.element.dispatchEvent(
      new PointerEvent('pointerdown', {
        isPrimary: true,
        clientX: startX,
        clientY: startY,
        pointerId: 1,
        buttons: 1, // Primary mouse button
      })
    );
    // Move enough to start the drag
    document.dispatchEvent(
      new PointerEvent('pointermove', {
        isPrimary: true,
        clientX: startX + DRAG_MOVEMENT,
        clientY: startY + DRAG_MOVEMENT,
        pointerId: 1,
        buttons: 1, // Primary mouse button
      })
    );
    expect(state.element.isDragging).toBe(true);

    // Now, simulate a "stuck" state by firing another move event without the button pressed
    document.dispatchEvent(
      new PointerEvent('pointermove', {
        isPrimary: true,
        clientX: startX + DRAG_MOVEMENT + 50,
        clientY: startY + DRAG_MOVEMENT + 50,
        pointerId: 1,
        buttons: 0, // No buttons pressed
      })
    );

    // The isDragging flag should be reset by the guard in handlePointerMove
    expect(state.element.isDragging).toBe(false);
  });

  describe('without node property set', () => {
    const state = cleanState(async () => {
      const element = new NodeRender();
      document.body.appendChild(element);
      await element.updateComplete;
      return { element };
    }, beforeEach);

    afterEach(() => {
      if (state.element.parentNode) {
        document.body.removeChild(state.element);
      }
    });

    it('renders nothing', () => {
      expect(
        state.element.shadowRoot!.querySelector('.node-container')
      ).toBeNull();
    });
  });
});
