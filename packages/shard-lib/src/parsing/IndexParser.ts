import type { RegistryIndex } from "../types/RegistryTypes.js";

import {
  DEFAULT_INDEX_NAME,
  DEFAULT_INDEX_URL,
  DEFAULT_LOGIN_SERVERNAME,
} from "../common.js";
import { isLocalhost } from "../utils/ValidationUtils.js";
/**
 * Special case: `docker` still refers to "https://index.docker.io/v1/"
 * when dealing with auth (including in its json file).
 *
 * @param {String} arg: Optional. Index name (optionally with leading scheme).
 */
export function parseIndex(arg?: string): RegistryIndex {
  if (!arg || arg === DEFAULT_LOGIN_SERVERNAME) {
    // Default index.
    return {
      scheme: "https",
      name: DEFAULT_INDEX_NAME,
      official: true,
    };
  }

  // Optional protocol/scheme.
  let indexName: string;
  let scheme: "https" | "http" = "https";
  const protoSepIdx = arg.indexOf("://");
  if (protoSepIdx !== -1) {
    const foundScheme = arg.slice(0, protoSepIdx);
    if (foundScheme !== "http" && foundScheme !== "https") {
      throw new Error(
        "invalid index scheme, must be " + '"http" or "https": ' + arg,
      );
    }
    scheme = foundScheme;
    indexName = arg.slice(protoSepIdx + 3);
  } else {
    scheme = isLocalhost(arg) ? "http" : "https";
    indexName = arg;
  }

  if (!indexName) {
    throw new Error("invalid index, empty host: " + arg);
  } else if (
    indexName.indexOf(".") === -1 &&
    indexName.indexOf(":") === -1 &&
    indexName !== "localhost"
  ) {
    throw new Error(
      `invalid index, "${indexName}" does not look like a valid host: ${arg}`,
    );
  } else {
    // Allow a trailing '/' as from some URL builder functions that
    // add a default '/' path to a URL, e.g. 'https://docker.io/'.
    if (indexName[indexName.length - 1] === "/") {
      indexName = indexName.slice(0, indexName.length - 1);
    }

    // Ensure no trailing repo.
    if (indexName.indexOf("/") !== -1) {
      throw new Error("invalid index, trailing repo: " + arg);
    }
  }

  // Per docker.git's `ValidateIndexName`.
  if (indexName === "index." + DEFAULT_INDEX_NAME) {
    indexName = DEFAULT_INDEX_NAME;
  }

  const index: RegistryIndex = {
    name: indexName,
    official: indexName === DEFAULT_INDEX_NAME,
    scheme,
  };

  // Disallow official and 'http'.
  if (index.official && index.scheme === "http") {
    throw new Error(
      "invalid index, plaintext HTTP to official index " +
        "is disallowed: " +
        arg,
    );
  }

  return index;
}

/**
 * Similar in spirit to docker.git:registry/endpoint.go#NewEndpoint().
 */
export function urlFromIndex(
  index: RegistryIndex,
  scheme?: "http" | "https",
): string {
  if (index.official) {
    // v1
    if (scheme != null && scheme !== "https")
      throw new Error(
        `Unencrypted communication with docker.io is not allowed`,
      );
    return DEFAULT_INDEX_URL;
  } else {
    if (scheme != null && scheme !== "https" && scheme !== "http")
      throw new Error(
        `Non-HTTP communication with docker registries is not allowed`,
      );
    return `${scheme ?? index.scheme}://${index.name}`;
  }
  // removed extra closing brace
}
