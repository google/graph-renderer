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
import { isPoint } from '../common/utils';
import { EdgePathService } from './edge_path_service';

/** A line */
export interface Line {
  start: Point;
  end: Point;
}

interface OrientationAmount {
  amount: number;
  markerOrientation: MarkerOrientation;
}

/** The orientations a marker can face */
export enum MarkerOrientation {
  UP = 'up',
  DOWN = 'down',
  LEFT = 'left',
  RIGHT = 'right',
}

const REVERSE_ORIENTATION_MAP: Record<MarkerOrientation, MarkerOrientation> = {
  [MarkerOrientation.UP]: MarkerOrientation.DOWN,
  [MarkerOrientation.DOWN]: MarkerOrientation.UP,
  [MarkerOrientation.LEFT]: MarkerOrientation.RIGHT,
  [MarkerOrientation.RIGHT]: MarkerOrientation.LEFT,
};

const ORIGIN: Point = {
  x: 0,
  y: 0,
};

/**
 * The angle in degrees relative to the positive X axis that the normal vector
 * of the side points in, relative to the x-axis when turning counter-clockwise
 */
const SIDE_TO_NORMAL_ANGLE: Record<Side, number> = {
  [Side.TOP]: 90,
  [Side.BOTTOM]: 270,
  [Side.LEFT]: 180,
  [Side.RIGHT]: 0,
};

/**
 * The fixed endpoint(s) of an edge.
 */
export enum FixedEnd {
  FROM = 'from',
  TO = 'to',
  BOTH = 'both',
  NONE = 'none', // both ends of the edge float
}

/**
 * The behavior when an edge is floating.
 */
export enum FloatingBehavior {
  CONTINUOUS = 'continuous',
  DISCRETE = 'discrete',
  DISCRETE_MINIMIZE_NORMAL_ANGLE = 'discrete_minimize_normal_angle',
}

/**
 * Configuration for the floating edges
 */
export interface FloatingEdgeConfiguration {
  fixedEnd: FixedEnd;
  floatingBehavior?: FloatingBehavior;
}

/**
 * Configuration for how to offset the label of a short edge.
 */
export interface ShortEdgeLabelOffsetConfiguration {
  maxEdgeLength: number;
  horizontalOffset: number;
}

const DEFAULT_PORT_PADDING = 4; //px
const DEFAULT_FLOATING_EDGE_CONFIGURATION: FloatingEdgeConfiguration = {
  fixedEnd: FixedEnd.BOTH,
  floatingBehavior: FloatingBehavior.CONTINUOUS,
};

/**
 * Default implementation of the Edge Path Service
 */
export class DefaultEdgePathService extends EdgePathService {
  protected portPadding: number;
  protected shortEdgeLabelOffsetConfiguration: ShortEdgeLabelOffsetConfiguration | null;
  protected readonly floatingEdgeConfiguration: FloatingEdgeConfiguration;

  constructor(config?: {
    portPadding?: number;
    shortEdgeLabelOffsetConfiguration?: ShortEdgeLabelOffsetConfiguration | null;
    floatingEdgeConfiguration?: FloatingEdgeConfiguration;
  }) {
    super();
    this.portPadding = config?.portPadding ?? DEFAULT_PORT_PADDING;
    this.shortEdgeLabelOffsetConfiguration =
      config?.shortEdgeLabelOffsetConfiguration ?? null;
    this.floatingEdgeConfiguration =
      config?.floatingEdgeConfiguration ?? DEFAULT_FLOATING_EDGE_CONFIGURATION;
  }

  protected get fixedEnd() {
    return this.floatingEdgeConfiguration.fixedEnd;
  }

  protected get floatingBehavior() {
    return (
      this.floatingEdgeConfiguration.floatingBehavior ??
      FloatingBehavior.CONTINUOUS
    );
  }

  buildPath<T extends BaseNode, M extends BaseEdge | TentativeEdge>(
    edge: M,
    from: T,
    to: T | Point
  ): { path: string; labelPosition: Point } {
    if (isPoint(to)) {
      return this.buildPathToPoint(edge, from, to);
    } else {
      return this.buildPathToNode(edge, from, to as T);
    }
  }

  static addPoints(point1: Point, point2: Point): Point {
    return { x: point1.x + point2.x, y: point1.y + point2.y };
  }

  protected transformNode<T extends BaseNode>(node: T): T {
    return node;
  }

  private buildPathToNode<
    T extends BaseNode,
    M extends BaseEdge | TentativeEdge,
  >(edge: M, from: T, to: T): { path: string; labelPosition: Point } {
    from = this.transformNode(from);
    to = this.transformNode(to);

    const returnVal = { path: '', labelPosition: { ...ORIGIN } };

    const { portId: fromPortId } = edge.from;
    if (isPoint(edge.to)) {
      return returnVal;
    }
    const { portId: toPortId } = edge.to;

    const fromPortOffset = EdgePathService.getPortOffsetForNode(
      fromPortId,
      from,
      this.portPadding
    );
    const toPortOffset = EdgePathService.getPortOffsetForNode(
      toPortId,
      to,
      this.portPadding
    );
    const fixedStartPoint = DefaultEdgePathService.addPoints(
      from,
      fromPortOffset
    );
    const fixedEndPoint = DefaultEdgePathService.addPoints(to, toPortOffset);

    let startPoint = fixedStartPoint;
    let orientStartMarker = false;

    let endPoint = fixedEndPoint;
    let orientEndMarker = false;

    if (
      this.fixedEnd === FixedEnd.NONE &&
      this.floatingBehavior === FloatingBehavior.CONTINUOUS
    ) {
      const intersectionPoints =
        DefaultEdgePathService.getIntersectionPointsOnLineBetweenCenters(
          from,
          to,
          this.portPadding
        );

      if (intersectionPoints) {
        startPoint = intersectionPoints.from;
        endPoint = intersectionPoints.to;
      }
    } else if (
      this.fixedEnd === FixedEnd.NONE &&
      (this.floatingBehavior === FloatingBehavior.DISCRETE ||
        this.floatingBehavior ===
          FloatingBehavior.DISCRETE_MINIMIZE_NORMAL_ANGLE)
    ) {
      const lineFunction =
        this.floatingBehavior ===
        FloatingBehavior.DISCRETE_MINIMIZE_NORMAL_ANGLE
          ? DefaultEdgePathService.getLineToMinimizeAngleToNormal
          : DefaultEdgePathService.getLineToClosestSide;

      const shortestLine = lineFunction(from, to, this.portPadding);

      startPoint = shortestLine.start;
      endPoint = shortestLine.end;
      orientStartMarker = true;
      orientEndMarker = true;
    } else if (this.fixedEnd === FixedEnd.TO) {
      startPoint = DefaultEdgePathService.getClosestPointOnFloatingNode(
        fixedEndPoint,
        from
      );
    } else if (this.fixedEnd === FixedEnd.FROM) {
      endPoint = DefaultEdgePathService.getClosestPointOnFloatingNode(
        fixedStartPoint,
        to
      );
    }

    const startPointSide = DefaultEdgePathService.getPointSide(
      startPoint,
      from
    );
    const endPointSide = DefaultEdgePathService.getPointSide(endPoint, to);
    const sides =
      startPointSide && endPointSide
        ? {
            start: startPointSide,
            end: endPointSide,
            curvature: 0.25,
          }
        : null;

    const [m1, m2] = EdgePathService.getControlPointsForBezierCurve(
      startPoint,
      endPoint,
      sides
    );

    const endSafe = { x: endPoint.x ?? 0, y: endPoint.y ?? 0 };

    let horizontalOffset = 0;
    if (this.shortEdgeLabelOffsetConfiguration) {
      const distance = Math.sqrt(
        Math.pow(endSafe.x - startPoint.x, 2) +
          Math.pow(endSafe.y - startPoint.y, 2)
      );

      const { maxEdgeLength, horizontalOffset: offset } =
        this.shortEdgeLabelOffsetConfiguration;

      horizontalOffset = distance <= maxEdgeLength ? offset : 0;
    }

    const midpoint = DefaultEdgePathService.getCubicBezierMidpoint([
      startPoint,
      m1,
      m2,
      endSafe,
    ]);

    const startOrientationSegment = orientStartMarker
      ? DefaultEdgePathService.getOrientationSegment(
          startPoint,
          DefaultEdgePathService.getMarkerOrientation(startPoint, from, 'start')
        )
      : '';

    const endOrientationSegment = orientEndMarker
      ? DefaultEdgePathService.getOrientationSegment(
          endPoint,
          DefaultEdgePathService.getMarkerOrientation(endPoint, to, 'end')
        )
      : '';

    const path = `${startOrientationSegment} M${startPoint.x} ${startPoint.y} C${m1.x} ${m1.y} ${m2.x} ${m2.y} ${endPoint.x} ${endPoint.y} ${endOrientationSegment}`;

    return {
      path: path.trim(),
      labelPosition: { x: midpoint.x + horizontalOffset, y: midpoint.y },
    };
  }

  private buildPathToPoint<
    T extends BaseNode,
    M extends BaseEdge | TentativeEdge,
  >(edge: M, from: T, to: Point): { path: string; labelPosition: Point } {
    const fromPortId = edge.from.portId;

    const fromPortOffset = EdgePathService.getPortOffsetForNode(
      fromPortId,
      from,
      this.portPadding
    );

    const startPoint = DefaultEdgePathService.addPoints(from, fromPortOffset);

    return {
      path: `M${startPoint.x},${startPoint.y} L${to.x},${to.y}`,
      labelPosition: DefaultEdgePathService.linearInterpolate(
        startPoint,
        to,
        0.5
      ),
    };
  }

  static getClosestPointOnFloatingNode<T extends BaseNode>(
    fixedPoint: Point,
    floatingNode: T
  ): Point {
    const top = floatingNode.y;
    const bottom = floatingNode.y + floatingNode.height;
    const left = floatingNode.x;
    const right = floatingNode.x + floatingNode.width;

    const y =
      fixedPoint.y < top ? top : fixedPoint.y > bottom ? bottom : fixedPoint.y;
    const x =
      fixedPoint.x < left ? left : fixedPoint.x > right ? right : fixedPoint.x;
    return { x, y };
  }

  static getOrientationSegment(
    endPoint: Point,
    orientation: MarkerOrientation,
    segmentLength = 1
  ): string {
    const moveString = `M${endPoint.x},${endPoint.y}`;

    if (orientation === MarkerOrientation.UP) {
      return `${moveString} L${endPoint.x},${endPoint.y - segmentLength}`;
    }
    if (orientation === MarkerOrientation.DOWN) {
      return `${moveString} L${endPoint.x},${endPoint.y + segmentLength}`;
    }
    if (orientation === MarkerOrientation.LEFT) {
      return `${moveString} L${endPoint.x - segmentLength},${endPoint.y}`;
    }
    if (orientation === MarkerOrientation.RIGHT) {
      return `${moveString} L${endPoint.x + segmentLength},${endPoint.y}`;
    }
    return moveString;
  }

  static getPointSide(lineEnd: Point, relatedNode: BaseNode): Side | null {
    const segments =
      DefaultEdgePathService.getLineSegmentsForBoundingRect(relatedNode);
    const buffer = 0.01; // Small buffer to handle floating point inaccuracies
    if (segments[Side.TOP].start.y - lineEnd.y > buffer) {
      return Side.TOP;
    }
    if (lineEnd.y - segments[Side.BOTTOM].start.y > buffer) {
      return Side.BOTTOM;
    }
    if (segments[Side.LEFT].start.x - lineEnd.x > buffer) {
      return Side.LEFT;
    }
    if (lineEnd.x - segments[Side.RIGHT].start.x > buffer) {
      return Side.RIGHT;
    }
    return null;
  }

  static getMarkerOrientation(
    lineEnd: Point,
    relatedNode: BaseNode,
    markerPosition: 'start' | 'end'
  ) {
    const segments =
      DefaultEdgePathService.getLineSegmentsForBoundingRect(relatedNode);

    const aboveAmt: OrientationAmount = {
      amount: Math.max(0, segments[Side.TOP].start.y - lineEnd.y),
      markerOrientation: MarkerOrientation.DOWN,
    };

    const belowAmt: OrientationAmount = {
      amount: Math.max(0, lineEnd.y - segments[Side.BOTTOM].start.y),
      markerOrientation: MarkerOrientation.UP,
    };

    const leftAmt: OrientationAmount = {
      amount: Math.max(0, segments[Side.LEFT].start.x - lineEnd.x),
      markerOrientation: MarkerOrientation.RIGHT,
    };

    const rightAmt: OrientationAmount = {
      amount: Math.max(0, lineEnd.x - segments[Side.RIGHT].start.x),
      markerOrientation: MarkerOrientation.LEFT,
    };
    const allPotentialOrientations = [aboveAmt, belowAmt, leftAmt, rightAmt];
    allPotentialOrientations.sort(
      (a: OrientationAmount, b: OrientationAmount): number =>
        a.amount - b.amount
    );
    const max = allPotentialOrientations[allPotentialOrientations.length - 1];
    return markerPosition === 'end'
      ? max.markerOrientation
      : DefaultEdgePathService.getReverseOrientation(max.markerOrientation);
  }

  static getReverseOrientation(orientation: MarkerOrientation) {
    return REVERSE_ORIENTATION_MAP[orientation];
  }

  static getCubicBezierMidpoint(points: Point[]): Point {
    const midpointPercentage = 0.5;
    if (points.length !== 4) {
      throw new Error(
        'Must provide 4 points (start, end, control points) for cubic bezier'
      );
    }
    const helperPoints: Point[] = [];
    for (let i = 1; i < 4; i++) {
      helperPoints.push(
        DefaultEdgePathService.linearInterpolate(
          points[i - 1],
          points[i],
          midpointPercentage
        )
      );
    }
    helperPoints.push(
      DefaultEdgePathService.linearInterpolate(
        helperPoints[0],
        helperPoints[1],
        midpointPercentage
      )
    );
    helperPoints.push(
      DefaultEdgePathService.linearInterpolate(
        helperPoints[1],
        helperPoints[2],
        midpointPercentage
      )
    );
    return DefaultEdgePathService.linearInterpolate(
      helperPoints[3],
      helperPoints[4],
      midpointPercentage
    );
  }

  static linearInterpolate(
    point1: Point,
    point2: Point,
    interpolatePercent: number
  ): Point {
    if (interpolatePercent < 0 || interpolatePercent > 1) {
      throw new Error('interpolatePercent must be between 0 and 1');
    }
    return {
      x: (point2.x - point1.x) * interpolatePercent + point1.x,
      y: (point2.y - point1.y) * interpolatePercent + point1.y,
    };
  }

  static getNodeCenter(node: BaseNode): Point {
    return {
      x: node.x + node.width / 2,
      y: node.y + node.height / 2,
    };
  }

  static getLineIntersection(line1: Line, line2: Line): Point | null {
    const { x: x1, y: y1 } = line1.start;
    const { x: x2, y: y2 } = line1.end;
    const { x: x3, y: y3 } = line2.start;
    const { x: x4, y: y4 } = line2.end;
    if ((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4)) return null;
    const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (denominator === 0) return null;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
    }
    return null;
  }

  static scaleRectForOffsetInPlace(node: BaseNode, offsetPx: number): BaseNode {
    const center = DefaultEdgePathService.getNodeCenter(node);
    return {
      ...node,
      x: center.x - node.width / 2 - offsetPx,
      y: center.y - node.height / 2 - offsetPx,
      width: node.width + offsetPx * 2,
      height: node.height + offsetPx * 2,
    };
  }

  static getSidesToCheckForIntersection(node: BaseNode, lineOrigin: Point) {
    const center = DefaultEdgePathService.getNodeCenter(node);
    const sides: Side[] = [];
    if (lineOrigin.x < center.x) sides.push(Side.LEFT);
    if (lineOrigin.x > center.x) sides.push(Side.RIGHT);
    if (lineOrigin.y < center.y) sides.push(Side.TOP);
    if (lineOrigin.y > center.y) sides.push(Side.BOTTOM);
    return sides;
  }

  static getLineSegmentsForBoundingRect({
    x: topLeftX,
    y: topLeftY,
    height,
    width,
  }: BaseNode): Record<Side, Line> {
    return {
      [Side.TOP]: {
        start: { x: topLeftX, y: topLeftY },
        end: { x: topLeftX + width, y: topLeftY },
      },
      [Side.BOTTOM]: {
        start: { x: topLeftX, y: topLeftY + height },
        end: { x: topLeftX + width, y: topLeftY + height },
      },
      [Side.LEFT]: {
        start: { x: topLeftX, y: topLeftY },
        end: { x: topLeftX, y: topLeftY + height },
      },
      [Side.RIGHT]: {
        start: { x: topLeftX + width, y: topLeftY },
        end: { x: topLeftX + width, y: topLeftY + height },
      },
    };
  }

  static getSidesToCheckForToPort(
    fromNodeCenter: Point,
    toNodeCenter: Point,
    fromNodeSide: Side
  ): [Side, Side] {
    const sidesToCheck: Side[] = [];
    if (fromNodeSide === Side.TOP) sidesToCheck.push(Side.BOTTOM);
    else if (fromNodeSide === Side.BOTTOM) sidesToCheck.push(Side.TOP);
    else if (fromNodeSide === Side.LEFT) sidesToCheck.push(Side.RIGHT);
    else if (fromNodeSide === Side.RIGHT) sidesToCheck.push(Side.LEFT);

    if (fromNodeSide === Side.TOP || fromNodeSide === Side.BOTTOM) {
      fromNodeCenter.x < toNodeCenter.x
        ? sidesToCheck.push(Side.LEFT)
        : sidesToCheck.push(Side.RIGHT);
    } else {
      fromNodeCenter.y < toNodeCenter.y
        ? sidesToCheck.push(Side.TOP)
        : sidesToCheck.push(Side.BOTTOM);
    }
    return sidesToCheck as [Side, Side];
  }

  static getLineToMinimizeAngleToNormal(
    fromNode: BaseNode,
    toNode: BaseNode,
    portPadding = 0
  ): Line {
    const centers = {
      from: DefaultEdgePathService.getNodeCenter(fromNode),
      to: DefaultEdgePathService.getNodeCenter(toNode),
    };
    const scaledNodes = {
      from: DefaultEdgePathService.scaleRectForOffsetInPlace(
        fromNode,
        portPadding
      ),
      to: DefaultEdgePathService.scaleRectForOffsetInPlace(toNode, portPadding),
    };
    const fromSegments = DefaultEdgePathService.getLineSegmentsForBoundingRect(
      scaledNodes.from
    );
    const toSegments = DefaultEdgePathService.getLineSegmentsForBoundingRect(
      scaledNodes.to
    );
    const fromPortSide = DefaultEdgePathService.getFromPortSide(
      centers.from,
      centers.to
    );
    const fromPort = DefaultEdgePathService.linearInterpolate(
      fromSegments[fromPortSide].start,
      fromSegments[fromPortSide].end,
      0.5
    );
    const sidesToCheckForToNode =
      DefaultEdgePathService.getSidesToCheckForToPort(
        centers.from,
        centers.to,
        fromPortSide
      );

    const anglesToNormal = sidesToCheckForToNode.map(side => {
      const normalAngle = SIDE_TO_NORMAL_ANGLE[side];
      const toPort = DefaultEdgePathService.linearInterpolate(
        toSegments[side].start,
        toSegments[side].end,
        0.5
      );
      const line = { start: toPort, end: fromPort };
      const lineFromOrigin = DefaultEdgePathService.translateLineToPoint(
        line,
        ORIGIN
      );
      const angle = DefaultEdgePathService.calculateAngleFromPositiveX(
        lineFromOrigin.end.x,
        -lineFromOrigin.end.y
      );
      const isBottomRightQuadrant = angle > 270;
      const portIsOnRightSide = side === Side.RIGHT;
      const angleDifference = Math.abs(
        isBottomRightQuadrant && portIsOnRightSide
          ? angle - 360
          : normalAngle - angle
      );
      return { angleDifference, port: toPort };
    });
    return {
      start: fromPort,
      end:
        anglesToNormal[0].angleDifference < anglesToNormal[1].angleDifference
          ? anglesToNormal[0].port
          : anglesToNormal[1].port,
    };
  }

  static getLineToClosestSide(
    fromNode: BaseNode,
    toNode: BaseNode,
    portPadding = 0
  ): Line {
    const centers = {
      from: DefaultEdgePathService.getNodeCenter(fromNode),
      to: DefaultEdgePathService.getNodeCenter(toNode),
    };
    const scaledNodes = {
      from: DefaultEdgePathService.scaleRectForOffsetInPlace(
        fromNode,
        portPadding
      ),
      to: DefaultEdgePathService.scaleRectForOffsetInPlace(toNode, portPadding),
    };
    const fromSegments = DefaultEdgePathService.getLineSegmentsForBoundingRect(
      scaledNodes.from
    );
    const toSegments = DefaultEdgePathService.getLineSegmentsForBoundingRect(
      scaledNodes.to
    );
    const verticalDistance = Math.abs(centers.from.y - centers.to.y);
    const horizontalDistance = Math.abs(centers.from.x - centers.to.x);

    if (verticalDistance > horizontalDistance) {
      const fromPortSide =
        centers.from.y < centers.to.y ? Side.BOTTOM : Side.TOP;
      const fromPort = DefaultEdgePathService.linearInterpolate(
        fromSegments[fromPortSide].start,
        fromSegments[fromPortSide].end,
        0.5
      );
      const toPortSide = fromPortSide === Side.BOTTOM ? Side.TOP : Side.BOTTOM;
      const toPort = DefaultEdgePathService.linearInterpolate(
        toSegments[toPortSide].start,
        toSegments[toPortSide].end,
        0.5
      );
      return { start: fromPort, end: toPort };
    } else {
      const fromPortSide =
        centers.from.x < centers.to.x ? Side.RIGHT : Side.LEFT;
      const fromPort = DefaultEdgePathService.linearInterpolate(
        fromSegments[fromPortSide].start,
        fromSegments[fromPortSide].end,
        0.5
      );
      const toPortSide = fromPortSide === Side.RIGHT ? Side.LEFT : Side.RIGHT;
      const toPort = DefaultEdgePathService.linearInterpolate(
        toSegments[toPortSide].start,
        toSegments[toPortSide].end,
        0.5
      );
      return { start: fromPort, end: toPort };
    }
  }

  static getIntersectionPointsOnLineBetweenCenters(
    from: BaseNode,
    to: BaseNode,
    padding: number
  ): null | { from: Point; to: Point } {
    const centers = {
      from: DefaultEdgePathService.getNodeCenter(from),
      to: DefaultEdgePathService.getNodeCenter(to),
    };
    const lineBetweenCenters = { start: centers.from, end: centers.to };
    const scaledNodes = {
      from: DefaultEdgePathService.scaleRectForOffsetInPlace(from, padding),
      to: DefaultEdgePathService.scaleRectForOffsetInPlace(to, padding),
    };
    const fromSegments = DefaultEdgePathService.getLineSegmentsForBoundingRect(
      scaledNodes.from
    );
    const toSegments = DefaultEdgePathService.getLineSegmentsForBoundingRect(
      scaledNodes.to
    );
    const fromSidesToCheck =
      DefaultEdgePathService.getSidesToCheckForIntersection(
        scaledNodes.from,
        centers.to
      );
    const toSidesToCheck =
      DefaultEdgePathService.getSidesToCheckForIntersection(
        scaledNodes.to,
        centers.from
      );
    const fromIntersection = fromSidesToCheck
      .map(side =>
        DefaultEdgePathService.getLineIntersection(
          lineBetweenCenters,
          fromSegments[side]
        )
      )
      .filter(point => !!point)[0];
    const toIntersection = toSidesToCheck
      .map(side =>
        DefaultEdgePathService.getLineIntersection(
          lineBetweenCenters,
          toSegments[side]
        )
      )
      .filter(point => !!point)[0];
    if (!fromIntersection || !toIntersection) return null;
    return { from: fromIntersection, to: toIntersection };
  }

  static getDistance(p1: Point, p2: Point) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  }

  static calculateAngleFromPositiveX(x: number, y: number) {
    const angle = (Math.atan2(y, x) * 180) / Math.PI;
    return angle < 0 ? angle + 360 : angle;
  }

  static translateLineToPoint(line: Line, point: Point = ORIGIN) {
    const { x: x1, y: y1 } = line.start;
    const { x: x2, y: y2 } = line.end;
    const xTranslation = point.x - x1;
    const yTranslation = point.y - y1;
    return {
      start: { x: x1 + xTranslation, y: y1 + yTranslation },
      end: { x: x2 + xTranslation, y: y2 + yTranslation },
    };
  }

  static getFromPortSide(fromNodeCenter: Point, toNodeCenter: Point) {
    const verticalDistance = Math.abs(fromNodeCenter.y - toNodeCenter.y);
    const horizontalDistance = Math.abs(fromNodeCenter.x - toNodeCenter.x);
    if (verticalDistance > horizontalDistance) {
      return fromNodeCenter.y < toNodeCenter.y ? Side.BOTTOM : Side.TOP;
    }
    return fromNodeCenter.x < toNodeCenter.x ? Side.RIGHT : Side.LEFT;
  }
}
