# Graph Renderer (`<gr-graph-renderer>`)

A standalone, Lit-based web component for rendering interactive, node-based
graphs. It provides a flexible and performant way to visualize and interact with
directed graphs, handling panning, zooming, and node-dragging interactions.

## Table of Contents

-   [Features](#features)
-   [Basic Usage Example](#basic-usage-example)
-   [Advanced Usage: Using Custom Components as Node Templates](#advanced-usage-using-custom-components-as-node-templates)
    -   [1. Create a Custom Node Component](#1-create-a-custom-node-component)
    -   [2. Update the Graph Host Component](#2-update-the-graph-host-component)
-   [Defining Custom Endpoint Markers](#defining-custom-endpoint-markers)
    -   [Basing a Custom Marker on a Built-in One](#basing-a-custom-marker-on-a-built-in-one)
-   [State Management: The "Data Down, Events Up" Pattern](#state-management-the-data-down-events-up-pattern)
    -   [Example: Correctly Handling State Synchronization](#example-correctly-handling-state-synchronization)
-   [Handling Events and Interactions](#handling-events-and-interactions)
    -   [Handling Clicks and Drag Events](#handling-clicks-and-drag-events)
        -   [1. Create a Node Component That Emits a Click Event](#1-create-a-node-component-that-emits-a-click-event)
        -   [2. Update the Host Component to Handle All Events](#2-update-the-host-component-to-handle-all-events)
    -   [Creating New Connections](#creating-new-connections)
        -   [1. Create a Node Component with Port Interaction](#1-create-a-node-component-with-port-interaction)
        -   [2. Update the Host Component to Manage Edge Creation](#2-update-the-host-component-to-manage-edge-creation)
-   [API Reference](#api-reference)
    -   [Properties](#properties)
    -   [Styling the Minimap](#styling-the-minimap)
    -   [`GraphTheme` Interface](#graphtheme-interface)
    -   [`ZoomStepConfig` Interface](#zoomstepconfig-interface)
    -   [`MouseWheelBehavior` Enum](#mousewheelbehavior-enum)
    -   [Events](#events)
-   [Utility Functions](#utility-functions)
    -   [`computeFitToScreen`](#computefittoscreen)

## Features

*   **Panning and Zooming**: The graph viewport can be panned by dragging the
    background and zoomed using the mouse wheel (with `Ctrl` or `Meta` key).
*   **Interactive Minimap**: Provides a small overview of the entire graph,
    allowing for quick navigation by clicking or dragging the viewport.
*   **Node and Edge Rendering**: Renders nodes and edges based on provided data
    arrays (`graphNodes`, `graphEdges`).
*   **Customizable Node Templates**: Allows for custom HTML content to be
    rendered inside nodes and for edge labels using a template map.
*   **Customizable Endpoint Markers**: Supports defining and using custom SVG
    shapes for edge endpoints.
*   **Draggable Nodes**: Nodes can be repositioned via drag-and-drop, with
    events fired for the start, move, and end of a drag.
*   **Customizable Edge Paths**: The logic for calculating the SVG path for
    edges is provided via a dependency-injected `EdgePathService`.
*   **Tentative Edge Rendering**: Supports rendering a "tentative" edge from a
    node port to the mouse cursor, useful for providing user feedback when
    creating new connections.

## Basic Usage Example

Here is a basic example of how to use the `<gr-graph-renderer>` component with
inline templates.

```typescript
import {LitElement, html} from 'lit';
import {customElement, state} from 'lit/decorators';
import {BaseNode, BaseEdge, Side} from './common/interfaces';
import {DefaultEdgePathService} from './edge_path_service/default_edge_path_service';
import './gr_graph_renderer';

@customElement('my-graph-element')
export class MyGraphElement extends LitElement {
  private readonly edgePathService = new DefaultEdgePathService();

  @state()
  private graphNodes: BaseNode[] = [
    { id: 'node1', x: 150, y: 150, width: 120, height: 60, templateId: 'default-node', ports: [{id: 'p1', side: Side.RIGHT}]},
    { id: 'node2', x: 450, y: 150, width: 120, height: 60, templateId: 'default-node', ports: [{id: 'p2', side: Side.LEFT}]},
  ];

  @state()
  private graphEdges: BaseEdge[] = [
    { from: {nodeId: 'node1', portId: 'p1'}, to: {nodeId: 'node2', portId: 'p2'}, id: 'edge1-2' }
  ];

  private nodeTemplates = {
    'default-node': (nodeId: string) => html`
        <div style="border: 1px solid black; background-color: white; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
          Node: ${nodeId}
        </div>`,
  };

  override render() {
    return html`
      <gr-graph-renderer
        .graphNodes=${this.graphNodes}
        .graphEdges=${this.graphEdges}
        .edgePathService=${this.edgePathService}
        .nodeTemplates=${this.nodeTemplates}
        .graphWidth=${1000}
        .graphHeight=${800}
      >
      </gr-graph-renderer>
    `;
  }
}
```

## Advanced Usage: Using Custom Components as Node Templates

For more complex applications, it is better to define node content as separate
components. This improves modularity and maintainability.

Here is how to achieve this with Lit.

#### 1. Create a Custom Node Component

First, define a component that will represent your node's content.

`my-task-node.ts`:

```typescript
import {LitElement, html, css} from 'lit';
import {customElement, property} from 'lit/decorators';

@customElement('my-task-node')
export class MyTaskNode extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      background-color: aliceblue;
      border: 1px solid cornflowerblue;
      box-sizing: border-box;
    }
  `;

  @property({type: String})
  nodeId = '';

  override render() {
    return html`
      <div>Task Node: ${this.nodeId}</div>
    `;
  }
}
```

#### 2. Update the Graph Host Component

Next, import the new custom node component and update the `nodeTemplates` map to
use it.

`my-advanced-graph.ts`:

```typescript
import {LitElement, html} from 'lit';
import {customElement, state} from 'lit/decorators';

// Import the custom component you just created
import './my-task-node';

// ... other imports
import {BaseNode, BaseEdge, Side} from './common/interfaces';
import {DefaultEdgePathService} from './edge_path_service/default_edge_path_service';
import './gr_graph_renderer';

@customElement('my-advanced-graph')
export class MyAdvancedGraph extends LitElement {
  private readonly edgePathService = new DefaultEdgePathService();

  @state()
  private graphNodes: BaseNode[] = [
    // Use a new templateId for your custom node type
    { id: 'task-A', x: 150, y: 150, width: 150, height: 75, templateId: 'task-node', ports: [{id: 'p1', side: Side.RIGHT}]},
    { id: 'task-B', x: 450, y: 150, width: 150, height: 75, templateId: 'task-node', ports: [{id: 'p2', side: Side.LEFT}]},
  ];

  @state()
  private graphEdges: BaseEdge[] = [
    { from: {nodeId: 'task-A', portId: 'p1'}, to: {nodeId: 'task-B', portId: 'p2'}, id: 'edge-A-B' }
  ];

  // Map the 'task-node' templateId to a function that renders your component.
  private nodeTemplates = {
    'task-node': (nodeId: string) => html`
      <my-task-node .nodeId=${nodeId}></my-task-node>
    `,
  };

  override render() {
    return html`
      <gr-graph-renderer
        .graphNodes=${this.graphNodes}
        .graphEdges=${this.graphEdges}
        .edgePathService=${this.edgePathService}
        .nodeTemplates=${this.nodeTemplates}
        .graphWidth=${1000}
        .graphHeight=${800}
      >
      </gr-graph-renderer>
    `;
  }
}
```

## Defining Custom Endpoint Markers

The `<gr-graph-renderer>` component allows you to define and use your own custom
shapes for edge endpoints. This is useful when the built-in markers (`ARROW`,
`TRIANGLE`, `CIRCLE`, `SQUARE`) are not sufficient for your application's needs.

To use custom markers, you need to:

1.  **Define your custom markers**: Create an array of `CustomEndpointMarker`
    objects. Each object must have a unique `id` and should define the `path`
    for the SVG shape, along with other properties like `color`, `markerWidth`,
    `markerHeight`, etc.

2.  **Pass the markers to the component**: Pass your array of custom markers to
    the `<gr-graph-renderer>` component using the `customEndpointMarkers`
    property.

3.  **Use the custom markers in your edges**: In your `graphEdges` data, set the
    `fromMarker` or `toMarker` style property to the `id` of your custom marker.

Here is an example:

```typescript
import {LitElement, html} from 'lit';
import {customElement, state} from 'lit/decorators';
import {
  BaseNode,
  BaseEdge,
  CustomEndpointMarker,
  Side,
  EndpointMarker,
} from './common/interfaces';
import {DefaultEdgePathService} from './edge_path_service/default_edge_path_service';
import './gr_graph_renderer';

@customElement('my-graph-with-custom-markers')
export class MyGraphWithCustomMarkers extends LitElement {
  private readonly edgePathService = new DefaultEdgePathService();

  @state()
  private graphNodes: BaseNode[] = [
    { id: 'node1', x: 150, y: 150, width: 120, height: 60, templateId: 'default-node', ports: [{id: 'p1', side: Side.RIGHT}]},
    { id: 'node2', x: 450, y: 150, width: 120, height: 60, templateId: 'default-node', ports: [{id: 'p2', side: Side.LEFT}]},
  ];

  @state()
  private graphEdges: BaseEdge[] = [
    {
      from: {nodeId: 'node1', portId: 'p1'},
      to: {nodeId: 'node2', portId: 'p2'},
      id: 'edge1-2',
      style: {
        fromMarker: 'diamond', // Use the custom marker
        toMarker: EndpointMarker.ARROW,
      },
    },
  ];

  private readonly customEndpointMarkers: CustomEndpointMarker[] = [
    {
      id: 'diamond',
      color: 'black',
      path: 'M 5 0 L 10 5 L 5 10 L 0 5 Z',
      refX: 5,
      refY: 5,
      markerWidth: 6,
      markerHeight: 6,
      orient: 'auto-start-reverse',
    },
  ];

  private nodeTemplates = {
    'default-node': (nodeId: string) => html`
        <div style="border: 1px solid black; background-color: white; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
          Node: ${nodeId}
        </div>`,
  };

  override render() {
    return html`
      <gr-graph-renderer
        .graphNodes=${this.graphNodes}
        .graphEdges=${this.graphEdges}
        .edgePathService=${this.edgePathService}
        .nodeTemplates=${this.nodeTemplates}
        .customEndpointMarkers=${this.customEndpointMarkers}
        .graphWidth=${1000}
        .graphHeight=${800}
      >
      </gr-graph-renderer>
    `;
  }
}
```

### Basing a Custom Marker on a Built-in One

If you want to create a custom marker that is just a slight variation of a
built-in one (e.g., a slightly modified path), you can import the
`BUILT_IN_MARKER_DEFINITIONS` object. This object contains the default
properties for the standard markers.

Here is an example of creating a custom purple arrow based on the default
`ARROW` marker:

```typescript
import { BUILT_IN_MARKER_DEFINITIONS } from './edge_canvas/edge_canvas';
import {
  CustomEndpointMarker,
  EndpointMarker
} from './common/interfaces';

// ...

private readonly customEndpointMarkers: CustomEndpointMarker[] = [
  {
    id: 'thin-arrow',
    ...BUILT_IN_MARKER_DEFINITIONS[EndpointMarker.ARROW],
    path: 'M 0 0 L 10 5 L 0 10 L 6 5 Z',
  },
];
```

## State Management: The "Data Down, Events Up" Pattern

The `<gr-graph-renderer>` follows a standard one-way data flow pattern common in
modern web components.

*   **Data Flows Down**: Your application (the parent component) owns the
    "source of truth" for the graph's data (the `graphNodes` and `graphEdges`
    arrays). It passes this data down to the renderer via properties.
*   **Events Flow Up**: The renderer should never directly change the properties
    it receives. Instead, when a user interaction changes the state (like
    dragging a node), the renderer emits an event to notify the parent of the
    change.

For performance, the renderer manages its own temporary state during an
interaction like a node drag. When the drag is complete, it dispatches the
`node-drag-end` event with the node's final coordinates.

It is the parent component's responsibility to listen for this event and update
its own state. If the parent's state is not updated, the UI will revert to the
old data on the next re-render, causing nodes to move back to their original
positions.

#### Example: Correctly Handling State Synchronization

The following example shows the correct way to keep the parent component's state
synchronized with the renderer.

```typescript
import {LitElement, html} from 'lit';
import {customElement, state} from 'lit/decorators';
import {BaseNode, BaseEdge} from './common/interfaces';
import './graph_renderer';
// ... other imports

@customElement('my-graph-host')
export class MyGraphHost extends LitElement {
  // This state is the "source of truth" for the graph's data.
  @state()
  private graphNodes: BaseNode[] = [
    { id: 'node-A', x: 100, y: 100, width: 150, height: 75, templateId: 'default-node'},
    { id: 'node-B', x: 400, y: 100, width: 150, height: 75, templateId: 'default-node'},
  ];

  // Other properties (graphEdges, edgePathService, etc.) would be defined here.

  /**
   * Handles the 'node-drag-end' event to update the component's state.
   */
  private handleNodeDragEnd(e: CustomEvent<{id: string, x: number, y: number}>) {
    const {id, x, y} = e.detail;
    // Update the graphNodes array, creating a new array to trigger a re-render.
    this.graphNodes = this.graphNodes.map(
      (node) => (node.id === id ? {...node, x, y} : node)
    );
  }

  override render() {
    return html`
      <gr-graph-renderer
        .graphNodes=${this.graphNodes}
        // ... other properties
        @node-drag-end=${this.handleNodeDragEnd}
      >
      </gr-graph-renderer>
    `;
  }
}
```

## Handling Events and Interactions

The component dispatches several custom events to allow for interaction. For
handling clicks on nodes or edge labels, you must add event listeners to the
templates you provide.

### Handling Clicks and Drag Events

This example shows how to listen for node clicks, edge clicks, label clicks, and
node drag events.

#### 1. Create a Node Component That Emits a Click Event

This component demonstrates how to create interactive node content that
dispatches a custom 'node-click' event to its host application, allowing the
host to manage the selection state

`my-interactive-node.ts`:

```typescript
import {LitElement, html, css} from 'lit';
import {customElement, property} from 'lit/decorators';
import {classMap} from 'lit/directives/class-map';

@customElement('my-interactive-node')
export class MyInteractiveNode extends LitElement {
  // ... styles
  @property({type: String}) nodeId = '';
  @property({type: Boolean}) selected = false;

  private handleNodeClick() {
    this.dispatchEvent(new CustomEvent('node-click', {
      detail: { nodeId: this.nodeId, selected: !this.selected },
      bubbles: true, composed: true
    }));
  }

  override render() {
    const classes = {'interactive-node-template': true, 'selected': this.selected};
    return html`
      <div class=${classMap(classes)} @click=${this.handleNodeClick}>
        Node: ${this.nodeId}
      </div>
    `;
  }
}
```

#### 2. Update the Host Component to Handle All Events

The host component listens for the events from the renderer and its custom nodes
to manage the application's state.

`my-graph-host.ts`:

```typescript
import {LitElement, html} from 'lit';
import {customElement, query, state} from 'lit/decorators';
import {BaseNode, BaseEdge, RenderableEdge, Point} from './common/interfaces';
import {GraphRenderer} from './graph_renderer';
import {EDGE_LABEL_TEMPLATE_ID} from './directed_graph/directed_graph';
import './my-interactive-node';

@customElement('my-graph-host')
export class MyGraphHost extends LitElement {
  @query('gr-graph-renderer') private readonly renderer!: GraphRenderer;

  @state() private selectedNodeIds = new Set<string>();
  @state() private graphNodes: BaseNode[] = [/* ... */];
  // ... other properties

  private handleNodeDragEnd(e: CustomEvent<{id: string, x: number, y: number}>) {
    console.log('Node Drag End:', e.detail);

    // It is critical to update the parent component's state when a drag ends.
    // See the "State Management" section for a detailed explanation.
    const {id, x, y} = e.detail;
    this.graphNodes = this.graphNodes.map(
      (node) => (node.id === id ? {...node, x, y} : node)
    );
  }

  private handleNodeClick(e: CustomEvent<{nodeId: string; selected: boolean}>) {
    console.log('Node Click:', e.detail.nodeId);
    const {nodeId, selected} = e.detail;
    const newSelectedNodeIds = new Set(this.selectedNodeIds);
    if (selected) {
      newSelectedNodeIds.add(nodeId);
    } else {
      newSelectedNodeIds.delete(nodeId);
    }
    this.selectedNodeIds = newSelectedNodeIds;
  }

  private handleEdgeLabelClick(edgeId: string) {
    console.log('Edge Label Click:', edgeId);
  }

  // Use a getter to create a new templates object on each render. This signals
  // to the child renderer that it needs to re-evaluate its node templates and
  // update with the latest state (e.g., selection changes).
  private get nodeTemplates() {
    return {
      'interactive-node': (nodeId: string) => html`
        <my-interactive-node
          .nodeId=${nodeId}
          .selected=${this.selectedNodeIds.has(nodeId)}
          @node-click=${this.handleNodeClick}
        ></my-interactive-node>
      `,
      [EDGE_LABEL_TEMPLATE_ID]: (edgeId: string) => html`
        <div @click=${() => this.handleEdgeLabelClick(edgeId)}>
          Label for ${edgeId}
        </div>
      `,
    };
  }

  override render() {
    return html`
      <gr-graph-renderer
        .graphNodes=${this.graphNodes}
        .graphEdges=${this.graphEdges}
        .edgePathService=${this.edgePathService}
        .nodeTemplates=${this.nodeTemplates}
        @node-drag-end=${this.handleNodeDragEnd}
        @node-drag-start=${(e: CustomEvent<BaseNode>) => console.log('Drag Start:', e.detail)}
        @node-drag-move=${(e: CustomEvent<{id: string, x: number, y: number}>) => console.log('Drag Move:', e.detail)}
        @graph-zoom=${(e: CustomEvent<{event: WheelEvent, zoom: number}>) => console.log('Graph zoom:', e.detail)}
        @graph-pan=${(e: CustomEvent<{event: DragEvent, topLeftCorner: Point}>) => console.log('Graph pan:', e.detail)}
        @edge-click=${(e: CustomEvent<RenderableEdge>) => console.log('Edge Click:', e.detail.id)}
      >
      </gr-graph-renderer>
    `;
  }
}
```

### Creating New Connections

Creating a new edge typically involves two steps:

1.  Starting a "tentative" edge from a port by setting the
    `tentativeEdgeStartEndpoint` property on a mousedown event.
2.  Completing the edge by listening for a mouseup event on a target node/port
    and updating the `graphEdges` array.

This requires a custom node component that can detect pointer events on its
ports.

#### 1. Create a Node Component with Port Interaction

`my-interactive-node-with-ports.ts`:

```typescript
import {LitElement, html, css} from 'lit';
import {customElement, property} from 'lit/decorators';
import {BaseNode} from './common/interfaces';

@customElement('my-interactive-node-with-ports')
export class MyInteractiveNodeWithPorts extends LitElement {
  @property({type: Object}) node!: BaseNode;

  private handlePortMouseDown(portId: string) {
    this.dispatchEvent(new CustomEvent('port-mousedown', {
      detail: { nodeId: this.node.id, portId },
      bubbles: true, composed: true
    }));
  }

  private handleNodeMouseUp() {
    this.dispatchEvent(new CustomEvent('node-mouseup', {
      detail: { nodeId: this.node.id, portId: this.node.ports?.[0].id }, // Assume first port is the target
      bubbles: true, composed: true
    }));
  }

  override render() {
    // A simplified node with a single port div
    return html`
      <div class="node-body" @mouseup=${this.handleNodeMouseUp}>
        Node: ${this.node.id}
        <div class="port" @mousedown=${() => this.handlePortMouseDown(this.node.ports![0].id)}></div>
      </div>
    `;
  }
}
```

#### 2. Update the Host Component to Manage Edge Creation

`my-connection-host.ts`:

```typescript
import {LitElement, html} from 'lit';
import {customElement, state} from 'lit/decorators';
import {BaseNode, BaseEdge, Side, Endpoint} from './common/interfaces';
import './graph_renderer';
import './my-interactive-node-with-ports';

@customElement('my-connection-host')
export class MyConnectionHost extends LitElement {
  // ... (graphNodes, graphEdges, edgePathService as before)

  @state() private tentativeEdgeSource: Endpoint | null = null;

  private handlePortMouseDown(e: CustomEvent<Endpoint>) {
    this.tentativeEdgeSource = e.detail;
  }

  private handleNodeMouseUp(e: CustomEvent<Endpoint>) {
    if (this.tentativeEdgeSource && this.tentativeEdgeSource.nodeId !== e.detail.nodeId) {
      const newEdge: BaseEdge = {
        from: this.tentativeEdgeSource,
        to: e.detail,
        id: `edge-${this.tentativeEdgeSource.nodeId}-${e.detail.nodeId}`
      };
      this.graphEdges = [...this.graphEdges, newEdge];
    }
    this.tentativeEdgeSource = null; // End the tentative edge drawing
  }

  private nodeTemplates = {
    'connectable-node': (node: BaseNode) => html`
      <my-interactive-node-with-ports
        .node=${node}
        @port-mousedown=${this.handlePortMouseDown}
        @node-mouseup=${this.handleNodeMouseUp}
      ></my-interactive-node-with-ports>
    `
  };

  override render() {
    return html`
      <gr-graph-renderer
        .graphNodes=${this.graphNodes}
        .graphEdges=${this.graphEdges}
        .edgePathService=${this.edgePathService}
        .nodeTemplates=${this.nodeTemplates}
        .tentativeEdgeStartEndpoint=${this.tentativeEdgeSource}
      >
      </gr-graph-renderer>
    `;
  }
}
```

## API Reference

### Properties

Attribute             | Property                     | Type                       | Default               | Description
--------------------- | ---------------------------- | -------------------------- | --------------------- | -----------
`ispanning`           | `isPanning`                  | `boolean`                  | `false`               | Read-only. Reflects the component's panning state. True when the user is actively panning the graph. Used for styling and should not be set externally.
-                     | `theme`                      | `GraphTheme`               | `DEFAULT_THEME`       | Optional. An object to customize the visual appearance of the graph background and dot pattern.
`zoom`                | `zoom`                       | `number`                   | `1`                   | Optional. Controls the zoom level of the graph.
`graph-height`        | `graphHeight`                | `number`                   | `0`                   | Optional. The total height of the graph's drawable area, defining the "world" boundaries. This is required when `constrainNodeDrag` is `true`, but can be omitted for applications with an "infinite" canvas where boundaries are not needed.
`graph-width`         | `graphWidth`                 | `number`                   | `0`                   | Optional. The total width of the graph's drawable area, defining the "world" boundaries. This is required when `constrainNodeDrag` is `true`, but can be omitted for applications with an "infinite" canvas where boundaries are not needed.
-                     | `graphX`                     | `number`                   | `0`                   | Optional. The x-coordinate of the viewport's top-left corner in world coordinates. This controls the horizontal pan of the graph.
-                     | `graphY`                     | `number`                   | `0`                   | Optional. The y-coordinate of the viewport's top-left corner in world coordinates. This controls the vertical pan of the graph.
-                     | `graphNodes`                 | `BaseNode[]`               | `[]`                  | Required to display nodes. An array of BaseNode objects to render on the graph.
-                     | `edgePathService`            | `EdgePathService`          | -                     | Required for rendering edges. An instance of a service that calculates SVG paths for edges.
-                     | `nodeTemplates`              | `Record<string, Function>` | `{}`                  | Optional. A map of template IDs to Lit html template functions for rendering custom node content.
-                     | `graphEdges`                 | `BaseEdge[]`               | `[]`                  | Required to display edges. An array of BaseEdge objects to render as connections.
-                     | `customEndpointMarkers`      | `CustomEndpointMarker[]`   | `[]`                  | Optional. An array of `CustomEndpointMarker` objects to define custom endpoint markers for edges.
-                     | `tentativeEdgeStartEndpoint` | `Endpoint`                 | `null`                | Optional. A "tentative" edge is drawn from the provided endpoint to the current position of the mouse cursor.
`lock-graph-viewport` | `lockGraphViewport`          | `boolean`                  | `false`               | Optional. If true, disables all user-initiated panning and zooming.
`constrain-node-drag` | `constrainNodeDrag`          | `boolean`                  | `false`               | Optional. If `true`, prevents nodes from being dragged outside the boundaries defined by `graphWidth` and `graphHeight`. The default is `false` to support use cases with dynamically sized or "infinite" canvases where nodes can be placed freely. Set this to `true` only if you have a fixed, defined graph area.
`show-minimap`        | `showMinimap`                | `boolean`                  | `false`               | Optional. If true, displays the interactive minimap.
-                     | `minimapSize`                | `number`                   | `200`                 | Optional. The size (width and height) of the square minimap in pixels.
-                     | `observeResizeElement`       | `HTMLElement`              | -                     | Optional. An external `HTMLElement` to observe for size changes. In some complex environments, the component's internal wrapper element may not be directly observable by `ResizeObserver`. Providing an element from the host environment allows for reliable resize detection. If not provided, the component will attempt to observe its internal wrapper.
-                     | `zoomStepConfig`             | `ZoomStepConfig`           | `DEFAULT_ZOOM_CONFIG` | Optional. An object to configure zoom behavior. See the `ZoomStepConfig` interface for more details.
-                     | `mouseWheelBehavior`         | `MouseWheelBehavior`       | `ZOOM`                | Optional. Configures the default behavior of the mouse wheel over the graph. See the `MouseWheelBehavior` enum for options.

### Styling the Minimap

The appearance and position of the minimap can be customized from an external
style sheet using the following CSS Custom Properties. By default, it is
positioned in the bottom-right corner.

**Positioning:**

Variable           | Default Value | Description
------------------ | ------------- | ---------------------------------
`--minimap-top`    | `auto`        | The top offset of the minimap.
`--minimap-left`   | `auto`        | The left offset of the minimap.
`--minimap-bottom` | `16px`        | The bottom offset of the minimap.
`--minimap-right`  | `16px`        | The right offset of the minimap.

**Theming:**

Variable                             | Default Value                      | Description
------------------------------------ | ---------------------------------- | -----------
`--minimap-background-color`         | `#f8f9fa`                          | The background color of the main minimap container.
`--minimap-background-image`         | `repeating-linear-gradient(...)`   | The background image (e.g., a pattern) for the main container.
`--minimap-outline`                  | `1px solid #777`                   | The outline/border for the entire minimap component.
`--minimap-border-radius`            | `4px`                              | The corner radius of the main minimap container.
`--minimap-canvas-background-color`  | `#f8f9fa`                          | The background color of the inner canvas where nodes are rendered.
`--minimap-node-background-color`    | `#aaa`                             | The background color of the nodes inside the minimap.
`--minimap-viewbox-background-color` | `rgba(0, 100, 255, 0.2)`           | The background color of the draggable viewport rectangle.
`--minimap-viewbox-border`           | `1px solid rgba(0, 100, 255, 0.5)` | The border of the draggable viewport rectangle.

Example:

```css
gr-graph-renderer {
  --minimap-top: 16px;
  --minimap-left: 16px;
  --minimap-bottom: auto;
  --minimap-right: auto;
  --minimap-outline: 2px solid blue;
  --minimap-node-background-color: purple;
}
```

### `GraphTheme` Interface

This interface defines the structure for the `theme` property, allowing you to
customize the graph's appearance. The component uses `DEFAULT_THEME` if no theme
is provided.

```typescript
interface GraphTheme {
  background: {
    fill: string; // The background color of the canvas
    dots: {      // Configuration for the dot pattern
      cx: number;
      cy: number;
      width: number;
      height: number;
      radius: number;
      fill: string; // The color of the dots
    };
  };
}
```

The `DEFAULT_THEME` constant provides a fallback white background with light
gray dots.

### `ZoomStepConfig` Interface

This interface allows for detailed configuration of the component's zoom
behavior when passed to the `zoomStepConfig` property. If not provided, the
component uses the exported `DEFAULT_ZOOM_CONFIG` constant.

```typescript
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
```

### `MouseWheelBehavior` Enum

This enum controls the action of the mouse wheel when passed to the
`mouseWheelBehavior` property.

*   `ZOOM` (Default): The mouse wheel zooms the graph. `Ctrl/Meta + Wheel` pans.
*   `PAN`: The mouse wheel pans the graph. `Ctrl/Meta + Wheel` zooms.
*   `ZOOM_CAPTURES`: Same behavior as `ZOOM`, but it "captures" the wheel event
    by listening in the capture phase. This allows the graph to intercept the
    event before it reaches any scrollable child elements (e.g., a scrollable
    `<div>` inside a custom node), preventing them from scrolling and ensuring
    the graph always zooms.

### Events

Event Name        | event.detail              | Description
:---------------- | :------------------------ | :---------------------------
`graph-pan`       | `{ event: DragEvent,      | Fired when the graph is
                  | topLeftCorner: Point }`   | panned via pointer drag or
                  |                           | mouse wheel scroll.
`graph-zoom`      | `{ event: WheelEvent,     | Fired when the graph is
                  | zoom: number }`           | zoomed using the mouse
                  |                           | wheel.
`node-drag-start` | `BaseNode`                | Fired when a node drag
                  |                           | interaction begins.
`node-drag-move`  | `{ id: string, x: number, | Fired continuously as a node
                  | y: number }`              | is being dragged.
`node-drag-end`   | `{ id: string, x: number, | Fired when a node drag
                  | y: number }`              | interaction ends, providing
                  |                           | the final position.
`edge-click`      | `RenderableEdge`          | Fired when an interactive
                  |                           | edge is clicked.
`resize-viewport` | `Dimension`               | Fired when the component's
                  |                           | main wrapper is resized.

### Utility Functions

The `gr-graph-renderer` library also exports helper functions to assist with
common tasks like fitting the graph to the viewport.

#### `computeFitToScreen`

This function calculates the optimal `zoom`, `graphX`, and `graphY` values
required to center all nodes within the available screen space. It is useful for
implementing a "fit to screen" button.

**Example Usage:**

This example shows how to use `computeFitToScreen` in a Lit component that hosts
the graph renderer.

```typescript
import {LitElement, html} from 'lit';
import {customElement, query, state} from 'lit/decorators';
import {computeFitToScreen} from './common/compute_fit_to_screen';
import './graph_renderer';

@customElement('my-graph-host')
export class MyGraphHost extends LitElement {
  @query('gr-graph-renderer')
  private readonly renderer!: HTMLElement;

  @state()
  private graphNodes: BaseNode[] = [/* ... your node data ... */];

  @state() private zoom = 1;
  @state() private graphX = 0;
  @state() private graphY = 0;

  private handleFitToScreen() {
    if (!this.renderer) return;
    const {width, height} = this.renderer.getBoundingClientRect();
    const fit = computeFitToScreen(this.graphNodes, width, height);

    this.zoom = fit.zoom;
    this.graphX = fit.graphX;
    this.graphY = fit.graphY;
  }

  override render() {
    return html`
      <button @click=${this.handleFitToScreen}>Fit to Screen</button>
      <gr-graph-renderer
        .graphNodes=${this.graphNodes}
        .zoom=${this.zoom}
        .graphX=${this.graphX}
        .graphY=${this.graphY}
      >
      </gr-graph-renderer>
    `;
  }
}
```
