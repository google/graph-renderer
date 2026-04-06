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

import {
  describe,
  expect,
  it,
  pit,
} from 'google3/javascript/angular2/testing/catalyst/fake_async';

import {BaseNode, Side} from '../common/interfaces';
import {BendDirection, EdgePathService, Quadrant} from './edge_path_service';

describe('EdgePathService', () => {
  describe('static methods', () => {
    describe('#getNeighborQuadrant', () => {
      it('handles top right clockwise', () => {
        expect(
          EdgePathService.getNeighborQuadrant(
            Quadrant.TOP_RIGHT,
            BendDirection.CLOCKWISE,
          ),
        ).toEqual(Quadrant.BOTTOM_RIGHT);
      });
      it('handles top right counter-clockwise', () => {
        expect(
          EdgePathService.getNeighborQuadrant(
            Quadrant.TOP_RIGHT,
            BendDirection.COUNTER_CLOCKWISE,
          ),
        ).toEqual(Quadrant.TOP_LEFT);
      });
      it('handles bottom right clockwise', () => {
        expect(
          EdgePathService.getNeighborQuadrant(
            Quadrant.BOTTOM_RIGHT,
            BendDirection.CLOCKWISE,
          ),
        ).toEqual(Quadrant.BOTTOM_LEFT);
      });
      it('handles bottom right counter-clockwise', () => {
        expect(
          EdgePathService.getNeighborQuadrant(
            Quadrant.BOTTOM_RIGHT,
            BendDirection.COUNTER_CLOCKWISE,
          ),
        ).toEqual(Quadrant.TOP_RIGHT);
      });
      it('handles top left clockwise', () => {
        expect(
          EdgePathService.getNeighborQuadrant(
            Quadrant.TOP_LEFT,
            BendDirection.CLOCKWISE,
          ),
        ).toEqual(Quadrant.TOP_RIGHT);
      });
      it('handles top left counter-clockwise', () => {
        expect(
          EdgePathService.getNeighborQuadrant(
            Quadrant.TOP_LEFT,
            BendDirection.COUNTER_CLOCKWISE,
          ),
        ).toEqual(Quadrant.BOTTOM_LEFT);
      });
      it('handles bottom left clockwise', () => {
        expect(
          EdgePathService.getNeighborQuadrant(
            Quadrant.BOTTOM_LEFT,
            BendDirection.CLOCKWISE,
          ),
        ).toEqual(Quadrant.TOP_LEFT);
      });
      it('handles bottom left counter-clockwise', () => {
        expect(
          EdgePathService.getNeighborQuadrant(
            Quadrant.BOTTOM_LEFT,
            BendDirection.COUNTER_CLOCKWISE,
          ),
        ).toEqual(Quadrant.BOTTOM_RIGHT);
      });
    });
    describe('#getOppositeDirection', () => {
      it('handles clockwise correctly', () => {
        expect(
          EdgePathService.getOppositeDirection(BendDirection.CLOCKWISE),
        ).toEqual(BendDirection.COUNTER_CLOCKWISE);
      });
      it('handles counter-clockwise correctly', () => {
        expect(
          EdgePathService.getOppositeDirection(BendDirection.COUNTER_CLOCKWISE),
        ).toEqual(BendDirection.CLOCKWISE);
      });
    });
    describe('#getElbow', () => {
      it('computes an elbow to bottom right ', () => {
        const start = {x: 10, y: 10};
        const radius = 5;
        const endQuadrant = Quadrant.BOTTOM_RIGHT;
        const bendDirection = BendDirection.CLOCKWISE;

        expect(
          EdgePathService.getElbow(start, endQuadrant, bendDirection, radius),
        ).toEqual({path: 'M 10 10 Q 15 10 15 15', end: {x: 15, y: 15}});
      });
      it('computes an elbow to top right ', () => {
        const start = {x: 10, y: 10};
        const radius = 5;
        const endQuadrant = Quadrant.TOP_RIGHT;
        const bendDirection = BendDirection.COUNTER_CLOCKWISE;

        expect(
          EdgePathService.getElbow(start, endQuadrant, bendDirection, radius),
        ).toEqual({path: 'M 10 10 Q 15 10 15 5', end: {x: 15, y: 5}});
      });
      it('computes an elbow to top left ', () => {
        const start = {x: 10, y: 10};
        const radius = 5;
        const endQuadrant = Quadrant.TOP_LEFT;
        const bendDirection = BendDirection.COUNTER_CLOCKWISE;

        expect(
          EdgePathService.getElbow(start, endQuadrant, bendDirection, radius),
        ).toEqual({path: 'M 10 10 Q 10 5 5 5', end: {x: 5, y: 5}});
      });
      it('computes an elbow to bottom left ', () => {
        const start = {x: 10, y: 10};
        const radius = 5;
        const endQuadrant = Quadrant.BOTTOM_LEFT;
        const bendDirection = BendDirection.CLOCKWISE;

        expect(
          EdgePathService.getElbow(start, endQuadrant, bendDirection, radius),
        ).toEqual({path: 'M 10 10 Q 10 15 5 15', end: {x: 5, y: 15}});
      });
    });
    describe('#getControlPointsForBezierCurve', () => {
      describe('when no sides are povided', () => {
        describe('if start is above end', () => {
          it('returns the correct control points', () => {
            const start = {x: 100, y: 100};
            const end = {x: 150, y: 200};

            expect(
              EdgePathService.getControlPointsForBezierCurve(start, end),
            ).toEqual([
              {x: 100, y: 150},
              {x: 150, y: 150},
            ]);
          });
        });
        describe('if start is below end', () => {
          it('returns the correct control points', () => {
            const end = {x: 100, y: 100};
            const start = {x: 150, y: 200};

            expect(
              EdgePathService.getControlPointsForBezierCurve(start, end),
            ).toEqual([
              {x: 125, y: 200},
              {x: 125, y: 100},
            ]);
          });
        });
      });
      describe('when sides are provided', () => {
        const curvature = 0.25;

        describe('when startNode is left of endNode', () => {
          const startNodePoint = {x: 100, y: 100};
          const endNodePoint = {x: 500, y: 100};
          describe('when the startNodePort is on the left side and the endNodePort is on the right side', () => {
            it('returns the correct control points', () => {
              const result = EdgePathService.getControlPointsForBezierCurve(
                startNodePoint,
                endNodePoint,
                {
                  start: Side.LEFT,
                  end: Side.RIGHT,
                  curvature,
                },
              );

              expect(result).toEqual([
                {x: -25, y: 100},
                {x: 625, y: 100},
              ]);
            });
          });
          describe('when the startNodePort is on the top side and the endNodePort is on the right side', () => {
            it('returns the correct control points', () => {
              const result = EdgePathService.getControlPointsForBezierCurve(
                startNodePoint,
                endNodePoint,
                {
                  start: Side.TOP,
                  end: Side.RIGHT,
                  curvature,
                },
              );

              expect(result).toEqual([
                {x: 100, y: 100},
                {x: 625, y: 100},
              ]);
            });
          });
          describe('when the startNodePort is on the bottom side and the endNodePort is on the right side', () => {
            it('returns the correct control points', () => {
              const result = EdgePathService.getControlPointsForBezierCurve(
                startNodePoint,
                endNodePoint,
                {
                  start: Side.BOTTOM,
                  end: Side.RIGHT,
                  curvature,
                },
              );

              expect(result).toEqual([
                {x: 100, y: 100},
                {x: 625, y: 100},
              ]);
            });
          });
          describe('when the startNodePort is on the right side and the endNodePort is on the left side', () => {
            it('returns the correct control points', () => {
              const result = EdgePathService.getControlPointsForBezierCurve(
                startNodePoint,
                endNodePoint,
                {
                  start: Side.RIGHT,
                  end: Side.LEFT,
                  curvature,
                },
              );

              expect(result).toEqual([
                {x: 300, y: 100},
                {x: 300, y: 100},
              ]);
            });
          });
        });
      });
    });
    describe('#getPortPaddingOffsets', () => {
      const padding = 10;
      it('computes correct offsets', () => {
        const offsets = EdgePathService.getPortPaddingOffsets(padding);

        expect(offsets).toEqual({
          [Side.LEFT]: {x: -10, y: 0},
          [Side.RIGHT]: {x: 10, y: 0},
          [Side.TOP]: {x: 0, y: -10},
          [Side.BOTTOM]: {x: 0, y: 10},
        });
      });
    });
    describe('#getPortOffsetForNode', () => {
      const padding = 10;
      const node: BaseNode = {
        x: 10,
        y: 10,
        ports: [
          {id: 'top1', side: Side.TOP},
          {id: 'left1', side: Side.LEFT},
          {id: 'right1', side: Side.RIGHT},
          {id: 'bottom1', side: Side.BOTTOM},
          {id: 'top2', side: Side.TOP},
          {id: 'left2', side: Side.LEFT},
          {id: 'right2', side: Side.RIGHT},
          {id: 'left3', side: Side.LEFT},
          {id: 'right3', side: Side.RIGHT},
        ],
        height: 100,
        width: 200,
        id: 'node',
        templateId: 'template',
      };
      pit(
        'when portId is',
        {
          'top1': {id: 'top1', expected: {x: 66, y: -10}},
          'top2': {id: 'top2', expected: {x: 132, y: -10}},
          'right1': {id: 'right1', expected: {x: 210, y: 25}},
          'right2': {id: 'right2', expected: {x: 210, y: 50}},
          'right3': {id: 'right3', expected: {x: 210, y: 75}},
          'left1': {id: 'left1', expected: {x: -10, y: 25}},
          'left2': {id: 'left2', expected: {x: -10, y: 50}},
          'left3': {id: 'left3', expected: {x: -10, y: 75}},
          'bottom1': {id: 'bottom1', expected: {x: 100, y: 110}},
          'undefined': {id: undefined, expected: {x: 0, y: 0}},
          'notfound': {id: 'notfound', expected: {x: 0, y: 0}},
        },
        ({id, expected}) => {
          expect(
            EdgePathService.getPortOffsetForNode(id, node, padding),
          ).toEqual(expected);
        },
      );
      it('returns {x: 0, y: 0} if node has no ports', () => {
        const nodeNoPorts = {...node, ports: undefined};
        expect(
          EdgePathService.getPortOffsetForNode('top1', nodeNoPorts, padding),
        ).toEqual({x: 0, y: 0});
      });
    });
    describe('#getLine', () => {
      it('creates the correct SVG line', () => {
        const start = {x: 100, y: 100};
        const endOffset = {x: 10, y: 10};

        expect(EdgePathService.getLine(start, endOffset)).toEqual({
          path: 'M 100 100 L 110 110',
          end: {x: 110, y: 110},
        });
      });
    });
    describe('#getControlPointOffset', () => {
      describe('with a positive distance', () => {
        const distance = 32;
        it('returns half the distance', () => {
          expect(EdgePathService.getControlPointOffset(distance, 0.25)).toEqual(
            16,
          );
        });
      });
      describe('with a negative distance', () => {
        const distance = -36;
        it('returns the curvature times the square root of the absolute value of the distance', () => {
          expect(EdgePathService.getControlPointOffset(distance, 0.25)).toEqual(
            37.5,
          );
        });
      });
    });
  });
});
