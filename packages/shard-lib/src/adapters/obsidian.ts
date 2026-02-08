import type { FetchAdapter } from "../client/FetchAdapter.js";
import type { RequestUrlParam, RequestUrlResponse } from "../types/RequestTypes.js";

/**
 * Adapter for Obsidian's requestUrl API.
 * Converts between fetch API and Obsidian's request format.
 */
export class ObsidianFetchAdapter implements FetchAdapter {
  constructor(
    private requestUrl: (
      request: RequestUrlParam | string,
    ) => Promise<RequestUrlResponse>,
  ) {}

  async fetch(input: string | Request, init?: RequestInit): Promise<Response> {
    // Convert Request to string URL
    const url = typeof input === "string" ? input : input.url;

    // Merge headers from Request and init
    const headers: Record<string, string> = {};
    if (typeof input !== "string" && input.headers) {
      input.headers.forEach((value, key) => {
        headers[key] = value;
      });
    }
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(init.headers)) {
        for (const [key, value] of init.headers) {
          headers[key] = value;
        }
      } else {
        Object.assign(headers, init.headers);
      }
    }

    // Get method from init or Request
    const method =
      init?.method || (typeof input !== "string" ? input.method : "GET");

    // Get body from init or Request
    let body: string | ArrayBuffer | undefined;
    if (init?.body) {
      if (typeof init.body === "string") {
        body = init.body;
      } else if (init.body instanceof ArrayBuffer) {
        body = init.body;
      } else if (init.body instanceof Uint8Array) {
        body = init.body.buffer.slice(0) as ArrayBuffer;
      } else {
        // Convert other body types to ArrayBuffer
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blob = new Blob([init.body as any]);
        body = await blob.arrayBuffer();
      }
    } else if (typeof input !== "string" && input.body) {
      if (input.body instanceof ArrayBuffer) {
        body = input.body;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blob = new Blob([input.body as any]);
        body = await blob.arrayBuffer();
      }
    }

    // Make the request using Obsidian's requestUrl
    const response = await this.requestUrl({
      url,
      method,
      headers,
      body,
      throw: false, // Handle errors ourselves
    });

    // Convert RequestUrlResponse to Response
    return this.convertToResponse(response);
  }

  private convertToResponse(response: RequestUrlResponse): Response {
    // Convert headers object to Headers
    const headers = new Headers();
    for (const [key, value] of Object.entries(response.headers)) {
      headers.set(key, value);
    }

    // Create Response with arrayBuffer body
    return new Response(response.arrayBuffer, {
      status: response.status,
      statusText: "", // requestUrl doesn't provide statusText
      headers,
    });
  }
}
