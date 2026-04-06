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

import {
  Scuba,
  customMatchers,
} from 'google3/testing/karma/karma_scuba_framework';
import {cleanState} from '../testing/test_utils';

import {
  type RenderableEdge,
  EdgeAnimation,
  EdgeDash,
  EdgeOpacity,
  EdgeStyle,
  EndpointMarker,
  type CustomEndpointMarker,
} from '../common/interfaces';
import {BUILT_IN_MARKER_DEFINITIONS, EdgeCanvas} from './edge_canvas';

// Helper to create default styles
function getStyleWithDefaults(style: Partial<EdgeStyle>): EdgeStyle {
  return {
    color: 'gray',
    width: 1,
    dash: EdgeDash.SOLID,
    animation: EdgeAnimation.NONE,
    opacity: EdgeOpacity.DEFAULT,
    fromMarker: EndpointMarker.NONE,
    toMarker: EndpointMarker.NONE,
    interactive: true,
    ...style,
  };
}

const EDGE_1: RenderableEdge = {
  id: 'edge1',
  path: 'M10 60 C100 60 100 240 250 240',
  labelPosition: {x: 0, y: 0},
  style: getStyleWithDefaults({
    fromMarker: EndpointMarker.NONE,
    toMarker: EndpointMarker.ARROW,
  }),
  from: {nodeId: 'node1'},
  to: {nodeId: 'node2'},
};

const EDGE_2: RenderableEdge = {
  id: 'edge2',
  path: 'M10,240 L100,10',
  labelPosition: {x: 0, y: 0},
  style: getStyleWithDefaults({
    toMarker: EndpointMarker.TRIANGLE,
    width: 2,
    color: 'blue',
  }),
  from: {nodeId: 'node1'},
  to: {nodeId: 'node3'},
};

describe('EdgeCanvas', () => {
  const scuba = new Scuba(
    './edge_canvas/g3doc/scuba_goldens',
  );

  beforeAll(() => {
    jasmine.addMatchers(customMatchers);
  });

  const state = cleanState(async () => {
    const element = new EdgeCanvas();
    element.style.width = '300px';
    element.style.height = '300px';
    element.style.position = 'relative';
    document.body.appendChild(element);
    await element.updateComplete; // Wait for initial render

    const edgeClickSpy = jasmine.createSpy('edge-click');
    element.addEventListener('edge-click', edgeClickSpy);

    return {
      element,
      edgeClickSpy,
    };
  }, beforeEach);

  afterEach(() => {
    document.body.removeChild(state.element);
  });

  it('renders two edges', async () => {
    state.element.edges = [EDGE_1, EDGE_2];
    await state.element.updateComplete;
    await state.element.updateComplete; // Wait for effects

    expect(
      await scuba.diffElement('edge_canvas_two_edges', 'gr-edge-canvas'),
    ).toHavePassed();
  });

  it('renders colored edges with markers', async () => {
    state.element.edges = [
      {
        ...EDGE_1,
        style: getStyleWithDefaults({
          color: 'red',
          toMarker: EndpointMarker.CIRCLE,
        }),
      },
      {
        ...EDGE_2,
        style: getStyleWithDefaults({
          color: 'green',
          fromMarker: EndpointMarker.SQUARE,
          toMarker: EndpointMarker.ARROW,
        }),
      },
    ];
    await state.element.updateComplete;
    await state.element.updateComplete;

    expect(
      await scuba.diffElement('edge_canvas_colored', 'gr-edge-canvas'),
    ).toHavePassed();
  });

  it('emits edge-click when an interactive edge is clicked', async () => {
    state.element.edges = [EDGE_1]; // EDGE_1 is interactive by default
    await state.element.updateComplete;
    await state.element.updateComplete;

    const pathElement =
        state.element.shadowRoot?.querySelector('path.edge-hit-area');
    expect(pathElement).not.toBeNull();

    // Simulate click on the path
    pathElement!.dispatchEvent(
      new MouseEvent('click', {bubbles: true, composed: true}),
    );

    expect(state.edgeClickSpy).toHaveBeenCalledTimes(1);
    const eventDetail = state.edgeClickSpy.calls.mostRecent().args[0].detail;
    expect(eventDetail.id).toEqual(EDGE_1.id);
  });

  it('does not emit edge-click for non-interactive edge', async () => {
    const nonInteractiveEdge = {
      ...EDGE_1,
      id: 'edge-non-interactive',
      style: getStyleWithDefaults({interactive: false}),
    };
    state.element.edges = [nonInteractiveEdge];
    await state.element.updateComplete;
    await state.element.updateComplete;

    const pathElement =
        state.element.shadowRoot?.querySelector('path.edge-hit-area');
    expect(pathElement).not.toBeNull();
    pathElement!.dispatchEvent(
      new MouseEvent('click', {bubbles: true, composed: true}),
    );

    expect(state.edgeClickSpy).not.toHaveBeenCalled();
  });

  it('applies only "edge" class and defaults when style is not provided', async () => {
    const edgeWithoutStyle: RenderableEdge = {
      id: 'edge-no-style',
      path: 'M10 10 L 290 290',
      labelPosition: {x: 0, y: 0},
      // style property is missing
      from: {nodeId: 'nodeA'},
      to: {nodeId: 'nodeB'},
    } as RenderableEdge;

    state.element.edges = [edgeWithoutStyle];
    await state.element.updateComplete;
    await state.element.updateComplete;

    const pathElement =
        state.element.shadowRoot?.querySelector('path:not(.edge-hit-area)');
    expect(pathElement).not.toBeNull();
    // Check classes
    expect(pathElement!.getAttribute('class')).toBe('edge');

    // Check marker defaults
    expect(pathElement!.getAttribute('marker-start')).toBe('none');
    expect(pathElement!.getAttribute('marker-end')).toBe('none');

    // Check stroke color default
    expect(pathElement!.getAttribute('stroke')).toBe('gray');

    // Check that no marker definitions were created for a "undefined" color
    const markerDefs =
      state.element.shadowRoot?.querySelectorAll('defs marker');
    markerDefs?.forEach((marker) => {
      expect(marker.id).not.toContain('undefined');
    });
  });

  describe('with custom markers', () => {
    it('renders custom markers correctly', async () => {
      const customMarkers: CustomEndpointMarker[] = [
        {
          id: 'diamond',
          color: 'black',
          path: 'M 5 0 L 10 5 L 5 10 L 0 5 Z',
          refX: 5,
          refY: 5,
          markerWidth: 6,
          markerHeight: 6,
          orient: 'auto-start-reverse',
        },
        {
          id: 'custom-thin-arrow',
          ...BUILT_IN_MARKER_DEFINITIONS[EndpointMarker.ARROW],
          path: 'M 0 0 L 10 5 L 0 10 L 6 5 Z',
          color: 'green',
        },
      ];
      state.element.customEndpointMarkers = customMarkers;
      state.element.edges = [
        {
          ...EDGE_1,
          style: getStyleWithDefaults({
            fromMarker: 'diamond',
            toMarker: 'custom-thin-arrow',
          }),
        },
        {
          ...EDGE_2,
          style: getStyleWithDefaults({
            fromMarker: EndpointMarker.CIRCLE,
            toMarker: EndpointMarker.SQUARE,
          }),
        },
      ];
      await state.element.updateComplete;
      await state.element.updateComplete;

      expect(
        await scuba.diffElement('edge_canvas_custom_markers', 'gr-edge-canvas'),
      ).toHavePassed();
    });
  });
});
