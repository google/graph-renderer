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
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { BehaviorSubject, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';

import { type RenderableLabel } from '../common/interfaces';
import sheet from './edge_label_render.css' with { type: 'css' };

/**
 * Component responsible for rendering and positioning a label on an edge.
 * It takes label data including position and dimensions, and slots content
 * to be displayed as the label. This component does not support dragging.
 */
@customElement('gr-edge-label-render')
export class EdgeLabelRender extends LitElement {
  static override styles = [sheet];

  /**
   * The data required to render the label, including position and dimensions.
   * Required to render a label.
   */
  @property({ type: Object })
  set label(newLabel: RenderableLabel) {
    this.label$.next(newLabel);
  }
  get label(): RenderableLabel {
    return this.label$.value!;
  }

  @state() private internalLabel?: RenderableLabel;
  @state() private labelPosition: { x: number; y: number } = { x: 0, y: 0 };

  private readonly label$ = new BehaviorSubject<RenderableLabel | undefined>(
    undefined
  );
  private readonly subscriptions: Subscription[] = [];

  override connectedCallback() {
    super.connectedCallback();

    const labelPosition$ = this.label$.pipe(
      map(label => {
        if (!label) return { x: 0, y: 0 };
        // Calculate top-left corner for absolute positioning
        return {
          x: label.x - label.width / 2,
          y: label.y - label.height / 2,
        };
      })
    );

    this.subscriptions.push(
      this.label$.subscribe(label => {
        this.internalLabel = label;
      }),
      labelPosition$.subscribe(pos => {
        this.labelPosition = pos;
      })
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.subscriptions.forEach(sub => {
      sub.unsubscribe();
    });
  }

  override render() {
    if (!this.internalLabel) {
      return html``;
    }

    const labelStyles = styleMap({
      transform: `translate(${this.labelPosition.x}px, ${this.labelPosition.y}px)`,
      width: `${this.internalLabel.width}px`,
      height: `${this.internalLabel.height}px`,
    });

    return html`
      <div class="edge-label-container" style=${labelStyles}>
        <slot></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gr-edge-label-render': EdgeLabelRender;
  }
}
