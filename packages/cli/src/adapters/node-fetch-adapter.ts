/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import type { FetchAdapter } from "@plugin-manager/lib";

/**
 * Adapter for Node.js native fetch API.
 * Thin wrapper that passes through to native fetch.
 */
export class NodeFetchAdapter implements FetchAdapter {
  async fetch(input: string | Request, init?: RequestInit): Promise<Response> {
    // Use native Node.js fetch
    return fetch(input, init);
  }
}
