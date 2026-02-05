# GHCR Push/Pull CLI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable pushing and pulling Obsidian plugins to/from GHCR as ORAS-compatible OCI artifacts with a Node.js CLI.

**Architecture:** Refactor `OciRegistryClient` to use standard fetch API with adapter pattern. Add blob upload and manifest push methods. Create separate CLI package that uses Node.js fetch adapter.

**Tech Stack:** TypeScript, Node.js native fetch, OCI Distribution Spec, ORAS conventions

---

## Task 1: Add artifactType to ManifestOCI Type

**Files:**
- Modify: `src/lib/client/types.ts:99-105`

**Step 1: Add artifactType field to ManifestOCI interface**

In `src/lib/client/types.ts`, update the `ManifestOCI` interface:

```typescript
export interface ManifestOCI {
  schemaVersion: 2;
  mediaType?: "application/vnd.oci.image.manifest.v1+json";
  artifactType?: string;
  config: ManifestOCIDescriptor;
  layers: Array<ManifestOCIDescriptor>;
  annotations?: Record<string, string>;
}
```

**Step 2: Verify type checking**

Run: `npm run build`
Expected: Build succeeds with no type errors

**Step 3: Commit**

```bash
git add src/lib/client/types.ts
git commit -m "feat: add artifactType field to ManifestOCI"
```

---

## Task 2: Create FetchAdapter Interface

**Files:**
- Create: `src/lib/client/fetch-adapter.ts`

**Step 1: Create fetch adapter interface file**

Create `src/lib/client/fetch-adapter.ts`:

```typescript
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * Adapter interface for HTTP requests.
 * Allows OciRegistryClient to work with different fetch implementations.
 */
export interface FetchAdapter {
  /**
   * Perform an HTTP request using fetch semantics.
   * @param input URL string or Request object
   * @param init Optional request initialization
   * @returns Promise resolving to Response
   */
  fetch(input: string | Request, init?: RequestInit): Promise<Response>;
}
```

**Step 2: Verify type checking**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/client/fetch-adapter.ts
git commit -m "feat: add FetchAdapter interface"
```

---

## Task 3: Create ObsidianFetchAdapter

**Files:**
- Create: `src/lib/client/obsidian-fetch-adapter.ts`

**Step 1: Create Obsidian fetch adapter**

Create `src/lib/client/obsidian-fetch-adapter.ts`:

```typescript
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import type { FetchAdapter } from "./fetch-adapter.js";
import type { RequestUrlParam, RequestUrlResponse } from "./types.js";

/**
 * Adapter that wraps Obsidian's requestUrl to match fetch API.
 */
export class ObsidianFetchAdapter implements FetchAdapter {
  constructor(
    private requestUrl: (
      request: RequestUrlParam | string,
    ) => Promise<RequestUrlResponse>,
  ) {}

  async fetch(input: string | Request, init?: RequestInit): Promise<Response> {
    // Extract URL and options
    const url = typeof input === "string" ? input : input.url;
    const method = typeof input === "string" ? init?.method : input.method;
    const headers =
      typeof input === "string" ? init?.headers : input.headers;
    const body = typeof input === "string" ? init?.body : await input.arrayBuffer();

    // Convert Headers object to plain object if needed
    const headersObj: Record<string, string> = {};
    if (headers) {
      if (headers instanceof Headers) {
        headers.forEach((value, key) => {
          headersObj[key] = value;
        });
      } else if (Array.isArray(headers)) {
        for (const [key, value] of headers) {
          headersObj[key] = value;
        }
      } else {
        Object.assign(headersObj, headers);
      }
    }

    // Call Obsidian's requestUrl
    const obsidianResponse = await this.requestUrl({
      url,
      method: method || "GET",
      headers: headersObj,
      body: body as ArrayBuffer | string | undefined,
    });

    // Convert to standard Response
    return new Response(obsidianResponse.arrayBuffer, {
      status: obsidianResponse.status,
      statusText: "", // Obsidian doesn't provide statusText
      headers: obsidianResponse.headers,
    });
  }
}
```

**Step 2: Verify type checking**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/client/obsidian-fetch-adapter.ts
git commit -m "feat: add ObsidianFetchAdapter"
```

---

## Task 4: Create NodeFetchAdapter

**Files:**
- Create: `src/lib/client/node-fetch-adapter.ts`

**Step 1: Create Node.js fetch adapter**

Create `src/lib/client/node-fetch-adapter.ts`:

```typescript
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import type { FetchAdapter } from "./fetch-adapter.js";

/**
 * Adapter that wraps Node.js native fetch.
 */
export class NodeFetchAdapter implements FetchAdapter {
  async fetch(input: string | Request, init?: RequestInit): Promise<Response> {
    try {
      return await fetch(input, init);
    } catch (error) {
      // Normalize network errors
      if (error instanceof TypeError) {
        throw new Error(`Network request failed: ${error.message}`);
      }
      throw error;
    }
  }
}
```

**Step 2: Verify type checking**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/client/node-fetch-adapter.ts
git commit -m "feat: add NodeFetchAdapter"
```

---

## Task 5: Refactor OciRegistryClient Constructor

**Files:**
- Modify: `src/lib/client/registry-client.ts:214-287`
- Modify: `src/lib/client/types.ts:136-150`

**Step 1: Update RegistryClientOpts type**

In `src/lib/client/types.ts`, replace `requestUrl` with `adapter`:

```typescript
export interface RegistryClientOpts {
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
  adapter: FetchAdapter;
}
```

**Step 2: Update OciRegistryClient class fields**

In `src/lib/client/registry-client.ts`, update the class:

```typescript
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
  private _commonHttpClientOpts: {
    userAgent: string;
  };
  private readonly _adapter: FetchAdapter;
```

**Step 3: Update constructor**

Replace the constructor implementation:

```typescript
  constructor(opts: RegistryClientOpts) {
    this.insecure = Boolean(opts.insecure);
    if (opts.repo) {
      this.repo = opts.repo;
    } else if (opts.name) {
      this.repo = parseRepo(opts.name);
    } else throw new Error(`name or repo required`);

    this.acceptOCIManifests = opts.acceptOCIManifests ?? true;
    this.acceptManifestLists = opts.acceptManifestLists ?? false;
    this.username = opts.username;
    this.password = opts.password;
    this.scopes = opts.scopes ?? ["pull"];
    this._loggedIn = false;
    this._loggedInScope = null;
    this._authInfo = null;
    this._headers = {};

    if (opts.token) {
      _setAuthHeaderFromAuthInfo(this._headers, {
        type: "Bearer",
        token: opts.token,
      });
    } else if (opts.username || opts.password) {
      _setAuthHeaderFromAuthInfo(this._headers, {
        type: "Basic",
        username: opts.username ?? "",
        password: opts.password ?? "",
      });
    } else {
      _setAuthHeaderFromAuthInfo(this._headers, {
        type: "None",
      });
    }

    this._url = urlFromIndex(this.repo.index, opts.scheme);
    this._commonHttpClientOpts = {
      userAgent: opts.userAgent || DEFAULT_USERAGENT,
    };

    this._adapter = opts.adapter;
  }
```

**Step 4: Add import for FetchAdapter**

At the top of `src/lib/client/registry-client.ts`, add import:

```typescript
import type { FetchAdapter } from "./fetch-adapter.js";
```

**Step 5: Verify type checking**

Run: `npm run build`
Expected: Build fails because existing code still uses `_api`

This is expected - we'll fix the methods in the next tasks.

**Step 6: Commit**

```bash
git add src/lib/client/types.ts src/lib/client/registry-client.ts
git commit -m "refactor: replace requestUrl with FetchAdapter in constructor"
```

---

## Task 6: Refactor _getToken to Use Fetch

**Files:**
- Modify: `src/lib/client/registry-client.ts:319-387`

**Step 1: Replace _api.request with _adapter.fetch**

In `src/lib/client/registry-client.ts`, update `_getToken` method:

```typescript
  async _getToken(opts: {
    realm: string;
    service?: string;
    scopes?: string[];
  }): Promise<string> {
    // - add https:// prefix (or http) if none on 'realm'
    let tokenUrl = opts.realm;
    const match = /^(\w+):\/\//.exec(tokenUrl);
    if (!match) {
      tokenUrl = (this.insecure ? "http" : "https") + "://" + tokenUrl;
    } else if (match[1] && ["http", "https"].indexOf(match[1]) === -1) {
      throw new Error(
        "unsupported scheme for " +
          `WWW-Authenticate realm "${opts.realm}": "${match[1]}"`,
      );
    }

    // Build query parameters
    const headers: Record<string, string> = {};
    const query = new URLSearchParams();
    if (opts.service) {
      query.set("service", opts.service);
    }
    if (opts.scopes && opts.scopes.length) {
      for (const scope of opts.scopes) {
        query.append("scope", scope);
      }
    }
    if (this.username) {
      query.set("account", this.username);
      _setAuthHeaderFromAuthInfo(headers, {
        type: "Basic",
        username: this.username,
        password: this.password ?? "",
      });
    }
    if (query.toString()) {
      tokenUrl += "?" + query.toString();
    }

    // Make request
    const resp = await this._adapter.fetch(tokenUrl, {
      method: "GET",
      headers: {
        ...headers,
        "User-Agent": this._commonHttpClientOpts.userAgent,
      },
    });

    if (resp.status === 401) {
      const body = await resp.json();
      const errMsg = _getRegistryErrorMessage(body);
      throw new Error(`Registry auth failed: ${errMsg as string}`);
    }

    if (!resp.ok) {
      throw new Error(
        `Token request failed: ${resp.status} ${resp.statusText}`,
      );
    }

    const body = (await resp.json()) as { token?: string };
    if (typeof body?.token !== "string") {
      console.error("TODO: auth resp:", body);
      throw new Error(
        "authorization server did not include a token in the response",
      );
    }
    return body.token;
  }
```

**Step 2: Verify type checking**

Run: `npm run build`
Expected: Still fails on other methods that use `_api`

**Step 3: Commit**

```bash
git add src/lib/client/registry-client.ts
git commit -m "refactor: convert _getToken to use fetch adapter"
```

---

## Task 7: Refactor listTags to Use Fetch

**Files:**
- Modify: `src/lib/client/registry-client.ts:425-440`

**Step 1: Replace _api.request with _adapter.fetch**

Update `listTags` method:

```typescript
  async listTags(
    props: { pageSize?: number; startingAfter?: string } = {},
  ): Promise<TagList> {
    const searchParams = new URLSearchParams();
    if (props.pageSize != null) searchParams.set("n", `${props.pageSize}`);
    if (props.startingAfter != null)
      searchParams.set("last", props.startingAfter);

    await this.login();

    const path = `/v2/${encodeURI(this.repo.remoteName)}/tags/list${
      searchParams.toString() ? "?" + searchParams.toString() : ""
    }`;

    const resp = await this._adapter.fetch(new URL(path, this._url).toString(), {
      method: "GET",
      headers: {
        ...this._headers,
        "User-Agent": this._commonHttpClientOpts.userAgent,
      },
    });

    if (!resp.ok) {
      throw new Error(`Failed to list tags: ${resp.status} ${resp.statusText}`);
    }

    return (await resp.json()) as TagList;
  }
```

**Step 2: Verify type checking**

Run: `npm run build`
Expected: Still fails on other methods

**Step 3: Commit**

```bash
git add src/lib/client/registry-client.ts
git commit -m "refactor: convert listTags to use fetch adapter"
```

---

## Task 8: Refactor listTagsPaginated to Use Fetch

**Files:**
- Modify: `src/lib/client/registry-client.ts:451-472`

**Step 1: Replace _api.request with _adapter.fetch**

Update `listTagsPaginated` method:

```typescript
  async *listTagsPaginated(
    props: { pageSize?: number } = {},
  ): AsyncGenerator<TagList> {
    await this.login();
    let path: string | null =
      `/v2/${encodeURI(this.repo.remoteName)}/tags/list`;
    if (props.pageSize != null) {
      path += `?n=${props.pageSize}`;
    }
    while (path) {
      const resp = await this._adapter.fetch(new URL(path, this._url).toString(), {
        method: "GET",
        headers: {
          ...this._headers,
          "User-Agent": this._commonHttpClientOpts.userAgent,
        },
      });

      if (!resp.ok) {
        throw new Error(
          `Failed to list tags: ${resp.status} ${resp.statusText}`,
        );
      }

      const linkHeader = resp.headers.get("link");
      const links = parseLinkHeader(linkHeader);
      const nextLink = links.find((x) => x.rel == "next");
      path = nextLink?.url ?? null;

      yield (await resp.json()) as TagList;
    }
  }
```

**Step 2: Verify type checking**

Run: `npm run build`
Expected: Still fails on other methods

**Step 3: Commit**

```bash
git add src/lib/client/registry-client.ts
git commit -m "refactor: convert listTagsPaginated to use fetch adapter"
```

---

## Task 9: Refactor getManifest to Use Fetch

**Files:**
- Modify: `src/lib/client/registry-client.ts:481-530`

**Step 1: Replace _api.request with _adapter.fetch**

Update `getManifest` method:

```typescript
  async getManifest(opts: {
    ref: string;
    acceptManifestLists?: boolean;
    acceptOCIManifests?: boolean;
    followRedirects?: boolean;
  }): Promise<{
    manifest: Manifest;
    digest?: string;
  }> {
    const acceptOCIManifests =
      opts.acceptOCIManifests ?? this.acceptOCIManifests;
    const acceptManifestLists =
      opts.acceptManifestLists ?? this.acceptManifestLists;

    await this.login();
    const headers = { ...this._headers };
    const acceptTypes = [MEDIATYPE_MANIFEST_V2];
    if (acceptManifestLists) {
      acceptTypes.push(MEDIATYPE_MANIFEST_LIST_V2);
    }
    if (acceptOCIManifests) {
      acceptTypes.push(MEDIATYPE_OCI_MANIFEST_V1);
      if (acceptManifestLists) {
        acceptTypes.push(MEDIATYPE_OCI_MANIFEST_INDEX_V1);
      }
    }
    headers["accept"] = acceptTypes.join(", ");
    headers["User-Agent"] = this._commonHttpClientOpts.userAgent;

    const path = `/v2/${encodeURI(this.repo.remoteName ?? "")}/manifests/${encodeURI(opts.ref)}`;
    const resp = await this._adapter.fetch(new URL(path, this._url).toString(), {
      method: "GET",
      headers: headers,
      redirect: opts.followRedirects == false ? "manual" : "follow",
    });

    if (resp.status === 401) {
      const body = await resp.json();
      const errMsg = _getRegistryErrorMessage(body);
      throw new Error(
        `Manifest ${JSON.stringify(opts.ref)} Not Found: ${errMsg as string}`,
      );
    }

    if (!resp.ok) {
      throw new Error(
        `Failed to get manifest: ${resp.status} ${resp.statusText}`,
      );
    }

    const manifest = (await resp.json()) as Manifest;
    if ((manifest.schemaVersion as number) === 1) {
      throw new Error(
        `schemaVersion 1 is not supported by /x/docker_registry_client.`,
      );
    }

    const digest = resp.headers.get("docker-content-digest") ?? undefined;

    return { manifest, digest };
  }
```

**Step 2: Update return type in getManifest**

Change return type to remove `resp`:

```typescript
  }): Promise<{
    manifest: Manifest;
    digest?: string;
  }> {
```

**Step 3: Verify type checking**

Run: `npm run build`
Expected: Still fails on other methods

**Step 4: Commit**

```bash
git add src/lib/client/registry-client.ts
git commit -m "refactor: convert getManifest to use fetch adapter"
```

---

## Task 10: Refactor _makeHttpRequest to Use Fetch

**Files:**
- Modify: `src/lib/client/registry-client.ts:540-585`

**Step 1: Replace _api.request with _adapter.fetch**

Update `_makeHttpRequest` method:

```typescript
  async _makeHttpRequest(opts: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    followRedirects?: boolean;
    maxRedirects?: number;
  }): Promise<Response[]> {
    const followRedirects = opts.followRedirects ?? true;
    const maxRedirects = opts.maxRedirects ?? 3;
    let numRedirs = 0;
    let currentPath = opts.path;
    const currentHeaders = opts.headers ?? {};
    const responses: Response[] = [];

    while (numRedirs < maxRedirects) {
      numRedirs += 1;

      const resp = await this._adapter.fetch(
        new URL(currentPath, this._url).toString(),
        {
          method: opts.method,
          headers: {
            ...currentHeaders,
            "User-Agent": this._commonHttpClientOpts.userAgent,
          },
          redirect: "manual",
        },
      );

      responses.push(resp);

      if (!followRedirects) return responses;
      if (!(resp.status === 302 || resp.status === 307)) return responses;

      const location = resp.headers.get("location");
      if (!location) return responses;

      const loc = new URL(location, new URL(currentPath, this._url));
      currentPath = loc.toString();
    }

    throw new e.TooManyRedirectsError(
      `maximum number of redirects (${maxRedirects}) hit`,
    );
  }
```

**Step 2: Verify type checking**

Run: `npm run build`
Expected: Still fails on methods using DockerResponse

**Step 3: Commit**

```bash
git add src/lib/client/registry-client.ts
git commit -m "refactor: convert _makeHttpRequest to use fetch adapter"
```

---

## Task 11: Refactor _headOrGetBlob to Use New _makeHttpRequest

**Files:**
- Modify: `src/lib/client/registry-client.ts:587-597`

**Step 1: Update _headOrGetBlob return type and implementation**

Update the method:

```typescript
  async _headOrGetBlob(
    method: "GET" | "HEAD",
    digest: string,
  ): Promise<Response[]> {
    await this.login();
    return await this._makeHttpRequest({
      method: method,
      path: `/v2/${encodeURI(this.repo.remoteName ?? "")}/blobs/${encodeURI(digest)}`,
      headers: this._headers,
    });
  }
```

**Step 2: Verify type checking**

Run: `npm run build`
Expected: Still fails on headBlob and downloadBlob

**Step 3: Commit**

```bash
git add src/lib/client/registry-client.ts
git commit -m "refactor: update _headOrGetBlob to use new _makeHttpRequest"
```

---

## Task 12: Refactor headBlob and downloadBlob

**Files:**
- Modify: `src/lib/client/registry-client.ts:614-660`

**Step 1: Update headBlob**

Update the method:

```typescript
  async headBlob(opts: { digest: string }): Promise<Response[]> {
    return await this._headOrGetBlob("HEAD", opts.digest);
  }
```

**Step 2: Update downloadBlob**

Update the method:

```typescript
  async downloadBlob(opts: { digest: string }): Promise<{
    responses: Response[];
    buffer: ArrayBuffer;
  }> {
    const responses = await this._headOrGetBlob("GET", opts.digest);
    const lastResp = responses[responses.length - 1];
    if (!lastResp) {
      throw new e.BlobReadError(
        `No response available for blob ${opts.digest}`,
      );
    }

    const buffer = await lastResp.arrayBuffer();

    const dcdHeader = responses[0]?.headers.get("docker-content-digest");
    if (dcdHeader) {
      const dcdInfo = _parseDockerContentDigest(dcdHeader);
      if (dcdInfo.raw !== opts.digest) {
        throw new e.BadDigestError(
          `Docker-Content-Digest header, ${dcdInfo.raw}, does not match ` +
            `given digest, ${opts.digest}`,
        );
      }

      // Validate the digest
      await dcdInfo.validate(buffer);
    }

    return { responses, buffer };
  }
```

**Step 3: Remove DockerJsonClient import**

Remove the line:

```typescript
import { DockerJsonClient, type DockerResponse } from "./docker-json-client.js";
```

**Step 4: Remove _api field**

Remove from class:

```typescript
  private readonly _api: DockerJsonClient;
```

**Step 5: Verify type checking**

Run: `npm run build`
Expected: Build succeeds now

**Step 6: Commit**

```bash
git add src/lib/client/registry-client.ts
git commit -m "refactor: complete migration to fetch adapter, remove DockerJsonClient"
```

---

## Task 13: Add pushBlob Method

**Files:**
- Modify: `src/lib/client/registry-client.ts` (add at end of class, before closing brace)

**Step 1: Add pushBlob method**

Add the method before the closing brace of the class:

```typescript
  /**
   * Upload a blob using POST then PUT workflow.
   * <https://github.com/opencontainers/distribution-spec/blob/main/spec.md#post-then-put>
   */
  async pushBlob(opts: {
    data: ArrayBuffer | Uint8Array;
    digest?: string;
  }): Promise<{ digest: string; size: number }> {
    await this.login();

    // Calculate digest if not provided
    const data =
      opts.data instanceof ArrayBuffer ? new Uint8Array(opts.data) : opts.data;
    let digest = opts.digest;
    if (!digest) {
      const hash = await crypto.subtle.digest("SHA-256", data);
      digest = `sha256:${encodeHex(hash)}`;
    }

    // Step 1: Initiate upload
    const initPath = `/v2/${encodeURI(this.repo.remoteName)}/blobs/uploads/`;
    const initResp = await this._adapter.fetch(
      new URL(initPath, this._url).toString(),
      {
        method: "POST",
        headers: {
          ...this._headers,
          "Content-Length": "0",
          "User-Agent": this._commonHttpClientOpts.userAgent,
        },
      },
    );

    if (!initResp.ok) {
      throw new Error(
        `Failed to initiate blob upload: ${initResp.status} ${initResp.statusText}`,
      );
    }

    const location = initResp.headers.get("location");
    if (!location) {
      throw new Error("Upload initiation response missing Location header");
    }

    // Step 2: Upload blob with PUT
    const uploadUrl = new URL(location, this._url);
    uploadUrl.searchParams.set("digest", digest);

    const uploadResp = await this._adapter.fetch(uploadUrl.toString(), {
      method: "PUT",
      headers: {
        ...this._headers,
        "Content-Type": "application/octet-stream",
        "Content-Length": data.byteLength.toString(),
        "User-Agent": this._commonHttpClientOpts.userAgent,
      },
      body: data,
    });

    if (!uploadResp.ok) {
      throw new Error(
        `Failed to upload blob: ${uploadResp.status} ${uploadResp.statusText}`,
      );
    }

    // Verify digest
    const returnedDigest = uploadResp.headers.get("docker-content-digest");
    if (returnedDigest && returnedDigest !== digest) {
      throw new e.BadDigestError(
        `Digest mismatch: expected ${digest}, got ${returnedDigest}`,
      );
    }

    return { digest, size: data.byteLength };
  }
```

**Step 2: Verify type checking**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/client/registry-client.ts
git commit -m "feat: add pushBlob method for uploading blobs"
```

---

## Task 14: Add pushManifest Method

**Files:**
- Modify: `src/lib/client/registry-client.ts` (add at end of class, before closing brace)

**Step 1: Add pushManifest method**

Add the method:

```typescript
  /**
   * Upload a manifest.
   * <https://github.com/opencontainers/distribution-spec/blob/main/spec.md#pushing-manifests>
   */
  async pushManifest(opts: {
    ref: string;
    manifest: Manifest;
    mediaType?: string;
  }): Promise<{ digest: string; size: number }> {
    await this.login();

    // Serialize manifest
    const manifestStr = JSON.stringify(opts.manifest);
    const manifestBytes = new TextEncoder().encode(manifestStr);

    // Calculate digest
    const digest = await digestFromManifestStr(manifestStr);

    // Determine media type
    const mediaType =
      opts.mediaType || "application/vnd.oci.image.manifest.v1+json";

    // Push manifest
    const path = `/v2/${encodeURI(this.repo.remoteName)}/manifests/${encodeURI(opts.ref)}`;
    const resp = await this._adapter.fetch(new URL(path, this._url).toString(), {
      method: "PUT",
      headers: {
        ...this._headers,
        "Content-Type": mediaType,
        "Content-Length": manifestBytes.byteLength.toString(),
        "User-Agent": this._commonHttpClientOpts.userAgent,
      },
      body: manifestBytes,
    });

    if (!resp.ok) {
      throw new Error(
        `Failed to push manifest: ${resp.status} ${resp.statusText}`,
      );
    }

    // Verify digest
    const returnedDigest = resp.headers.get("docker-content-digest");
    if (returnedDigest && returnedDigest !== digest) {
      throw new e.BadDigestError(
        `Digest mismatch: expected ${digest}, got ${returnedDigest}`,
      );
    }

    return { digest, size: manifestBytes.byteLength };
  }
```

**Step 2: Verify type checking**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/client/registry-client.ts
git commit -m "feat: add pushManifest method for uploading manifests"
```

---

## Task 15: Update Plugin to Use ObsidianFetchAdapter

**Files:**
- Modify: `src/plugin/ghcr-wrapper.ts`

**Step 1: Add import for ObsidianFetchAdapter**

Add to imports:

```typescript
import { ObsidianFetchAdapter } from "../lib/client/obsidian-fetch-adapter.js";
```

**Step 2: Find all OciRegistryClient instantiations**

Search for `new OciRegistryClient` in the file.

**Step 3: Update constructor calls to use adapter**

Replace `requestUrl: requestUrl` with `adapter: new ObsidianFetchAdapter(requestUrl)` in all OciRegistryClient instantiations.

Example:

```typescript
const client = new OciRegistryClient({
  name: imageName,
  token: this.settings.pat,
  adapter: new ObsidianFetchAdapter(requestUrl),
});
```

**Step 4: Verify type checking**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/plugin/ghcr-wrapper.ts
git commit -m "refactor: update plugin to use ObsidianFetchAdapter"
```

---

## Task 16: Create CLI Package Structure

**Files:**
- Create: `src/cli/package.json`
- Create: `src/cli/tsconfig.json`

**Step 1: Create CLI package.json**

Create `src/cli/package.json`:

```json
{
  "name": "@obsidian-ghcr/cli",
  "version": "0.1.0",
  "type": "module",
  "description": "CLI for pushing and pulling Obsidian plugins to/from GitHub Container Registry",
  "bin": {
    "obsidian-plugin": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "keywords": ["obsidian", "plugin", "ghcr", "oci", "oras"],
  "license": "MPL-2.0",
  "dependencies": {},
  "devDependencies": {
    "@types/node": "^25.2.0",
    "typescript": "^5.9.3"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Step 2: Create CLI tsconfig.json**

Create `src/cli/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": ".",
    "module": "ES2022",
    "target": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "types": ["node"]
  },
  "include": ["./**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create directory structure**

```bash
mkdir -p src/cli/{commands,lib,adapters}
```

**Step 4: Commit**

```bash
git add src/cli/package.json src/cli/tsconfig.json
git commit -m "feat: create CLI package structure"
```

---

## Task 17: Create Logger Utility

**Files:**
- Create: `src/cli/lib/logger.ts`

**Step 1: Create logger utility**

Create `src/cli/lib/logger.ts`:

```typescript
/**
 * Simple logger that writes to stderr for progress messages.
 */
export class Logger {
  constructor(private verbose: boolean = true) {}

  log(message: string): void {
    if (this.verbose) {
      console.error(message);
    }
  }

  error(message: string): void {
    console.error(`Error: ${message}`);
  }

  success(message: string): void {
    if (this.verbose) {
      console.error(`✓ ${message}`);
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/cli/lib/logger.ts
git commit -m "feat: add logger utility for CLI"
```

---

## Task 18: Create Auth Resolution

**Files:**
- Create: `src/cli/lib/auth.ts`

**Step 1: Create auth resolution utility**

Create `src/cli/lib/auth.ts`:

```typescript
/**
 * Resolve GitHub authentication token from CLI flag or environment.
 */
export function resolveAuthToken(cliToken?: string): string {
  // Priority: CLI flag > GITHUB_TOKEN > GH_TOKEN
  if (cliToken) {
    return cliToken;
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (githubToken) {
    return githubToken;
  }

  const ghToken = process.env.GH_TOKEN;
  if (ghToken) {
    return ghToken;
  }

  throw new Error(
    "GitHub token required. Use --token flag or set GITHUB_TOKEN environment variable",
  );
}
```

**Step 2: Commit**

```bash
git add src/cli/lib/auth.ts
git commit -m "feat: add auth token resolution for CLI"
```

---

## Task 19: Create Plugin Discovery

**Files:**
- Create: `src/cli/lib/plugin.ts`

**Step 1: Create plugin discovery utility**

Create `src/cli/lib/plugin.ts`:

```typescript
import { readFile } from "fs/promises";
import { join } from "path";

export interface PluginFile {
  path: string;
  name: string;
  mediaType: string;
  data: ArrayBuffer;
  size: number;
}

export interface DiscoveredPlugin {
  manifestJson: {
    id: string;
    version: string;
    [key: string]: unknown;
  };
  files: PluginFile[];
}

/**
 * Discover plugin files in a directory.
 */
export async function discoverPlugin(
  directory: string,
): Promise<DiscoveredPlugin> {
  const files: PluginFile[] = [];

  // Read manifest.json (required)
  const manifestPath = join(directory, "manifest.json");
  let manifestData: Buffer;
  try {
    manifestData = await readFile(manifestPath);
  } catch (error) {
    throw new Error(`manifest.json not found in ${directory}`);
  }

  // Parse manifest
  let manifestJson: { id: string; version: string; [key: string]: unknown };
  try {
    manifestJson = JSON.parse(manifestData.toString("utf-8"));
  } catch (error) {
    throw new Error(
      `Could not parse manifest.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!manifestJson.version) {
    throw new Error('manifest.json missing required "version" field');
  }

  if (!manifestJson.id) {
    throw new Error('manifest.json missing required "id" field');
  }

  files.push({
    path: manifestPath,
    name: "manifest.json",
    mediaType: "application/json",
    data: manifestData.buffer.slice(
      manifestData.byteOffset,
      manifestData.byteOffset + manifestData.byteLength,
    ),
    size: manifestData.byteLength,
  });

  // Read main.js (required)
  const mainPath = join(directory, "main.js");
  try {
    const mainData = await readFile(mainPath);
    files.push({
      path: mainPath,
      name: "main.js",
      mediaType: "application/javascript",
      data: mainData.buffer.slice(
        mainData.byteOffset,
        mainData.byteOffset + mainData.byteLength,
      ),
      size: mainData.byteLength,
    });
  } catch (error) {
    throw new Error(`main.js not found in ${directory}`);
  }

  // Read styles.css (optional)
  const stylesPath = join(directory, "styles.css");
  try {
    const stylesData = await readFile(stylesPath);
    files.push({
      path: stylesPath,
      name: "styles.css",
      mediaType: "text/css",
      data: stylesData.buffer.slice(
        stylesData.byteOffset,
        stylesData.byteOffset + stylesData.byteLength,
      ),
      size: stylesData.byteLength,
    });
  } catch (error) {
    // styles.css is optional, ignore if not found
  }

  return { manifestJson, files };
}
```

**Step 2: Commit**

```bash
git add src/cli/lib/plugin.ts
git commit -m "feat: add plugin discovery for CLI"
```

---

## Task 20: Create Digest Utility

**Files:**
- Create: `src/cli/lib/digest.ts`

**Step 1: Create digest utility**

Create `src/cli/lib/digest.ts`:

```typescript
/**
 * Calculate SHA-256 digest of data.
 */
export async function calculateDigest(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hashHex}`;
}

/**
 * Verify digest matches expected value.
 */
export async function verifyDigest(
  data: ArrayBuffer,
  expectedDigest: string,
): Promise<void> {
  const actualDigest = await calculateDigest(data);
  if (actualDigest !== expectedDigest) {
    throw new Error(
      `Digest verification failed: expected ${expectedDigest}, got ${actualDigest}`,
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/cli/lib/digest.ts
git commit -m "feat: add digest calculation utilities for CLI"
```

---

## Task 21: Create Push Command

**Files:**
- Create: `src/cli/commands/push.ts`

**Step 1: Create push command (part 1 - structure)**

Create `src/cli/commands/push.ts`:

```typescript
import { OciRegistryClient } from "../../lib/client/registry-client.js";
import { NodeFetchAdapter } from "../adapters/node-fetch.js";
import { parseRepo } from "../../lib/client/common.js";
import { resolveAuthToken } from "../lib/auth.js";
import { discoverPlugin } from "../lib/plugin.js";
import { calculateDigest } from "../lib/digest.js";
import { Logger } from "../lib/logger.js";
import type { ManifestOCI } from "../../lib/client/types.js";

export interface PushOptions {
  directory: string;
  repository: string;
  token?: string;
  json?: boolean;
}

export interface PushResult {
  digest: string;
  tag: string;
  size: number;
  repository: string;
}

export async function pushCommand(opts: PushOptions): Promise<PushResult> {
  const logger = new Logger(!opts.json);

  // Resolve auth
  const token = resolveAuthToken(opts.token);

  // Discover plugin
  logger.log(`Discovering plugin files in ${opts.directory}...`);
  const plugin = await discoverPlugin(opts.directory);

  // Parse repository and add tag from manifest
  const repo = parseRepo(opts.repository);
  const tag = plugin.manifestJson.version;
  const fullRef = `${opts.repository}:${tag}`;

  logger.log(
    `Pushing ${plugin.manifestJson.id} v${tag} to ${fullRef}`,
  );

  // Create client
  const client = new OciRegistryClient({
    repo,
    token,
    adapter: new NodeFetchAdapter(),
    scopes: ["push", "pull"],
  });

  // Create empty config blob
  const configData = new TextEncoder().encode("{}");
  const configDigest = await calculateDigest(configData);
  logger.log(`Uploading config blob (${configData.byteLength} bytes)...`);
  const configResult = await client.pushBlob({
    data: configData,
    digest: configDigest,
  });

  // Push each file as a blob
  const layers: Array<{
    mediaType: string;
    digest: string;
    size: number;
    annotations: { "org.opencontainers.image.title": string };
  }> = [];

  for (const file of plugin.files) {
    logger.log(`Uploading ${file.name} (${file.size} bytes)...`);
    const fileDigest = await calculateDigest(file.data);
    const result = await client.pushBlob({
      data: file.data,
      digest: fileDigest,
    });
    layers.push({
      mediaType: file.mediaType,
      digest: result.digest,
      size: result.size,
      annotations: {
        "org.opencontainers.image.title": file.name,
      },
    });
  }

  // Build manifest
  const manifest: ManifestOCI = {
    schemaVersion: 2,
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    artifactType: "application/vnd.obsidian.plugin.v1+json",
    config: {
      mediaType: "application/vnd.oci.image.config.v1+json",
      digest: configResult.digest,
      size: configResult.size,
    },
    layers,
    annotations: {
      "org.opencontainers.image.created": new Date().toISOString(),
    },
  };

  // Push manifest
  logger.log("Pushing manifest...");
  const manifestResult = await client.pushManifest({
    ref: tag,
    manifest,
  });

  logger.success(`Successfully pushed to ${fullRef}`);

  return {
    digest: manifestResult.digest,
    tag,
    size: manifestResult.size,
    repository: fullRef,
  };
}
```

**Step 2: Commit**

```bash
git add src/cli/commands/push.ts
git commit -m "feat: add push command implementation"
```

---

## Task 22: Create Pull Command

**Files:**
- Create: `src/cli/commands/pull.ts`

**Step 1: Create pull command**

Create `src/cli/commands/pull.ts`:

```typescript
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { OciRegistryClient } from "../../lib/client/registry-client.js";
import { NodeFetchAdapter } from "../adapters/node-fetch.js";
import { parseRepo } from "../../lib/client/common.js";
import { resolveAuthToken } from "../lib/auth.js";
import { Logger } from "../lib/logger.js";
import type { ManifestOCI } from "../../lib/client/types.js";

export interface PullOptions {
  repository: string;
  output: string;
  token?: string;
  json?: boolean;
}

export interface PullResult {
  files: string[];
  output: string;
  digest?: string;
}

function getFilenameFromLayer(layer: {
  annotations?: Record<string, string>;
}): string {
  const filename = layer.annotations?.["org.opencontainers.image.title"];
  if (!filename) {
    throw new Error("Layer missing org.opencontainers.image.title annotation");
  }
  return filename;
}

export async function pullCommand(opts: PullOptions): Promise<PullResult> {
  const logger = new Logger(!opts.json);

  // Parse repository reference
  const refMatch = opts.repository.match(/^(.+?)(?::([^:@]+)|@(sha256:[a-f0-9]+))$/);
  if (!refMatch) {
    throw new Error(
      "Repository reference must include tag or digest (e.g., :1.0.0 or @sha256:...)",
    );
  }

  const repoName = refMatch[1];
  const ref = refMatch[2] || refMatch[3];
  if (!ref) {
    throw new Error(
      "Repository reference must include tag or digest",
    );
  }

  // Resolve auth
  const token = resolveAuthToken(opts.token);

  logger.log(`Pulling ${opts.repository}...`);

  // Create client
  const repo = parseRepo(repoName);
  const client = new OciRegistryClient({
    repo,
    token,
    adapter: new NodeFetchAdapter(),
    scopes: ["pull"],
  });

  // Fetch manifest
  const { manifest, digest } = await client.getManifest({ ref });

  if (!("layers" in manifest)) {
    throw new Error("Manifest does not contain layers");
  }

  const ociManifest = manifest as ManifestOCI;

  // Create output directory
  await mkdir(opts.output, { recursive: true });

  // Download each layer
  const files: string[] = [];
  for (const layer of ociManifest.layers) {
    const filename = getFilenameFromLayer(layer);
    logger.log(`Downloading ${filename} (${layer.size} bytes)...`);

    const { buffer } = await client.downloadBlob({ digest: layer.digest });

    const outputPath = join(opts.output, filename);
    await writeFile(outputPath, new Uint8Array(buffer));
    files.push(filename);
  }

  logger.success(
    `Successfully pulled to ${opts.output} (${files.length} files)`,
  );

  return {
    files,
    output: opts.output,
    digest,
  };
}
```

**Step 2: Commit**

```bash
git add src/cli/commands/pull.ts
git commit -m "feat: add pull command implementation"
```

---

## Task 23: Create NodeFetchAdapter (moved from earlier)

**Files:**
- Create: `src/cli/adapters/node-fetch.ts`

**Step 1: Create Node.js fetch adapter**

Create `src/cli/adapters/node-fetch.ts`:

```typescript
import type { FetchAdapter } from "../../lib/client/fetch-adapter.js";

/**
 * Adapter that wraps Node.js native fetch.
 */
export class NodeFetchAdapter implements FetchAdapter {
  async fetch(input: string | Request, init?: RequestInit): Promise<Response> {
    try {
      return await fetch(input, init);
    } catch (error) {
      // Normalize network errors
      if (error instanceof TypeError) {
        throw new Error(`Network request failed: ${error.message}`);
      }
      throw error;
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/cli/adapters/node-fetch.ts
git commit -m "feat: add NodeFetchAdapter for CLI"
```

---

## Task 24: Create CLI Entry Point

**Files:**
- Create: `src/cli/index.ts`

**Step 1: Create CLI entry point**

Create `src/cli/index.ts`:

```typescript
#!/usr/bin/env node

import { parseArgs } from "util";
import { pushCommand } from "./commands/push.js";
import { pullCommand } from "./commands/pull.js";

const USAGE = `
Usage: obsidian-plugin <command> [options]

Commands:
  push <directory> <repository>  Push plugin to registry
  pull <repository>              Pull plugin from registry

Push Options:
  --token <token>               GitHub Personal Access Token
  --json                        Output JSON to stdout

Pull Options:
  --output <directory>          Output directory (required)
  --token <token>               GitHub Personal Access Token
  --json                        Output JSON to stdout

Examples:
  obsidian-plugin push ./dist ghcr.io/user/plugin
  obsidian-plugin pull ghcr.io/user/plugin:1.0.0 --output ./plugin
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(USAGE);
    process.exit(0);
  }

  const command = args[0];

  try {
    if (command === "push") {
      const { values, positionals } = parseArgs({
        args: args.slice(1),
        options: {
          token: { type: "string" },
          json: { type: "boolean" },
        },
        allowPositionals: true,
      });

      if (positionals.length !== 2) {
        throw new Error("push requires <directory> and <repository> arguments");
      }

      const result = await pushCommand({
        directory: positionals[0],
        repository: positionals[1],
        token: values.token,
        json: values.json,
      });

      if (values.json) {
        console.log(JSON.stringify(result, null, 2));
      }
    } else if (command === "pull") {
      const { values, positionals } = parseArgs({
        args: args.slice(1),
        options: {
          output: { type: "string" },
          token: { type: "string" },
          json: { type: "boolean" },
        },
        allowPositionals: true,
      });

      if (positionals.length !== 1) {
        throw new Error("pull requires <repository> argument");
      }

      if (!values.output) {
        throw new Error("pull requires --output flag");
      }

      const result = await pullCommand({
        repository: positionals[0],
        output: values.output,
        token: values.token,
        json: values.json,
      });

      if (values.json) {
        console.log(JSON.stringify(result, null, 2));
      }
    } else {
      throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

main();
```

**Step 2: Make executable**

```bash
chmod +x src/cli/index.ts
```

**Step 3: Commit**

```bash
git add src/cli/index.ts
git commit -m "feat: add CLI entry point with push and pull commands"
```

---

## Task 25: Build and Test CLI

**Files:**
- Modify: `src/cli/package.json`

**Step 1: Install CLI dependencies**

```bash
cd src/cli
npm install
cd ../..
```

**Step 2: Build CLI**

```bash
cd src/cli
npm run build
cd ../..
```

**Step 3: Test help output**

```bash
node src/cli/dist/index.js --help
```

Expected: Usage information prints

**Step 4: Commit if build config needs updates**

If any changes needed:

```bash
git add src/cli/
git commit -m "build: configure CLI build"
```

---

## Task 26: Update Root Package.json

**Files:**
- Modify: `package.json`

**Step 1: Add CLI workspace**

Add to root package.json:

```json
{
  "workspaces": [
    "src/cli"
  ]
}
```

**Step 2: Install workspaces**

```bash
npm install
```

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add CLI workspace to root package"
```

---

## Task 27: Create CLI README

**Files:**
- Create: `src/cli/README.md`

**Step 1: Create CLI documentation**

Create `src/cli/README.md`:

```markdown
# Obsidian Plugin CLI

CLI tool for pushing and pulling Obsidian plugins to/from GitHub Container Registry (GHCR).

## Installation

```bash
npm install -g @obsidian-ghcr/cli
```

## Usage

### Push Plugin

Push a plugin to GHCR:

```bash
obsidian-plugin push <directory> <repository>
```

Example:

```bash
export GITHUB_TOKEN=ghp_xxx
obsidian-plugin push ./dist ghcr.io/user/my-plugin
```

The plugin version from `manifest.json` will be used as the tag.

### Pull Plugin

Pull a plugin from GHCR:

```bash
obsidian-plugin pull <repository> --output <directory>
```

Example:

```bash
export GITHUB_TOKEN=ghp_xxx
obsidian-plugin pull ghcr.io/user/my-plugin:1.0.0 --output ./plugin
```

## Authentication

The CLI requires a GitHub Personal Access Token with `write:packages` scope for pushing and `read:packages` for pulling.

Authentication is resolved in this order:
1. `--token` CLI flag
2. `GITHUB_TOKEN` environment variable
3. `GH_TOKEN` environment variable

## Options

### Push Options

- `--token <token>`: GitHub Personal Access Token
- `--json`: Output JSON result to stdout

### Pull Options

- `--output <directory>`: Output directory (required)
- `--token <token>`: GitHub Personal Access Token
- `--json`: Output JSON result to stdout

## File Structure

The CLI expects plugins to have:
- `manifest.json` (required) - Must contain `id` and `version` fields
- `main.js` (required)
- `styles.css` (optional)

## Manifest Format

The CLI creates ORAS-compatible OCI artifacts with:
- Custom artifact type: `application/vnd.obsidian.plugin.v1+json`
- Each file as a separate layer
- Filenames stored in `org.opencontainers.image.title` annotations
- Minimal config blob (empty JSON)

## Examples

### Push from CI/CD

```yaml
- name: Push to GHCR
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    npx @obsidian-ghcr/cli push ./dist ghcr.io/${{ github.repository }}
```

### Pull for Testing

```bash
obsidian-plugin pull ghcr.io/user/plugin:latest --output ./test-plugin
cd test-plugin
ls -la
```

## License

MPL-2.0
```

**Step 2: Commit**

```bash
git add src/cli/README.md
git commit -m "docs: add CLI README"
```

---

## Task 28: Final Build and Verification

**Files:**
- All

**Step 1: Build everything**

```bash
npm run build
cd src/cli && npm run build && cd ../..
```

**Step 2: Run linter**

```bash
npm run lint
```

**Step 3: Fix any linting issues**

If linting fails, fix issues and commit:

```bash
git add .
git commit -m "fix: address linting issues"
```

**Step 4: Verify no uncommitted changes**

```bash
git status
```

Expected: Working tree clean

---

## Completion

**Implementation complete!** The GHCR push/pull CLI is ready.

**What was built:**
- Refactored `OciRegistryClient` to use fetch adapter pattern
- Added `pushBlob()` and `pushManifest()` methods
- Created CLI with push and pull commands
- ORAS-compatible manifest structure
- GitHub authentication support

**Next steps:**
1. Test push command with real GHCR repository
2. Test pull command to verify round-trip
3. Consider adding integration tests
4. Publish CLI package to npm
