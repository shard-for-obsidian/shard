// ...existing code...
// Add this import if FetchAdapter is used in this file
// import type { FetchAdapter } from "./adapters/FetchAdapter.js";
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {
  parseRepo,
  DEFAULT_USERAGENT,
  MEDIATYPE_MANIFEST_V2,
  MEDIATYPE_MANIFEST_LIST_V2,
  MEDIATYPE_OCI_MANIFEST_V1,
  MEDIATYPE_OCI_MANIFEST_INDEX_V1,
} from "../common.js";
import { splitIntoTwo } from "../utils/ValidationUtils.js";

import { urlFromIndex } from "../parsing/IndexParser.js";

import { REALM, SERVICE } from "../ghcr.js";

import type { Manifest } from "../types/ManifestTypes.js";
import type { RegistryRepo, TagList } from "../types/RegistryTypes.js";
import type { AuthInfo } from "../types/AuthTypes.js";

import * as e from "../errors/RegistryErrors.js";

import { parseLinkHeader } from "../parsing/LinkHeaderParser.js";

import { encodeHex } from "../utils/DigestUtils.js";

/**
 * Calculate the 'Docker-Content-Digest' header for the given manifest.
 *
 * @returns {Promise<String>} The docker digest string.
 * @throws {InvalidContentError} if there is a problem parsing the manifest.
 */
export async function digestFromManifestStr(
  manifestStr: string,
): Promise<string> {
  let manifest: Manifest | { schemaVersion: 1 };
  try {
    manifest = JSON.parse(manifestStr) as Manifest | { schemaVersion: 1 };
  } catch (thrown) {
    const err = thrown as Error;
    throw new Error(`could not parse manifest: ${err.message}\n${manifestStr}`);
  }
  if (manifest.schemaVersion === 1) {
    throw new Error(
      `schemaVersion 1 is not supported by /x/docker_registry_client.`,
    );
  }

  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(manifestStr),
  );
  return `sha256:${encodeHex(hash)}`;
}

export class OciRegistryClient {
  readonly version = 2;
  insecure: boolean;
  repo: RegistryRepo;
  acceptOCIManifests: boolean;
  acceptManifestLists: boolean;
  username?: string;
  password?: string;
  scopes: string[];
  private _loggedIn: boolean;
  private _loggedInScope?: string | null;
  private _authInfo?: AuthInfo | null;
  private _headers: Record<string, string>;
  private _url: string;
  private _userAgent: string;
  private readonly _adapter: {
    fetch(input: string | Request, init?: RequestInit): Promise<Response>;
  };

  // ...rest of OciRegistryClient implementation (move from registry-client.ts)...
}
