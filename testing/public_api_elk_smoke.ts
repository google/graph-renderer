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
 * @fileoverview Compile-time smoke test for the ELK subpath barrel. Fails
 * `tsc --noEmit` (run via `npm run typecheck` or `npm run typecheck:smoke`)
 * if a documented public symbol disappears from `public_api_elk.ts`. The
 * module has no runtime behavior and is never imported by tests or
 * production code.
 */

import {
  ElkEdgePathService,
  ElkLabelPositioning,
  type ElkEdgePathConfig,
} from '../public_api_elk';

// Reference every imported symbol in a single tuple type so the compiler
// retains them under `noUnusedLocals`. The tuple is exported (rather than
// declared as a local type alias) so the same `noUnusedLocals` rule does
// not flag the alias itself; the export is otherwise unused, since this
// file is never imported at runtime.
export type _AllUsed = [
  typeof ElkEdgePathService,
  typeof ElkLabelPositioning,
  ElkEdgePathConfig,
];
