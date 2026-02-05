import type { RegistryIndex } from "../types/RegistryTypes.js";

import {
  DEFAULT_INDEX_NAME,
  DEFAULT_INDEX_URL,
  DEFAULT_LOGIN_SERVERNAME,
} from "../common.js";

/**
 * Parse a docker index name or index URL.
 *
 * Examples:
 *      docker.io               (no scheme implies 'https')
 *      index.docker.io         (normalized to docker.io)
 *      https://docker.io
 *      http://localhost:5000
 *      https://index.docker.io/v1/  (special case)
 *
 * Special case: `docker` still refers to "https://index.docker.io/v1/"
 * when dealing with auth (including in its json file).
 *
 * @param {String} arg: Optional. Index name (optionally with leading scheme).
 */
export function parseIndex(arg?: string): RegistryIndex {
  // ...implementation moved from common.ts...
  throw new Error("Not yet implemented: see refactor plan");
}

/**
 * Similar in spirit to docker.git:registry/endpoint.go#NewEndpoint().
 */
export function urlFromIndex(
  index: RegistryIndex,
  scheme?: "http" | "https",
): string {
  // ...implementation moved from common.ts...
  throw new Error("Not yet implemented: see refactor plan");
}
