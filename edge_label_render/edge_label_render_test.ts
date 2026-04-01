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

import {type RenderableLabel} from '../common/interfaces';
import {EdgeLabelRender} from './edge_label_render';

const LABEL: RenderableLabel = {
  id: 'label1',
  x: 500,
  y: 600,
  width: 120,
  height: 40,
};

describe('EdgeLabelRender', () => {
  describe('with label property set', () => {
    const state = cleanState(async () => {
      const element = new EdgeLabelRender();
      element.label = LABEL;

      const slotContent = document.createElement('div');
      slotContent.setAttribute('slot', '');
      slotContent.textContent = 'Test Label Content';
      element.appendChild(slotContent);

      document.body.appendChild(element);
      await element.updateComplete;

      return {
        element,
        slotContent,
      };
    }, beforeEach);

    afterEach(() => {
      document.body.removeChild(state.element);
    });

    it('renders the component', () => {
      expect(state.element).toBeDefined();
      expect(state.element instanceof EdgeLabelRender).toBeTrue();
    });

    it('positions the label container correctly', () => {
      const container = state.element.shadowRoot!.querySelector(
        '.edge-label-container',
      ) as HTMLElement;
      expect(container).toBeDefined();

      const expectedX = LABEL.x - LABEL.width / 2;
      const expectedY = LABEL.y - LABEL.height / 2;

      expect(container.style.transform).toBe(
        `translate(${expectedX}px, ${expectedY}px)`,
      );
      expect(container.style.width).toBe(`${LABEL.width}px`);
      expect(container.style.height).toBe(`${LABEL.height}px`);
    });

    it('projects the slot content', () => {
      const slot = state.element.shadowRoot!.querySelector('slot')!;
      const assignedNodes = slot.assignedNodes();
      expect(assignedNodes.length).toBe(1);
      expect(assignedNodes[0]).toBe(state.slotContent);
      expect(state.element.textContent).toContain('Test Label Content');
    });
  });

  describe('without label property set', () => {
    const state = cleanState(async () => {
      const element = new EdgeLabelRender();
      document.body.appendChild(element);
      await element.updateComplete;

      return {
        element,
      };
    }, beforeEach);

    afterEach(() => {
      document.body.removeChild(state.element);
    });

    it('renders nothing', () => {
      expect(
        state.element.shadowRoot!.querySelector('.edge-label-container'),
      ).toBeNull();
    });
  });
});
