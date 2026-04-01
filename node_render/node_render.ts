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
import {LitElement, html} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {BehaviorSubject, Subscription} from 'rxjs';

import {type BaseNode, type Point} from '../common/interfaces';
import {clampVal} from '../common/utils';
import sheet from './node_render.css' with { type: 'css' };

/**
 * The distance in pixels the pointer must move before a drag is initiated.
 */
export const DRAG_THRESHOLD_PX = 5;

/**
 * Default stacking order for the node.
 * Must be kept in sync with gr-node-render z-index in directed_graph.css.
 */
const DEFAULT_Z_INDEX = 2;

/**
 * Component responsible for rendering a single node within the graph.
 * It handles the node's position, dimensions, and drag interactions
 * using native Pointer Events. The visual content of the node is provided
 * via a slot.
 */
@customElement('gr-node-render')
export class NodeRender extends LitElement {
  static override styles = [sheet];

  /**
   * The data object for the node to be rendered.
   * Required.
   */
  @property({type: Object})
  set node(newNode: BaseNode) {
    if (newNode) {
      this.node$.next(newNode);
      if (!this.isDragging) {
        this.x = newNode.x;
        this.y = newNode.y;
        this.updateHostStyles();
      }
    }
  }
  get node(): BaseNode {
    return this.node$.value!;
  }

  /**
   * Current zoom level of the graph, used to scale drag movements.
   * Optional.
   */
  @property({type: Number}) zoom = 1;

  /**
   * Width of the graph canvas, used for drag constraints.
   * Optional.
   */
  @property({type: Number}) graphWidth = 0;

  /**
   * Height of the graph canvas, used for drag constraints.
   * Optional.
   */
  @property({type: Number}) graphHeight = 0;

  /**
   * If true, this node cannot be dragged outside the graph bounds.
   * Optional.
   */
  @property({type: Boolean}) constrainNodeDrag = false;

  /**
   * If true, the node cannot be dragged.
   * Optional.
   */
  @property({type: Boolean}) locked = false;

  /**
   * Stacking order of the node. Higher numbers appear on top.
   * Optional.
   */
  @property({type: Number}) zIndex = DEFAULT_Z_INDEX;

  /**
   * The internal x-coordinate of the node. This value is updated during a
   * drag operation and may differ from `this.node.x` until the drag ends.
   * It is used to compute the element's CSS transform.
   */
  @state() private x = 0;

  /**
   * The internal y-coordinate of the node. This value is updated during a
   * drag operation and may differ from `this.node.y` until the drag ends.
   * It is used to compute the element's CSS transform.
   */
  @state() private y = 0;

  /**
   * A read-only property reflecting the node's dragging state.
   * It is reflected as a host attribute (`isdragging`) for styling purposes.
   * This property should not be set externally.
   */
  @property({type: Boolean, reflect: true}) isDragging = false;

  private readonly node$ = new BehaviorSubject<BaseNode | undefined>(undefined);
  private nodeSubscription?: Subscription;

  // Drag state
  private isPotentiallyDragging = false;
  private startX = 0;
  private startY = 0;
  private pointerDownX = 0;
  private pointerDownY = 0;
  private capturedPointerId: number | null = null;

  private updateHostStyles() {
    if (!this.node$.value) return;
    const node = this.node$.value;

    this.style.width = `${node.width}px`;
    this.style.height = `${node.height}px`;
    this.style.transform = `translate(${this.x}px, ${this.y}px)`;
    this.style.zIndex = `${this.zIndex}`;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.nodeSubscription = this.node$.subscribe((node) => {
      if (node && !this.isDragging) {
        this.x = node.x;
        this.y = node.y;
        this.updateHostStyles();
      } else if (node) {
        this.updateHostStyles();
      }
    });
    this.addEventListener('pointerdown', this.handlePointerDown);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.nodeSubscription?.unsubscribe();
    this.removeEventListener('pointerdown', this.handlePointerDown);
    this.removeDragEventListeners();
  }

  override firstUpdated() {
    this.updateHostStyles();
  }

  private removeDragEventListeners() {
    document.removeEventListener('pointermove', this.handlePointerMove);
    document.removeEventListener('pointerup', this.handlePointerUp);
    document.removeEventListener('pointercancel', this.handlePointerUp);
  }

  private readonly handlePointerDown = (event: PointerEvent) => {
    if (
      this.isDragging ||
      this.locked ||
      !this.node ||
      this.node.dragDisabled
    ) {
      return;
    }

    // Stop the event from bubbling up to the graph renderer's wrapper.
    // This prevents the graph from panning while a node drag is being initiated.
    event.stopPropagation();

    this.isPotentiallyDragging = true;
    this.startX = this.x;
    this.startY = this.y;
    this.pointerDownX = event.clientX;
    this.pointerDownY = event.clientY;
    this.capturedPointerId = event.pointerId;

    document.addEventListener('pointermove', this.handlePointerMove);
    document.addEventListener('pointerup', this.handlePointerUp);
    document.addEventListener('pointercancel', this.handlePointerUp);
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    if (
      !this.isPotentiallyDragging ||
      !this.node ||
      event.pointerId !== this.capturedPointerId
    ) {
      return;
    }

    // Sanity check to prevent a "stuck" dragging state.
    // A `pointermove` event should only trigger a drag if the primary mouse button is actively pressed.
    // However, the `pointerup` event that normally ends the drag can be "lost" in several scenarios, such as:
    //  - A right-click opens a context menu, and the user dismisses it with a click or the 'esc' key.
    //  - The browser window loses focus during a drag operation.
    // This leaves dangling event listeners. When the mouse moves again, this `pointermove` handler
    // is incorrectly called. The `event.buttons` property provides a reliable state check. A value of `1`
    // indicates that only the primary (usually the left) mouse button is pressed.
    // If `event.buttons` is not `1`, we are in a stuck state and must manually
    // call the cleanup handler (`handlePointerUp`) to prevent an unwanted drag.
    if (event.buttons !== 1) {
      this.handlePointerUp(event);
      return;
    }

    const dx = event.clientX - this.pointerDownX;
    const dy = event.clientY - this.pointerDownY;

    if (!this.isDragging) {
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        // Threshold passed, begin the drag.
        this.isDragging = true;
        this.setPointerCapture(this.capturedPointerId!);

        // Dispatch drag-start now that we are sure it's a drag.
        this.dispatchEvent(
          new CustomEvent<BaseNode>('node-drag-start', {
            detail: this.node,
            bubbles: true,
            composed: true,
          }),
        );
      } else {
        // Not dragging yet.
        return;
      }
    }

    event.preventDefault();

    const scaledDx = dx / this.zoom;
    const scaledDy = dy / this.zoom;

    let newX = this.startX + scaledDx;
    let newY = this.startY + scaledDy;

    if (this.constrainNodeDrag) {
      const {width, height} = this.node;
      newX = clampVal(newX, 0, this.graphWidth - width);
      newY = clampVal(newY, 0, this.graphHeight - height);
    }

    this.x = newX;
    this.y = newY;
    this.updateHostStyles();

    this.dispatchEvent(
      new CustomEvent<Point & {id: string}>('node-drag-move', {
        detail: {x: this.x, y: this.y, id: this.node.id},
        bubbles: true,
        composed: true,
      }),
    );
  };

  private readonly handlePointerUp = (event: PointerEvent) => {
    if (
      !this.isPotentiallyDragging ||
      event.pointerId !== this.capturedPointerId
    ) {
      return;
    }

    if (this.isDragging) {
      this.dispatchEvent(
        new CustomEvent<Point & {id: string}>('node-drag-end', {
          detail: {x: this.x, y: this.y, id: this.node.id},
          bubbles: true,
          composed: true,
        }),
      );
      this.releasePointerCapture(this.capturedPointerId!);
    }
    // If it wasn't a drag, we do nothing, and the browser generates a click.

    // Reset all states.
    this.isDragging = false;
    this.isPotentiallyDragging = false;
    this.capturedPointerId = null;
    this.removeDragEventListeners();
  };

  override render() {
    if (!this.node$.value) {
      return html``;
    }
    return html`
      <div class="node-container">
        <slot></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gr-node-render': NodeRender;
  }
}
