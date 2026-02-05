import type { FetchAdapter } from "shard-lib";

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
