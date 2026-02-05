/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Main client
export {
  OciRegistryClient,
  digestFromManifestStr,
} from "./client/OciRegistryClient.js";

// Common utilities
export {
  parseRepo,
  parseRepoAndRef,
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
} from "./types/ManifestTypes.js";
export type {
  RegistryRepo,
  RegistryImage,
  TagList,
} from "./types/RegistryTypes.js";
export type {
  AuthInfo,
  RequestUrlParam,
  RequestUrlResponse,
} from "./types/AuthTypes.js";

// Errors
export { BadDigestError } from "./errors/RegistryErrors.js";
export { BlobReadError } from "./errors/RegistryErrors.js";
export { TooManyRedirectsError } from "./errors/RegistryErrors.js";

// Fetch adapter
export type { FetchAdapter } from "./client/adapters/FetchAdapter.js";

// Utilities
export { parseLinkHeader } from "./parsing/LinkHeaderParser.js";
