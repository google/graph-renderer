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

import {pit} from 'google3/javascript/angular2/testing/catalyst/fake_async';
import {cleanState} from '../testing/test_utils';
import {BaseNode, Side} from '../common/interfaces';
import {
  DefaultEdgePathService,
  FixedEnd,
  FloatingBehavior,
  MarkerOrientation,
} from './default_edge_path_service';

const ORIGIN = {x: 0, y: 0};
const TEST_PORT_PADDING = 4;

// Helper to parse path start and end points of the MAIN path
function getPathStartEnd(path: string) {
  const commands = path.trim().split(/(?=[MCZLHVCSQTAmczlhvcsqta])/);
  const firstMove = commands.find((c) => c.startsWith('M'));
  const startCoords = firstMove
    ?.substring(1)
    .trim()
    .split(/[\s,]+/)
    .map(Number);

  // Find the last coordinates of the primary path (before any trailing orientation segments)
  let mainPathEndCoords: number[] = [];
  for (let i = commands.length - 1; i >= 0; i--) {
    if (commands[i].startsWith('C') || commands[i].startsWith('L')) {
      const coordString = commands[i].substring(1).trim();
      const coords = coordString.split(/[\s,]+/).map(Number);
      if (coords.length >= 2) {
        mainPathEndCoords = coords.slice(-2);
        break;
      }
    }
  }
  if (mainPathEndCoords.length === 0 && startCoords) {
    // Fallback for very simple paths like single M command
    mainPathEndCoords = startCoords;
  }

  return {
    start: {x: startCoords?.[0] ?? NaN, y: startCoords?.[1] ?? NaN},
    end: {x: mainPathEndCoords?.[0] ?? NaN, y: mainPathEndCoords?.[1] ?? NaN},
  };
}

// Helper to normalize SVG path strings for comparison
function normalizePath(path: string): string {
  return path.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
}

// Regex to check for a valid cubic Bezier structure, more flexible with spaces
const CUBIC_BEZIER_REGEX =
  /^M\s*[\d.-]+\s+[\d.-]+\s*C\s*[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+[\d.-]+$/;
const ORIENTATION_PATH_REGEX =
  /^(M\s*[\d.-]+\s+[\d.-]+\s*L\s*[\d.-]+\s+[\d.-]+\s*)*M\s*[\d.-]+\s+[\d.-]+\s*C\s*[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+[\d.-]+(\s*M\s*[\d.-]+\s+[\d.-]+\s*L\s*[\d.-]+\s+[\d.-]+)*$/;

describe('DefaultEdgePathService', () => {
  const state = cleanState(() => {
    const edgePathService = new DefaultEdgePathService({
      portPadding: TEST_PORT_PADDING,
    });
    return {edgePathService};
  }, beforeEach);

  describe('static methods', () => {
    describe('#getNodeCenter', () => {
      it('returns the center of a node', () => {
        const node: BaseNode = {
          id: '1',
          templateId: '1',
          x: 100,
          y: 100,
          width: 100,
          height: 200,
        };

        expect(DefaultEdgePathService.getNodeCenter(node)).toEqual({
          x: 150,
          y: 200,
        });
      });
    });
    describe('getLineIntersection', () => {
      it('calculates the point of intersection correctly when lines intersect', () => {
        const line1 = {
          start: {x: 0, y: 0},
          end: {x: 100, y: 100},
        };
        const line2 = {
          start: {x: 50, y: 0},
          end: {x: 50, y: 100},
        };

        expect(
          DefaultEdgePathService.getLineIntersection(line1, line2),
        ).toEqual({
          x: 50,
          y: 50,
        });
      });

      it('returns null when lines do not intersect', () => {
        const line1 = {
          start: {x: 0, y: 0},
          end: {x: 100, y: 100},
        };
        const line2 = {
          start: {x: 0, y: 25},
          end: {x: 100, y: 125},
        };
        expect(
          DefaultEdgePathService.getLineIntersection(line1, line2),
        ).toBeNull();
      });
    });
    describe('#scaleRectForOffsetInPlace', () => {
      it('calculates the center of a rectangle that has been scaled outwards by a number of pixels on each side', () => {
        const node: BaseNode = {
          id: '1',
          templateId: '1',
          x: 100,
          y: 100,
          height: 50,
          width: 100,
        }; // center  is (x: 150, y: 125)

        expect(
          DefaultEdgePathService.scaleRectForOffsetInPlace(node, 10 /* px */),
        ).toEqual({...node, x: 90, y: 90, height: 70, width: 120});
      });
    });
    describe('#getLineSegmentsForBoundingRect', () => {
      it('returns the four line segments correctly', () => {
        const node: BaseNode = {
          x: 100,
          y: 100,
          width: 50,
          height: 75,
          id: '1',
          templateId: '1',
        };

        expect(
          DefaultEdgePathService.getLineSegmentsForBoundingRect(node),
        ).toEqual({
          [Side.TOP]: {start: {x: 100, y: 100}, end: {x: 150, y: 100}},
          [Side.BOTTOM]: {start: {x: 100, y: 175}, end: {x: 150, y: 175}},
          [Side.LEFT]: {start: {x: 100, y: 100}, end: {x: 100, y: 175}},
          [Side.RIGHT]: {start: {x: 150, y: 100}, end: {x: 150, y: 175}},
        });
      });
    });
    describe('#getSidesToCheckForIntersection', () => {
      const node: BaseNode = {
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        id: '1',
        templateId: '1',
      };

      it('returns the correct sides when the point is down and right', () => {
        const point = {x: 300, y: 300};

        expect(
          DefaultEdgePathService.getSidesToCheckForIntersection(node, point),
        ).toEqual(jasmine.arrayContaining([Side.BOTTOM, Side.RIGHT]));
      });
      it('returns the correct sides when the point is down and left', () => {
        const point = {x: 0, y: 300};
        expect(
          DefaultEdgePathService.getSidesToCheckForIntersection(node, point),
        ).toEqual(jasmine.arrayContaining([Side.BOTTOM, Side.LEFT]));
      });
      it('returns the correct sides when the point is up and right', () => {
        const point = {x: 300, y: 0};
        expect(
          DefaultEdgePathService.getSidesToCheckForIntersection(node, point),
        ).toEqual(jasmine.arrayContaining([Side.TOP, Side.RIGHT]));
      });
      it('reutnrs the correct sides when the point is up and left', () => {
        const point = {x: 0, y: 0};
        expect(
          DefaultEdgePathService.getSidesToCheckForIntersection(node, point),
        ).toEqual(jasmine.arrayContaining([Side.TOP, Side.LEFT]));
      });
    });
    describe('#getCubicBezierMidpoint', () => {
      it('throws an error if less than 4 points', () => {
        const points = [ORIGIN];

        expect(() => {
          DefaultEdgePathService.getCubicBezierMidpoint(points);
        }).toThrow(
          new Error(
            'Must provide 4 points (start, end, control points) for cubic bezier',
          ),
        );
      });
      it('throws an error if more than 4 points', () => {
        const points = [
          ORIGIN,
          {x: 0, y: 8},
          {x: 0, y: 8},
          {x: 0, y: 8},
          {x: 0, y: 8},
        ];

        expect(() =>
          DefaultEdgePathService.getCubicBezierMidpoint(points),
        ).toThrow(
          new Error(
            'Must provide 4 points (start, end, control points) for cubic bezier',
          ),
        );
      });
      it('provides the correct midpoint for a cubic bezier curve with start above end', () => {
        const start = {x: 100, y: 100};
        const end = {x: 150, y: 200};
        const controlPoint1 = {x: 100, y: 150};
        const controlPoint2 = {x: 150, y: 150};

        const midpoint = DefaultEdgePathService.getCubicBezierMidpoint([
          start,
          controlPoint1,
          controlPoint2,
          end,
        ]);

        expect(midpoint).toEqual({x: 125, y: 150});
      });
      it('provides the correct midpoint for a cubic bezier curve with start below end', () => {
        const end = {x: 100, y: 100};
        const start = {x: 150, y: 200};
        const controlPoint1 = {x: 125, y: 200};
        const controlPoint2 = {x: 125, y: 100};

        const midpoint = DefaultEdgePathService.getCubicBezierMidpoint([
          start,
          controlPoint1,
          controlPoint2,
          end,
        ]);

        expect(midpoint).toEqual({x: 125, y: 150});
      });
    });
    describe('#linearInterpolate', () => {
      it('handles a vertical line', () => {
        const point1 = ORIGIN;
        const point2 = {x: 0, y: 8};

        const interpolatedPoint = DefaultEdgePathService.linearInterpolate(
          point1,
          point2,
          0.25,
        );

        expect(interpolatedPoint).toEqual({x: 0, y: 2});
      });
      it('handles a horizontal line', () => {
        const point1 = ORIGIN;
        const point2 = {x: 8, y: 0};

        const interpolatedPoint = DefaultEdgePathService.linearInterpolate(
          point1,
          point2,
          0.25,
        );

        expect(interpolatedPoint).toEqual({x: 2, y: 0});
      });
      it('handles a positive sloped line', () => {
        const point1 = ORIGIN;
        const point2 = {x: 8, y: 8};

        const interpolatedPoint = DefaultEdgePathService.linearInterpolate(
          point1,
          point2,
          0.25,
        );

        expect(interpolatedPoint).toEqual({x: 2, y: 2});
      });
      it('handles a negative sloped line', () => {
        const point1 = {x: 0, y: 8};
        const point2 = {x: 8, y: 0};

        const interpolatedPoint = DefaultEdgePathService.linearInterpolate(
          point1,
          point2,
          0.25,
        );

        expect(interpolatedPoint).toEqual({x: 2, y: 6});
      });
      it('throws an error if interpolatePercent is > 1', () => {
        const point1 = ORIGIN;
        const point2 = {x: 0, y: 8};

        expect(() => {
          DefaultEdgePathService.linearInterpolate(point1, point2, 1.25);
        }).toThrow(new Error('interpolatePercent must be between 0 and 1'));
      });
      it('throws an error if interpolatePercent is negative', () => {
        const point1 = ORIGIN;
        const point2 = {x: 0, y: 8};

        expect(() => {
          DefaultEdgePathService.linearInterpolate(point1, point2, -0.25);
        }).toThrow(new Error('interpolatePercent must be between 0 and 1'));
      });
    });
    describe('#getClosestPointOnFloatingNode', () => {
      const floatingNode: BaseNode = {
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        id: 'floatingNode',
        templateId: 'floatingNode',
      };
      it('provides the correct point when the fixed point is down and left of the floating node', () => {
        const fixedPoint = {x: 0, y: 250};

        expect(
          DefaultEdgePathService.getClosestPointOnFloatingNode(
            fixedPoint,
            floatingNode,
          ),
        ).toEqual({x: 100, y: 200}); // bottom left corner
      });
      it('provides the correct point when the fixed point is down and right of the floating node', () => {
        const fixedPoint = {x: 550, y: 250};

        expect(
          DefaultEdgePathService.getClosestPointOnFloatingNode(
            fixedPoint,
            floatingNode,
          ),
        ).toEqual({x: 200, y: 200}); // bottom right corner
      });
      it('provides the correct point when the fixed point is up and left of the floating node', () => {
        const fixedPoint = {x: 0, y: 0};

        expect(
          DefaultEdgePathService.getClosestPointOnFloatingNode(
            fixedPoint,
            floatingNode,
          ),
        ).toEqual({x: 100, y: 100}); // top left corner
      });
      it('provides the correct point when the fixed point is up and right of the floating node', () => {
        const fixedPoint = {x: 400, y: 0};

        expect(
          DefaultEdgePathService.getClosestPointOnFloatingNode(
            fixedPoint,
            floatingNode,
          ),
        ).toEqual({x: 200, y: 100}); // top right corner
      });
      it('provides the correct point when the fixed point is up and in the horizontal center of the floating node', () => {
        const fixedPoint = {x: 150, y: 0};

        expect(
          DefaultEdgePathService.getClosestPointOnFloatingNode(
            fixedPoint,
            floatingNode,
          ),
        ).toEqual({x: 150, y: 100});
      });
      it('provides the correct point when the fixed point is left and in the vertical center of the floating node', () => {
        const fixedPoint = {x: 0, y: 150};

        expect(
          DefaultEdgePathService.getClosestPointOnFloatingNode(
            fixedPoint,
            floatingNode,
          ),
        ).toEqual({x: 100, y: 150});
      });
    });
    describe('#getOrientationSegment', () => {
      const endPoint = {x: 12, y: 35};
      it('provides the correct svg line for a right orientation', () => {
        const result = DefaultEdgePathService.getOrientationSegment(
          endPoint,
          MarkerOrientation.RIGHT,
          1,
        );
        expect(result).toEqual('M12,35 L13,35');
      });
      it('provides the correct svg line for a left orientation', () => {
        expect(
          DefaultEdgePathService.getOrientationSegment(
            endPoint,
            MarkerOrientation.LEFT,
            1,
          ),
        ).toEqual('M12,35 L11,35');
      });
      it('provides the correct svg line for a up orientation', () => {
        expect(
          DefaultEdgePathService.getOrientationSegment(
            endPoint,
            MarkerOrientation.UP,
            1,
          ),
        ).toEqual('M12,35 L12,34');
      });
      it('provides the correct svg line for a down orientation', () => {
        expect(
          DefaultEdgePathService.getOrientationSegment(
            endPoint,
            MarkerOrientation.DOWN,
            1,
          ),
        ).toEqual('M12,35 L12,36');
      });
    });
    describe('#getMarkerOrientation', () => {
      const relatedNode: BaseNode = {
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        id: 'r',
        templateId: 't',
      };
      describe('when the marker is at the end of the line', () => {
        pit('returns RIGHT orientation if y is', [96, 150, 204], (pointY) => {
          expect(
            DefaultEdgePathService.getMarkerOrientation(
              {x: 95, y: pointY},
              relatedNode,
              'end',
            ),
          ).toEqual(MarkerOrientation.RIGHT);
        });
        pit('returns LEFT orientation if y is', [96, 150, 204], (pointY) => {
          expect(
            DefaultEdgePathService.getMarkerOrientation(
              {x: 205, y: pointY},
              relatedNode,
              'end',
            ),
          ).toEqual(MarkerOrientation.LEFT);
        });
        pit('returns DOWN orientation if x is', [96, 150, 204], (pointX) => {
          expect(
            DefaultEdgePathService.getMarkerOrientation(
              {x: pointX, y: 95},
              relatedNode,
              'end',
            ),
          ).toEqual(MarkerOrientation.DOWN);
        });
        pit('returns UP orientation if x is', [96, 150, 204], (pointX) => {
          expect(
            DefaultEdgePathService.getMarkerOrientation(
              {x: pointX, y: 205},
              relatedNode,
              'end',
            ),
          ).toEqual(MarkerOrientation.UP);
        });
      });
      describe('when the marker is at the start of the line', () => {
        pit('returns LEFT orientation if y is', [96, 150, 204], (pointY) => {
          expect(
            DefaultEdgePathService.getMarkerOrientation(
              {x: 95, y: pointY},
              relatedNode,
              'start',
            ),
          ).toEqual(MarkerOrientation.LEFT);
        });
        pit('returns RIGHT orientation if y is', [96, 150, 204], (pointY) => {
          expect(
            DefaultEdgePathService.getMarkerOrientation(
              {x: 205, y: pointY},
              relatedNode,
              'start',
            ),
          ).toEqual(MarkerOrientation.RIGHT);
        });
        pit('returns UP orientation if x is', [96, 150, 204], (pointX) => {
          expect(
            DefaultEdgePathService.getMarkerOrientation(
              {x: pointX, y: 95},
              relatedNode,
              'start',
            ),
          ).toEqual(MarkerOrientation.UP);
        });
        pit('returns DOWN orientation if x is', [96, 150, 204], (pointX) => {
          expect(
            DefaultEdgePathService.getMarkerOrientation(
              {x: pointX, y: 205},
              relatedNode,
              'start',
            ),
          ).toEqual(MarkerOrientation.DOWN);
        });
      });
    });
    describe('#getLineToClosestSide', () => {
      const fromNode: BaseNode = {
        id: '1',
        templateId: 't',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      };
      it('connects to bottom / top when toNode is directly below fromNode', () => {
        const toNode: BaseNode = {
          id: '2',
          templateId: 't',
          x: 0,
          y: 200,
          width: 100,
          height: 100,
        };
        const line = DefaultEdgePathService.getLineToClosestSide(
          fromNode,
          toNode,
          8,
        );
        expect(line).toEqual({start: {x: 50, y: 108}, end: {x: 50, y: 192}});
      });
      it('connects to right / left when toNode is directly to the right of fromNode', () => {
        const toNode: BaseNode = {
          id: '2',
          templateId: 't',
          x: 200,
          y: 0,
          width: 100,
          height: 100,
        };
        const line = DefaultEdgePathService.getLineToClosestSide(
          fromNode,
          toNode,
          8,
        );
        expect(line).toEqual({start: {x: 108, y: 50}, end: {x: 192, y: 50}});
      });
    });
    describe('#calculateAngleFromPositiveX', () => {
      pit(
        'when point is',
        {
          '(1,0)': {p: {x: 1, y: 0}, expected: 0},
          '(1,1)': {p: {x: 1, y: 1}, expected: 45},
          '(0,1)': {p: {x: 0, y: 1}, expected: 90},
          '(-1,1)': {p: {x: -1, y: 1}, expected: 135},
          '(-1,0)': {p: {x: -1, y: 0}, expected: 180},
          '(-1,-1)': {p: {x: -1, y: -1}, expected: 225},
          '(0,-1)': {p: {x: 0, y: -1}, expected: 270},
          '(1,-1)': {p: {x: 1, y: -1}, expected: 315},
        },
        'it returns the correct angle',
        ({p, expected}) => {
          expect(
            DefaultEdgePathService.calculateAngleFromPositiveX(p.x, p.y),
          ).toBeCloseTo(expected);
        },
      );
    });
    describe('#getLineToMinimizeAngleToNormal', () => {
      const fromNode: BaseNode = {
        id: '1',
        templateId: 't',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      };
      const toNode: BaseNode = {
        id: '2',
        templateId: 't',
        x: 200,
        y: 50,
        width: 100,
        height: 100,
      };
      it('connects to the side minimizing angle to normal', () => {
        const line = DefaultEdgePathService.getLineToMinimizeAngleToNormal(
          fromNode,
          toNode,
          8,
        );
        // Expected: fromNode's right side to toNode's left side
        expect(line.start).toEqual({x: 108, y: 50});
        expect(line.end).toEqual({x: 192, y: 100});
      });
    });
    describe('#getPointSide', () => {
      const node: BaseNode = {
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        id: '1',
        templateId: 't',
      };
      it('returns TOP', () => {
        expect(
          DefaultEdgePathService.getPointSide({x: 150, y: 90}, node),
        ).toEqual(Side.TOP);
      });
      it('returns BOTTOM', () => {
        expect(
          DefaultEdgePathService.getPointSide({x: 150, y: 210}, node),
        ).toEqual(Side.BOTTOM);
      });
      it('returns LEFT', () => {
        expect(
          DefaultEdgePathService.getPointSide({x: 90, y: 150}, node),
        ).toEqual(Side.LEFT);
      });
      it('returns RIGHT', () => {
        expect(
          DefaultEdgePathService.getPointSide({x: 210, y: 150}, node),
        ).toEqual(Side.RIGHT);
      });
      it('returns null if on border', () => {
        expect(
          DefaultEdgePathService.getPointSide({x: 100, y: 150}, node),
        ).toBeNull();
      });
    });
  });

  describe('instance methods', () => {
    describe('#buildPath', () => {
      describe('when building a path to a node', () => {
        it('builds a cubic bezier curve with the correct midpoint', () => {
          const edge = {
            from: {nodeId: 'node1', portId: 'port1'},
            to: {nodeId: 'node2', portId: 'port2'},
          };
          const startNode: BaseNode = {
            id: 'node1',
            templateId: 't',
            ports: [{id: 'port1', side: Side.BOTTOM}],
            x: 0,
            y: 550,
            height: 100,
            width: 200,
          };
          const endNode: BaseNode = {
            id: 'node2',
            templateId: 't',
            ports: [{id: 'port2', side: Side.TOP}],
            x: 200,
            y: 250,
            height: 100,
            width: 200,
          };

          const result = state.edgePathService.buildPath(
            edge,
            startNode,
            endNode,
          );
          const {start, end} = getPathStartEnd(result.path);
          expect(start.x).toBeCloseTo(100);
          expect(start.y).toBeCloseTo(654); // 550 + 100 + 4
          expect(end.x).toBeCloseTo(300);
          expect(end.y).toBeCloseTo(246); // 250 - 4

          expect(normalizePath(result.path)).toMatch(CUBIC_BEZIER_REGEX);
          expect(result.labelPosition).toEqual({x: 200, y: 450});
        });
        it('builds a cubic bezier curve with the correct midpoint offset between nodes with a short edge', () => {
          const edgePathService = new DefaultEdgePathService({
            shortEdgeLabelOffsetConfiguration: {
              maxEdgeLength: 50,
              horizontalOffset: 18,
            },
            portPadding: TEST_PORT_PADDING,
          });
          const edge = {
            from: {nodeId: 'node1', portId: 'port1'},
            to: {nodeId: 'node2', portId: 'port2'},
          };
          const startNode: BaseNode = {
            id: 'node1',
            templateId: 't',
            ports: [{id: 'port1', side: Side.BOTTOM}],
            x: 0,
            y: 0,
            height: 100,
            width: 200,
          };
          const endNode: BaseNode = {
            id: 'node2',
            templateId: 't',
            ports: [{id: 'port2', side: Side.TOP}],
            x: 0,
            y: 104,
            height: 100,
            width: 200,
          };

          const result = edgePathService.buildPath(edge, startNode, endNode);
          const {start, end} = getPathStartEnd(result.path);
          expect(start.y).toBeCloseTo(104); // 0 + 100 + 4
          expect(end.y).toBeCloseTo(100); // 104 - 4
          expect(result.labelPosition).toEqual({x: 100 + 18, y: 102});
        });
      });

      describe('when building a path to a point', () => {
        it('provides a straight line', () => {
          const endPoint = {x: 10, y: 10};
          const edge = {from: {nodeId: 'node1', portId: 'port1'}, to: endPoint};
          const startNode: BaseNode = {
            id: 'node1',
            templateId: 't',
            ports: [{id: 'port1', side: Side.TOP}],
            x: 0,
            y: 250,
            height: 100,
            width: 200,
          };
          const result = state.edgePathService.buildPath(
            edge,
            startNode,
            endPoint,
          );
          expect(normalizePath(result.path)).toBe('M100 246 L10 10');
          expect(result.labelPosition).toEqual({x: 55, y: 128});
        });
      });
    });
  });

  describe('with provider for port offset', () => {
    const state = cleanState(() => {
      const edgePathService = new DefaultEdgePathService({portPadding: 24});
      return {edgePathService};
    }, beforeEach);

    it('builds a curve with larger port padding', () => {
      const edge = {
        from: {nodeId: 'node1', portId: 'port1'},
        to: {nodeId: 'node2', portId: 'port2'},
      };
      const startNode: BaseNode = {
        id: 'node1',
        templateId: 't',
        ports: [{id: 'port1', side: Side.BOTTOM}],
        x: 0,
        y: 550,
        height: 100,
        width: 200,
      };
      const endNode: BaseNode = {
        id: 'node2',
        templateId: 't',
        ports: [{id: 'port2', side: Side.TOP}],
        x: 200,
        y: 250,
        height: 100,
        width: 200,
      };
      const result = state.edgePathService.buildPath(edge, startNode, endNode);
      const {start, end} = getPathStartEnd(result.path);
      expect(start.y).toBeCloseTo(674); // 550 + 100 + 24
      expect(end.y).toBeCloseTo(226); // 250 - 24
      expect(normalizePath(result.path)).toMatch(CUBIC_BEZIER_REGEX);
    });
  });

  describe('with floating edge configuration', () => {
    const startNode: BaseNode = {
      id: '1',
      templateId: 't',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      ports: [{id: 'p1', side: Side.RIGHT}],
    };
    const endNode: BaseNode = {
      id: '2',
      templateId: 't',
      x: 200,
      y: 0,
      width: 100,
      height: 100,
      ports: [{id: 'p2', side: Side.LEFT}],
    };
    const edge = {
      from: {nodeId: '1', portId: 'p1'},
      to: {nodeId: '2', portId: 'p2'},
    };
    const portPadding = 8;

    it('FixedEnd.TO - start of edge floats', () => {
      const service = new DefaultEdgePathService({
        portPadding,
        floatingEdgeConfiguration: {fixedEnd: FixedEnd.TO},
      });
      const result = service.buildPath(edge, startNode, endNode);
      const {start, end} = getPathStartEnd(result.path);
      expect(start.x).toBeCloseTo(100);
      expect(start.y).toBeCloseTo(50);
      expect(end.x).toBeCloseTo(192);
      expect(end.y).toBeCloseTo(50);
      expect(normalizePath(result.path)).toMatch(CUBIC_BEZIER_REGEX);
    });
    it('FixedEnd.FROM - end of edge floats', () => {
      const service = new DefaultEdgePathService({
        portPadding,
        floatingEdgeConfiguration: {fixedEnd: FixedEnd.FROM},
      });
      const result = service.buildPath(edge, startNode, endNode);
      const {start, end} = getPathStartEnd(result.path);
      expect(start.x).toBeCloseTo(108);
      expect(start.y).toBeCloseTo(50);
      expect(end.x).toBeCloseTo(200);
      expect(end.y).toBeCloseTo(50);
      expect(normalizePath(result.path)).toMatch(CUBIC_BEZIER_REGEX);
    });
    it('FixedEnd.NONE - both ends float, continuous', () => {
      const service = new DefaultEdgePathService({
        portPadding,
        floatingEdgeConfiguration: {
          fixedEnd: FixedEnd.NONE,
          floatingBehavior: FloatingBehavior.CONTINUOUS,
        },
      });
      const result = service.buildPath(edge, startNode, endNode);
      const {start, end} = getPathStartEnd(result.path);
      expect(start.x).toBeCloseTo(108);
      expect(start.y).toBeCloseTo(50);
      expect(end.x).toBeCloseTo(192);
      expect(end.y).toBeCloseTo(50);
      expect(normalizePath(result.path)).toMatch(CUBIC_BEZIER_REGEX);
    });
    it('FixedEnd.NONE - both ends float, discrete', () => {
      const service = new DefaultEdgePathService({
        portPadding,
        floatingEdgeConfiguration: {
          fixedEnd: FixedEnd.NONE,
          floatingBehavior: FloatingBehavior.DISCRETE,
        },
      });
      const result = service.buildPath(edge, startNode, endNode);
      const {start, end} = getPathStartEnd(result.path);
      expect(start.x).toBeCloseTo(108);
      expect(start.y).toBeCloseTo(50);
      expect(end.x).toBeCloseTo(193);
      expect(end.y).toBeCloseTo(50);
      expect(normalizePath(result.path)).toMatch(ORIENTATION_PATH_REGEX);
    });
  });
});
