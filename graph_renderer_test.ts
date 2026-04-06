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

import {cleanState} from './testing/test_utils';

import {BaseEdge, BaseNode} from './common/interfaces';
import {DefaultEdgePathService} from './edge_path_service/default_edge_path_service';
import {
  DEFAULT_ZOOM_CONFIG,
  GraphRenderer,
  MouseWheelBehavior,
  PAN_THRESHOLD,
  ZoomStepConfig,
} from './graph_renderer';

const NODE1: BaseNode = {
  id: '1',
  templateId: 'default',
  x: 10,
  y: 10,
  width: 100,
  height: 50,
};
const NODE2: BaseNode = {
  id: '2',
  templateId: 'default',
  x: 200,
  y: 100,
  width: 100,
  height: 50,
};
const EDGE1: BaseEdge = {from: {nodeId: '1'}, to: {nodeId: '2'}};

describe('GraphRenderer', () => {
  const state = cleanState(async () => {
    const element = new GraphRenderer();
    element.graphNodes = [NODE1, NODE2];
    element.graphEdges = [EDGE1];
    element.graphWidth = 1000;
    element.graphHeight = 1000;
    element.edgePathService = new DefaultEdgePathService();
    document.body.appendChild(element);
    await element.updateComplete;

    const graphPanSpy = jasmine.createSpy('graphPan');
    const graphZoomSpy = jasmine.createSpy('graphZoom');

    element.addEventListener('graph-pan', graphPanSpy);
    element.addEventListener('graph-zoom', graphZoomSpy);

    const wrapper = element.shadowRoot!.querySelector(
      '.wrapper',
    ) as HTMLElement;
    const directedGraph = element.shadowRoot!.querySelector(
      'gr-directed-graph',
    ) as HTMLElement;

    // Spy on getBoundingClientRect to return consistent values for zoom tests
    spyOn(wrapper, 'getBoundingClientRect').and.returnValue({
      top: 0,
      left: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
    } as DOMRect);

    const resizeObserverObserveSpy = spyOn(ResizeObserver.prototype, 'observe');
    const resizeObserverDisconnectSpy = spyOn(ResizeObserver.prototype, 'disconnect');

    return {
      element,
      wrapper,
      directedGraph,
      graphPanSpy,
      graphZoomSpy,
      resizeObserverDisconnectSpy,
      resizeObserverObserveSpy,
    };
  }, beforeEach);

  afterEach(() => {
    if (state.element.parentNode) {
      document.body.removeChild(state.element);
    }
  });

  it('renders wrapper', async () => {
    expect(state.wrapper).toBeDefined();
  });

  describe('Panning', () => {
    beforeEach(() => {
      jasmine.clock().install();
    });

    afterEach(() => {
      jasmine.clock().uninstall();
    });

    it('emits graph-pan events on pointer drag on wrapper', async () => {
      const wrapper = state.wrapper;
      const startX = 100;
      const startY = 100;
      const moveX = 150;
      const moveY = 160;
      const secondMoveX = 200;
      const secondMoveY = 220;

      // Pointer down should not start panning
      const pointerDownEvent = new PointerEvent('pointerdown', {
        isPrimary: true,
        clientX: startX,
        clientY: startY,
        bubbles: true,
        composed: true,
        buttons: 1, // Primary mouse button
      });
      wrapper.dispatchEvent(pointerDownEvent);
      expect(state.graphPanSpy).not.toHaveBeenCalled();
      expect(state.element.isPanning).toBeFalse();

      // First pointer move starts panning and emits a 'start' and 'move' event
      const pointerMoveEvent = new PointerEvent('pointermove', {
        isPrimary: true,
        clientX: moveX,
        clientY: moveY,
        bubbles: true,
        composed: true,
        buttons: 1, // Primary mouse button
      });
      document.dispatchEvent(pointerMoveEvent);
      expect(state.element.isPanning).toBeTrue();
      expect(state.graphPanSpy).toHaveBeenCalledTimes(2);
      expect(state.graphPanSpy.calls.argsFor(0)[0].detail.event.type).toBe('start');
      expect(state.graphPanSpy.calls.argsFor(1)[0].detail.event.type).toBe('move');

      // Second pointer move emits another 'move' event
      const secondPointerMoveEvent = new PointerEvent('pointermove', {
        isPrimary: true,
        clientX: secondMoveX,
        clientY: secondMoveY,
        bubbles: true,
        composed: true,
        buttons: 1, // Primary mouse button
      });
      document.dispatchEvent(secondPointerMoveEvent);
      expect(state.graphPanSpy).toHaveBeenCalledTimes(3);
      expect(state.graphPanSpy.calls.argsFor(2)[0].detail.event.type).toBe('move');

      // Pointer up emits an 'end' event
      const pointerUpEvent = new PointerEvent('pointerup', {
        isPrimary: true,
        clientX: secondMoveX,
        clientY: secondMoveY,
        bubbles: true,
        composed: true,
      });
      document.dispatchEvent(pointerUpEvent);
      expect(state.graphPanSpy).toHaveBeenCalledTimes(4);
      expect(state.graphPanSpy.calls.argsFor(3)[0].detail.event.type).toBe('end');

      expect(state.element.isPanning).toBeFalse();
    });

    it('resets panning state if a pointermove event is fired without the primary button pressed', async () => {
      const wrapper = state.wrapper;
      const startX = 100;
      const startY = 100;
      const moveX = 150;
      const moveY = 160;

      // Start a pan
      const pointerDownEvent = new PointerEvent('pointerdown', {
        isPrimary: true,
        clientX: startX,
        clientY: startY,
        bubbles: true,
        composed: true,
        buttons: 1, // Primary mouse button
      });
      wrapper.dispatchEvent(pointerDownEvent);
      const pointerMoveEvent = new PointerEvent('pointermove', {
        isPrimary: true,
        clientX: moveX,
        clientY: moveY,
        bubbles: true,
        composed: true,
        buttons: 1, // Primary mouse button
      });
      document.dispatchEvent(pointerMoveEvent);
      expect(state.element.isPanning).toBeTrue();

      // Now, simulate a "stuck" state by firing another move event without the button pressed
      const stuckPointerMoveEvent = new PointerEvent('pointermove', {
        isPrimary: true,
        clientX: moveX + 50,
        clientY: moveY + 50,
        bubbles: true,
        composed: true,
        buttons: 0, // Explicitly set to 0 to simulate no buttons pressed
      });
      document.dispatchEvent(stuckPointerMoveEvent);

      // The isPanning flag should be reset by the guard in handlePointerMove
      expect(state.element.isPanning).toBeFalse();
    });

    it('does not start panning if pointer moves less than the threshold', async () => {
      const wrapper = state.wrapper;
      const startX = 100;
      const startY = 100;

      // Movement less than the PAN_THRESHOLD
      const moveX = startX + PAN_THRESHOLD - 1;
      const moveY = startY + PAN_THRESHOLD - 1;

      // Simulate pointer down
      const pointerDownEvent = new PointerEvent('pointerdown', {
        isPrimary: true,
        clientX: startX,
        clientY: startY,
        bubbles: true,
        composed: true,
        buttons: 1,
      });
      wrapper.dispatchEvent(pointerDownEvent);

      // Simulate pointer move
      const pointerMoveEvent = new PointerEvent('pointermove', {
        isPrimary: true,
        clientX: moveX,
        clientY: moveY,
        bubbles: true,
        composed: true,
        buttons: 1,
      });
      document.dispatchEvent(pointerMoveEvent);

      // Asserts that panning has not started
      expect(state.element.isPanning).toBeFalse();
      expect(state.graphPanSpy).not.toHaveBeenCalled();

      // Simulate pointer up to complete the click action
      const pointerUpEvent = new PointerEvent('pointerup', {
        isPrimary: true,
        clientX: moveX,
        clientY: moveY,
        bubbles: true,
        composed: true,
      });
      document.dispatchEvent(pointerUpEvent);

      // Final check to ensure panning state is not activated
      expect(state.element.isPanning).toBeFalse();
      expect(state.graphPanSpy).not.toHaveBeenCalled();
    });

    it('starts panning if pointer moves only horizontally beyond the threshold', async () => {
      const wrapper = state.wrapper;
      const startX = 100;
      const startY = 100;

      // Horizontal movement is greater than the PAN_THRESHOLD, but vertical movement is not.
      const moveX = startX + PAN_THRESHOLD + 1;
      const moveY = startY;

      // Simulate pointer down
      const pointerDownEvent = new PointerEvent('pointerdown', {
        isPrimary: true,
        clientX: startX,
        clientY: startY,
        bubbles: true,
        composed: true,
        buttons: 1,
      });
      wrapper.dispatchEvent(pointerDownEvent);

      // Simulate pointer move
      const pointerMoveEvent = new PointerEvent('pointermove', {
        isPrimary: true,
        clientX: moveX,
        clientY: moveY,
        bubbles: true,
        composed: true,
        buttons: 1,
      });
      document.dispatchEvent(pointerMoveEvent);

      expect(state.element.isPanning).toBeTrue();
      expect(state.graphPanSpy).toHaveBeenCalled();

      // Pointer up emits an 'end' event
      const pointerUpEvent = new PointerEvent('pointerup', {
        isPrimary: true,
        clientX: moveX,
        clientY: moveY,
        bubbles: true,
        composed: true,
      });
      document.dispatchEvent(pointerUpEvent);
    });

    it('prevents the click event that follows a pan, but allows subsequent clicks', () => {
      const wrapper = state.wrapper;
      const wrapperClickSpy = jasmine.createSpy('wrapper-click-spy');
      wrapper.addEventListener('click', wrapperClickSpy);

      // Simulate a pan gesture that exceeds the movement threshold
      const startX = 100;
      const startY = 100;
      const moveX = startX + PAN_THRESHOLD + 1;
      const moveY = startY + PAN_THRESHOLD + 1;

      wrapper.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: startX, clientY: startY, isPrimary: true, buttons: 1, bubbles: true, composed: true
      }));
      document.dispatchEvent(new PointerEvent('pointermove', {
        clientX: moveX, clientY: moveY, isPrimary: true, buttons: 1, bubbles: true, composed: true
      }));

      // End the pan. This attaches the one-time `consumeClick` listener to wrapper.
      document.dispatchEvent(new PointerEvent('pointerup', {
        clientX: moveX, clientY: moveY, isPrimary: true, bubbles: true, composed: true
      }));

      // --- Verification Step 1: The Unwanted Click ---
      // Now, simulate the unwanted 'click' that the browser would fire after a pan.
      // This click should be caught and consumed by the wrapper's listener.
      wrapper.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

      // Verify that our spy was NOT called, because the click was successfully consumed.
      expect(wrapperClickSpy).not.toHaveBeenCalled();

      // --- Verification Step 2: The Intentional Click ---
      // Now, simulate a brand new, separate, intentional click on the wrapper.
      // The `consumeClick` listener was a `{once: true}` listener and should now be gone.
      wrapper.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

      // Verify that this second, legitimate click DID get through.
      expect(wrapperClickSpy).toHaveBeenCalledTimes(1);

      // Cleanup the spy listener
      wrapper.removeEventListener('click', wrapperClickSpy);
    });
  });

  describe('MouseWheelBehavior', () => {
    it('defaults to ZOOM behavior', () => {
      expect(state.element.mouseWheelBehavior).toBe(MouseWheelBehavior.ZOOM);
    });

    describe('ZOOM mode', () => {
      it('zooms with wheel', async () => {
        const wheelEvent = new WheelEvent('wheel', {deltaY: -120}); // Zoom in
        state.wrapper.dispatchEvent(wheelEvent);
        await state.element.updateComplete;

        // The expected zoom is the initial zoom (1) + the default step.
        expect(state.element.zoom).toBeCloseTo(1 + DEFAULT_ZOOM_CONFIG.step);
        expect(state.graphZoomSpy).toHaveBeenCalledTimes(1);
        expect(state.graphPanSpy).toHaveBeenCalledTimes(1); // Zooming also pans
      });

      it('pans with ctrl + wheel', async () => {
        const initialX = state.element.graphX;
        const wheelEvent =
            new WheelEvent('wheel', {deltaX: 10, ctrlKey: true});
        state.wrapper.dispatchEvent(wheelEvent);
        await state.element.updateComplete;

        expect(state.element.graphX).toBe(initialX - 10);
        expect(state.graphZoomSpy).not.toHaveBeenCalled();
        expect(state.graphPanSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('PAN mode', () => {
      beforeEach(async () => {
        state.element.mouseWheelBehavior = MouseWheelBehavior.PAN;
        await state.element.updateComplete;
      });

      it('pans with wheel', async () => {
        const initialX = state.element.graphX;
        const wheelEvent = new WheelEvent('wheel', {deltaX: 10});
        state.wrapper.dispatchEvent(wheelEvent);
        await state.element.updateComplete;

        expect(state.element.graphX).toBe(initialX - 10);
        expect(state.graphZoomSpy).not.toHaveBeenCalled();
        expect(state.graphPanSpy).toHaveBeenCalledTimes(1);
      });

      it('zooms with ctrl + wheel', async () => {
        const wheelEvent =
            new WheelEvent('wheel', {deltaY: -120, ctrlKey: true});
        state.wrapper.dispatchEvent(wheelEvent);
        await state.element.updateComplete;

        // The expected zoom is the initial zoom (1) + the default step.
        expect(state.element.zoom).toBeCloseTo(1 + DEFAULT_ZOOM_CONFIG.step);
        expect(state.graphZoomSpy).toHaveBeenCalledTimes(1);
        expect(state.graphPanSpy).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Animated Zooming', () => {
    beforeEach(() => {
      jasmine.clock().install();
    });

    afterEach(() => {
      jasmine.clock().uninstall();
    });

    it('applies transition style during animated zoom', async () => {
      const zoomConfig: ZoomStepConfig = {
        ...DEFAULT_ZOOM_CONFIG,
        animateZoom: true,
        zoomAnimationTransition: 'transform 0.5s linear',
      };
      state.element.zoomStepConfig = zoomConfig;
      await state.element.updateComplete;

      // Trigger a zoom update
      state.element.zoom = 1.5;
      await state.element.updateComplete;

      // Check that the transition style is applied immediately.
      expect(state.directedGraph.style.transition).toBe(
        'transform 0.5s linear',
      );

      // Advance the clock past the animation duration and check that the style is removed.
      jasmine.clock().tick(501);
      await state.element.updateComplete;
      expect(state.directedGraph.style.transition).toBeFalsy();
    });

    it('panning cancels an in-progress zoom animation', async () => {
      state.element.zoomStepConfig = {
        ...DEFAULT_ZOOM_CONFIG,
        animateZoom: true,
        zoomAnimationTransition: 'transform 0.5s linear',
      };
      await state.element.updateComplete;

      // Start a zoom animation.
      state.element.zoom = 1.5;
      await state.element.updateComplete;
      expect(state.directedGraph.style.transition).toBe(
        'transform 0.5s linear',
      );

      // Advance the clock part-way through the animation.
      jasmine.clock().tick(200);
      await state.element.updateComplete;

      // Assertion to verify the animation is still in progress.
      expect(state.directedGraph.style.transition).toBe(
        'transform 0.5s linear',
      );

      // Before the animation finishes, start a pan operation.
      const pointerDownEvent = new PointerEvent('pointerdown', {
        isPrimary: true,
      });
      state.wrapper.dispatchEvent(pointerDownEvent);
      await state.element.updateComplete;

      // The transition style should be immediately removed.
      expect(state.directedGraph.style.transition).toBeFalsy();
    });
  });

  describe('Minimap Integration', () => {
    it('should not render the minimap', async () => {
      state.element.showMinimap = false;
      await state.element.updateComplete;

      const minimap = state.element.shadowRoot!.querySelector('gr-minimap');
      expect(minimap).toBeNull();
    });

    it('should render the minimap when showMinimap is true', async () => {
      state.element.showMinimap = true;
      await state.element.updateComplete;

      const minimap = state.element.shadowRoot!.querySelector('gr-minimap');
      expect(minimap).not.toBeNull();
    });

    it('should update graph position when receiving a minimap-pan event', async () => {
      state.element.showMinimap = true;
      await state.element.updateComplete;

      const minimap = state.element.shadowRoot!.querySelector('gr-minimap')!;

      // Simulate the event from the minimap
      const panDetail = {
        event: {type: 'click', event: new MouseEvent('click')},
        topLeftCorner: {x: 250, y: 150},
      };
      minimap.dispatchEvent(
        new CustomEvent('minimap-pan', {detail: panDetail}),
      );

      await state.element.updateComplete;

      // Verify the main renderer's state was updated
      expect(state.element.graphX).toBe(-250);
      expect(state.element.graphY).toBe(-150);
    });
  });

  describe('Resize Observation', () => {
    it('should use observeResizeElement for ResizeObserver if provided', async () => {
      const externalElement = document.createElement('div');
      document.body.appendChild(externalElement);

      state.element.observeResizeElement = externalElement;
      await state.element.updateComplete;

      expect(state.resizeObserverObserveSpy).toHaveBeenCalledWith(externalElement);
      document.body.removeChild(externalElement);
    });

    it('should use wrapper for ResizeObserver if observeResizeElement is not provided', async () => {
      state.element.observeResizeElement = undefined;
      await state.element.updateComplete;

      expect(state.resizeObserverObserveSpy).toHaveBeenCalledWith(state.wrapper);
    });

    it('should re-setup ResizeObserver when observeResizeElement changes', async () => {
      expect(state.resizeObserverDisconnectSpy).not.toHaveBeenCalled();

      const externalElement1 = document.createElement('div');
      const externalElement2 = document.createElement('div');
      document.body.appendChild(externalElement1);
      document.body.appendChild(externalElement2);

      state.element.observeResizeElement = externalElement1;
      await state.element.updateComplete;

      expect(state.resizeObserverObserveSpy).toHaveBeenCalledWith(externalElement1);
      expect(state.resizeObserverDisconnectSpy).toHaveBeenCalledTimes(1);

      state.element.observeResizeElement = externalElement2;
      await state.element.updateComplete;

      expect(state.resizeObserverDisconnectSpy).toHaveBeenCalledTimes(2);
      expect(state.resizeObserverObserveSpy).toHaveBeenCalledWith(externalElement2);

      document.body.removeChild(externalElement1);
      document.body.removeChild(externalElement2);
    });
  });

  describe('Static Methods', () => {
    it('getGraphTransform returns correct transform string', () => {
      expect(GraphRenderer.getGraphTransform(1.5, 10, 20)).toBe(
        'translate(15px, 30px) scale(1.5)',
      );
    });

    it('getUpdatedGraphZoomFromWheelEvent calculates discrete zoom correctly', () => {
      const wheelUp = new WheelEvent('wheel', {deltaY: -120, ctrlKey: true});
      const initialZoom = 1;
      const newZoom = GraphRenderer.getUpdatedGraphZoomFromWheelEvent(
        wheelUp,
        initialZoom,
        DEFAULT_ZOOM_CONFIG,
      );
      expect(newZoom).toBeCloseTo(initialZoom + DEFAULT_ZOOM_CONFIG.step);
    });

    it('getUpdatedGraphZoomFromWheelEvent calculates smooth zoom correctly', () => {
      const smoothZoomConfig = {...DEFAULT_ZOOM_CONFIG, enableSmoothZoom: true};
      const wheelUp = new WheelEvent('wheel', {
        deltaY: -50,
        deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      });
      // 1 * (1 + 1 * min(50 * 0.01, 0.04)) = 1 * (1 + 0.04) = 1.04
      expect(
        GraphRenderer.getUpdatedGraphZoomFromWheelEvent(
          wheelUp,
          1,
          smoothZoomConfig,
        ),
      ).toBeCloseTo(1.04, 3);
    });

    it('getScaledDimension scales dimensions', () => {
      expect(
        GraphRenderer.getScaledDimension({width: 100, height: 200}, 2),
      ).toEqual({width: 50, height: 100});
    });

    it('getRectCenter finds center', () => {
      expect(GraphRenderer.getRectCenter({width: 100, height: 200})).toEqual({
        x: 50,
        y: 100,
      });
    });

    it('parseTransitionDuration parses seconds correctly', () => {
      expect(
        GraphRenderer.parseTransitionDuration('transform 0.5s linear'),
      ).toBe(500);
    });

    it('parseTransitionDuration parses milliseconds correctly', () => {
      expect(
        GraphRenderer.parseTransitionDuration('all 300ms ease-in-out'),
      ).toBe(300);
    });

    it('parseTransitionDuration returns default for invalid string', () => {
      expect(GraphRenderer.parseTransitionDuration('invalid-string')).toBe(200);
    });
  });
});
