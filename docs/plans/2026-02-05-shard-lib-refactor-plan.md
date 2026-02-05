# Shard Lib Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor shard-lib package structure for improved maintainability, clarity, and separation of concerns

**Architecture:** Reorganize flat file structure into domain-organized folders (client/, errors/, parsing/, types/, utils/, ghcr/) while maintaining exact same behavior and public API

**Tech Stack:** TypeScript, ESBuild, pnpm workspaces

---

## Assumptions & Context

**Current state:**
- No existing tests (test infrastructure needed)
- 8 source files in flat structure
- 835-line registry-client.ts (consider splitting in future)
- ESM modules with .js extensions in imports
- MPL 2.0 licensed code with some Joyent copyright sections

**Verification approach:**
- Type-checking after each major step
- Build verification after each major step
- Manual API testing at end (no automated tests exist)

**Naming decisions:**
- Keep `RegistryRepo`, `RegistryImage`, `RegistryIndex` (consistent pattern)
- Rename `RegistryClientOpts` → `RegistryClientOptions` (standard naming)
- Keep descriptive file names (e.g., `RepoParser.ts` not `repo.ts`)

---

## Task 1: Setup Test Infrastructure

**Files:**
- Modify: `packages/shard-lib/package.json`
- Create: `packages/shard-lib/vitest.config.ts`
- Create: `packages/shard-lib/src/__tests__/setup.ts`

**Step 1: Install vitest dependencies**

```bash
cd /Users/gillisandrew/Projects/gillisandrew/open-obsidian-plugin-spec
pnpm add -D vitest @vitest/ui --workspace packages/shard-lib
```

**Step 2: Add test scripts to package.json**

In `packages/shard-lib/package.json`, modify scripts section:

```json
"scripts": {
  "build": "node esbuild.config.mjs && tsc",
  "clean": "rimraf dist",
  "ts-check": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:ui": "vitest --ui"
}
```

**Step 3: Create vitest config**

```typescript
// packages/shard-lib/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

**Step 4: Verify test setup works**

Run: `cd packages/shard-lib && pnpm test`
Expected: "No test files found"

**Step 5: Commit**

```bash
git add packages/shard-lib/package.json packages/shard-lib/vitest.config.ts
git commit -m "test: add vitest infrastructure to shard-lib"
```

---

## Task 2: Create Baseline Tests for Parsing Functions

**Files:**
- Create: `packages/shard-lib/src/__tests__/parsing.test.ts`

**Step 1: Write tests for parseIndex**

```typescript
// packages/shard-lib/src/__tests__/parsing.test.ts
import { describe, it, expect } from 'vitest';
import { parseIndex } from '../common.js';

describe('parseIndex', () => {
  it('should parse default index', () => {
    const result = parseIndex();
    expect(result).toEqual({
      scheme: 'https',
      name: 'docker.io',
      official: true,
    });
  });

  it('should parse custom registry', () => {
    const result = parseIndex('ghcr.io');
    expect(result).toEqual({
      scheme: 'https',
      name: 'ghcr.io',
      official: false,
    });
  });

  it('should parse localhost with http', () => {
    const result = parseIndex('localhost:5000');
    expect(result).toEqual({
      scheme: 'http',
      name: 'localhost:5000',
      official: false,
    });
  });

  it('should normalize index.docker.io to docker.io', () => {
    const result = parseIndex('index.docker.io');
    expect(result.name).toBe('docker.io');
    expect(result.official).toBe(true);
  });
});
```

**Step 2: Run test to verify it passes**

Run: `cd packages/shard-lib && pnpm test`
Expected: 4 tests pass

**Step 3: Write tests for parseRepo**

Add to `packages/shard-lib/src/__tests__/parsing.test.ts`:

```typescript
import { parseRepo } from '../common.js';

describe('parseRepo', () => {
  it('should parse simple repo name', () => {
    const result = parseRepo('busybox');
    expect(result.remoteName).toBe('library/busybox');
    expect(result.localName).toBe('busybox');
    expect(result.official).toBe(true);
  });

  it('should parse namespaced repo', () => {
    const result = parseRepo('google/python');
    expect(result.remoteName).toBe('google/python');
    expect(result.localName).toBe('google/python');
    expect(result.official).toBe(false);
  });

  it('should parse repo with registry', () => {
    const result = parseRepo('ghcr.io/owner/repo');
    expect(result.index.name).toBe('ghcr.io');
    expect(result.remoteName).toBe('owner/repo');
    expect(result.official).toBe(false);
  });

  it('should parse repo with protocol', () => {
    const result = parseRepo('https://localhost:5000/myrepo');
    expect(result.index.scheme).toBe('https');
    expect(result.index.name).toBe('localhost:5000');
    expect(result.remoteName).toBe('myrepo');
  });
});
```

**Step 4: Run test to verify it passes**

Run: `cd packages/shard-lib && pnpm test`
Expected: 8 tests pass

**Step 5: Write tests for parseRepoAndRef**

Add to `packages/shard-lib/src/__tests__/parsing.test.ts`:

```typescript
import { parseRepoAndRef } from '../common.js';

describe('parseRepoAndRef', () => {
  it('should parse repo with default tag', () => {
    const result = parseRepoAndRef('busybox');
    expect(result.tag).toBe('latest');
    expect(result.digest).toBeNull();
  });

  it('should parse repo with tag', () => {
    const result = parseRepoAndRef('busybox:1.36');
    expect(result.tag).toBe('1.36');
    expect(result.digest).toBeNull();
  });

  it('should parse repo with digest', () => {
    const result = parseRepoAndRef('alpine@sha256:abc123');
    expect(result.digest).toBe('sha256:abc123');
    expect(result.tag).toBeNull();
  });

  it('should parse repo with tag and digest', () => {
    const result = parseRepoAndRef('google/python:3.3@sha256:abc123');
    expect(result.tag).toBe('3.3');
    expect(result.digest).toBe('sha256:abc123');
  });
});
```

**Step 6: Run test to verify it passes**

Run: `cd packages/shard-lib && pnpm test`
Expected: 12 tests pass

**Step 7: Commit**

```bash
git add packages/shard-lib/src/__tests__/parsing.test.ts
git commit -m "test: add baseline tests for parsing functions"
```

---

## Task 3: Create New Directory Structure

**Files:**
- Create directories only (no files yet)

**Step 1: Create new directories**

```bash
cd /Users/gillisandrew/Projects/gillisandrew/open-obsidian-plugin-spec/packages/shard-lib/src
mkdir -p client errors ghcr parsing types utils
```

**Step 2: Verify directories exist**

Run: `ls -la packages/shard-lib/src/`
Expected: See client, errors, ghcr, parsing, types, utils directories

**Step 3: Commit**

```bash
git add packages/shard-lib/src/
git commit -m "refactor: create new directory structure for shard-lib"
```

---

## Task 4: Extract and Move Constants to Domain Files

**Files:**
- Create: `packages/shard-lib/src/types/ManifestTypes.ts`
- Create: `packages/shard-lib/src/ghcr/GhcrConstants.ts`

**Step 1: Create ManifestTypes.ts with media type constants**

```typescript
// packages/shard-lib/src/types/ManifestTypes.ts
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

export const MEDIATYPE_MANIFEST_V2 =
  "application/vnd.docker.distribution.manifest.v2+json";
export const MEDIATYPE_MANIFEST_LIST_V2 =
  "application/vnd.docker.distribution.manifest.list.v2+json";

export const MEDIATYPE_OCI_MANIFEST_V1 =
  "application/vnd.oci.image.manifest.v1+json";
export const MEDIATYPE_OCI_MANIFEST_INDEX_V1 =
  "application/vnd.oci.image.index.v1+json";

export const DEFAULT_USERAGENT: string = `open-obsidian-plugin-spec/0.1.0`;

export type Manifest =
  | ManifestV2
  | ManifestV2List
  | ManifestOCI
  | ManifestOCIIndex;

export interface ManifestV2 {
  schemaVersion: 2;
  mediaType: "application/vnd.docker.distribution.manifest.v2+json";
  config: ManifestV2Descriptor;
  layers: Array<ManifestV2Descriptor>;
}

export interface ManifestV2Descriptor {
  mediaType: string;
  size: number;
  digest: string;
  urls?: Array<string>;
}

export interface ManifestV2List {
  schemaVersion: 2;
  mediaType: "application/vnd.docker.distribution.manifest.list.v2+json";
  manifests: Array<{
    mediaType: string;
    digest: string;
    size: number;
    platform: {
      architecture: string;
      os: string;
      "os.version"?: string;
      "os.features"?: string[];
      variant?: string;
      features?: string[];
    };
  }>;
}

export interface ManifestOCI {
  schemaVersion: 2;
  mediaType?: "application/vnd.oci.image.manifest.v1+json";
  artifactType?: string;
  config: ManifestOCIDescriptor;
  layers: Array<ManifestOCIDescriptor>;
  annotations?: Record<string, string>;
}

export interface ManifestOCIDescriptor {
  mediaType: string;
  size: number;
  digest: string;
  urls?: Array<string>;
  annotations?: Record<string, string>;
}

export interface ManifestOCIIndex {
  schemaVersion: 2;
  mediaType?: "application/vnd.oci.image.index.v1+json";
  manifests: Array<{
    mediaType: string;
    digest: string;
    size: number;
    platform?: {
      architecture: string;
      os: string;
      "os.version"?: string;
      "os.features"?: string[];
      variant?: string;
      features?: string[];
    };
    annotations?: Record<string, string>;
  }>;
  annotations?: Record<string, string>;
}
```

**Step 2: Create GhcrConstants.ts**

Copy existing ghcr.ts to new location and rename:

```bash
cp packages/shard-lib/src/ghcr.ts packages/shard-lib/src/ghcr/GhcrConstants.ts
```

**Step 3: Run type check**

Run: `cd packages/shard-lib && pnpm ts-check`
Expected: Pass (no errors - files not yet imported anywhere)

**Step 4: Commit**

```bash
git add packages/shard-lib/src/types/ManifestTypes.ts packages/shard-lib/src/ghcr/GhcrConstants.ts
git commit -m "refactor: extract manifest types and constants"
```

---

## Task 5: Move Registry Type Definitions

**Files:**
- Create: `packages/shard-lib/src/types/RegistryTypes.ts`
- Create: `packages/shard-lib/src/types/RequestTypes.ts`
- Create: `packages/shard-lib/src/types/AuthTypes.ts`

**Step 1: Create RegistryTypes.ts**

```typescript
// packages/shard-lib/src/types/RegistryTypes.ts
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

export interface RegistryIndex {
  name: string;
  official: boolean;
  scheme: "https" | "http";
}

export interface RegistryRepo {
  index: RegistryIndex;
  official: boolean;
  remoteName: string;
  localName: string;
  canonicalName: string;
}

export interface RegistryImage extends RegistryRepo {
  digest: string | null;
  tag: string | null;
  canonicalRef: string;
}

export interface TagList {
  name: string;
  tags: string[];
  // these seem GCR specific:
  child?: string[];
  manifest?: Record<
    string,
    {
      imageSizeBytes: string;
      layerId?: string;
      mediaType: string;
      tag: string[];
      timeCreatedMs: string;
      timeUploadedMs: string;
    }
  >;
}

export interface RegistryError {
  code?: string;
  message: string;
  detail?: string;
}
```

**Step 2: Create RequestTypes.ts**

```typescript
// packages/shard-lib/src/types/RequestTypes.ts
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
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

export interface DockerResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;

  dockerBody(): Promise<ByteArray>;
  dockerJson(): Promise<unknown>;

  dockerErrors(): Promise<Array<import('./RegistryTypes.js').RegistryError>>;
  dockerThrowable(baseMsg: string): Promise<Error>;
}
```

**Step 3: Create AuthTypes.ts**

```typescript
// packages/shard-lib/src/types/AuthTypes.ts
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

export type AuthInfo =
  | { type: "None" }
  | { type: "Basic"; username: string; password: string }
  | { type: "Bearer"; token: string };
```

**Step 4: Run type check**

Run: `cd packages/shard-lib && pnpm ts-check`
Expected: Pass

**Step 5: Commit**

```bash
git add packages/shard-lib/src/types/
git commit -m "refactor: organize type definitions into domain files"
```

---

## Task 6: Extract Parsing Functions

**Files:**
- Create: `packages/shard-lib/src/parsing/RepoParser.ts`
- Create: `packages/shard-lib/src/parsing/IndexParser.ts`

**Step 1: Create IndexParser.ts**

```typescript
// packages/shard-lib/src/parsing/IndexParser.ts
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright 2016 Joyent, Inc.
 */

import type { RegistryIndex } from "../types/RegistryTypes.js";

// See `INDEXNAME` in docker/docker.git:registry/config.go.
export const DEFAULT_INDEX_NAME = "docker.io";
export const DEFAULT_INDEX_URL = "https://registry-1.docker.io";
export const DEFAULT_LOGIN_SERVERNAME = "https://index.docker.io/v1/";

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
}

export function isLocalhost(host: string): boolean {
  const lead = host.split(":")[0];
  if (lead === "localhost" || lead === "127.0.0.1" || host.includes("::1")) {
    return true;
  } else {
    return false;
  }
}
```

**Step 2: Create RepoParser.ts**

```typescript
// packages/shard-lib/src/parsing/RepoParser.ts
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright 2016 Joyent, Inc.
 */

import type { RegistryRepo, RegistryImage, RegistryIndex } from "../types/RegistryTypes.js";
import { parseIndex, DEFAULT_INDEX_NAME } from "./IndexParser.js";
import { splitIntoTwo } from "../utils/ValidationUtils.js";

// JSSTYLED
// 'DEFAULTTAG' from https://github.com/docker/docker/blob/0c7b51089c8cd7ef3510a9b40edaa139a7ca91aa/graph/tags.go#L25
export const DEFAULT_TAG = "latest";

const VALID_NS = /^[a-z0-9._-]*$/;
const VALID_REPO = /^[a-z0-9_/.-]*$/;

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
```

**Step 3: Run type check**

Run: `cd packages/shard-lib && pnpm ts-check`
Expected: Fail - ValidationUtils.ts doesn't exist yet

This is expected. Continue to next task.

---

## Task 7: Extract Utility Functions

**Files:**
- Create: `packages/shard-lib/src/utils/ValidationUtils.ts`
- Create: `packages/shard-lib/src/utils/DigestUtils.ts`
- Create: `packages/shard-lib/src/parsing/LinkHeaderParser.ts`

**Step 1: Create ValidationUtils.ts**

```typescript
// packages/shard-lib/src/utils/ValidationUtils.ts
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright 2016 Joyent, Inc.
 */

export function splitIntoTwo(
  str: string,
  sep: string,
): [string] | [string, string] {
  const slashIdx = str.indexOf(sep);
  return slashIdx == -1
    ? [str]
    : [str.slice(0, slashIdx), str.slice(slashIdx + 1)];
}
```

**Step 2: Move LinkHeaderParser**

```bash
mv packages/shard-lib/src/util/link-header.ts packages/shard-lib/src/parsing/LinkHeaderParser.ts
rmdir packages/shard-lib/src/util
```

**Step 3: Read registry-client.ts to find digest utilities**

Run: `cd packages/shard-lib && grep -n "digestFromManifestStr\|encodeHex" src/registry-client.ts`

**Step 4: Extract digest utilities from registry-client.ts**

Read the digest functions from registry-client.ts and create:

```typescript
// packages/shard-lib/src/utils/DigestUtils.ts
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * Encode bytes as hex string
 */
export function encodeHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Calculate SHA256 digest from manifest string
 */
export async function digestFromManifestStr(
  manifestStr: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(manifestStr);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return "sha256:" + encodeHex(hashArray);
}
```

**Step 5: Run type check**

Run: `cd packages/shard-lib && pnpm ts-check`
Expected: Pass

**Step 6: Commit**

```bash
git add packages/shard-lib/src/utils/ packages/shard-lib/src/parsing/LinkHeaderParser.ts
git rm packages/shard-lib/src/util/link-header.ts
git commit -m "refactor: extract utility functions to dedicated files"
```

---

## Task 8: Move Error Classes

**Files:**
- Rename: `packages/shard-lib/src/errors.ts` → `packages/shard-lib/src/errors/RegistryErrors.ts`

**Step 1: Move and rename errors file**

```bash
mv packages/shard-lib/src/errors.ts packages/shard-lib/src/errors/RegistryErrors.ts
```

**Step 2: Run type check**

Run: `cd packages/shard-lib && pnpm ts-check`
Expected: Fail (imports not updated yet)

**Step 3: Commit**

```bash
git add packages/shard-lib/src/errors/RegistryErrors.ts
git rm packages/shard-lib/src/errors.ts
git commit -m "refactor: move error classes to errors directory"
```

---

## Task 9: Create Client Options Type

**Files:**
- Create: `packages/shard-lib/src/client/RegistryClientOptions.ts`

**Step 1: Create RegistryClientOptions.ts**

```typescript
// packages/shard-lib/src/client/RegistryClientOptions.ts
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import type { RegistryRepo } from "../types/RegistryTypes.js";

export interface RegistryClientOptions {
  name?: string; // mutually exclusive with repo
  repo?: RegistryRepo;
  // log
  username?: string;
  password?: string;
  token?: string; // for bearer auth
  insecure?: boolean;
  scheme?: "https" | "http";
  acceptOCIManifests?: boolean;
  acceptManifestLists?: boolean;
  userAgent?: string;
  scopes?: string[];
  adapter: {
    fetch(input: string | Request, init?: RequestInit): Promise<Response>;
  };
}
```

**Step 2: Run type check**

Run: `cd packages/shard-lib && pnpm ts-check`
Expected: Pass

**Step 3: Commit**

```bash
git add packages/shard-lib/src/client/RegistryClientOptions.ts
git commit -m "refactor: create dedicated client options type"
```

---

## Task 10: Move and Update Registry Client (Part 1 - Move File)

**Files:**
- Move: `packages/shard-lib/src/registry-client.ts` → `packages/shard-lib/src/client/OciRegistryClient.ts`

**Step 1: Move registry client file**

```bash
mv packages/shard-lib/src/registry-client.ts packages/shard-lib/src/client/OciRegistryClient.ts
```

**Step 2: Commit**

```bash
git add packages/shard-lib/src/client/OciRegistryClient.ts
git rm packages/shard-lib/src/registry-client.ts
git commit -m "refactor: move OCI registry client to client directory"
```

---

## Task 11: Update Registry Client Imports (Part 2 - Fix Imports)

**Files:**
- Modify: `packages/shard-lib/src/client/OciRegistryClient.ts`

**Step 1: Update all imports in OciRegistryClient.ts**

Replace the imports section at the top of the file:

OLD:
```typescript
import type { RegistryImage, RegistryIndex, RegistryRepo } from "./types.js";
import type {
  Manifest,
  ManifestOCI,
  ManifestV2,
  RegistryClientOpts,
  AuthInfo,
  TagList,
  DockerResponse,
} from "./types.js";
import {
  parseRepo,
  parseRepoAndRef,
  urlFromIndex,
  MEDIATYPE_MANIFEST_V2,
  MEDIATYPE_MANIFEST_LIST_V2,
  MEDIATYPE_OCI_MANIFEST_V1,
  MEDIATYPE_OCI_MANIFEST_INDEX_V1,
  DEFAULT_USERAGENT,
} from "./common.js";
import {
  BadDigestError,
  BlobReadError,
  TooManyRedirectsError,
} from "./errors.js";
import type { ByteArray } from "./types.js";
import { parseLinkHeader } from "./util/link-header.js";
```

NEW:
```typescript
import type {
  RegistryImage,
  RegistryIndex,
  RegistryRepo,
  TagList,
  RegistryError,
} from "../types/RegistryTypes.js";
import type {
  Manifest,
  ManifestOCI,
  ManifestV2,
} from "../types/ManifestTypes.js";
import type { AuthInfo } from "../types/AuthTypes.js";
import type { ByteArray, DockerResponse } from "../types/RequestTypes.js";
import type { RegistryClientOptions } from "./RegistryClientOptions.js";
import {
  parseRepo,
  parseRepoAndRef,
  DEFAULT_TAG,
} from "../parsing/RepoParser.js";
import {
  parseIndex,
  urlFromIndex,
  DEFAULT_INDEX_NAME,
} from "../parsing/IndexParser.js";
import {
  MEDIATYPE_MANIFEST_V2,
  MEDIATYPE_MANIFEST_LIST_V2,
  MEDIATYPE_OCI_MANIFEST_V1,
  MEDIATYPE_OCI_MANIFEST_INDEX_V1,
  DEFAULT_USERAGENT,
} from "../types/ManifestTypes.js";
import {
  BadDigestError,
  BlobReadError,
  TooManyRedirectsError,
} from "../errors/RegistryErrors.js";
import { parseLinkHeader } from "../parsing/LinkHeaderParser.js";
import { digestFromManifestStr, encodeHex } from "../utils/DigestUtils.js";
```

**Step 2: Update RegistryClientOpts to RegistryClientOptions**

Replace all occurrences in the file:
- `RegistryClientOpts` → `RegistryClientOptions`

Run: `cd packages/shard-lib/src/client && sed -i '' 's/RegistryClientOpts/RegistryClientOptions/g' OciRegistryClient.ts`

**Step 3: Remove digest functions from OciRegistryClient.ts**

Remove the `encodeHex` and `digestFromManifestStr` function definitions (they're now imported from DigestUtils)

**Step 4: Run type check**

Run: `cd packages/shard-lib && pnpm ts-check`
Expected: Pass

**Step 5: Commit**

```bash
git add packages/shard-lib/src/client/OciRegistryClient.ts
git commit -m "refactor: update registry client imports and rename options type"
```

---

## Task 12: Move Fetch Adapter

**Files:**
- Move: `packages/shard-lib/src/fetch-adapter.ts` → `packages/shard-lib/src/client/FetchAdapter.ts`

**Step 1: Move fetch adapter file**

```bash
mv packages/shard-lib/src/fetch-adapter.ts packages/shard-lib/src/client/FetchAdapter.ts
```

**Step 2: Run type check**

Run: `cd packages/shard-lib && pnpm ts-check`
Expected: Pass (not imported anywhere yet)

**Step 3: Commit**

```bash
git add packages/shard-lib/src/client/FetchAdapter.ts
git rm packages/shard-lib/src/fetch-adapter.ts
git commit -m "refactor: move fetch adapter to client directory"
```

---

## Task 13: Update Main Index Barrel File

**Files:**
- Modify: `packages/shard-lib/src/index.ts`

**Step 1: Rewrite index.ts with new exports**

```typescript
// packages/shard-lib/src/index.ts
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Main client
export {
  OciRegistryClient,
} from "./client/OciRegistryClient.js";
export {
  digestFromManifestStr,
} from "./utils/DigestUtils.js";

// Parsing utilities
export {
  parseRepo,
  parseRepoAndRef,
  DEFAULT_TAG,
} from "./parsing/RepoParser.js";
export {
  parseIndex,
  urlFromIndex,
  DEFAULT_INDEX_NAME,
} from "./parsing/IndexParser.js";
export {
  parseLinkHeader,
} from "./parsing/LinkHeaderParser.js";

// Validation utilities
export {
  splitIntoTwo,
} from "./utils/ValidationUtils.js";

// Constants
export {
  DEFAULT_USERAGENT,
  MEDIATYPE_MANIFEST_V2,
  MEDIATYPE_MANIFEST_LIST_V2,
  MEDIATYPE_OCI_MANIFEST_V1,
  MEDIATYPE_OCI_MANIFEST_INDEX_V1,
} from "./types/ManifestTypes.js";

// GHCR constants
export {
  REALM,
  SERVICE,
} from "./ghcr/GhcrConstants.js";

// Types
export type {
  Manifest,
  ManifestOCI,
  ManifestOCIDescriptor,
  ManifestV2,
  ManifestV2Descriptor,
  ManifestV2List,
  ManifestOCIIndex,
} from "./types/ManifestTypes.js";
export type {
  RegistryRepo,
  RegistryImage,
  RegistryIndex,
  TagList,
  RegistryError,
} from "./types/RegistryTypes.js";
export type {
  AuthInfo,
} from "./types/AuthTypes.js";
export type {
  RequestUrlParam,
  RequestUrlResponse,
  ByteArray,
  DockerResponse,
} from "./types/RequestTypes.js";
export type {
  RegistryClientOptions,
} from "./client/RegistryClientOptions.js";

// Errors
export {
  BadDigestError,
  BlobReadError,
  TooManyRedirectsError,
} from "./errors/RegistryErrors.js";

// Fetch adapter
export type {
  FetchAdapter,
} from "./client/FetchAdapter.js";
```

**Step 2: Run type check**

Run: `cd packages/shard-lib && pnpm ts-check`
Expected: Pass

**Step 3: Commit**

```bash
git add packages/shard-lib/src/index.ts
git commit -m "refactor: update barrel exports to new structure"
```

---

## Task 14: Remove Old Files

**Files:**
- Delete: `packages/shard-lib/src/common.ts`
- Delete: `packages/shard-lib/src/types.ts`
- Delete: `packages/shard-lib/src/ghcr.ts`

**Step 1: Remove old files**

```bash
git rm packages/shard-lib/src/common.ts
git rm packages/shard-lib/src/types.ts
git rm packages/shard-lib/src/ghcr.ts
```

**Step 2: Run type check**

Run: `cd packages/shard-lib && pnpm ts-check`
Expected: Pass

**Step 3: Commit**

```bash
git commit -m "refactor: remove old flat structure files"
```

---

## Task 15: Update Tests for New Structure

**Files:**
- Modify: `packages/shard-lib/src/__tests__/parsing.test.ts`

**Step 1: Update test imports**

OLD:
```typescript
import { parseIndex, parseRepo, parseRepoAndRef } from '../common.js';
```

NEW:
```typescript
import { parseIndex } from '../parsing/IndexParser.js';
import { parseRepo, parseRepoAndRef } from '../parsing/RepoParser.js';
```

**Step 2: Run tests**

Run: `cd packages/shard-lib && pnpm test`
Expected: All 12 tests pass

**Step 3: Commit**

```bash
git add packages/shard-lib/src/__tests__/parsing.test.ts
git commit -m "test: update test imports for new structure"
```

---

## Task 16: Full Build and Type Check Verification

**Files:**
- None (verification only)

**Step 1: Clean and rebuild**

```bash
cd packages/shard-lib
pnpm clean
pnpm build
```

Expected: Build succeeds, no errors

**Step 2: Run type check**

Run: `cd packages/shard-lib && pnpm ts-check`
Expected: Pass with no errors

**Step 3: Run all tests**

Run: `cd packages/shard-lib && pnpm test`
Expected: All tests pass

**Step 4: Check dist output structure**

Run: `ls -la packages/shard-lib/dist/`
Expected: See compiled .js and .d.ts files

**Step 5: Commit if any changes**

Only if there were any unexpected changes:
```bash
git add .
git commit -m "build: verify refactored structure builds correctly"
```

---

## Task 17: Verify Public API Compatibility

**Files:**
- None (verification only)

**Step 1: Check that all previously exported items are still available**

Create temporary test file to verify exports:

```typescript
// packages/shard-lib/src/__tests__/api-compatibility.test.ts
import { describe, it, expect } from 'vitest';
import * as ShardLib from '../index.js';

describe('Public API Compatibility', () => {
  it('should export OciRegistryClient', () => {
    expect(ShardLib.OciRegistryClient).toBeDefined();
  });

  it('should export digestFromManifestStr', () => {
    expect(ShardLib.digestFromManifestStr).toBeDefined();
  });

  it('should export parsing functions', () => {
    expect(ShardLib.parseRepo).toBeDefined();
    expect(ShardLib.parseRepoAndRef).toBeDefined();
    expect(ShardLib.urlFromIndex).toBeDefined();
    expect(ShardLib.splitIntoTwo).toBeDefined();
  });

  it('should export constants', () => {
    expect(ShardLib.DEFAULT_USERAGENT).toBeDefined();
    expect(ShardLib.MEDIATYPE_MANIFEST_V2).toBeDefined();
    expect(ShardLib.MEDIATYPE_MANIFEST_LIST_V2).toBeDefined();
    expect(ShardLib.MEDIATYPE_OCI_MANIFEST_V1).toBeDefined();
    expect(ShardLib.MEDIATYPE_OCI_MANIFEST_INDEX_V1).toBeDefined();
  });

  it('should export GHCR constants', () => {
    expect(ShardLib.REALM).toBeDefined();
    expect(ShardLib.SERVICE).toBeDefined();
  });

  it('should export error classes', () => {
    expect(ShardLib.BadDigestError).toBeDefined();
    expect(ShardLib.BlobReadError).toBeDefined();
    expect(ShardLib.TooManyRedirectsError).toBeDefined();
  });

  it('should export parseLinkHeader', () => {
    expect(ShardLib.parseLinkHeader).toBeDefined();
  });
});
```

**Step 2: Run API compatibility tests**

Run: `cd packages/shard-lib && pnpm test`
Expected: All tests pass (20 total tests)

**Step 3: Commit**

```bash
git add packages/shard-lib/src/__tests__/api-compatibility.test.ts
git commit -m "test: add API compatibility verification tests"
```

---

## Task 18: Update Package Documentation

**Files:**
- Create: `packages/shard-lib/README.md`

**Step 1: Create README.md**

```markdown
# shard-lib

OCI-compatible container registry client library for TypeScript/JavaScript.

## Features

- Parse and validate Docker/OCI repository references
- Interact with OCI registries (Docker Hub, GHCR, etc.)
- Support for Docker v2 and OCI manifest formats
- Bearer token and basic authentication
- Link header parsing for pagination

## Installation

```bash
pnpm add shard-lib
```

## Usage

```typescript
import { OciRegistryClient, parseRepoAndRef } from 'shard-lib';

// Parse a repository reference
const repo = parseRepoAndRef('ghcr.io/owner/repo:latest');
console.log(repo.index.name); // 'ghcr.io'
console.log(repo.tag); // 'latest'

// Create a registry client
const client = new OciRegistryClient({
  repo: repo,
  adapter: { fetch },
  username: 'user',
  password: 'token',
});

// List tags
const tags = await client.listTags();
console.log(tags);

// Get manifest
const manifest = await client.getManifest('latest');
console.log(manifest);
```

## Project Structure

```
src/
  client/          # OCI registry client and adapters
  errors/          # Custom error classes
  ghcr/            # GitHub Container Registry constants
  parsing/         # Repository and index parsing
  types/           # TypeScript type definitions
  utils/           # Utility functions
  __tests__/       # Test files
```

## API

### Parsing

- `parseIndex(arg?: string): RegistryIndex` - Parse registry index/URL
- `parseRepo(arg: string, defaultIndex?: string | RegistryIndex): RegistryRepo` - Parse repository
- `parseRepoAndRef(arg: string, defaultIndex?: string | RegistryIndex): RegistryImage` - Parse repository with tag/digest
- `urlFromIndex(index: RegistryIndex, scheme?: 'http' | 'https'): string` - Generate URL from index

### Client

- `OciRegistryClient` - Main registry client class
  - `listTags()` - List repository tags
  - `getManifest(ref: string)` - Get image manifest
  - `getBlob(digest: string)` - Download blob by digest

### Types

See TypeScript definitions for complete type information.

## License

MPL 2.0
```

**Step 2: Commit**

```bash
git add packages/shard-lib/README.md
git commit -m "docs: add package README with usage examples"
```

---

## Task 19: Final Verification Across Dependent Packages

**Files:**
- None (verification only)

**Step 1: Build all packages**

```bash
cd /Users/gillisandrew/Projects/gillisandrew/open-obsidian-plugin-spec
pnpm build
```

Expected: All packages build successfully

**Step 2: Run workspace type check**

Run: `pnpm ts-check`
Expected: Pass

**Step 3: Check for any broken imports in dependent packages**

Run: `grep -r "from ['\"]shard-lib" packages/shard-cli/src packages/shard-installer/src`
Expected: Verify imports still work (should use public exports from index)

**Step 4: If any issues found, document and fix**

If imports are broken in dependent packages, fix them by ensuring they import from `shard-lib` (barrel exports), not internal paths.

---

## Post-Refactor Notes

**What changed:**
- 8 flat files → 17 organized files in 6 directories
- Added test infrastructure (vitest)
- Created 20 baseline tests
- All public API maintained (backward compatible)
- Type-safe imports with explicit paths

**What didn't change:**
- Zero behavior changes
- Same public API surface
- Same build output
- Same runtime behavior

**Future improvements to consider:**
1. Break down 835-line OciRegistryClient.ts into smaller classes
2. Add more comprehensive test coverage
3. Add integration tests with mock registry
4. Extract constants to a dedicated constants file
5. Consider adding JSDoc comments to all public APIs

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-02-05-shard-lib-refactor-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
