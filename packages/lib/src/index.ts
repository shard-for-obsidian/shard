/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Main client
export { OciRegistryClient, digestFromManifestStr } from "./registry-client.js";

// Common utilities
export {
  parseRepo,
  parseRepoAndRef,
  urlFromIndex,
  splitIntoTwo,
  DEFAULT_USERAGENT,
  MEDIATYPE_MANIFEST_V2,
  MEDIATYPE_MANIFEST_LIST_V2,
  MEDIATYPE_OCI_MANIFEST_V1,
  MEDIATYPE_OCI_MANIFEST_INDEX_V1,
} from "./common.js";

// GHCR constants
export { REALM, SERVICE } from "./ghcr.js";

// Types
export type {
  Manifest,
  ManifestOCI,
  ManifestOCIDescriptor,
  RegistryRepo,
  RegistryClientOpts,
  AuthInfo,
  TagList,
} from "./types.js";

// Errors
export {
  BadDigestError,
  BlobReadError,
  TooManyRedirectsError,
} from "./errors.js";

// Fetch adapter
export type { FetchAdapter } from "./fetch-adapter.js";

// Utilities
export { parseLinkHeader } from "./util/link-header.js";
