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
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { BaseNode, Endpoint } from './interfaces';
import * as utils from './utils';

describe('GraphRenderer Utils', () => {
  describe('clampVal', () => {
    it('clamps a value to a range', () => {
      expect(utils.clampVal(1, 2, 3)).toEqual(2);
      expect(utils.clampVal(2.5, 2, 3)).toEqual(2.5);
      expect(utils.clampVal(3, 2, 3)).toEqual(3);
      expect(utils.clampVal(0, 2, 3)).toEqual(2);
      expect(utils.clampVal(4, 2, 3)).toEqual(3);
    });

    it('handles a config object', () => {
      expect(utils.clampVal({ num: 1, min: 2, max: 3 })).toEqual(2);
      expect(utils.clampVal({ num: 2.5, min: 2, max: 3 })).toEqual(2.5);
      expect(utils.clampVal({ num: 4, min: 2, max: 3 })).toEqual(3);
    });

    it('handles missing min or max', () => {
      expect(utils.clampVal(5, -Infinity, 10)).toEqual(5);
      expect(utils.clampVal(5, 0, Infinity)).toEqual(5);
    });
  });

  describe('isPoint', () => {
    it('returns false for an endpoint', () => {
      const endpoint: Endpoint = { nodeId: 'node', portId: 'port' };
      expect(utils.isPoint(endpoint)).toBe(false);
    });

    it('returns false for a node', () => {
      const node: BaseNode = {
        id: 'node',
        templateId: 'node',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      };
      expect(utils.isPoint(node)).toBe(false);
    });

    it('returns true for a point', () => {
      const point = { x: 1, y: 2 };
      expect(utils.isPoint(point)).toBe(true);
    });
  });

  describe('convertToMapById', () => {
    it("converts an array of objects to a map keyed by the object's id", () => {
      const nodes = [
        { id: 'node1', val: 1 },
        { id: 'node2', val: 2 },
      ];
      const nodeMap = utils.convertToMapById(nodes);
      expect(nodeMap.size).toBe(2);
      expect(nodeMap.get('node1')).toEqual({ id: 'node1', val: 1 });
      expect(nodeMap.get('node2')).toEqual({ id: 'node2', val: 2 });
    });

    it('handles an empty array', () => {
      const nodes: Array<{ id: string }> = [];
      const nodeMap = utils.convertToMapById(nodes);
      expect(nodeMap.size).toBe(0);
    });
  });

  describe('isWheelEventOverScrollable', () => {
    let wrapper: HTMLElement;
    let scrollableChild: HTMLElement;
    let innerContent: HTMLElement;
    let nonScrollableChild: HTMLElement;

    beforeEach(() => {
      wrapper = document.createElement('div');
      scrollableChild = document.createElement('div');
      innerContent = document.createElement('div');
      nonScrollableChild = document.createElement('div');

      scrollableChild.style.overflowY = 'auto';
      scrollableChild.style.height = '50px';
      innerContent.style.height = '100px'; // Makes parent scrollable

      scrollableChild.appendChild(innerContent);
      wrapper.appendChild(scrollableChild);
      wrapper.appendChild(nonScrollableChild);
      document.body.appendChild(wrapper);
    });

    afterEach(() => {
      document.body.removeChild(wrapper);
    });

    it('should return true for an event over a scrollable element', () => {
      // Manually force JSDOM to think the element has content taller than its box
      Object.defineProperty(scrollableChild, 'scrollHeight', {
        value: 100,
        configurable: true,
      });
      Object.defineProperty(scrollableChild, 'clientHeight', {
        value: 50,
        configurable: true,
      });

      // A non-zero deltaY is required to simulate a scroll.
      const event = new WheelEvent('wheel', {
        bubbles: true,
        composed: true,
        deltaY: 10,
      });
      // Mock composedPath to simulate the event originating from the inner content
      Object.defineProperty(event, 'composedPath', {
        value: () => [innerContent, scrollableChild, wrapper],
      });

      expect(utils.isWheelEventOverScrollable(event, wrapper)).toBe(true);
    });

    it('should return false for an event over a non-scrollable element', () => {
      const event = new WheelEvent('wheel', {
        bubbles: true,
        composed: true,
        deltaY: 10,
      });
      Object.defineProperty(event, 'composedPath', {
        value: () => [nonScrollableChild, wrapper],
      });

      expect(utils.isWheelEventOverScrollable(event, wrapper)).toBe(false);
    });

    it('should return false if the search stops before the scrollable element', () => {
      const event = new WheelEvent('wheel', {
        bubbles: true,
        composed: true,
        deltaY: 10,
      });
      Object.defineProperty(event, 'composedPath', {
        value: () => [innerContent, scrollableChild, wrapper],
      });
      // Stop the search at the scrollable child itself, so it's not considered.
      expect(utils.isWheelEventOverScrollable(event, scrollableChild)).toBe(
        false
      );
    });

    it('should return false if there is no scroll delta', () => {
      // deltaY is 0, so no scroll is happening.
      const event = new WheelEvent('wheel', {
        bubbles: true,
        composed: true,
        deltaY: 0,
      });
      Object.defineProperty(event, 'composedPath', {
        value: () => [innerContent, scrollableChild, wrapper],
      });

      expect(utils.isWheelEventOverScrollable(event, wrapper)).toBe(false);
    });
  });
});
