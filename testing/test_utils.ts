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

/** Ensures that test state is fresh for every 'it' block to prevent pollution. */
export function cleanState<T>(
    factory: () => T | Promise<T>,
    hook: (fn: () => void | Promise<void>) => void = beforeEach): T {
  const state = {} as T;

  hook(async () => {
    for (const key in state) {
      delete (state as any)[key];
    }
    const fresh = await factory();
    Object.assign(state, fresh);
  });

  return state;
}
