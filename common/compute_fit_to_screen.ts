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
/**
 * @fileoverview Contains utils for the "fit to screen" graph functionality.
 */

import { BaseNode } from './interfaces';

/**
 * Represents the bounding box of a rectangle.
 */
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Represents an infinite bounding box, used as a starting point for
 * calculations.
 */
export const INFINITE_BOUNDING_BOX: BoundingBox = {
  minX: Number.POSITIVE_INFINITY,
  minY: Number.POSITIVE_INFINITY,
  maxX: Number.NEGATIVE_INFINITY,
  maxY: Number.NEGATIVE_INFINITY,
};

/**
 * Returns the bounding box for a single node.
 */
function getBoundingBoxForNode(node: BaseNode): BoundingBox {
  return {
    minX: node.x,
    minY: node.y,
    maxX: node.x + node.width,
    maxY: node.y + node.height,
  };
}

/**
 * Updates an existing bounding box to include another bounding box.
 */
function updateBoundingBox(
  initialBox: BoundingBox,
  boxToUpdateWith: BoundingBox
): BoundingBox {
  return {
    minX: Math.min(initialBox.minX, boxToUpdateWith.minX),
    minY: Math.min(initialBox.minY, boxToUpdateWith.minY),
    maxX: Math.max(initialBox.maxX, boxToUpdateWith.maxX),
    maxY: Math.max(initialBox.maxY, boxToUpdateWith.maxY),
  };
}

/**
 * Returns the bounding box that encompasses a list of nodes.
 */
export function getBoundingBox(nodes: BaseNode[]): BoundingBox {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  const nodeBoundingBoxes = nodes.map(getBoundingBoxForNode);
  return nodeBoundingBoxes.reduce(
    (acc, box) => updateBoundingBox(acc, box),
    INFINITE_BOUNDING_BOX
  );
}

/**
 * Computes the optimal zoom and position to fit all nodes within a given
 * viewport.
 *
 * @param nodes The array of nodes to be displayed.
 * @param viewportWidth The width of the container element.
 * @param viewportHeight The height of the container element.
 * @param padding An optional padding amount in pixels to leave around the graph.
 * @return An object with the calculated zoom, graphX, and graphY.
 */
export function computeFitToScreen(
  nodes: BaseNode[],
  viewportWidth: number,
  viewportHeight: number,
  padding = 50
) {
  if (nodes.length === 0 || viewportWidth === 0 || viewportHeight === 0) {
    return { zoom: 1, graphX: 0, graphY: 0 };
  }

  const boundingBox = getBoundingBox(nodes);
  const contentWidth = boundingBox.maxX - boundingBox.minX;
  const contentHeight = boundingBox.maxY - boundingBox.minY;

  if (contentWidth === 0 || contentHeight === 0) {
    return { zoom: 1, graphX: 0, graphY: 0 };
  }

  const effectiveViewportWidth = viewportWidth - padding * 2;
  const effectiveViewportHeight = viewportHeight - padding * 2;

  const zoomX = effectiveViewportWidth / contentWidth;
  const zoomY = effectiveViewportHeight / contentHeight;
  const zoom = Math.min(zoomX, zoomY, 1);

  const scaledContentWidth = contentWidth * zoom;
  const scaledContentHeight = contentHeight * zoom;

  const offsetX = (viewportWidth - scaledContentWidth) / 2;
  const offsetY = (viewportHeight - scaledContentHeight) / 2;

  const graphX = offsetX / zoom - boundingBox.minX;
  const graphY = offsetY / zoom - boundingBox.minY;

  return { zoom, graphX, graphY };
}
