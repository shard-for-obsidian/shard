/**
 * Request/Response types for HTTP operations
 */

/** An alias for Uint8Array<ArrayBuffer> for Typescript 5.7 */
export type ByteArray = ReturnType<Uint8Array["slice"]>;

/** Obsidian's requestUrl parameter type */
export interface RequestUrlParam {
  url: string;
  method?: string;
  contentType?: string;
  body?: string | ArrayBuffer;
  headers?: Record<string, string>;
  throw?: boolean;
}

/** Obsidian's requestUrl response type */
export interface RequestUrlResponse {
  status: number;
  headers: Record<string, string>;
  arrayBuffer: ArrayBuffer;
  json: unknown;
  text: string;
}
