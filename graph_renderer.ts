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
import { LitElement, html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import {
  BehaviorSubject,
  Subject,
  Subscription,
  combineLatest,
  fromEvent,
} from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  map,
  takeUntil,
  withLatestFrom,
} from 'rxjs/operators';

import {
  BaseEdge,
  BaseNode,
  Point,
  RenderableEdge,
  TentativeEdge,
  type Dimension,
  type DragEvent,
  type Endpoint,
  type CustomEndpointMarker,
} from './common/interfaces';
import { clampVal, isWheelEventOverScrollable } from './common/utils';
import './directed_graph/directed_graph';
import { EdgePathService } from './edge_path_service/edge_path_service';
import sheet from './graph_renderer.css' with { type: 'css' };
import './minimap/minimap';

interface GraphTheme {
  background: {
    fill: string;
    dots: {
      cx: number;
      cy: number;
      width: number;
      height: number;
      radius: number;
      fill: string;
    };
  };
}

/**
 * Configures the behavior of the mouse wheel.
 */
export enum MouseWheelBehavior {
  /**
   * `Wheel`: Zoom (Captured).
   * `Ctrl/Meta + Wheel`: Pan.
   * This mode "captures" the wheel event, preventing it from reaching
   * scrollable child elements.
   */
  ZOOM_CAPTURES,
  /**
   * `Wheel`: Zoom.
   * `Ctrl/Meta + Wheel`: Pan.
   */
  ZOOM,
  /**
   * `Wheel`: Pan.
   * `Ctrl/Meta + Wheel`: Zoom.
   */
  PAN,
}

/**
 * An object to configure zoom behavior, including min/max zoom levels and
 * step increments.
 */
export interface ZoomStepConfig {
  /** The minimum zoom level allowed. */
  min: number;
  /** The maximum zoom level allowed. */
  max: number;
  /**
   * The amount to change the zoom by for each discrete mouse wheel event.
   * This is used when `enableSmoothZoom` is `false`.
   */
  step: number;
  /**
   * If true, calculates the zoom increment based on the magnitude of the mouse
   * wheel scroll event (`deltaY`), allowing for variable-speed zooming. This
   * provides a more granular zoom level proportional to the scroll speed but
   * does not produce a visual animation between zoom levels.
   * Optional. Defaults to `false`.
   */
  enableSmoothZoom?: boolean;
  /**
   * When `enableSmoothZoom` is true, this controls the sensitivity of the
   * zoom, representing the percentage of zoom change per pixel of vertical
   * wheel scroll.
   * Optional. Defaults to `0.01`.
   */
  zoomPercentPerDeltaY?: number;
  /**
   * When `enableSmoothZoom` is true, this acts as a cap on the maximum amount
   * the zoom can change in a single mouse wheel event. This helps prevent
   * excessively fast zooming.
   * Optional. Defaults to `0.04`.
   */
  maxZoomPerWheelEvent?: number;
  /**
   * If true, enables a CSS transition to create a smooth, animated effect
   * when the zoom level changes.
   * Optional. Default: `false`.
   */
  animateZoom?: boolean;
  /**
   * The CSS transition string to apply for the zoom animation.
   * This is only used if `animateZoom` is true.
   * Optional. Defaults to 'transform 0.2s ease-out'.
   */
  zoomAnimationTransition?: string;
}

/**
 * Exported for testing only
 */
export const DEFAULT_ZOOM_CONFIG: Required<ZoomStepConfig> = {
  max: 4,
  min: 0.01,
  step: 0.05,
  enableSmoothZoom: false,
  zoomPercentPerDeltaY: 0.01,
  maxZoomPerWheelEvent: 0.04,
  animateZoom: false,
  zoomAnimationTransition: 'transform 0.2s ease-out',
};

/**
 * The minimum distance in pixels the cursor must move before a pan is initiated.
 * This helps distinguish between a click and a drag.
 *
 * Exported for testing only
 */
export const PAN_THRESHOLD = 5; // pixels

const CM_SYS_COLOR_SURFACE = '#fff';
const CM_SYS_COLOR_PLACEHOLDER = '#eee';

const DEFAULT_THEME: GraphTheme = {
  background: {
    fill: CM_SYS_COLOR_SURFACE,
    dots: {
      width: 8,
      height: 8,
      cx: 1,
      cy: 1,
      radius: 1,
      fill: CM_SYS_COLOR_PLACEHOLDER,
    },
  },
};
let instanceNumber = 0;

/**
 * Root component for rendering an interactive graph. It handles panning,
 * zooming, and orchestrates the rendering of the graph background, nodes,
 * and edges through child components.
 */
@customElement('gr-graph-renderer')
export class GraphRenderer extends LitElement {
  static override styles = [sheet];

  @query('.wrapper')
  private readonly wrapper!: HTMLElement;

  @query('.directed-graph-element')
  private readonly directedGraphElement!: HTMLElement;

  /**
   * HTMLElement provided by the parent application to be the target for ResizeObserver.
   * This is necessary for certain environments where the component's direct wrapper
   * might not be a standard Element instance observable by a ResizeObserver created within the sandbox.
   * Optional.
   */
  @property({ type: Object }) observeResizeElement?: HTMLElement;

  /**
   * An object to customize the visual appearance of the graph,
   * such as the background color and the dot pattern.
   * Optional.
   */
  @property({ type: Object }) theme: GraphTheme = DEFAULT_THEME;

  @state() private isZooming = false;
  private zoomAnimationTimeout?: number;

  /**
   * Controls the zoom level of the graph. The value is clamped between the
   * `min` and `max` values defined in `zoomStepConfig`.
   * Optional. Default: `1`.
   */
  @property({ type: Number })
  set zoom(zoomLevel: number) {
    const newZoom = clampVal(
      zoomLevel,
      this.zoomStepConfig.min,
      this.zoomStepConfig.max
    );
    if (this.zoom$.value === newZoom) return;

    if (this.zoomStepConfig.animateZoom) {
      this.isZooming = true;
      const transition =
        this.zoomStepConfig.zoomAnimationTransition ??
        DEFAULT_ZOOM_CONFIG.zoomAnimationTransition;
      const durationMs = GraphRenderer.parseTransitionDuration(transition);

      window.clearTimeout(this.zoomAnimationTimeout);
      this.zoomAnimationTimeout = window.setTimeout(() => {
        this.isZooming = false;
      }, durationMs);
    }

    this.zoom$.next(newZoom);
  }
  get zoom(): number {
    return this.zoom$.value;
  }

  /**
   * The total height of the drawable graph area in "world" coordinates. This
   * is used to define the boundaries for features like constrained node dragging.
   * Note: This property is functionally required if `constrainNodeDrag` is true.
   * Optional. Default: `0`.
   */
  @property({ type: Number })
  set graphHeight(height: number) {
    this.graphHeight$.next(height);
  }
  get graphHeight(): number {
    return this.graphHeight$.value;
  }

  /**
   * The total width of the drawable graph area in "world" coordinates. This
   * is used to define the boundaries for features like constrained node dragging.
   * Note: This property is functionally required if `constrainNodeDrag` is true.
   * Optional. Default: `0`.
   */
  @property({ type: Number })
  set graphWidth(width: number) {
    this.graphWidth$.next(width);
  }
  get graphWidth(): number {
    return this.graphWidth$.value;
  }

  /**
   * The x-coordinate for the top-left corner of the viewport, in graph
   * (world) coordinates. This controls the horizontal pan of the graph.
   * This value is updated internally on panning and zooming, but can also be
   * set externally to programmatically pan the graph.
   * Optional. Default: `0`.
   */
  @property({ type: Number })
  set graphX(graphX: number) {
    if (graphX === this.graphX$.value) return;
    this.graphX$.next(graphX);
  }
  get graphX(): number {
    return this.graphX$.value;
  }

  /**
   * The y-coordinate for the top-left corner of the viewport, in graph
   * (world) coordinates. This controls the vertical pan of the graph.
   * This value is updated internally on panning and zooming, but can also be
   * set externally to programmatically pan the graph.
   * Optional. Default: `0`.
   */
  @property({ type: Number })
  set graphY(graphY: number) {
    if (graphY === this.graphY$.value) return;
    this.graphY$.next(graphY);
  }
  get graphY(): number {
    return this.graphY$.value;
  }

  /**
   * An array of `BaseNode` objects that will be rendered on the graph canvas.
   * This is the primary input for displaying nodes.
   * Required to display nodes.
   */
  @property({ type: Array })
  set graphNodes(nodes: BaseNode[]) {
    this.graphNodes$.next(nodes);
  }
  get graphNodes(): BaseNode[] {
    return this.graphNodes$.value;
  }

  /**
   * An instance of a class that extends `EdgePathService`. This service is
   * responsible for calculating the SVG path string for edges that connect nodes.
   * Required for rendering edges.
   */
  @property({ type: Object }) edgePathService!: EdgePathService;

  /**
   * An object that maps a `templateId` from a `BaseNode` to a Lit `html`
   * template function. This allows for custom rendering of different node types.
   * Note: If a template for a `templateId` is not found,
   * the renderer defaults to displaying the node's ID.
   * Optional.
   */
  @property({ type: Object }) nodeTemplates: Record<string, Function> = {};

  /**
   * An array of `BaseEdge` objects to be rendered as connections between nodes.
   * Required to display edges.
   */
  @property({ type: Array }) graphEdges: BaseEdge[] = [];

  /**
   * When an `Endpoint` is provided, a "tentative" edge is drawn from that
   * endpoint to the current position of the mouse cursor.
   * Optional. Default: `null`.
   */
  @property({ type: Object })
  set tentativeEdgeStartEndpoint(endpoint: Endpoint | null) {
    this.tentativeEdgeStartEndpoint$.next(endpoint);
  }
  get tentativeEdgeStartEndpoint(): Endpoint | null {
    return this.tentativeEdgeStartEndpoint$.value;
  }

  /**
   * Disables all user-initiated panning and zooming of the graph viewport.
   * Optional. Default: `false`.
   */
  @property({ type: Boolean })
  set lockGraphViewport(lock: boolean) {
    this.internalLockGraphViewport = lock;
    this.lockGraphViewport$.next(lock);
  }
  get lockGraphViewport(): boolean {
    return this.internalLockGraphViewport;
  }
  private internalLockGraphViewport = false;

  /**
   * Configures the default behavior of the mouse wheel over the graph.
   * Optional.
   */
  @property({ type: Number }) mouseWheelBehavior: MouseWheelBehavior =
    MouseWheelBehavior.ZOOM;

  /**
   * An object to configure zoom behavior, including min/max zoom levels and
   * step increments.
   * Optional.
   */
  @property({ type: Object }) zoomStepConfig: ZoomStepConfig =
    DEFAULT_ZOOM_CONFIG;

  /**
   * If true, prevents nodes from being dragged outside the boundaries defined by
   * `graphWidth` and `graphHeight`.
   * Optional.
   */
  @property({ type: Boolean }) constrainNodeDrag = false;

  /**
   * Whether the minimap should be visible.
   * Optional.
   */
  @property({ type: Boolean }) showMinimap = false;

  /**
   * The size (width and height) of the square minimap in pixels.
   * Optional.
   */
  @property({ type: Number }) minimapSize = 200;

  /**
   * A read-only property reflecting the component's panning state. True when
   * the user is actively panning the graph. It is reflected as a host
   * attribute (`ispanning`) for styling purposes.
   * This property should not be set externally.
   */
  @property({ type: Boolean, reflect: true }) isPanning = false;

  /**
   * An array of `CustomEndpointMarker` objects for defining custom endpoint markers.
   * This allows consumers to provide their own SVG shapes for edge markers.
   * Optional.
   */
  @property({ type: Array }) customEndpointMarkers: CustomEndpointMarker[] = [];

  /**
   * The calculated CSS transform string, derived from the current pan (graphX,
   * graphY) and zoom levels. This is applied to the directed-graph element.
   */
  @state() private graphTransform = '';

  /**
   * An array of tentative edges, typically a single edge from a starting
   * endpoint to the current mouse position. This state is updated on mouse
   * move to provide real-time visual feedback to the user.
   */
  @state() private tentativeEdges: TentativeEdge[] = [];

  /**
   * The current pixel dimensions of the graph renderer's main viewport.
   * This value is updated by a ResizeObserver and is used to provide
   * the viewport size to child components, such as the minimap.
   */
  @state() private viewportDimension: Dimension = { width: 0, height: 0 };

  private readonly subscriptions: Subscription[] = [];
  private readonly zoom$ = new BehaviorSubject<number>(1);
  private readonly graphHeight$ = new BehaviorSubject<number>(0);
  private readonly graphWidth$ = new BehaviorSubject<number>(0);
  private readonly graphX$ = new BehaviorSubject<number>(0);
  private readonly graphY$ = new BehaviorSubject<number>(0);
  private readonly graphNodes$ = new BehaviorSubject<BaseNode[]>([]);
  private readonly tentativeEdgeStartEndpoint$ =
    new BehaviorSubject<Endpoint | null>(null);
  private readonly lockGraphViewport$ = new BehaviorSubject<boolean>(false);
  private readonly draggingNode$ = new BehaviorSubject<boolean>(false);

  private readonly graphXDistinct$ = this.graphX$.pipe(distinctUntilChanged());
  private readonly graphYDistinct$ = this.graphY$.pipe(distinctUntilChanged());

  private readonly instanceNumber: number;
  protected get backroundId() {
    return `graph-renderer-bg-${this.instanceNumber}`;
  }
  protected get backgroundUrl() {
    return `url(#${this.backroundId})`;
  }

  // --- Panning State ---
  private panStartX = 0;
  private panStartY = 0;
  private lastGraphX = 0;
  private lastGraphY = 0;

  constructor() {
    super();
    this.instanceNumber = instanceNumber++;
  }

  private readonly destroy$ = new Subject<void>();

  override async firstUpdated(changedProperties: Map<string, unknown>) {
    super.firstUpdated(changedProperties);

    // Wait for the component's initial render to finish. While elements
    // decorated with @query are typically available within firstUpdated,
    // awaiting updateComplete ensures that the shadow DOM is fully built
    // and all reactive updates have settled. This provides robustness,
    // especially in some complex integration environments
    // where timing differences can affect element readiness.
    await this.updateComplete;

    this.wrapper.addEventListener('pointerdown', this.handlePointerDown);
    this.updateWheelListener();
    this.setupResizeObserver();

    const moveObservable = fromEvent<MouseEvent>(this.wrapper, 'mousemove');
    this.subscriptions.push(
      combineLatest([moveObservable, this.tentativeEdgeStartEndpoint$])
        .pipe(
          withLatestFrom(this.zoom$),
          takeUntil(this.destroy$),
          filter(() => !this.internalLockGraphViewport)
        )
        .subscribe(([[event, endpoint], zoom]) => {
          if (!endpoint || !this.directedGraphElement) {
            this.tentativeEdges = [];
            return;
          }
          const to = GraphRenderer.getOffsetsFromContainer(
            this.directedGraphElement,
            event,
            zoom
          );
          this.tentativeEdges = [{ from: endpoint, to }];
        })
    );
  }

  override updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);
    if (changedProperties.has('observeResizeElement')) {
      this.resizeObserver?.disconnect();
      this.resizeObserver = undefined;
      this.setupResizeObserver();
    }
    if (changedProperties.has('mouseWheelBehavior')) {
      this.updateWheelListener();
    }
  }

  override connectedCallback() {
    super.connectedCallback();
    const graphTransform$ = combineLatest([
      this.zoom$,
      this.graphXDistinct$,
      this.graphYDistinct$,
    ]).pipe(map(([zoom, x, y]) => GraphRenderer.getGraphTransform(zoom, x, y)));

    this.subscriptions.push(
      graphTransform$.subscribe(transform => {
        this.graphTransform = transform;
      }),
      this.lockGraphViewport$.subscribe(locked => {
        this.internalLockGraphViewport = locked;
      })
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.forEach(s => {
      s.unsubscribe();
    });

    if (this.wrapper) {
      this.wrapper.removeEventListener('pointerdown', this.handlePointerDown);
      this.wrapper.removeEventListener('wheel', this.handleWheelEvent, {
        capture: true,
      });
      this.wrapper.removeEventListener('wheel', this.handleWheelEvent, {
        capture: false,
      });
    }

    document.removeEventListener('pointermove', this.handlePointerMove);
    document.removeEventListener('pointerup', this.handlePointerUp);
    this.resizeObserver?.disconnect();
  }

  private resizeObserver: ResizeObserver | undefined;
  private setupResizeObserver() {
    if (typeof ResizeObserver === 'undefined') {
      console.warn('gr-graph-renderer: ResizeObserver API not available.');
      return;
    }
    if (this.resizeObserver) return;

    const target = this.observeResizeElement || this.wrapper;
    if (!target) {
      console.error(
        'gr-graph-renderer: No valid element to observe (observeResizeElement or wrapper).'
      );
      return;
    }

    // We need to check if the target is an Element, as required by ResizeObserver.
    // This is particularly important because this.wrapper might not be a true Element
    // in some complex environments.
    if (!(target instanceof Element)) {
      console.warn(
        'gr-graph-renderer: Target for ResizeObserver is not a valid Element.',
        target
      );
      return;
    }

    try {
      this.resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const dims = {
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          };

          if (
            this.viewportDimension.width !== dims.width ||
            this.viewportDimension.height !== dims.height
          ) {
            this.viewportDimension = dims;
            this.handleResizeWithEvent(dims);
          }
        }
      });
      this.resizeObserver.observe(target);
    } catch (error) {
      console.error(
        'gr-graph-renderer: Failed to observe element',
        error,
        target
      );
    }
  }

  private handleMinimapPan(event: CustomEvent<{ topLeftCorner: Point }>) {
    const { topLeftCorner } = event.detail;
    this.graphX = -topLeftCorner.x;
    this.graphY = -topLeftCorner.y;
    this.dispatchGraphPanEvent({ type: 'minimap-pan', event });
  }

  private handleResizeWithEvent(dims: Dimension) {
    this.dispatchEvent(new CustomEvent('resize-viewport', { detail: dims }));
  }

  private readonly handlePointerDown = (event: PointerEvent) => {
    if (this.internalLockGraphViewport || !event.isPrimary) return;

    // When panning starts, immediately remove the zooming class and cancel any
    // pending timeouts to ensure panning is instant and responsive.
    this.isZooming = false;
    window.clearTimeout(this.zoomAnimationTimeout);

    this.panStartX = event.clientX;
    this.panStartY = event.clientY;
    this.lastGraphX = this.graphX$.value;
    this.lastGraphY = this.graphY$.value;

    document.addEventListener('pointermove', this.handlePointerMove);
    document.addEventListener('pointerup', this.handlePointerUp);
    document.addEventListener('pointercancel', this.handlePointerUp);
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    // Sanity check to prevent a "stuck" panning state.
    // A `pointermove` event should only trigger a pan if the primary mouse button is actively pressed.
    // However, the `pointerup` event that normally ends the pan can be "lost" in several scenarios, such as:
    //  - A right-click opens a context menu, which is then dismissed by a click or the 'esc' key.
    //  - The browser window loses focus during a drag operation.
    // This leaves dangling event listeners. When the mouse moves again, this `pointermove` handler
    // is incorrectly called. The `event.buttons` property provides a reliable state check. A value of `1`
    // indicates that only the primary (usually the left) mouse button is pressed.
    // If `event.buttons` is not `1`, we are in a stuck state and must manually
    // call the cleanup handler (`handlePointerUp`) to prevent an unwanted pan.
    if (event.buttons !== 1) {
      this.handlePointerUp(event);
      return;
    }

    const dx = event.clientX - this.panStartX;
    const dy = event.clientY - this.panStartY;

    if (!this.isPanning && event.isPrimary) {
      // Only start panning if the cursor has moved beyond a threshold.
      // This prevents small, unintentional movements from being treated as a pan.
      if (Math.abs(dx) < PAN_THRESHOLD && Math.abs(dy) < PAN_THRESHOLD) {
        return;
      }
      this.isPanning = true;
      this.dispatchGraphPanEvent({ type: 'start', event });
    }
    if (!this.isPanning) return;

    // When panning is in progress, prevent the default browser
    // action for the move event (e.g., text selection, image dragging, or scrolling).
    event.preventDefault();

    const zoom = this.zoom$.value;
    const newGraphX = this.lastGraphX + dx / zoom;
    const newGraphY = this.lastGraphY + dy / zoom;

    this.graphX$.next(newGraphX);
    this.graphY$.next(newGraphY);

    this.dispatchGraphPanEvent({ type: 'move', event });
  };

  private readonly handlePointerUp = (event: PointerEvent) => {
    document.removeEventListener('pointermove', this.handlePointerMove);
    document.removeEventListener('pointerup', this.handlePointerUp);
    document.removeEventListener('pointercancel', this.handlePointerUp);

    // Only perform pan-ending logic if a pan actually happened.
    if (!this.isPanning || !event.isPrimary) return;

    // A pan has just ended. We must prevent the browser's subsequent 'click'
    // event from being processed by consumers, as it's part of the same pan
    // gesture, not a distinct click.
    //
    // Browsers typically suppress a `click` event if significant movement occurs
    // between `pointerdown` and `pointerup`. However, because we call
    // `event.preventDefault()` in `handlePointerMove` to create our custom pan
    // behavior, we disable that native suppression. Therefore, we must manually
    // consume the unwanted `click` event ourselves.
    //
    // To do this reliably, we add a temporary, one-time capturing listener.
    // This listener is attached to `this.wrapper` (the component's container).
    // This ensures it runs before any other listener for click events within
    // this component, consumes the event, and is then automatically removed.
    //
    // This is safe and will not block a separate, intentional click because the
    // browser's event model dispatches the `pointerup` and its corresponding
    // `click` in a nearly-atomic sequence. A user cannot physically perform a
    // new, separate click (which requires a new `pointerdown` and `pointerup`)
    // faster than this built-in sequence completes.
    const consumeClick = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
    };
    this.wrapper.addEventListener('click', consumeClick, {
      once: true,
      capture: true,
    });

    // With the click being consumed, we can safely reset the isPanning flag
    // immediately, making the component ready for a new, distinct click
    // without any delay.
    this.isPanning = false;

    this.dispatchGraphPanEvent({ type: 'end', event });
  };

  private dispatchGraphPanEvent(dragEvent: DragEvent) {
    const topLeftCorner = { x: -this.graphX$.value, y: -this.graphY$.value };
    this.dispatchEvent(
      new CustomEvent('graph-pan', {
        detail: { event: dragEvent, topLeftCorner },
      })
    );
  }

  protected handleWheelEvent = async (event: WheelEvent) => {
    if (this.internalLockGraphViewport) return;

    const isModKey = event.ctrlKey || event.metaKey;

    if (this.mouseWheelBehavior === MouseWheelBehavior.ZOOM_CAPTURES) {
      event.preventDefault();
      event.stopPropagation();
      if (isModKey) {
        // Pan
        const currentX = this.graphX$.value;
        const currentY = this.graphY$.value;
        this.graphX$.next(currentX - event.deltaX / this.zoom$.value);
        this.graphY$.next(currentY - event.deltaY / this.zoom$.value);
        this.dispatchGraphPanEvent({ type: 'wheel', event });
      } else {
        // Zoom
        this.zoomOnWheel(event);
      }
      return;
    }

    // For non-MouseWheelBehavior.ZOOM_CAPTURES modes, let browser handle events that originated inside a scrollable child.
    if (isWheelEventOverScrollable(event, this.wrapper)) {
      return;
    }

    // If we are not over a scrollable child, take over the event for graph interaction.
    event.preventDefault();

    switch (this.mouseWheelBehavior) {
      case MouseWheelBehavior.ZOOM:
        if (isModKey) {
          // Pan
          const currentX = this.graphX$.value;
          const currentY = this.graphY$.value;
          this.graphX$.next(currentX - event.deltaX / this.zoom$.value);
          this.graphY$.next(currentY - event.deltaY / this.zoom$.value);
          this.dispatchGraphPanEvent({ type: 'wheel', event });
        } else {
          // Zoom
          this.zoomOnWheel(event);
        }
        break;
      case MouseWheelBehavior.PAN:
      default:
        if (isModKey) {
          // Zoom
          this.zoomOnWheel(event);
        } else {
          // Pan
          const currentX = this.graphX$.value;
          const currentY = this.graphY$.value;
          this.graphX$.next(currentX - event.deltaX / this.zoom$.value);
          this.graphY$.next(currentY - event.deltaY / this.zoom$.value);
          this.dispatchGraphPanEvent({ type: 'wheel', event });
        }
        break;
    }
  };

  private updateWheelListener() {
    this.wrapper.removeEventListener('wheel', this.handleWheelEvent, {
      capture: true,
    });
    this.wrapper.removeEventListener('wheel', this.handleWheelEvent, {
      capture: false,
    });

    const isCapture =
      this.mouseWheelBehavior === MouseWheelBehavior.ZOOM_CAPTURES;
    this.wrapper.addEventListener('wheel', this.handleWheelEvent, {
      capture: isCapture,
      passive: false,
    });
  }

  private zoomOnWheel(event: WheelEvent) {
    const currentZoom = this.zoom$.value;
    const { width, height } = this.wrapper.getBoundingClientRect();
    if (!width || !height) return;

    const nextZoom = clampVal(
      GraphRenderer.getUpdatedGraphZoomFromWheelEvent(
        event,
        currentZoom,
        this.zoomStepConfig
      ),
      this.zoomStepConfig.min,
      this.zoomStepConfig.max
    );

    if (currentZoom === nextZoom) return;

    const { top, left } = this.wrapper.getBoundingClientRect();
    const mouseX = event.clientX - left;
    const mouseY = event.clientY - top;

    const worldXBefore =
      (mouseX - this.graphX$.value * currentZoom) / currentZoom;
    const worldYBefore =
      (mouseY - this.graphY$.value * currentZoom) / currentZoom;

    this.zoom = nextZoom;

    const newGraphX = (mouseX - worldXBefore * nextZoom) / nextZoom;
    const newGraphY = (mouseY - worldYBefore * nextZoom) / nextZoom;

    this.graphX$.next(newGraphX);
    this.graphY$.next(newGraphY);

    this.dispatchEvent(
      new CustomEvent('graph-zoom', { detail: { event, zoom: nextZoom } })
    );
    this.dispatchGraphPanEvent({ type: 'wheel', event });
  }

  // --- Node Drag Handlers ---
  private handleNodeDragStart(event: CustomEvent) {
    this.draggingNode$.next(true);
    this.dispatchEvent(
      new CustomEvent('node-drag-start', { detail: event.detail })
    );
  }

  private handleNodeDragMove(event: CustomEvent<Point & { id: string }>) {
    this.dispatchEvent(
      new CustomEvent('node-drag-move', { detail: event.detail })
    );
  }

  private handleNodeDragEnd(event: CustomEvent<Point & { id: string }>) {
    const detail = event.detail;
    const currentGraphNodes = this.graphNodes$.value;
    const nextGraphNodes = currentGraphNodes.map(node => {
      return node.id === detail.id
        ? { ...node, x: detail.x, y: detail.y }
        : node;
    });
    this.graphNodes$.next(nextGraphNodes);
    this.draggingNode$.next(false);
    this.dispatchEvent(new CustomEvent('node-drag-end', { detail }));
  }

  private handleEdgeClick(event: CustomEvent<RenderableEdge>) {
    this.dispatchEvent(new CustomEvent('edge-click', { detail: event.detail }));
  }

  static getGraphTransform(
    zoom: number,
    graphX: number,
    graphY: number
  ): string {
    return `translate(${graphX * zoom}px, ${graphY * zoom}px) scale(${zoom})`;
  }

  static getOffsetsFromContainer(
    containerElement: HTMLElement,
    event: MouseEvent,
    zoom: number
  ): Point {
    const rect = containerElement.getBoundingClientRect();
    const eventOffsetX = event.clientX - rect.left;
    const eventOffsetY = event.clientY - rect.top;
    return { x: eventOffsetX / zoom, y: eventOffsetY / zoom };
  }

  static getUpdatedGraphZoomFromWheelEvent(
    event: WheelEvent,
    currentZoom: number,
    zoomStepConfig: ZoomStepConfig
  ): number {
    const step = zoomStepConfig.step;
    const enableSmoothZoom =
      zoomStepConfig.enableSmoothZoom ?? DEFAULT_ZOOM_CONFIG.enableSmoothZoom;
    const zoomPercentPerDeltaY =
      zoomStepConfig.zoomPercentPerDeltaY ??
      DEFAULT_ZOOM_CONFIG.zoomPercentPerDeltaY;
    const maxZoomPerWheelEvent =
      zoomStepConfig.maxZoomPerWheelEvent ??
      DEFAULT_ZOOM_CONFIG.maxZoomPerWheelEvent;
    const direction = event.deltaY > 0 ? -1 : 1;
    if (enableSmoothZoom && event.deltaMode === WheelEvent.DOM_DELTA_PIXEL) {
      const wheelMagnitude = Math.abs(event.deltaY);
      const zoomMagnitude = Math.min(
        wheelMagnitude * zoomPercentPerDeltaY,
        maxZoomPerWheelEvent
      );
      return currentZoom * (1 + direction * zoomMagnitude);
    } else {
      return currentZoom + direction * step;
    }
  }

  static getScaledDimension(unscaled: Dimension, zoom: number): Dimension {
    return { width: unscaled.width / zoom, height: unscaled.height / zoom };
  }
  static getRectCenter(dim: Dimension): Point {
    return { x: dim.width / 2, y: dim.height / 2 };
  }

  /**
   * Parses the duration in milliseconds from a CSS transition string.
   * Example: "transform 0.2s ease-out" -> 200
   */
  static parseTransitionDuration(transition: string): number {
    const match = transition.match(/([0-9.]+)(ms|s)/);
    if (match) {
      const value = Number(match[1]);
      const unit = match[2];
      return unit === 's' ? value * 1000 : value;
    }
    return 200; // Default fallback.
  }

  override render() {
    const styles: { [key: string]: string | undefined } = {
      transform: this.graphTransform,
      transition: this.isZooming
        ? (this.zoomStepConfig.zoomAnimationTransition ??
          DEFAULT_ZOOM_CONFIG.zoomAnimationTransition)
        : undefined,
    };

    return html`
      <div class="wrapper">
        <div class="background-canvas">
          <svg
            width="100%"
            height="100%"
            style="position: absolute; background-color: ${this.theme.background
              .fill};"
          >
            <defs>
              <pattern
                id="${this.backroundId}"
                x="0"
                y="0"
                width="${this.theme.background.dots.width}"
                height="${this.theme.background.dots.height}"
                patternUnits="userSpaceOnUse"
              >
                <circle
                  cx="${this.theme.background.dots.cx}"
                  cy="${this.theme.background.dots.cy}"
                  r="${this.theme.background.dots.radius}"
                  fill="${this.theme.background.dots.fill}"
                ></circle>
              </pattern>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="${this.backgroundUrl}"
            ></rect>
          </svg>
        </div>
        <gr-directed-graph
          class="directed-graph-element"
          style=${styleMap(styles)}
          .edgePathService=${this.edgePathService}
          .nodes=${this.graphNodes}
          .edges=${this.graphEdges}
          .tentativeEdges=${this.tentativeEdges}
          .customEndpointMarkers=${this.customEndpointMarkers}
          .zoom=${this.zoom}
          .graphWidth=${this.graphWidth$.value}
          .graphHeight=${this.graphHeight$.value}
          .constrainNodeDrag=${this.constrainNodeDrag}
          .nodeTemplates=${this.nodeTemplates}
          .lockGraphViewport=${this.internalLockGraphViewport}
          @node-drag-start=${this.handleNodeDragStart}
          @node-drag-move=${this.handleNodeDragMove}
          @node-drag-end=${this.handleNodeDragEnd}
          @edge-click=${this.handleEdgeClick}
        >
          <slot></slot>
        </gr-directed-graph>
        ${this.showMinimap
          ? html`
              <div class="minimap-container">
                <gr-minimap
                  .size=${this.minimapSize}
                  .nodes=${this.graphNodes}
                  .zoom=${this.zoom}
                  .graphX=${this.graphX}
                  .graphY=${this.graphY}
                  .graphWidth=${this.graphWidth$.value}
                  .graphHeight=${this.graphHeight$.value}
                  .winWidth=${this.viewportDimension.width}
                  .winHeight=${this.viewportDimension.height}
                  @minimap-pan=${this.handleMinimapPan}
                ></gr-minimap>
              </div>
            `
          : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gr-graph-renderer': GraphRenderer;
  }
}
