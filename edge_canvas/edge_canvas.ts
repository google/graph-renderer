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
import { LitElement, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { combineLatest, BehaviorSubject, type Subscription } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  EndpointMarker,
  type CustomEndpointMarker,
  type RenderableEdge,
  type RenderableTentativeEdge,
} from '../common/interfaces';
import sheet from './edge_canvas.css' with { type: 'css' };

// Internal alias for a marker definition, used for both built-in and custom markers.
type MarkerDef = CustomEndpointMarker;

/**
 * An object containing the definitions for the built-in endpoint markers.
 * This can be used by consumers to build their own custom markers.
 */
export const BUILT_IN_MARKER_DEFINITIONS: Readonly<
  Record<
    Exclude<EndpointMarker, EndpointMarker.NONE>,
    Omit<CustomEndpointMarker, 'id' | 'color'>
  >
> = {
  [EndpointMarker.ARROW]: {
    path: 'M 0 0 L 10 5 L 0 10 L 2 5 z',
    refX: 7,
    refY: 5,
    markerWidth: 5,
    markerHeight: 10,
    orient: 'auto-start-reverse',
  },
  [EndpointMarker.TRIANGLE]: {
    path: 'M 0 0 L 10 5 L 0 10 z',
    refX: 7,
    refY: 5,
    markerWidth: 5,
    markerHeight: 10,
    orient: 'auto-start-reverse',
  },
  [EndpointMarker.CIRCLE]: {
    type: 'circle',
    refX: 7,
    refY: 5,
    markerWidth: 6,
    markerHeight: 6,
    orient: 'auto-start-reverse',
  },
  [EndpointMarker.SQUARE]: {
    type: 'square',
    refX: 7,
    refY: 5,
    markerWidth: 6,
    markerHeight: 6,
    orient: 'auto-start-reverse',
  },
};

function getEdgeStyleClasslist(edge: RenderableEdge): string {
  const { style } = edge;
  if (!style) {
    return 'edge';
  }
  const { animation, dash, opacity, interactive } = style;
  const classes = ['edge'];
  if (animation) {
    classes.push(`edge-animation-${animation.replace(/_/g, '-')}`);
  }
  if (dash) {
    classes.push(`edge-dash-${dash.replace(/_/g, '-')}`);
  }
  if (opacity) {
    classes.push(`edge-opacity-${opacity}`);
  }
  if (interactive) {
    classes.push('edge-interactive');
  }
  return classes.join(' ');
}

/**
 * Generates a unique ID for a marker definition based on its type and color.
 * The color string is sanitized to ensure it's a valid part of an ID.
 */
function getEndpointMarkerId(
  markerType: EndpointMarker | string,
  color: string
): string | null {
  if (markerType === EndpointMarker.NONE) {
    return null;
  }

  // If markerType is a number, it's a built-in enum, so generate the namespaced ID.
  if (typeof markerType === 'number') {
    const safeColor = color.replace(/[^a-zA-Z0-9]/g, '');
    return `marker-${markerType}-${safeColor}`;
  }

  // Otherwise, it must be a string for a custom marker. Return it directly.
  return markerType;
}

// Generates the marker definitions to be placed in an SVG <defs> section.
function createMarkerDefs(
  markerMap: Map<string, EndpointMarker[]>
): MarkerDef[] {
  const defs: MarkerDef[] = [];
  for (const [color, markers] of markerMap.entries()) {
    for (const markerType of markers) {
      if (markerType === EndpointMarker.NONE) continue;
      const id = getEndpointMarkerId(markerType, color);
      if (!id) continue;

      const markerDef =
        BUILT_IN_MARKER_DEFINITIONS[
          markerType as Exclude<EndpointMarker, EndpointMarker.NONE>
        ];
      if (markerDef) {
        defs.push({
          id,
          color,
          ...markerDef,
        });
      }
    }
  }
  return defs;
}

/**
 * Component responsible for rendering all the edges and tentative edges
 * within an SVG canvas. It dynamically creates SVG <path> elements for each edge
 * and supports various styles, markers, and animations.
 */
@customElement('gr-edge-canvas')
export class EdgeCanvas extends LitElement {
  static override styles = [sheet];

  /**
   * An array of `RenderableEdge` objects to be drawn on the SVG canvas. Each
   * object contains the path data and styling information for a single edge.
   * Required to display standard edges.
   */
  @property({ type: Array })
  set edges(edges: RenderableEdge[]) {
    this.edges$.next(edges || []);
  }
  get edges(): RenderableEdge[] {
    return this.edges$.value;
  }

  /**
   * An array of `RenderableTentativeEdge` objects to be drawn on the canvas.
   * These are typically used to provide visual feedback, such as showing an
   * edge being dragged from a node before it is connected.
   * Optional.
   */
  @property({ type: Array })
  set tentativeEdges(edges: RenderableTentativeEdge[]) {
    this.tentativeEdges$.next(edges || []);
  }
  get tentativeEdges(): RenderableTentativeEdge[] {
    return this.tentativeEdges$.value;
  }

  /**
   * An array of `CustomEndpointMarker` objects for defining custom endpoint markers.
   * This allows for the rendering of custom SVG shapes for edge endpoints.
   * Optional.
   */
  @property({ type: Array })
  set customEndpointMarkers(markers: CustomEndpointMarker[]) {
    this.customEndpointMarkers$.next(markers || []);
  }
  get customEndpointMarkers(): CustomEndpointMarker[] {
    return this.customEndpointMarkers$.value;
  }
  @state() private renderableEdges: RenderableEdge[] = [];
  @state() private renderableTentativeEdges: RenderableTentativeEdge[] = [];
  @state() private markerDefs: MarkerDef[] = [];
  @state() private isDraggingTentativeEdge = false;

  protected readonly edges$ = new BehaviorSubject<RenderableEdge[]>([]);
  private readonly tentativeEdges$ = new BehaviorSubject<
    RenderableTentativeEdge[]
  >([]);
  private readonly customEndpointMarkers$ = new BehaviorSubject<
    CustomEndpointMarker[]
  >([]);

  private readonly draggingTentativeEdge$ = this.tentativeEdges$.pipe(
    map(tentativeEdges => tentativeEdges.length > 0)
  );

  private readonly subscriptions: Subscription[] = [];

  override connectedCallback() {
    super.connectedCallback();
    const markerDefs$ = combineLatest([
      this.edges$,
      this.customEndpointMarkers$,
    ]).pipe(
      map(([edges, customEndpointMarkers]) => {
        // Group all unique marker types by their color to avoid duplicate definitions.
        const markerMap = new Map<string, Set<EndpointMarker>>();
        edges.forEach(edge => {
          if (!edge.style) return;

          const color = edge.style.color;
          if (!markerMap.has(color)) {
            markerMap.set(color, new Set<EndpointMarker>());
          }
          const markers = markerMap.get(color)!;
          const { fromMarker, toMarker } = edge.style;

          if (typeof fromMarker === 'number') {
            markers.add(fromMarker);
          }

          if (typeof toMarker === 'number') {
            markers.add(toMarker);
          }
        });
        // Convert the Set to an Array for the createMarkerDefs function.
        const mapWithArrays = new Map<string, EndpointMarker[]>();
        markerMap.forEach((value, key) => {
          mapWithArrays.set(key, Array.from(value));
        });
        const defaultDefs = createMarkerDefs(mapWithArrays);
        return [...customEndpointMarkers, ...defaultDefs];
      })
    );

    this.subscriptions.push(
      this.edges$.subscribe(edges => {
        this.renderableEdges = edges;
      }),
      this.tentativeEdges$.subscribe(edges => {
        this.renderableTentativeEdges = edges;
      }),
      this.draggingTentativeEdge$.subscribe(isDragging => {
        this.isDraggingTentativeEdge = isDragging;
      }),
      markerDefs$.subscribe(defs => {
        this.markerDefs = defs;
      })
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.subscriptions.forEach(sub => {
      sub.unsubscribe();
    });
  }

  private clickEdge(event: MouseEvent, edge: RenderableEdge) {
    if (!edge.style.interactive) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    this.dispatchEvent(
      new CustomEvent<RenderableEdge>('edge-click', {
        detail: edge,
        bubbles: true,
        composed: true,
      })
    );
  }

  override render() {
    return svg`
      <svg class="edge-canvas ${this.isDraggingTentativeEdge ? 'dragging-tentative-edge' : ''}">
        <defs>
          ${this.markerDefs.map(def => {
            return svg`
              <marker
                id="${def.id}"
                viewBox="0 0 10 10"
                refX="${def.refX}"
                refY="${def.refY}"
                markerWidth="${def.markerWidth}"
                markerHeight="${def.markerHeight}"
                orient="${def.orient}"
              >
                ${
                  def.type === 'circle'
                    ? svg`<circle cx="5" cy="5" r="4" fill="${def.color}" />`
                    : def.type === 'square'
                      ? svg`<rect x="1" y="1" width="8" height="8" fill="${def.color}" />`
                      : svg`<path d="${def.path!}" fill="${def.color}"></path>`
                }
              </marker>
            `;
          })}
        </defs>
        ${this.renderableEdges.map(edge => {
          const fromMarker = edge.style?.fromMarker ?? EndpointMarker.NONE;
          const toMarker = edge.style?.toMarker ?? EndpointMarker.NONE;
          const color = edge.style?.color ?? 'gray';

          const startMarkerId = getEndpointMarkerId(fromMarker, color);
          const endMarkerId = getEndpointMarkerId(toMarker, color);

          return svg`
            <path
              class="edge-hit-area"
              data-edge-id="${edge.id}"
              d=${edge.path}
              stroke="transparent"
              stroke-width="20"
              fill="none"
              style="pointer-events: stroke; stroke-linecap: round;"
              @click=${(e: MouseEvent) => {
                this.clickEdge(e, edge);
              }}
            ></path>
            <path
              class="${getEdgeStyleClasslist(edge)}"
              data-edge-id="${edge.id}"
              d=${edge.path}
              stroke="${color}"
              marker-start=${startMarkerId ? `url(#${startMarkerId})` : 'none'}
              marker-end=${endMarkerId ? `url(#${endMarkerId})` : 'none'}
              style="pointer-events: none;"
            ></path>
          `;
        })}
        ${this.renderableTentativeEdges.map(
          edge => svg`
          <path
            class="tentative-edge"
            stroke="${edge.style?.color ?? 'gray'}"
            d=${edge.path}
          ></path>
        `
        )}
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gr-edge-canvas': EdgeCanvas;
  }
}
