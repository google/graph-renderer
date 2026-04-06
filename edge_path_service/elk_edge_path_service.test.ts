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
import { describe, it, expect, beforeEach } from 'vitest';

import { BaseEdge, BaseNode, Point, Side } from '../common/interfaces';
import {
  ElkEdgePathService,
  ElkLabelPositioning,
} from '../edge_path_service/elk_edge_path_service';

const PORT_PADDING = 4;
const ORIGIN_SPLIT_RADIUS = 16;
const TERMINAL_BEND_RADIUS = 16;
const DEFAULT_BEND_RADIUS = 12;
const TARGET_MARKER_CLEARANCE = 4;

// Define constant nodes for use in all tests.
const FROM_NODE: BaseNode = {
  id: 'from-node',
  x: 20,
  y: 20,
  width: 120,
  height: 60,
  templateId: 'default',
  ports: [{ id: 'from-port-right', side: Side.RIGHT }],
};
const TO_NODE: BaseNode = {
  id: 'to-node',
  x: 300,
  y: 300,
  width: 120,
  height: 60,
  templateId: 'default',
};

const EDGE_WITH_NO_SECTIONS: BaseEdge = {
  from: { nodeId: FROM_NODE.id },
  to: { nodeId: TO_NODE.id },
};

const EDGE_WITH_SIMPLE_SECTION: BaseEdge = {
  from: { nodeId: FROM_NODE.id },
  to: { nodeId: TO_NODE.id },
  sections: [
    {
      id: 's1',
      startPoint: { x: 140, y: 50 },
      endPoint: { x: 300, y: 50 },
    },
  ],
};

const EDGE_WITH_BEND_POINTS: BaseEdge = {
  from: { nodeId: FROM_NODE.id },
  to: { nodeId: TO_NODE.id },
  sections: [
    {
      id: 's1',
      startPoint: { x: 140, y: 50 },
      bendPoints: [
        { x: 200, y: 50 },
        { x: 200, y: 330 },
      ],
      endPoint: { x: 300, y: 330 },
    },
  ],
};

const EDGE_WITH_MULTIPLE_SECTIONS_COMPLEX: BaseEdge = {
  from: { nodeId: FROM_NODE.id },
  to: { nodeId: TO_NODE.id },
  sections: [
    { id: 's1', startPoint: { x: 10, y: 20 }, endPoint: { x: 50, y: 20 } },
    {
      id: 's2',
      startPoint: { x: 50, y: 20 },
      bendPoints: [{ x: 50, y: 100 }],
      endPoint: { x: 100, y: 100 },
    },
  ],
};

const EDGE_WITH_INVALID_SECTIONS: BaseEdge = {
  from: { nodeId: FROM_NODE.id },
  to: { nodeId: TO_NODE.id },
  sections: [
    { id: 's1', startPoint: { x: 10, y: 20 } } as any, // Missing endPoint
    { id: 's2', endPoint: { x: 100, y: 100 } } as any, // Missing startPoint
  ],
};

describe('ElkEdgePathService', () => {
  let service: ElkEdgePathService;

  beforeEach(() => {
    service = new ElkEdgePathService({
      portPadding: PORT_PADDING,
      originSplitRadius: ORIGIN_SPLIT_RADIUS,
      terminalBendRadius: TERMINAL_BEND_RADIUS,
      defaultBendRadius: DEFAULT_BEND_RADIUS,
      targetMarkerClearance: TARGET_MARKER_CLEARANCE,
    });
  });

  describe('buildPath', () => {
    describe('when "to" is a Point (tentative edge)', () => {
      it('builds a straight line from the node port to the point', () => {
        const toPoint: Point = { x: 200, y: 200 };
        const fromPortPosition = {
          x: FROM_NODE.x + FROM_NODE.width + PORT_PADDING,
          y: FROM_NODE.y + FROM_NODE.height / 2,
        };

        const result = service.buildPath(
          {
            from: { nodeId: FROM_NODE.id, portId: 'from-port-right' },
            to: toPoint,
          },
          FROM_NODE,
          toPoint
        );

        const expectedPath = `M${fromPortPosition.x},${fromPortPosition.y} L${toPoint.x},${toPoint.y}`;
        expect(result.path).toEqual(expectedPath);
      });
    });

    describe('when "to" is a Node', () => {
      it('returns an empty path if the edge has no sections', () => {
        const result = service.buildPath(
          EDGE_WITH_NO_SECTIONS,
          FROM_NODE,
          TO_NODE
        );
        expect(result.path).toEqual('');
        expect(result.labelPosition).toEqual({ x: 0, y: 0 });
      });

      it('builds a path from a single section with no bend points', () => {
        const section = EDGE_WITH_SIMPLE_SECTION.sections![0];
        const startPoint = section.startPoint!;
        const endPoint = section.endPoint!;
        const result = service.buildPath(
          EDGE_WITH_SIMPLE_SECTION,
          FROM_NODE,
          TO_NODE
        );

        // Expect the final segment to be shortened by the clearance
        const expectedEndPointX = endPoint.x - TARGET_MARKER_CLEARANCE;

        expect(result.path).toEqual(
          `M ${startPoint.x} ${startPoint.y} L ${expectedEndPointX} ${endPoint.y}`
        );

        const expectedLabelPosition = {
          x: (startPoint.x + endPoint.x) / 2,
          y: (startPoint.y + endPoint.y) / 2,
        };
        expect(result.labelPosition).toEqual(expectedLabelPosition);
      });

      it('builds a path from a single section with bend points', () => {
        const section = EDGE_WITH_BEND_POINTS.sections![0];
        const startPoint = section.startPoint!;
        const endPoint = section.endPoint!;
        const bendPoints = section.bendPoints!;
        const result = service.buildPath(
          EDGE_WITH_BEND_POINTS,
          FROM_NODE,
          TO_NODE
        );

        const expectedEndPointX = endPoint.x - TARGET_MARKER_CLEARANCE;

        const expectedPath = `M ${startPoint.x} ${startPoint.y} L ${
          bendPoints[0].x - ORIGIN_SPLIT_RADIUS
        } ${bendPoints[0].y} Q ${bendPoints[0].x} ${bendPoints[0].y}, ${
          bendPoints[0].x
        } ${bendPoints[0].y + ORIGIN_SPLIT_RADIUS} L ${bendPoints[1].x} ${
          bendPoints[1].y - TERMINAL_BEND_RADIUS
        } Q ${bendPoints[1].x} ${bendPoints[1].y}, ${
          bendPoints[1].x + TERMINAL_BEND_RADIUS
        } ${bendPoints[1].y} L ${expectedEndPointX} ${endPoint.y}`;

        expect(result.path).toEqual(expectedPath);

        // Expect the midpoint of the central segment for even-length arrays
        const expectedLabelPos = {
          x: (section.bendPoints![0].x + section.bendPoints![1].x) / 2,
          y: (section.bendPoints![0].y + section.bendPoints![1].y) / 2,
        };
        expect(result.labelPosition).toEqual(expectedLabelPos);
      });

      it('builds a path from multiple sections', () => {
        const section1 = EDGE_WITH_MULTIPLE_SECTIONS_COMPLEX.sections![0];
        const section2 = EDGE_WITH_MULTIPLE_SECTIONS_COMPLEX.sections![1];
        const result = service.buildPath(
          EDGE_WITH_MULTIPLE_SECTIONS_COMPLEX,
          FROM_NODE,
          TO_NODE
        );

        // Section 1: Should not be shortened
        const path1 = `M ${section1.startPoint!.x} ${section1.startPoint!.y} L ${
          section1.endPoint!.x
        } ${section1.endPoint!.y}`;

        // Section 2: Final segment shortened by clearance
        const expectedEndPointX =
          section2.endPoint!.x - TARGET_MARKER_CLEARANCE;
        const path2 = `M ${section2.startPoint!.x} ${section2.startPoint!.y} L ${
          section2.bendPoints![0].x
        } ${section2.bendPoints![0].y - ORIGIN_SPLIT_RADIUS} Q ${
          section2.bendPoints![0].x
        } ${section2.bendPoints![0].y}, ${
          section2.bendPoints![0].x + ORIGIN_SPLIT_RADIUS
        } ${section2.bendPoints![0].y} L ${expectedEndPointX} ${
          section2.endPoint!.y
        }`;

        expect(result.path).toEqual(`${path1} ${path2}`);
        expect(result.labelPosition).toEqual(section2.startPoint!);
      });

      it('handles sections with missing start or end points gracefully', () => {
        const result = service.buildPath(
          EDGE_WITH_INVALID_SECTIONS,
          FROM_NODE,
          TO_NODE
        );
        expect(result.path).toEqual('');
        expect(result.labelPosition).toEqual({ x: 0, y: 0 });
      });
    });

    it('respects the clearance guard for extremely short final segments', () => {
      const clearance = 10;
      const shortService = new ElkEdgePathService({
        targetMarkerClearance: clearance,
      });
      const startPoint = { x: 0, y: 0 };
      const targetPoint = { x: 5, y: 0 };
      const shortEdge: BaseEdge = {
        from: { nodeId: 'a' },
        to: { nodeId: 'b' },
        sections: [
          {
            id: 's1',
            startPoint,
            endPoint: targetPoint,
          },
        ],
      };

      const result = shortService.buildPath(shortEdge, FROM_NODE, TO_NODE);

      // Ensures that target clearance does not result in negative segment
      // lengths or flipped paths by clamping the shortening amount to the
      // physical length of the final segment.
      const expectedEndPointX = startPoint.x;
      const expectedPath = `M ${startPoint.x} ${startPoint.y} L ${expectedEndPointX} ${startPoint.y}`;

      expect(result.path).toEqual(expectedPath);
    });
  });

  describe('labelPositioning strategies', () => {
    it('calculates the geometric midpoint of the final segment (LAST_SEGMENT_MIDPOINT)', () => {
      const lastSegmentService = new ElkEdgePathService({
        labelPositioning: ElkLabelPositioning.LAST_SEGMENT_MIDPOINT,
      });
      const result = lastSegmentService.buildPath(
        EDGE_WITH_BEND_POINTS,
        FROM_NODE,
        TO_NODE
      );

      const section = EDGE_WITH_BEND_POINTS.sections![0];
      const pA = section.bendPoints![1];
      const pB = section.endPoint!;
      const expectedLabelPos = { x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 };

      expect(result.labelPosition).toEqual(expectedLabelPos);
    });

    it('calculates the geometric midpoint of the entire path (PATH_MIDPOINT)', () => {
      const pathMidpointService = new ElkEdgePathService({
        labelPositioning: ElkLabelPositioning.PATH_MIDPOINT,
      });
      const result = pathMidpointService.buildPath(
        EDGE_WITH_BEND_POINTS,
        FROM_NODE,
        TO_NODE
      );

      // Geometric midpoint calculation for the specific bend point coordinates.
      const expectedLabelPos = { x: 200, y: 210 };
      expect(result.labelPosition).toEqual(expectedLabelPos);
    });
  });

  describe('snapThreshold features', () => {
    it('snaps points within the threshold to eliminate layout jitter', () => {
      const threshold = 5;
      const snappingService = new ElkEdgePathService({
        snapThreshold: threshold,
      });
      const startPoint = { x: 0, y: 0 };
      const targetPoint = { x: 3, y: 100 };
      const jitterEdge: BaseEdge = {
        from: { nodeId: 'a' },
        to: { nodeId: 'b' },
        sections: [
          {
            id: 's1',
            startPoint,
            bendPoints: [{ x: 3, y: 0 }],
            endPoint: targetPoint,
          },
        ],
      };
      const result = snappingService.buildPath(jitterEdge, FROM_NODE, TO_NODE);

      // Verify the path is a straight vertical line due to coordinate snapping.
      expect(result.path).toContain(`M ${startPoint.x} ${startPoint.y}`);
      expect(result.path).toContain(`L ${startPoint.x} ${targetPoint.y}`);
    });
  });
});
