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
import { BaseEdge, BaseNode, Point, TentativeEdge } from '../common/interfaces';
import { isPoint } from '../common/utils';
import { EdgePathService } from '../edge_path_service/edge_path_service';

/** Strategies for positioning the edge label. */
export enum ElkLabelPositioning {
  /** Positions the label at the central vertex of the path (original behavior). */
  CENTRAL_VERTEX = 'central_vertex',
  /** Positions the label at the geometric midpoint of the entire path. */
  PATH_MIDPOINT = 'path_midpoint',
  /** Positions the label at the geometric midpoint of the final segment. */
  LAST_SEGMENT_MIDPOINT = 'last_segment_midpoint',
}

/** Configuration options for ElkEdgePathService. */
export interface ElkEdgePathConfig {
  /**
   * The distance between the node boundary and the port.
   *
   * NOTE: This property is currently a no-op for standard edges until node
   * dragging support is added, as they follow static coordinates from the
   * layout engine. It is only used for tentative edges during interaction.
   */
  portPadding?: number;
  /** Radius for the first bend after leaving the source node. */
  originSplitRadius?: number;
  /** Radius for the last bend before entering the target node. */
  terminalBendRadius?: number;
  /** Default radius for any bends. */
  defaultBendRadius?: number;
  /** Visual gap to accommodate arrowheads at the target node. */
  targetMarkerClearance?: number;
  /**
   * Threshold in pixels to snap nearly-aligned points.
   * Useful for removing small 'jogs' or bends caused by layout engine noise.
   */
  snapThreshold?: number;
  /** The strategy to use for calculating the label's coordinates. */
  labelPositioning?: ElkLabelPositioning;
}

const DEFAULT_PORT_PADDING = 4;
const DEFAULT_ORIGIN_SPLIT_RADIUS = 16;
const DEFAULT_TERMINAL_BEND_RADIUS = 16;
const DEFAULT_BEND_RADIUS = 12;
const DEFAULT_TARGET_MARKER_CLEARANCE = 0;
const DEFAULT_SNAP_THRESHOLD = 3;
const DEFAULT_LABEL_POSITIONING = ElkLabelPositioning.CENTRAL_VERTEX;

/**
 * An EdgePathService that renders the exact static path calculated by the
 * ELKjs layout engine.
 *
 * Note: This service does not support dynamic node dragging, as it relies
 * on static path data provided by the layout engine.
 */
export class ElkEdgePathService extends EdgePathService {
  private readonly config: Required<ElkEdgePathConfig>;

  constructor(config?: ElkEdgePathConfig) {
    super();
    this.config = {
      portPadding: config?.portPadding ?? DEFAULT_PORT_PADDING,
      originSplitRadius:
        config?.originSplitRadius ?? DEFAULT_ORIGIN_SPLIT_RADIUS,
      terminalBendRadius:
        config?.terminalBendRadius ?? DEFAULT_TERMINAL_BEND_RADIUS,
      defaultBendRadius: config?.defaultBendRadius ?? DEFAULT_BEND_RADIUS,
      targetMarkerClearance:
        config?.targetMarkerClearance ?? DEFAULT_TARGET_MARKER_CLEARANCE,
      snapThreshold: config?.snapThreshold ?? DEFAULT_SNAP_THRESHOLD,
      labelPositioning: config?.labelPositioning ?? DEFAULT_LABEL_POSITIONING,
    };
  }

  buildPath<T extends BaseNode, M extends BaseEdge | TentativeEdge>(
    edge: M,
    from: T,
    to: T | Point
  ): { path: string; labelPosition: Point } {
    if (isPoint(to)) {
      return this.buildPathToPoint(edge, from, to);
    }

    const fallbackLabelPosition = { x: 0, y: 0 };
    const sections = (edge as BaseEdge).sections;

    if (!sections || sections.length === 0) {
      return { path: '', labelPosition: fallbackLabelPosition };
    }

    // 1. Collect all raw points from all sections into a single sequence.
    const allRawPoints: Point[] = [];
    for (const section of sections) {
      if (!section.startPoint || !section.endPoint) continue;
      allRawPoints.push(section.startPoint);
      if (section.bendPoints) {
        allRawPoints.push(...section.bendPoints);
      }
      allRawPoints.push(section.endPoint);
    }

    // 2. Apply snapping to the entire sequence of raw points. This ensures that
    // points shared between sections (end of one, start of the next) are
    // snapped consistently.
    const snappedPoints: Point[] = [];
    if (allRawPoints.length > 0) {
      snappedPoints.push(allRawPoints[0]);
      for (let i = 1; i < allRawPoints.length; i++) {
        const p = allRawPoints[i];
        const prev = snappedPoints[i - 1]; // Use the already-snapped previous point
        snappedPoints.push({
          x: Math.abs(p.x - prev.x) < this.config.snapThreshold ? prev.x : p.x,
          y: Math.abs(p.y - prev.y) < this.config.snapThreshold ? prev.y : p.y,
        });
      }
    }
    // `allPoints` is used later for label position calculation.
    const allPoints = snappedPoints;

    // 3. Build each section's path using the globally snapped points.
    const pathSegments: string[] = [];
    let currentPointIndex = 0;

    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const section = sections[sIdx];
      if (!section.startPoint || !section.endPoint) continue;

      // Determine the number of points in this section (start + bends + end).
      const numSectionPoints = 1 + (section.bendPoints?.length || 0) + 1;
      // Extract the corresponding snapped points for this section.
      const points = snappedPoints.slice(
        currentPointIndex,
        currentPointIndex + numSectionPoints
      );
      currentPointIndex += numSectionPoints;

      // If for some reason a section has no points, skip it.
      if (points.length === 0) continue;

      let sectionPath = `M ${points[0].x} ${points[0].y}`;

      for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const next = points[i + 1];

        // Determine the radius based on bend position
        const isFirstBend = i === 1;
        const isLastBend = i === points.length - 2;

        let maxRadius = this.config.defaultBendRadius;
        if (isFirstBend) maxRadius = this.config.originSplitRadius;
        else if (isLastBend) maxRadius = this.config.terminalBendRadius;

        const dPrev = Math.hypot(curr.x - prev.x, curr.y - prev.y);
        const dNext = Math.hypot(next.x - curr.x, next.y - curr.y);

        // DYNAMIC LIMITS:
        // 1. If the previous point is a port (i=1), the curve can use the full segment.
        // 2. If the next point is a port (i=n-2), the curve can use the full segment.
        // 3. Otherwise, segments are shared between two curves, so limit to half.
        const prevLimit = i === 1 ? dPrev : dPrev / 2;
        const nextLimit = i === points.length - 2 ? dNext : dNext / 2;

        // Select the effective radius by clamping to the available runway on
        // adjacent segments. The Math.max guard prevents negative radii if
        // target clearance exceeds the physical segment length.
        const r = Math.max(0, Math.min(maxRadius, prevLimit, nextLimit));

        // Fall back to a sharp corner for segments too short to support a distinct curve (r <= 1px). This ensures visual sharpness and prevents potential sub-pixel rendering glitches in the browser's SVG engine.
        if (r > 1) {
          // The '|| 1' prevents division by zero (NaN) if ELK provides
          // overlapping points, ensuring the SVG path remains valid.
          const p1 = {
            x: curr.x - (r * (curr.x - prev.x)) / (dPrev || 1),
            y: curr.y - (r * (curr.y - prev.y)) / (dPrev || 1),
          };
          const p2 = {
            x: curr.x + (r * (next.x - curr.x)) / (dNext || 1),
            y: curr.y + (r * (next.y - curr.y)) / (dNext || 1),
          };
          sectionPath += ` L ${p1.x} ${p1.y} Q ${curr.x} ${curr.y}, ${p2.x} ${p2.y}`;
        } else {
          // Emits clear L command for baseline tests or nearly-straight lines.
          sectionPath += ` L ${curr.x} ${curr.y}`;
        }
      }

      // Final Segment Logic with Shortening
      const lastIdx = points.length - 1;
      const targetPoint = points[lastIdx];
      const lastRefPoint = points[lastIdx - 1];
      const dLast = Math.hypot(
        targetPoint.x - lastRefPoint.x,
        targetPoint.y - lastRefPoint.y
      );

      const isLastSection = sIdx === sections.length - 1;
      let endPoint = targetPoint;

      if (isLastSection && this.config.targetMarkerClearance > 0) {
        const shortening = Math.min(dLast, this.config.targetMarkerClearance);
        endPoint = {
          x:
            targetPoint.x -
            (shortening * (targetPoint.x - lastRefPoint.x)) / (dLast || 1),
          y:
            targetPoint.y -
            (shortening * (targetPoint.y - lastRefPoint.y)) / (dLast || 1),
        };
      }

      sectionPath += ` L ${endPoint.x} ${endPoint.y}`;
      pathSegments.push(sectionPath);
    }

    const path = pathSegments.join(' ');

    // Calculate label position based on the configured strategy.
    let labelPosition = fallbackLabelPosition;

    switch (this.config.labelPositioning) {
      case ElkLabelPositioning.LAST_SEGMENT_MIDPOINT:
        // Geometric midpoint of the final segment (entry to target node).
        if (allPoints.length >= 2) {
          const pA = allPoints[allPoints.length - 2];
          const pB = allPoints[allPoints.length - 1];
          labelPosition = {
            x: (pA.x + pB.x) / 2,
            y: (pA.y + pB.y) / 2,
          };
        } else if (allPoints.length === 1) {
          labelPosition = allPoints[0];
        }
        break;

      case ElkLabelPositioning.PATH_MIDPOINT: {
        // Calculate the geometric midpoint of the entire polyline length. This
        // ensures labels are centered on the segment, even for straight 2-point lines.
        let totalLength = 0;
        for (let i = 0; i < allPoints.length - 1; i++) {
          totalLength += Math.hypot(
            allPoints[i + 1].x - allPoints[i].x,
            allPoints[i + 1].y - allPoints[i].y
          );
        }

        if (totalLength > 0) {
          let traversed = 0;
          const target = totalLength / 2;
          for (let i = 0; i < allPoints.length - 1; i++) {
            const d = Math.hypot(
              allPoints[i + 1].x - allPoints[i].x,
              allPoints[i + 1].y - allPoints[i].y
            );
            if (traversed + d >= target) {
              const ratio = (target - traversed) / (d || 1);
              labelPosition = {
                x:
                  allPoints[i].x +
                  ratio * (allPoints[i + 1].x - allPoints[i].x),
                y:
                  allPoints[i].y +
                  ratio * (allPoints[i + 1].y - allPoints[i].y),
              };
              break;
            }
            traversed += d;
          }
        } else if (allPoints.length > 0) {
          labelPosition = allPoints[0];
        }
        break;
      }

      case ElkLabelPositioning.CENTRAL_VERTEX:
      default:
        // Position the label at the path's central vertex. For paths with an
        // even number of points (e.g., 2-point straight lines or 4-point
        // branched paths), calculate the geometric midpoint of the central
        // segment to keep the label visually centered.
        if (allPoints.length === 0) {
          labelPosition = fallbackLabelPosition;
        } else if (allPoints.length % 2 === 1) {
          const midIndex = Math.floor(allPoints.length / 2);
          labelPosition = allPoints[midIndex];
        } else {
          const midIndex = allPoints.length / 2;
          const p1 = allPoints[midIndex - 1];
          const p2 = allPoints[midIndex];
          labelPosition = {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2,
          };
        }
        break;
    }

    return { path, labelPosition };
  }

  /**
   * Builds a path for a tentative edge from a node's port to a point.
   */
  private buildPathToPoint<
    T extends BaseNode,
    M extends BaseEdge | TentativeEdge,
  >(edge: M, from: T, to: Point): { path: string; labelPosition: Point } {
    // The port offset is calculated using portPadding to ensure that the
    // tentative edge preview matches the visual spacing of standard edges.
    const fromPortOffset = EdgePathService.getPortOffsetForNode(
      edge.from.portId,
      from,
      this.config.portPadding
    );
    const startPoint = {
      x: from.x + fromPortOffset.x,
      y: from.y + fromPortOffset.y,
    };

    return {
      path: `M${startPoint.x},${startPoint.y} L${to.x},${to.y}`,
      labelPosition: {
        x: (startPoint.x + to.x) / 2,
        y: (startPoint.y + to.y) / 2,
      },
    };
  }
}
