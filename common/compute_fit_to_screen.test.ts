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
import { describe, it, expect } from 'vitest';
import { computeFitToScreen, getBoundingBox } from './compute_fit_to_screen';
import { BaseNode } from './interfaces';

const NODE_A: BaseNode = {
  id: 'a',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  templateId: 't',
};
const NODE_B: BaseNode = {
  id: 'b',
  x: 150,
  y: 100,
  width: 50,
  height: 150,
  templateId: 't',
};
const NODE_C_OFFSET: BaseNode = {
  id: 'c',
  x: 500,
  y: 500,
  width: 100,
  height: 100,
  templateId: 't',
};

describe('Fit to Screen Utils', () => {
  describe('getBoundingBox', () => {
    it('should return a zero-sized box for an empty array of nodes', () => {
      expect(getBoundingBox([])).toEqual({
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
      });
    });

    it('should return the box of a single node', () => {
      const expectedBox = {
        minX: NODE_A.x,
        minY: NODE_A.y,
        maxX: NODE_A.x + NODE_A.width,
        maxY: NODE_A.y + NODE_A.height,
      };
      expect(getBoundingBox([NODE_A])).toEqual(expectedBox);
    });

    it('should calculate the correct bounding box for multiple nodes', () => {
      const nodes = [NODE_A, NODE_B];
      const expectedBox = {
        minX: Math.min(NODE_A.x, NODE_B.x),
        minY: Math.min(NODE_A.y, NODE_B.y),
        maxX: Math.max(NODE_A.x + NODE_A.width, NODE_B.x + NODE_B.width),
        maxY: Math.max(NODE_A.y + NODE_A.height, NODE_B.y + NODE_B.height),
      };
      expect(getBoundingBox(nodes)).toEqual(expectedBox);
    });
  });

  describe('computeFitToScreen', () => {
    it('should return default values for an empty array of nodes', () => {
      expect(computeFitToScreen([], 1000, 800)).toEqual({
        zoom: 1,
        graphX: 0,
        graphY: 0,
      });
    });

    it('should return default values if either viewport dimension is zero', () => {
      expect(computeFitToScreen([NODE_A], 0, 800)).toEqual({
        zoom: 1,
        graphX: 0,
        graphY: 0,
      });
      expect(computeFitToScreen([NODE_A], 1000, 0)).toEqual({
        zoom: 1,
        graphX: 0,
        graphY: 0,
      });
    });

    it('should return default values for zero-dimension content', () => {
      const zeroWidthNode: BaseNode = { ...NODE_A, id: 'zero-width', width: 0 };
      const zeroHeightNode: BaseNode = {
        ...NODE_A,
        id: 'zero-height',
        height: 0,
      };

      expect(computeFitToScreen([zeroWidthNode], 1000, 800)).toEqual({
        zoom: 1,
        graphX: 0,
        graphY: 0,
      });
      expect(computeFitToScreen([zeroHeightNode], 1000, 800)).toEqual({
        zoom: 1,
        graphX: 0,
        graphY: 0,
      });
    });

    it('should fit content that is wider than the viewport', () => {
      const nodes = [NODE_A, NODE_B];
      const viewportWidth = 100;
      const viewportHeight = 800;
      const padding = 0;
      const contentWidth =
        getBoundingBox(nodes).maxX - getBoundingBox(nodes).minX;
      const expectedZoom = viewportWidth / contentWidth;

      const { zoom } = computeFitToScreen(
        nodes,
        viewportWidth,
        viewportHeight,
        padding
      );
      expect(zoom).toBeCloseTo(expectedZoom);
    });

    it('should fit content that is taller than the viewport', () => {
      const nodes = [NODE_A, NODE_B];
      const viewportWidth = 1000;
      const viewportHeight = 125;
      const padding = 0;
      const contentHeight =
        getBoundingBox(nodes).maxY - getBoundingBox(nodes).minY;
      const expectedZoom = viewportHeight / contentHeight;

      const { zoom } = computeFitToScreen(
        nodes,
        viewportWidth,
        viewportHeight,
        padding
      );
      expect(zoom).toBeCloseTo(expectedZoom);
    });

    it('should not zoom in if content is smaller than the viewport', () => {
      const nodes = [NODE_A];
      const viewportWidth = 1000;
      const viewportHeight = 800;
      const { zoom } = computeFitToScreen(nodes, viewportWidth, viewportHeight);

      // The zoom level should be capped at 1.
      expect(zoom).toBe(1);
    });

    it('should correctly center content that is smaller than the viewport', () => {
      const nodes = [NODE_A];
      const viewportWidth = 1000;
      const viewportHeight = 800;
      const padding = 0;
      const contentWidth = NODE_A.width;
      const contentHeight = NODE_A.height;

      const expectedOffsetX = (viewportWidth - contentWidth) / 2;
      const expectedOffsetY = (viewportHeight - contentHeight) / 2;
      const expectedGraphX = expectedOffsetX - NODE_A.x;
      const expectedGraphY = expectedOffsetY - NODE_A.y;

      const { zoom, graphX, graphY } = computeFitToScreen(
        nodes,
        viewportWidth,
        viewportHeight,
        padding
      );

      expect(zoom).toBe(1);
      expect(graphX).toBeCloseTo(expectedGraphX);
      expect(graphY).toBeCloseTo(expectedGraphY);
    });

    it('should correctly center content that is offset from the origin', () => {
      const nodes = [NODE_C_OFFSET];
      const viewportWidth = 1000;
      const viewportHeight = 800;
      const padding = 0;

      const contentWidth = NODE_C_OFFSET.width;
      const contentHeight = NODE_C_OFFSET.height;

      const expectedOffsetX = (viewportWidth - contentWidth) / 2;
      const expectedOffsetY = (viewportHeight - contentHeight) / 2;
      const expectedGraphX = expectedOffsetX - NODE_C_OFFSET.x;
      const expectedGraphY = expectedOffsetY - NODE_C_OFFSET.y;

      const { zoom, graphX, graphY } = computeFitToScreen(
        nodes,
        viewportWidth,
        viewportHeight,
        padding
      );

      expect(zoom).toBe(1);
      expect(graphX).toBeCloseTo(expectedGraphX);
      expect(graphY).toBeCloseTo(expectedGraphY);
    });

    it('should account for padding when calculating zoom', () => {
      const nodes = [NODE_A, NODE_B];
      const viewportWidth = 200;
      const viewportHeight = 800;
      const padding = 50;

      const effectiveViewportWidth = viewportWidth - padding * 2;
      const contentWidth =
        getBoundingBox(nodes).maxX - getBoundingBox(nodes).minX;
      const expectedZoom = effectiveViewportWidth / contentWidth;

      const { zoom } = computeFitToScreen(
        nodes,
        viewportWidth,
        viewportHeight,
        padding
      );
      expect(zoom).toBeCloseTo(expectedZoom);
    });
  });
});
