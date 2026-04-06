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
import {BaseNode} from '../common/interfaces';
import './minimap'; // Ensure the custom element is defined
import {Minimap} from './minimap';

const MOCK_NODE: BaseNode = {
  id: 'node1',
  templateId: 't1',
  x: 100,
  y: 100,
  width: 100,
  height: 50,
};

describe('Minimap', () => {
  const state = cleanState(async () => {
    const element = document.createElement('gr-minimap') as Minimap;
    element.nodes = [MOCK_NODE];
    element.graphWidth = 2000;
    element.graphHeight = 1600;
    element.winWidth = 1000;
    element.winHeight = 800;
    element.zoom = 1;
    element.graphX = 0;
    element.graphY = 0;
    element.size = 200;

    document.body.appendChild(element);
    await element.updateComplete;

    const panSpy = jasmine.createSpy('minimap-pan');
    element.addEventListener('minimap-pan', panSpy);

    const miniMap = element.shadowRoot!.querySelector(
      '.mini-map',
    ) as HTMLElement;
    const viewBox = element.shadowRoot!.querySelector(
      '.view-box',
    ) as HTMLElement;
    const canvasContainer = element.shadowRoot!.querySelector(
      '.canvas-container',
    ) as HTMLElement;

    return {element, panSpy, miniMap, viewBox, canvasContainer};
  }, beforeEach);

  afterEach(() => {
    if (state.element && state.element.parentNode) {
      document.body.removeChild(state.element);
    }
  });

  it('should render the minimap and its internal elements', () => {
    expect(state.element).toBeDefined();
    expect(state.miniMap).not.toBeNull();
    expect(state.viewBox).not.toBeNull();
  });

  it('should calculate derived state and styles correctly', async () => {
    // zoom = 1, zoomContentScale = 1, scale = 0.1, finalScale = 0.1
    // boxWidth = (0.1 * 1000) / 1 = 100
    // boxHeight = (0.1 * 800) / 1 = 80
    // boxPosition = { x: -0 * 0.1 = 0, y: -0 * 0.1 = 0 }
    expect(state.viewBox.style.width).toBe('100px');
    expect(state.viewBox.style.height).toBe('80px');
    expect(state.viewBox.style.transform).toBe('translate3d(0px, 0px, 0px)');

    // Test with zoom > 1
    state.element.graphX = -500;
    state.element.graphY = -400;
    state.element.zoom = 2;
    await state.element.updateComplete;

    // zoom = 2, zoomContentScale = 1, scale = 0.1, finalScale = 0.1
    // boxWidth = (0.1 * 1000) / 2 = 50
    // boxHeight = (0.1 * 800) / 2 = 40
    // boxPosition = { x: -(-500) * 0.1 = 50, y: -(-400) * 0.1 = 40 }
    expect(state.viewBox.style.width).toBe('50px');
    expect(state.viewBox.style.height).toBe('40px');
    expect(state.viewBox.style.transform).toBe('translate3d(50px, 40px, 0px)');

    // Test with zoom < 1
    state.element.zoom = 0.5;
    await state.element.updateComplete;

    // zoom = 0.5, zoomContentScale = 0.5, scale = 0.1, finalScale = 0.05
    // boxWidth = (0.1 * 1000) / 0.5 = 200
    // boxHeight = (0.1 * 800) / 0.5 = 160
    // boxPosition = { x: -(-500) * 0.05 = 25, y: -(-400) * 0.05 = 20 }
    expect(state.viewBox.style.width).toBe('200px');
    expect(state.viewBox.style.height).toBe('160px');
    expect(state.viewBox.style.transform).toBe('translate3d(25px, 20px, 0px)');
  });

  it('should dispatch a pan event on click', () => {
    const clickEvent = new PointerEvent('click', {
      bubbles: true,
      composed: true,
    });
    // Simulate properties that would be on a real event.
    Object.defineProperties(clickEvent, {
      'offsetX': {value: 50},
      'offsetY': {value: 60},
    });

    // Dispatch the event on the element that has the listener.
    state.canvasContainer.dispatchEvent(clickEvent);

    expect(state.panSpy).toHaveBeenCalledTimes(1);
    const eventDetail = state.panSpy.calls.mostRecent().args[0].detail;
    expect(eventDetail.event.type).toBe('click');
  });

  it('should dispatch pan events when dragging the viewbox', () => {
    const startX = 10;
    const startY = 10;
    const moveX = 60;
    const moveY = 80;

    // 1. Pointer Down
    state.viewBox.dispatchEvent(
      new PointerEvent('pointerdown', {
        isPrimary: true,
        clientX: startX,
        clientY: startY,
        pointerId: 1,
      }),
    );

    expect(state.panSpy).toHaveBeenCalledTimes(1);
    let eventDetail = state.panSpy.calls.mostRecent().args[0].detail;
    expect(eventDetail.event.type).toBe('start');

    // 2. Pointer Move
    document.dispatchEvent(
      new PointerEvent('pointermove', {
        isPrimary: true,
        clientX: moveX,
        clientY: moveY,
        pointerId: 1,
      }),
    );

    expect(state.panSpy).toHaveBeenCalledTimes(2);
    eventDetail = state.panSpy.calls.mostRecent().args[0].detail;
    expect(eventDetail.event.type).toBe('move');
    // lastViewBoxX was 0. dx = 60 - 10 = 50. dy = 80 - 10 = 70.
    // scale = 0.1
    // topLeftCorner = {x: 50 / 0.1 = 500, y: 70 / 0.1 = 700}
    expect(eventDetail.topLeftCorner.x).toBeCloseTo(500);
    expect(eventDetail.topLeftCorner.y).toBeCloseTo(700);

    // 3. Pointer Up
    document.dispatchEvent(
      new PointerEvent('pointerup', {
        isPrimary: true,
        clientX: moveX,
        clientY: moveY,
        pointerId: 1,
      }),
    );

    expect(state.panSpy).toHaveBeenCalledTimes(3);
    eventDetail = state.panSpy.calls.mostRecent().args[0].detail;
    expect(eventDetail.event.type).toBe('end');
    expect(eventDetail.topLeftCorner.x).toBeCloseTo(500);
    expect(eventDetail.topLeftCorner.y).toBeCloseTo(700);
  });
});
