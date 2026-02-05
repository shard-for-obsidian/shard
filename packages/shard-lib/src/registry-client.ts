import { encodeHex } from "./utils/DigestUtils.js";
// ...existing code...
import type { AuthInfo } from "./types/AuthTypes.js";
// Add this import if FetchAdapter is used in this file
// import type { FetchAdapter } from "./client/adapters/FetchAdapter.js";
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
} from "./common.js";
import { splitIntoTwo } from "./utils/ValidationUtils.js";
import { urlFromIndex } from "./parsing/IndexParser.js";

import { REALM, SERVICE } from "./ghcr.js";

// ...existing code...

import * as e from "./errors/RegistryErrors.js";

// ...existing code...

/*
 * Copyright 2017 Joyent, Inc.
 */

/*
 * Set the "Authorization" HTTP header into the headers object from the given
 * auth info.
 * - Bearer auth if `token`.
 * - Else, Basic auth if `username`.
 * - Else, if the authorization key exists, then it is removed from headers.
 */
function _setAuthHeaderFromAuthInfo(
  headers: Record<string, string>,
  authInfo: AuthInfo | null,
) {
  if (authInfo?.type === "Bearer") {
    headers["authorization"] = "Bearer " + authInfo.token;
  } else if (authInfo?.type === "Basic") {
    const credentials = `${authInfo.username ?? ""}:${authInfo.password ?? ""}`;
    headers["authorization"] = "Basic " + btoa(credentials);
  } else {
    delete headers["authorization"];
  }
  return headers;
}

/**
 * Special handling of errors from the registry server.
 *
import { parseLinkHeader } from "./parsing/LinkHeaderParser.js";
 * and convert these as necessary.
 *
 * Example JSON response for a missing repo:
 * {
 *   "jse_shortmsg": "",
 *   "jse_info": {},
 *   "message": "{\"errors\":[{\"code\":\"UNAUTHORIZED\",\"message\":\"...}\n",
 *   "body": {
 *       "errors": [{
 *           "code": "UNAUTHORIZED",
 *           "message": "authentication required",
 *           "detail": [{
 *               "Type": "repository",
 *               "Class": "",
 *               "Name": "library/idontexist",
 *               "Action": "pull"
 *           }]
 *       }]
 *   }
 * }
 *
 * Example JSON response for bad username/password:
 * {
 *   "statusCode": 401,
 *   "jse_shortmsg":"",
 *   "jse_info":{},
 *   "message":"{\"details\":\"incorrect username or password\"}\n",
 *   "body":{
 *     "details": "incorrect username or password"
 *   }
 * }
 *
 * Example AWS token error:
 * {
 *   "statusCode": 400,
 *   "errors": [
 *     {
 *       "code": "DENIED",
 *       "message": "Your Authorization Token is invalid."
 *     }
 *   ]
 * }
 */
function _getRegistryErrorMessage(err: unknown) {
  const e = err as Record<string, unknown>;
  if (e.body && typeof e.body === "object" && e.body !== null) {
    const body = e.body as Record<string, unknown>;
    if (Array.isArray(body.errors) && body.errors[0]) {
      return (body.errors[0] as { message?: unknown }).message;
    } else if (body.details) {
      return body.details;
    }
  }
  if (Array.isArray(e.errors) && e.errors[0]) {
    return (e.errors[0] as { message?: unknown }).message;
  } else if (e.message) {
    return e.message;
  } else if (e.details) {
    return e.details;
  }
  return String(err);
}

/**
 * Return a scope string to be used for an auth request. Example:
 *   repository:library/nginx:pull
 */
function _makeAuthScope(resource: string, name: string, actions: string[]) {
  return `${resource}:${name}:${actions.join(",")}`;
}

/*
 * Parse the 'Docker-Content-Digest' header.
 *
 * @throws {BadDigestError} if the value is missing or malformed
 */
function _parseDockerContentDigest(dcd: string) {
  if (!dcd)
    throw new e.BadDigestError('missing "Docker-Content-Digest" header');
  const errPre = `could not parse Docker-Content-Digest header "${dcd}": `;

  // E.g. docker-content-digest: sha256:887f7ecfd0bda3...
  const parts = splitIntoTwo(dcd, ":");
  if (parts.length !== 2)
    throw new e.BadDigestError(errPre + JSON.stringify(dcd));
  if (parts[0] !== "sha256")
    throw new e.BadDigestError(
      errPre + "Unsupported hash algorithm " + JSON.stringify(parts[0]),
    );

  return {
    raw: dcd,
    algorithm: parts[0],
    expectedDigest: parts[1],
    async validate(buffer: ArrayBuffer): Promise<void> {
      switch (this.algorithm) {
        case "sha256": {
          const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
          const digest = encodeHex(hashBuffer);
          if (this.expectedDigest !== digest) {
            throw new e.BadDigestError(
              `Docker-Content-Digest mismatch (expected: ${this.expectedDigest}, got: ${digest})`,
            );
          }
          return;
        }
        default:
          throw new e.BadDigestError(
            `Unsupported hash algorithm ${this.algorithm}`,
          );
      }
    },
  };
}

// ...existing code...

// ...existing code...
