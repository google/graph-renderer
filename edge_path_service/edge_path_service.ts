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
import {
  BaseEdge,
  BaseNode,
  Point,
  Side,
  TentativeEdge,
} from '../common/interfaces';

/**
 * Enum describing the direction of the bend
 */
export enum BendDirection {
  CLOCKWISE = 'CLOCKWISE',
  COUNTER_CLOCKWISE = 'COUNTER_CLOCKWISE',
}

/**
 * Enum describing the four quadrants
 */
export enum Quadrant {
  TOP_LEFT = 'top_left',
  TOP_RIGHT = 'top_right',
  BOTTOM_LEFT = 'bottom_left',
  BOTTOM_RIGHT = 'bottom_right',
}

const QUADRANT_TO_VALUE: Record<Quadrant, number> = {
  [Quadrant.TOP_LEFT]: 0,
  [Quadrant.TOP_RIGHT]: 1,
  [Quadrant.BOTTOM_RIGHT]: 2,
  [Quadrant.BOTTOM_LEFT]: 3,
};

const VALUE_TO_QUADRANT: Record<number, Quadrant> = {
  [QUADRANT_TO_VALUE[Quadrant.TOP_LEFT]]: Quadrant.TOP_LEFT,
  [QUADRANT_TO_VALUE[Quadrant.TOP_RIGHT]]: Quadrant.TOP_RIGHT,
  [QUADRANT_TO_VALUE[Quadrant.BOTTOM_LEFT]]: Quadrant.BOTTOM_LEFT,
  [QUADRANT_TO_VALUE[Quadrant.BOTTOM_RIGHT]]: Quadrant.BOTTOM_RIGHT,
};

const QUADRANT_MULTIPLIERS: Record<Quadrant, Point> = {
  [Quadrant.TOP_LEFT]: {x: -1, y: -1},
  [Quadrant.TOP_RIGHT]: {x: 1, y: -1},
  [Quadrant.BOTTOM_LEFT]: {x: -1, y: 1},
  [Quadrant.BOTTOM_RIGHT]: {x: 1, y: 1},
};

// default port padding in pixels
const PORT_PADDING = 8;

/**
 * Abstract service for building SVG paths.
 * A concrete implementation must be provided to the DirectedGraph component.
 */
export abstract class EdgePathService {
  abstract buildPath<T extends BaseNode, M extends BaseEdge | TentativeEdge>(
    edge: M,
    from: T,
    to: T | Point,
  ): {path: string; labelPosition: Point};

  static getNeighborQuadrant(
    startQuadrant: Quadrant,
    bendDirection: BendDirection,
  ): Quadrant {
    const startValue = QUADRANT_TO_VALUE[startQuadrant];
    const endValuePreMod =
      bendDirection === BendDirection.CLOCKWISE
        ? startValue + 1
        : startValue - 1;
    const endValue =
      endValuePreMod < 0
        ? QUADRANT_TO_VALUE[Quadrant.BOTTOM_LEFT]
        : endValuePreMod % 4;

    return VALUE_TO_QUADRANT[endValue];
  }

  static getOppositeDirection(direction: BendDirection) {
    return direction === BendDirection.CLOCKWISE
      ? BendDirection.COUNTER_CLOCKWISE
      : BendDirection.CLOCKWISE;
  }

  /**
   * Builds an SVG curve (elbow) from a start point to an ending quadrant with a specified bend direction and radius
   */
  static getElbow(
    start: Point,
    endQuadrant: Quadrant,
    bendDirection: BendDirection,
    radius: number,
  ): {path: string; end: Point} {
    const endQuadrantMultiplier = QUADRANT_MULTIPLIERS[endQuadrant];

    const end = {
      x: start.x + endQuadrantMultiplier.x * radius,
      y: start.y + endQuadrantMultiplier.y * radius,
    };

    const controlQuadrant = EdgePathService.getNeighborQuadrant(
      endQuadrant,
      EdgePathService.getOppositeDirection(bendDirection), // need the direction from perspective of end
    );

    const controlPointQuadrantMultiplier =
      QUADRANT_MULTIPLIERS[controlQuadrant];

    const controlXMultiplier =
      controlPointQuadrantMultiplier.x === endQuadrantMultiplier.x
        ? controlPointQuadrantMultiplier.x
        : 0;
    const controlYMultiplier =
      controlPointQuadrantMultiplier.y === endQuadrantMultiplier.y
        ? controlPointQuadrantMultiplier.y
        : 0;

    const controlPoint = {
      x: start.x + controlXMultiplier * radius,
      y: start.y + controlYMultiplier * radius,
    };
    const path = `M ${start.x} ${start.y} Q ${controlPoint.x} ${controlPoint.y} ${end.x} ${end.y}`;

    return {path, end};
  }

  /**
   * Builds an SVG line from a start point to the endpoint calculated from an offset
   */
  static getLine(start: Point, endOffset: Point): {path: string; end: Point} {
    const end = {x: endOffset.x + start.x, y: endOffset.y + start.y};
    const path = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    return {path, end};
  }

  /**
   * Calculates the control points for a bezier curve between two points. If provided,
   * the sides are used to determine whether the line should loop "around" the nodes
   * or go directly between them.
   */
  static getControlPointsForBezierCurve(
    start: Point,
    end: Point,
    sides?: {start: Side; end: Side; curvature: number} | null,
  ): Point[] {
    if (!sides) {
      const startIsAboveEnd = start.y < end.y;

      if (startIsAboveEnd) {
        return [
          {x: start.x, y: (start.y + end.y) / 2},
          {x: end.x, y: (start.y + end.y) / 2},
        ];
      }
      return [
        {x: (start.x + end.x) / 2, y: start.y},
        {x: (start.x + end.x) / 2, y: end.y},
      ];
    }

    const startControlPoint = EdgePathService.getControlPointForSide(
      sides.start,
      start,
      end,
      sides.curvature,
    );

    const endControlPoint = EdgePathService.getControlPointForSide(
      sides.end,
      end,
      start,
      sides.curvature,
    );

    return [startControlPoint, endControlPoint];
  }

  /**
   * Calculates a control point based on the side where the line connects to the
   * node.
   * @param sideA the side pointA is on along the node
   * @param pointA the endpoint on the line connecting to the node
   * @param pointB the endpoint on the other side of the line
   * @param curvature the amount of curvature to apply to any lines that need to loop around a node
   */
  static getControlPointForSide(
    sideA: Side,
    pointA: Point,
    pointB: Point,
    curvature: number,
  ): Point {
    if (sideA === Side.LEFT) {
      const distance = pointA.x - pointB.x;

      return {
        x:
          pointA.x - EdgePathService.getControlPointOffset(distance, curvature),
        y: pointA.y,
      };
    }

    if (sideA === Side.RIGHT) {
      const distance = pointB.x - pointA.x;

      return {
        x:
          pointA.x + EdgePathService.getControlPointOffset(distance, curvature),
        y: pointA.y,
      };
    }

    if (sideA === Side.TOP) {
      const distance = pointA.y - pointB.y;
      return {
        x: pointA.x,
        y:
          pointA.y - EdgePathService.getControlPointOffset(distance, curvature),
      };
    }

    const distance = pointB.y - pointA.y;
    return {
      x: pointA.x,
      y: pointA.y + EdgePathService.getControlPointOffset(distance, curvature),
    };
  }

  /**
   * Returns the position (offset) of the control point for a bezier curve. Negative
   * values of distance imply that the line crosses back through a node, so the
   * control point is in the opposite direction of the line such that the curve
   * appears to loop around the node.
   *
   */
  static getControlPointOffset(distance: number, curvature: number): number {
    return distance >= 0
      ? 0.5 * distance
      : curvature * 25 * Math.sqrt(Math.abs(distance));
  }

  static getPortPaddingOffsets(padding: number): Record<Side, Point> {
    return {
      [Side.LEFT]: {x: -1 * padding, y: 0},
      [Side.RIGHT]: {x: padding, y: 0},
      [Side.TOP]: {x: 0, y: -1 * padding},
      [Side.BOTTOM]: {x: 0, y: padding},
    };
  }

  static getPortOffsetForNode<T extends BaseNode>(
    portId: string | undefined,
    node: T,
    portPadding = PORT_PADDING,
  ): Point {
    const {width, height, ports} = node;
    if (!ports || !portId) {
      return {x: 0, y: 0};
    }

    const port = ports.find((port) => port.id === portId);

    if (!port) {
      return {x: 0, y: 0};
    }

    const {side} = port;
    const portsAlongSide = ports.filter((port) => port.side === side);
    const idx = portsAlongSide.findIndex((port) => port.id === portId);
    const portsAlongSideCount = portsAlongSide.length;
    const portOffset = EdgePathService.getPortPaddingOffsets(portPadding)[side];

    if (side === Side.LEFT || side === Side.RIGHT) {
      const offsetY =
        Math.floor(height / (portsAlongSideCount + 1)) * (idx + 1);
      const offsetX = side === Side.LEFT ? 0 : width;
      return {x: offsetX + portOffset.x, y: offsetY + portOffset.y};
    }

    const offsetY = side === Side.TOP ? 0 : height;
    const offsetX = Math.floor(width / (portsAlongSideCount + 1)) * (idx + 1);
    return {x: offsetX + portOffset.x, y: offsetY + portOffset.y};
  }
}
