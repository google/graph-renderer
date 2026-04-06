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
 * @fileoverview Contains utils for the graph renderer
 */

import { BaseNode, ClampConfig, Endpoint, Point } from './interfaces';

/**
 * Clamps a numeric value to be within a specified range [min, max].
 *
 * @param config - An object containing the number, min, and max values.
 * @return The clamped number.
 */
export function clampVal(config: ClampConfig): number;
/**
 * Clamps a numeric value to be within a specified range [min, max].
 *
 * @param num - The number to clamp.
 * @param min - The lower bound of the range.
 * @param max - The upper bound of the range.
 * @return The clamped number.
 */
export function clampVal(num: number, min: number, max: number): number;
export function clampVal(
  num: number | ClampConfig,
  min?: number,
  max?: number
) {
  if (typeof num === 'object') {
    ({ num, min, max } = num);
  }
  // Default min and max to -Infinity and +Infinity if not provided.
  const lowerBound = typeof min === 'number' ? min : -Infinity;
  const upperBound = typeof max === 'number' ? max : Infinity;
  return Math.max(lowerBound, Math.min(upperBound, num));
}

/**
 * Type guard to determine if a given object is a Point.
 * It checks if the object lacks node-specific properties ('id')
 * and endpoint-specific properties ('nodeId').
 *
 * @param possiblePoint - The object to check.
 * @return True if the object has x and y properties but no node or endpoint identifiers.
 */
export function isPoint<T extends BaseNode>(
  possiblePoint: Point | T | Endpoint
): possiblePoint is Point {
  if ((possiblePoint as T).id !== undefined) {
    return false;
  }
  if ((possiblePoint as Endpoint).nodeId !== undefined) {
    return false;
  }
  return true;
}

/**
 * Converts an array of objects, each containing an 'id' property,
 * into a Map where the keys are the object IDs.
 *
 * @param arr - The array of objects to convert. Each object must have a string 'id' property.
 * @return A Map where each key is an object's id and the value is the object itself.
 */
export function convertToMapById<T extends { id: string }>(
  arr: T[]
): Map<string, T> {
  return arr.reduce((acc, cur) => {
    acc.set(cur.id, cur);
    return acc;
  }, new Map<string, T>());
}

/**
 * Checks if a wheel event occurred over a scrollable child element by
 * traversing the event's composed path.
 * @param event The wheel event.
 * @param stopAt The ancestor element at which to stop the search.
 * @return True if a scrollable element was found in the event path.
 */
export function isWheelEventOverScrollable(
  event: WheelEvent,
  stopAt: HTMLElement
): boolean {
  const path = event.composedPath();
  for (const element of path) {
    if (element === stopAt) return false; // Reached boundary

    if (element instanceof HTMLElement) {
      const style = window.getComputedStyle(element);
      const canScrollY =
        (style.overflowY === 'scroll' || style.overflowY === 'auto') &&
        element.scrollHeight > element.clientHeight;
      const canScrollX =
        (style.overflowX === 'scroll' || style.overflowX === 'auto') &&
        element.scrollWidth > element.clientWidth;

      if (
        (event.deltaY !== 0 && canScrollY) ||
        (event.deltaX !== 0 && canScrollX)
      ) {
        return true; // Found a scrollable ancestor
      }
    }
  }
  return false;
}
