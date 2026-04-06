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
import {styleMap} from 'lit/directives/style-map.js';
import {BaseNode, DragEvent, Point} from '../common/interfaces';
import sheet from './minimap.css' with { type: 'css' };

interface NodeWithTransform extends BaseNode {
  cssTransform: string;
}

/**
 * A component that renders a small, interactive preview of the main graph.
 *
 * The minimap provides an overview of the entire graph canvas and displays a
 * rectangle representing the user's current viewport. It allows for quick
 * navigation via two interaction modes: clicking on a location to center the
 * viewport there, and dragging the viewbox to pan the main graph.
 */
@customElement('gr-minimap')
export class Minimap extends LitElement {
  static override styles = [sheet];

  /**
   * The current zoom level of the parent graph renderer.
   * Optional.
   */
  @property({type: Number}) zoom = 1;

  /**
   * The current x-coordinate of the parent graph's viewport.
   * Optional.
   */
  @property({type: Number}) graphX = 0;

  /**
   * The current y-coordinate of the parent graph's viewport.
   * Optional.
   */
  @property({type: Number}) graphY = 0;

  /**
   * The total width of the parent graph's canvas.
   * Optional.
   */
  @property({type: Number}) graphWidth = 0;

  /**
   * The total height of the parent graph's canvas.
   * Optional.
   */
  @property({type: Number}) graphHeight = 0;

  /**
   * The array of node data objects from the parent graph.
   * Optional.
   */
  @property({type: Array}) nodes: BaseNode[] = [];

  /**
   * The width of the parent graph's viewport element in pixels.
   * Optional.
   */
  @property({type: Number}) winWidth = 0;

  /**
   * The height of the parent graph's viewport element in pixels.
   * Optional.
   */
  @property({type: Number}) winHeight = 0;

  /**
   * The size (width and height) of the square minimap component in pixels.
   * Optional.
   */
  @property({type: Number}) size = 200;

  /**
   * An array of node data augmented with CSS transform strings for rendering.
   */
  @state() private nodesWithTransform: NodeWithTransform[] = [];

  /**
   * Inline styles for the container of the minimap canvas.
   */
  @state() private canvasContainerStyles: {[key: string]: string} = {};

  /**
   * Inline styles for the minimap's main canvas element.
   */
  @state() private canvasStyles: {[key: string]: string} = {};

  /**
   * Inline styles for the box representing the user's current viewport.
   */
  @state() private viewBoxStyles: {[key: string]: string} = {};

  // Panning State
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private lastViewBoxX = 0;
  private lastViewBoxY = 0;

  override willUpdate(changedProperties: Map<string | symbol, unknown>) {
    // Only compute the state from properties if we are not in the middle of a pan.
    // This prevents the parent's re-render from overwriting the drag state.
    if (changedProperties.size > 0 && !this.isPanning) {
      this.computeAndSetDerivedState();
    }
  }

  private computeAndSetDerivedState() {
    const scale = this.size / Math.max(this.graphWidth, this.graphHeight, 1);
    const zoomContentScale = Math.min(this.zoom, 1);
    const finalScale = scale * zoomContentScale;

    const boxHeight = (scale * this.winHeight) / this.zoom;
    const boxWidth = (scale * this.winWidth) / this.zoom;
    const boxPosition = {x: -this.graphX * finalScale, y: -this.graphY * finalScale};

    this.lastViewBoxX = boxPosition.x;
    this.lastViewBoxY = boxPosition.y;

    this.nodesWithTransform = this.nodes.map((n) => ({
      ...n,
      cssTransform: `translate3d(${n.x}px, ${n.y}px, 0)`,
    }));

    this.canvasContainerStyles = {
      'height': `${Math.floor(this.graphHeight * finalScale)}px`,
      'width': `${Math.floor(this.graphWidth * finalScale)}px`,
    };

    this.canvasStyles = {
      'height': `${this.graphHeight}px`,
      'width': `${this.graphWidth}px`,
      'transform': `scale(${finalScale})`,
    };

    this.viewBoxStyles = {
      'height': `${boxHeight}px`,
      'width': `${boxWidth}px`,
      'transform': `translate3d(${boxPosition.x}px, ${boxPosition.y}px, 0)`,
    };
  }

  private dispatchMinimapPan(event: DragEvent, position: Point) {
    const scale = this.size / Math.max(this.graphWidth, this.graphHeight, 1);
    const topLeftCorner = {x: position.x / scale, y: position.y / scale};
    this.dispatchEvent(
      new CustomEvent('minimap-pan', {detail: {event, topLeftCorner}}),
    );
  }

  private readonly handleViewBoxPointerDown = (event: PointerEvent) => {
    event.stopPropagation();
    this.isPanning = true;
    this.panStartX = event.clientX;
    this.panStartY = event.clientY;

    (event.target as HTMLElement).setPointerCapture(event.pointerId);

    document.addEventListener('pointermove', this.handleViewBoxPointerMove);
    document.addEventListener('pointerup', this.handleViewBoxPointerUp);

    this.dispatchMinimapPan(
      {type: 'start', event},
      {x: this.lastViewBoxX, y: this.lastViewBoxY},
    );
  };

  private readonly handleViewBoxPointerMove = (event: PointerEvent) => {
    if (!this.isPanning) return;
    event.preventDefault();

    const dx = event.clientX - this.panStartX;
    const dy = event.clientY - this.panStartY;

    const newX = this.lastViewBoxX + dx;
    const newY = this.lastViewBoxY + dy;

    this.viewBoxStyles = {
      ...this.viewBoxStyles,
      'transform': `translate3d(${newX}px, ${newY}px, 0)`,
    };

    this.dispatchMinimapPan({type: 'move', event}, {x: newX, y: newY});
  };

  private readonly handleViewBoxPointerUp = (event: PointerEvent) => {
    if (!this.isPanning) return;
    this.isPanning = false;

    // The element that captured the pointer (`.view-box`) must be the one to
    // release it, not `event.target` which may be the document.
    this.shadowRoot
      ?.querySelector('.view-box')
      ?.releasePointerCapture(event.pointerId);

    document.removeEventListener('pointermove', this.handleViewBoxPointerMove);
    document.removeEventListener('pointerup', this.handleViewBoxPointerUp);

    const dx = event.clientX - this.panStartX;
    const dy = event.clientY - this.panStartY;
    const finalX = this.lastViewBoxX + dx;
    const finalY = this.lastViewBoxY + dy;

    this.lastViewBoxX = finalX;
    this.lastViewBoxY = finalY;

    this.dispatchMinimapPan({type: 'end', event}, {x: finalX, y: finalY});
  };

  private handleClickToPan(event: PointerEvent) {
    if ((event.target as HTMLElement).classList.contains('view-box')) {
      return; // Clicks on the viewbox are handled by the drag interaction
    }
    const scale = this.size / Math.max(this.graphWidth, this.graphHeight, 1);
    const boxHeight = (scale * this.winHeight) / this.zoom;
    const boxWidth = (scale * this.winWidth) / this.zoom;

    const position = {
      x: event.offsetX - boxWidth / 2,
      y: event.offsetY - boxHeight / 2,
    };

    this.dispatchMinimapPan({type: 'click', event}, position);
  }

  override render() {
    return html`
      <div
        class="mini-map"
        style=${styleMap({
          'width': `${this.size}px`,
          'height': `${this.size}px`,
        })}>
        <div
          class="canvas-container"
          style=${styleMap(this.canvasContainerStyles)}
          @click=${this.handleClickToPan}>
          <div class="canvas" style=${styleMap(this.canvasStyles)}>
            ${this.nodesWithTransform.map(
              (node) => html`
                <div
                  class="node"
                  style=${styleMap({
                    'width': `${node.width}px`,
                    'height': `${node.height}px`,
                    'transform': node.cssTransform,
                  })}></div>
              `,
            )}
          </div>
          <div
            class="view-box"
            style=${styleMap(this.viewBoxStyles)}
            @pointerdown=${this.handleViewBoxPointerDown}></div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gr-minimap': Minimap;
  }
}
