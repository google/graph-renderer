# Testing Guide for `<gr-graph-renderer>`

This document provides instructions for running tests and contributing to the
`<gr-graph-renderer>` component.

### Unit Tests

The core functionality of `<gr-graph-renderer>` and its internal sub-components
(`<gr-directed-graph>`, `<gr-node-render>`, etc.) is covered by a suite of unit
tests. These tests are written using Karma and Jasmine and verify the behavior
of each individual component in isolation.

#### Running the Unit Tests

You can run the tests for each component by targeting its `karma_web_test_suite`
in the corresponding `BUILD` file.

For example, to run the tests for the main renderer component, you would run:

```sh
blaze test //third_party/javascript/graph_renderer:test
```

### Integration Testing with the Test Harness

For consumers of the `<gr-graph-renderer>`, a test harness is provided to
simplify integration testing. The `GraphRendererHarness` class abstracts away
the internal Shadow DOM structure of the component, providing a stable API to
interact with rendered nodes and edges.

The goal of the harness is to make it easy to test how your application responds
to events from the graph renderer without needing to know about its internal
implementation details.

#### Example Harness Usage

The recommended way to use the harness is via its static `create()` method,
which handles all the necessary asynchronous setup. Below is an example of how
you might use it in your own component's test file.

```typescript
import {GraphRendererHarness} from 'google3/third_party/javascript/graph_renderer/testing/harness';
import {DefaultEdgePathService} from 'google3/third_party/javascript/graph_renderer/edge_path_service/default_edge_path_service';

describe('MyComponent with GraphRenderer', () => {
  it('should allow dragging a node', async () => {
    // 1. Create the harness, which handles all setup.
    const harness = await GraphRendererHarness.create({
      graphNodes: [{id: 'node-1', x: 50, y: 50, width: 100, height: 50, templateId: 'default'}],
      edgePathService: new DefaultEdgePathService(),
      nodeTemplates: {'default': (id) => html`<div>${id}</div>`},
    });

    const dragEndSpy = jasmine.createSpy('node-drag-end');
    harness.element.addEventListener('node-drag-end', dragEndSpy);

    // 2. Interact with the component through the harness API.
    await harness.dragNode('node-1', {dx: 100, dy: 50});

    // 3. Make assertions.
    expect(dragEndSpy).toHaveBeenCalledTimes(1);
  });
});
```
