// DEPRECATED: Implementation moved to utils/ValidationUtils.ts
export function isLocalhost() {
  throw new Error("isLocalhost has moved to utils/ValidationUtils. Update your imports to use 'import { isLocalhost } from ./utils/ValidationUtils' instead.");
}
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import type {
  RegistryImage,
  RegistryIndex,
  RegistryRepo,
} from "./types/RegistryTypes.js";

export const MEDIATYPE_MANIFEST_V2 =
  "application/vnd.docker.distribution.manifest.v2+json";
export const MEDIATYPE_MANIFEST_LIST_V2 =
  "application/vnd.docker.distribution.manifest.list.v2+json";

export const MEDIATYPE_OCI_MANIFEST_V1 =
  "application/vnd.oci.image.manifest.v1+json";
export const MEDIATYPE_OCI_MANIFEST_INDEX_V1 =
  "application/vnd.oci.image.index.v1+json";

/*
 * Copyright 2016 Joyent, Inc.
 */

// --- globals

export const DEFAULT_USERAGENT: string = `open-obsidian-plugin-spec/0.1.0`;

// See `INDEXNAME` in docker/docker.git:registry/config.go.
export const DEFAULT_INDEX_NAME = "docker.io";
export const DEFAULT_INDEX_URL = "https://registry-1.docker.io";

export const DEFAULT_LOGIN_SERVERNAME = "https://index.docker.io/v1/";

// JSSTYLED
// 'DEFAULTTAG' from https://github.com/docker/docker/blob/0c7b51089c8cd7ef3510a9b40edaa139a7ca91aa/graph/tags.go#L25
export const DEFAULT_TAG = "latest";

const VALID_NS = /^[a-z0-9._-]*$/;
const VALID_REPO = /^[a-z0-9_/.-]*$/;

// --- exports

// DEPRECATED: Implementation moved to utils/ValidationUtils.ts
export function splitIntoTwo() {
  throw new Error("splitIntoTwo has moved to utils/ValidationUtils. Update your imports to use 'import { splitIntoTwo } from ./utils/ValidationUtils' instead.");
}

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
  // DEPRECATED: Implementation moved to parsing/IndexParser.ts
  throw new Error("parseIndex has moved to parsing/IndexParser. Update your imports to use 'import { parseIndex } from ./parsing/IndexParser' instead.");
}

/**
 * Parse a docker repo and tag string: [INDEX/]REPO[:TAG|@DIGEST]
 *
 * Examples:
 *    busybox
 *    google/python
 *    docker.io/ubuntu
 *    localhost:5000/blarg
 *    http://localhost:5000/blarg
 *
 * Dev Notes:
 * - This is meant to mimic
 *   docker.git:registry/config.go#ServiceConfig.NewRepositoryInfo
 *   as much as reasonable -- with the addition that we maintain the
 *   'tag' field.  Also, that we accept the scheme on the "INDEX" is
 *   different than docker.git's parsing.
 * - TODO: what about the '@digest' digest alternative to a tag? See:
 *   // JSSTYLED
 *   https://github.com/docker/docker/blob/0c7b51089c8cd7ef3510a9b40edaa139a7ca91aa/pkg/parsers/parsers.go#L68
 *
 * @param arg {String} The docker repo string to parse. See examples above.
 * @param defaultIndex {Object|String} Optional. The default index to use
 *      if not specified with `arg`. If not given the default is 'docker.io'.
 *      If given it may either be a string, e.g. 'https://myreg.example.com',
 *      or parsed index object, as from `parseIndex()`.
 */
export function parseRepo(
  arg: string,
  defaultIndex?: string | RegistryIndex,
): RegistryRepo {
  let index: RegistryIndex;

  // Strip off optional leading `INDEX/`, parse it to `info.index` and
  // leave the rest in `remoteName`.
  let remoteNameRaw: string;
  const protoSepIdx = arg.indexOf("://");
  if (protoSepIdx !== -1) {
    // (A) repo with a protocol, e.g. 'https://host/repo'.
    const slashIdx = arg.indexOf("/", protoSepIdx + 3);
    if (slashIdx === -1) {
      throw new Error(
        'invalid repository name, no "/REPO" after ' + "hostame: " + arg,
      );
    }
    const indexName = arg.slice(0, slashIdx);
    remoteNameRaw = arg.slice(slashIdx + 1);
    index = parseIndex(indexName);
  } else {
    const parts = splitIntoTwo(arg, "/");
    if (
      parts.length === 1 ||
      /* or if parts[0] doesn't look like a hostname or IP */
      (parts[0].indexOf(".") === -1 &&
        parts[0].indexOf(":") === -1 &&
        parts[0] !== "localhost")
    ) {
      // (B) repo without leading 'INDEX/'.
      if (defaultIndex === undefined) {
        index = parseIndex();
      } else if (typeof defaultIndex === "string") {
        index = parseIndex(defaultIndex);
      } else {
        index = defaultIndex;
      }
      remoteNameRaw = arg;
    } else {
      // (C) repo with leading 'INDEX/' (without protocol).
      index = parseIndex(parts[0]);
      remoteNameRaw = parts[1];
    }
  }

  // Validate remoteName (docker `validateRemoteName`).
  const nameParts = splitIntoTwo(remoteNameRaw, "/");
  let ns = "",
    name: string;
  if (nameParts.length === 2) {
    name = nameParts[1];

    // Validate ns.
    ns = nameParts[0];
    if (ns.length < 2 || ns.length > 255) {
      throw new Error(
        "invalid repository namespace, must be between " +
          "2 and 255 characters: " +
          ns,
      );
    }
    if (!VALID_NS.test(ns)) {
      throw new Error(
        "invalid repository namespace, may only contain " +
          "[a-z0-9._-] characters: " +
          ns,
      );
    }
    if (ns[0] === "-" && ns[ns.length - 1] === "-") {
      throw new Error(
        "invalid repository namespace, cannot start or " +
          "end with a hypen: " +
          ns,
      );
    }
    if (ns.indexOf("--") !== -1) {
      throw new Error(
        "invalid repository namespace, cannot contain " +
          "consecutive hyphens: " +
          ns,
      );
    }
  } else {
    name = remoteNameRaw;
    if (index.official) {
      ns = "library";
    }
  }

  // Validate name.
  if (!VALID_REPO.test(name)) {
    throw new Error(
      "invalid repository name, may only contain " +
        "[a-z0-9_/.-] characters: " +
        name,
    );
  }

  const isLibrary = index.official && ns === "library";
  const remoteName = ns ? `${ns}/${name}` : name;
  const localName = index.official
    ? isLibrary
      ? name
      : remoteName
    : `${index.name}/${remoteName}`;
  const canonicalName = index.official
    ? `${DEFAULT_INDEX_NAME}/${localName}`
    : localName;

  return {
    index,
    official: isLibrary,
    remoteName,
    localName,
    canonicalName,
  };
}

/**
 * Parse a docker repo and tag/digest string: [INDEX/]REPO[:TAG|@DIGEST|:TAG@DIGEST]
 *
 * Examples:
 *    busybox
 *    busybox:latest
 *    google/python:3.3
 *    docker.io/ubuntu
 *    localhost:5000/blarg
 *    http://localhost:5000/blarg:latest
 *    google/python:3.3@sha256:fb9f16730ac6316afa4d97caa51302199...
 *    alpine@sha256:fb9f16730ac6316afa4d97caa5130219927bfcecf0b0...
 *
 * Dev Notes:
 * - TODO Validation on digest and tag would be nice.
 *
 * @param arg {String} The docker repo:tag string to parse. See examples above.
 * @param defaultIndex {Object|String} Optional. The default index to use
 *      if not specified with `arg`. If not given the default is 'docker.io'.
 *      If given it may either be a string, e.g. 'https://myreg.example.com',
 *      or parsed index object, as from `parseIndex()`.
 */
export function parseRepoAndRef(
  arg: string,
  defaultIndex?: string | RegistryIndex,
): RegistryImage {
  // Parse off the tag/digest per
  // https://github.com/docker/docker/blob/0c7b51089c8cd7ef3510a9b40edaa139a7ca91aa/pkg/parsers/parsers.go#L69
  let digest: string | null = null;
  let tag: string | null = null;

  const atIdx = arg.lastIndexOf("@");
  if (atIdx !== -1) {
    digest = arg.slice(atIdx + 1);
    arg = arg.slice(0, atIdx);
  } else {
    tag = DEFAULT_TAG;
  }

  const colonIdx = arg.lastIndexOf(":");
  const slashIdx = arg.lastIndexOf("/");
  if (colonIdx !== -1 && colonIdx > slashIdx) {
    tag = arg.slice(colonIdx + 1);
    arg = arg.slice(0, colonIdx);
  }

  const repo = parseRepo(arg, defaultIndex);
  return {
    ...repo,
    digest,
    tag,
    canonicalRef: [
      repo.canonicalName,
      tag ? `:${tag}` : "",
      digest ? `@${digest}` : "",
    ].join(""),
  };
}

export const parseRepoAndTag = parseRepoAndRef;

/**
 * Similar in spirit to docker.git:registry/endpoint.go#NewEndpoint().
 */
  // DEPRECATED: Implementation moved to parsing/IndexParser.ts
  throw new Error("urlFromIndex has moved to parsing/IndexParser. Update your imports to use 'import { urlFromIndex } from ./parsing/IndexParser' instead.");
}

export function isLocalhost(host: string): boolean {
  const lead = host.split(":")[0];
  if (lead === "localhost" || lead === "127.0.0.1" || host.includes("::1")) {
    return true;
  } else {
    return false;
  }
}
