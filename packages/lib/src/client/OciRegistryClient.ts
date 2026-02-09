import { urlFromIndex } from "../parsing/IndexParser.js";
import { parseRepo } from "../parsing/RepoParser.js";
import { splitIntoTwo } from "../utils/ValidationUtils.js";
import { encodeHex, digestFromManifestStr } from "../utils/DigestUtils.js";
import {
  MEDIATYPE_MANIFEST_V2,
  MEDIATYPE_MANIFEST_LIST_V2,
  MEDIATYPE_OCI_MANIFEST_V1,
  MEDIATYPE_OCI_MANIFEST_INDEX_V1,
  MEDIATYPE_OBSIDIAN_PLUGIN_CONFIG_V1,
} from "../types/ManifestTypes.js";
import { REALM, SERVICE } from "../ghcr/GhcrConstants.js";
import type {
  Manifest,
  ManifestOCI,
  ManifestOCIDescriptor,
  ObsidianManifest,
} from "../types/ManifestTypes.js";
import type { RegistryRepo, TagList } from "../types/RegistryTypes.js";
import type { AuthInfo } from "../types/AuthTypes.js";
import type { RegistryClientOptions } from "./RegistryClientOptions.js";
import * as e from "../errors/RegistryErrors.js";
import { parseLinkHeader } from "../parsing/LinkHeaderParser.js";

const DEFAULT_USERAGENT: string = `open-obsidian-plugin-spec/0.1.0`;

// Use globalThis.crypto (available in browsers/Electron/Node 18+)
const getCrypto = (): Crypto => {
  if (!globalThis.crypto) {
    throw new Error(
      "crypto API not available. This library requires Node.js 18+ or a modern browser environment."
    );
  }
  return globalThis.crypto;
};

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
 * Some registry errors will use a custom error format, so detect those
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
          const hashBuffer = await getCrypto().subtle.digest("SHA-256", buffer);
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

  /**
   * Create a new GHCR client for a particular repository.
   *
   * @param opts.insecure {Boolean} Optional. Default false. Set to true
   *      to *not* fail on an invalid or this-signed server certificate.
   * @param opts.adapter {FetchAdapter} Required. HTTP adapter for making requests.
   * ... TODO: lots more to document
   *
   */
  constructor(opts: RegistryClientOptions) {
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
    this._loggedInScope = null; // Keeps track of the login type.
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
    this._userAgent = opts.userAgent || DEFAULT_USERAGENT;
    this._adapter = opts.adapter;
  }

  /**
   * Login V2
   *
   * Typically one does not need to call this function directly because most
   * methods of a `GHCRClient` will automatically login as necessary.
   *
   * @param opts {Object}
   *      - opts.scope {String} Optional. A scope string passed in for
   *        bearer/token auth. If this is just a login request where the token
   *        won't be used, then the empty string (the default) is sufficient.
   *        // JSSTYLED
   *        See <https://github.com/docker/distribution/blob/master/docs/spec/auth/token.md#requesting-a-token>
   * @return an object with authentication info
   */
  async performLogin(opts: { scope?: string }): Promise<AuthInfo> {
    return {
      type: "Bearer",
      token: await this._getToken({
        realm: REALM,
        service: SERVICE,
        scopes: opts.scope ? [opts.scope] : [],
      }),
    };
  }

  /**
   * Get an auth token.
   *
   * See: docker/docker.git:registry/token.go
   */
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
      // TODO: Verify the logic above
      throw new Error(
        "unsupported scheme for " +
          `WWW-Authenticate realm "${opts.realm}": "${match[1]}"`,
      );
    }

    // - GET $realm
    //      ?service=$service
    //      (&scope=$scope)*
    //      (&account=$username)
    //   Authorization: Basic ...
    const headers: Record<string, string> = {};
    const query = new URLSearchParams();
    if (opts.service) {
      query.set("service", opts.service);
    }
    if (opts.scopes && opts.scopes.length) {
      for (const scope of opts.scopes) {
        query.append("scope", scope); // intentionally singular 'scope'
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
    // log.trace({tokenUrl: tokenUrl}, '_getToken: url');

    headers["user-agent"] = this._userAgent;

    const resp = await this._adapter.fetch(tokenUrl, {
      method: "GET",
      headers: headers,
    });

    if (resp.status === 401) {
      // Convert *all* 401 errors to use a generic error constructor
      // with a simple error message.
      const body = await resp.json();
      const errMsg = _getRegistryErrorMessage(body);
      throw new Error(`Registry auth failed: ${errMsg as string}`);
    }

    if (resp.status !== 200) {
      throw new Error(`Unexpected HTTP ${resp.status} from ${tokenUrl}`);
    }

    const body = (await resp.json()) as { token?: string };
    if (typeof body?.token !== "string") {
      console.error("TODO: auth resp:", body);
      throw new Error(
        "authorization " + "server did not include a token in the response",
      );
    }
    return body.token;
  }

  /**
   * Get a registry session (i.e. login to the registry).
   *
   * Typically one does not need to call this method directly because most
   * methods of a client will automatically login as necessary.
   *
   * @param opts {Object} Optional.
   *      - opts.scope {String} Optional. Scope to use in the auth Bearer token.
   *
   * Side-effects:
   * - On success, all of `this._loggedIn*`, `this._authInfo`, and
   *   `this._headers.authorization` are set.
   */
  async login(
    opts: {
      scope?: string;
    } = {},
  ): Promise<void> {
    const scope =
      opts.scope ||
      _makeAuthScope("repository", this.repo.remoteName, this.scopes);

    if (this._loggedIn && this._loggedInScope === scope) {
      return;
    }

    const authInfo = await this.performLogin({
      scope: scope,
    });
    this._loggedIn = true;
    this._loggedInScope = scope;
    this._authInfo = authInfo;
    _setAuthHeaderFromAuthInfo(this._headers, authInfo);
    // this.log.trace({err: err, loggedIn: this._loggedIn}, 'login: done');
  }

  async listTags(
    props: { pageSize?: number; startingAfter?: string } = {},
  ): Promise<TagList> {
    const searchParams = new URLSearchParams();
    if (props.pageSize != null) searchParams.set("n", `${props.pageSize}`);
    if (props.startingAfter != null)
      searchParams.set("last", props.startingAfter);

    await this.login();

    const url = new URL(
      `/v2/${encodeURI(this.repo.remoteName)}/tags/list`,
      this._url,
    );
    url.search = searchParams.toString();

    const headers = { ...this._headers, "user-agent": this._userAgent };
    const resp = await this._adapter.fetch(url.toString(), {
      method: "GET",
      headers,
    });

    if (!resp.ok) {
      throw new Error(`Unexpected HTTP ${resp.status} from ${url.toString()}`);
    }

    return (await resp.json()) as TagList;
  }

  async listAllTags(props: { pageSize?: number } = {}): Promise<TagList> {
    const pages: TagList[] = [];
    for await (const page of this.listTagsPaginated(props)) {
      pages.push(page);
    }
    const firstPage = pages.shift()!;
    for (const nextPage of pages) {
      firstPage.tags = [...firstPage.tags, ...nextPage.tags];
    }
    return firstPage;
  }

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
      const url = new URL(path, this._url);
      const headers = { ...this._headers, "user-agent": this._userAgent };

      const resp = await this._adapter.fetch(url.toString(), {
        method: "GET",
        headers,
      });

      if (!resp.ok) {
        throw new Error(
          `Unexpected HTTP ${resp.status} from ${url.toString()}`,
        );
      }

      const linkHeader = resp.headers.get("link");
      const links = parseLinkHeader(linkHeader ?? null);
      const nextLink = links.find((x) => x.rel == "next");
      // If there's no next link then we use a null to end the loop.
      path = nextLink?.url ?? null;
      yield (await resp.json()) as TagList;
    }
  }

  /*
   * Get an image manifest. `ref` is either a tag or a digest.
   * <https://docs.docker.com/registry/spec/api/#pulling-an-image-manifest>
   *
   * Note that docker-content-digest header can be undefined, so if you
   * need a manifest digest, use the `digestFromManifestStr` function.
   */
  async getManifest(opts: {
    ref: string;
    acceptManifestLists?: boolean;
    acceptOCIManifests?: boolean;
    followRedirects?: boolean;
  }): Promise<{
    resp: Response;
    manifest: Manifest;
  }> {
    const acceptOCIManifests =
      opts.acceptOCIManifests ?? this.acceptOCIManifests;
    const acceptManifestLists =
      opts.acceptManifestLists ?? this.acceptManifestLists;

    await this.login();
    const headers: Record<string, string> = {
      ...this._headers,
      "user-agent": this._userAgent,
    };
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

    const url = new URL(
      `/v2/${encodeURI(this.repo.remoteName ?? "")}/manifests/${encodeURI(opts.ref)}`,
      this._url,
    );

    const resp = await this._adapter.fetch(url.toString(), {
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
      throw new Error(`Unexpected HTTP ${resp.status} from ${url.toString()}`);
    }

    const manifest = (await resp.json()) as Manifest;
    if ((manifest.schemaVersion as number) === 1) {
      throw new Error(
        `schemaVersion 1 is not supported by /x/docker_registry_client.`,
      );
    }

    return { resp, manifest };
  }

  /**
   * Makes a http request to the given url, following any redirects, then fires
   * the callback(err, req, responses) with the result.
   *
   * Note that 'responses' is an *array* of Response objects, with
   * the last response being at the end of the array. When there is more than
   * one response, it means a redirect has been followed.
   */
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
    const req = {
      path: opts.path,
      headers: opts.headers,
    };
    const ress = new Array<Response>();

    while (numRedirs < maxRedirects) {
      numRedirs += 1;

      const url = new URL(req.path, this._url);
      const headers = {
        ...req.headers,
        "user-agent": this._userAgent,
      };

      const resp = await this._adapter.fetch(url.toString(), {
        method: opts.method,
        headers: headers,
        redirect: "manual",
      });

      ress.push(resp);

      if (!followRedirects) return ress;
      if (!(resp.status === 302 || resp.status === 307)) return ress;

      const location = resp.headers.get("location");
      if (!location) return ress;

      const loc = new URL(location, url);
      // this.log.trace({numRedirs: numRedirs, loc: loc}, 'got redir response');
      req.path = loc.toString();
      req.headers = {};
    }

    throw new e.TooManyRedirectsError(
      `maximum number of redirects (${maxRedirects}) hit`,
    );
  }

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

  /*
   * Get an image file blob -- just the headers. See `getBlob`.
   *
   * <https://docs.docker.com/registry/spec/api/#get-blob>
   * <https://docs.docker.com/registry/spec/api/#pulling-an-image-manifest>
   *
   * This endpoint can return 3xx redirects. The first response often redirects
   * to an object CDN, which would then return the raw data.
   *
   * Interesting headers:
   * - `ress[0].headers.get('docker-content-digest')` is the digest of the
   *   content to be downloaded
   * - `ress[-1].headers.get('content-length')` is the number of bytes to download
   * - `ress[-1].headers[*]` as appropriate for HTTP caching, range gets, etc.
   */
  async headBlob(opts: { digest: string }): Promise<Response[]> {
    const resp = await this._headOrGetBlob("HEAD", opts.digest);
    // No need to cancel body - fetch returns complete responses
    return resp;
  }

  /**
   * Download a blob and return its ArrayBuffer.
   * <https://docs.docker.com/registry/spec/api/#get-blob>
   *
   * @return
   *      The `buffer` is the blob's content as an ArrayBuffer.
   *      `ress` (plural of 'res') is an array of responses
   *      after following redirects. The full set of responses are returned mainly because
   *      headers on both the first, e.g. 'Docker-Content-Digest', and last,
   *      e.g. 'Content-Length', might be interesting.
   */
  async downloadBlob(opts: { digest: string }): Promise<{
    ress: Response[];
    buffer: ArrayBuffer;
  }> {
    const ress = await this._headOrGetBlob("GET", opts.digest);
    const lastResp = ress[ress.length - 1];
    if (!lastResp) {
      throw new e.BlobReadError(
        `No response available for blob ${opts.digest}`,
      );
    }

    const buffer = await lastResp.arrayBuffer();

    const dcdHeader = ress[0]?.headers.get("docker-content-digest");
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

    return { ress, buffer };
  }

  /**
   * Upload a blob using POST then PUT workflow.
   * <https://github.com/opencontainers/distribution-spec/blob/main/spec.md#post-then-put>
   *
   * @param opts.data The blob data as ArrayBuffer or Uint8Array
   * @param opts.annotations Optional annotations for the blob
   * @returns Object with digest, size, and annotations (with auto-added ORAS title if applicable)
   */
  async pushBlob(opts: {
    data: ArrayBuffer | Uint8Array;
    annotations?: Record<string, string>;
  }): Promise<{ digest: string; size: number; annotations?: Record<string, string> }> {
    await this.login();

    // Convert to ArrayBuffer if needed
    const buffer: ArrayBuffer =
      opts.data instanceof Uint8Array
        ? new Uint8Array(opts.data).buffer
        : opts.data;

    // Calculate digest
    const hashBuffer = await getCrypto().subtle.digest("SHA-256", buffer);
    const digest = `sha256:${encodeHex(hashBuffer)}`;

    // Step 1: POST to initiate upload
    const postUrl = new URL(
      `/v2/${encodeURI(this.repo.remoteName)}/blobs/uploads/`,
      this._url,
    );

    const postHeaders = {
      ...this._headers,
      "user-agent": this._userAgent,
      "content-length": "0",
    };

    const postResp = await this._adapter.fetch(postUrl.toString(), {
      method: "POST",
      headers: postHeaders,
    });

    if (postResp.status !== 202) {
      throw new Error(
        `Failed to initiate blob upload: HTTP ${postResp.status}`,
      );
    }

    // Get upload URL from Location header
    const uploadLocation = postResp.headers.get("location");
    if (!uploadLocation) {
      throw new Error("No Location header in POST response");
    }

    // Step 2: PUT to upload blob
    const uploadUrl = new URL(uploadLocation, this._url);
    uploadUrl.searchParams.set("digest", digest);

    const putHeaders = {
      ...this._headers,
      "user-agent": this._userAgent,
      "content-type": "application/octet-stream",
      "content-length": buffer.byteLength.toString(),
    };

    const putResp = await this._adapter.fetch(uploadUrl.toString(), {
      method: "PUT",
      headers: putHeaders,
      body: buffer,
    });

    if (putResp.status !== 201) {
      throw new Error(`Failed to upload blob: HTTP ${putResp.status}`);
    }

    // Verify digest from response
    const returnedDigest = putResp.headers.get("docker-content-digest");
    if (returnedDigest && returnedDigest !== digest) {
      throw new e.BadDigestError(
        `Digest mismatch: expected ${digest}, got ${returnedDigest}`,
      );
    }

    // Handle annotations - automatically add ORAS-compatible title from filename
    let annotations = opts.annotations ? { ...opts.annotations } : undefined;
    if (annotations && annotations['vnd.obsidianmd.layer.filename']) {
      annotations['org.opencontainers.image.title'] = annotations['vnd.obsidianmd.layer.filename'];
    }

    return { digest, size: buffer.byteLength, annotations };
  }

  /**
   * Upload an image manifest.
   * <https://github.com/opencontainers/distribution-spec/blob/main/spec.md#pushing-manifests>
   *
   * @param opts.ref The tag or digest to push to
   * @param opts.manifest The manifest object to upload
   * @param opts.mediaType Optional media type (defaults to OCI manifest type)
   * @returns Object with digest and size of the uploaded manifest
   */
  async pushManifest(opts: {
    ref: string;
    manifest: Manifest;
    mediaType?: string;
  }): Promise<{ digest: string; size: number }> {
    await this.login();

    const manifestStr = JSON.stringify(opts.manifest);
    const manifestBuffer = new TextEncoder().encode(manifestStr);

    // Calculate digest
    const digest = await digestFromManifestStr(manifestStr);

    const url = new URL(
      `/v2/${encodeURI(this.repo.remoteName)}/manifests/${encodeURI(opts.ref)}`,
      this._url,
    );

    const headers = {
      ...this._headers,
      "user-agent": this._userAgent,
      "content-type":
        opts.mediaType || "application/vnd.oci.image.manifest.v1+json",
      "content-length": manifestBuffer.byteLength.toString(),
    };

    const resp = await this._adapter.fetch(url.toString(), {
      method: "PUT",
      headers,
      body: manifestBuffer,
    });

    if (resp.status !== 201) {
      throw new Error(`Failed to push manifest: HTTP ${resp.status}`);
    }

    // Verify digest from response
    const returnedDigest = resp.headers.get("docker-content-digest");
    if (returnedDigest && returnedDigest !== digest) {
      throw new e.BadDigestError(
        `Digest mismatch: expected ${digest}, got ${returnedDigest}`,
      );
    }

    return { digest, size: manifestBuffer.byteLength };
  }

  /**
   * Push a manifest with multiple tags atomically.
   * Pushes the manifest once with the first tag, then tags the remaining tags
   * by pushing the same manifest content.
   *
   * @param opts.tags Array of tags to apply (must not be empty)
   * @param opts.manifest The manifest object to upload
   * @param opts.annotations Optional annotations to merge with manifest annotations
   * @returns Object with digest, tags array, and size
   */
  async pushManifestWithTags(opts: {
    tags: string[];
    manifest: ManifestOCI;
    annotations?: Record<string, string>;
  }): Promise<{ digest: string; tags: string[]; size: number }> {
    if (opts.tags.length === 0) {
      throw new Error('tags array cannot be empty');
    }

    // Merge annotations: manifest.annotations + opts.annotations
    const mergedManifest = {
      ...opts.manifest,
      annotations: {
        ...(opts.manifest.annotations || {}),
        ...(opts.annotations || {}),
      },
    };

    // Push manifest with first tag
    const result = await this.pushManifest({
      ref: opts.tags[0]!,
      manifest: mergedManifest,
      mediaType: opts.manifest.mediaType || MEDIATYPE_OCI_MANIFEST_V1,
    });

    // Tag remaining tags by pushing the same manifest
    for (let i = 1; i < opts.tags.length; i++) {
      await this.pushManifest({
        ref: opts.tags[i]!,
        manifest: mergedManifest,
        mediaType: opts.manifest.mediaType || MEDIATYPE_OCI_MANIFEST_V1,
      });
    }

    return {
      digest: result.digest,
      tags: opts.tags,
      size: result.size,
    };
  }

  /**
   * Push a plugin manifest as a config blob and create an OCI manifest.
   * This follows the OCI spec where the Obsidian manifest is stored as the config.
   *
   * @param opts.ref The tag or digest to push to
   * @param opts.pluginManifest The Obsidian plugin manifest
   * @param opts.layers The layer descriptors (main.js, styles.css, etc.)
   * @param opts.annotations Optional annotations for the OCI manifest
   * @returns Object with digest, configDigest, and the created manifest
   */
  async pushPluginManifest(opts: {
    ref: string;
    pluginManifest: ObsidianManifest;
    layers: ManifestOCIDescriptor[];
    annotations?: Record<string, string>;
  }): Promise<{
    digest: string;
    configDigest: string;
    manifest: ManifestOCI;
  }> {
    // Step 1: Push plugin manifest as config blob
    const manifestStr = JSON.stringify(opts.pluginManifest);
    const manifestBuffer = new TextEncoder().encode(manifestStr);

    const configResult = await this.pushBlob({
      data: manifestBuffer,
    });

    // Step 2: Build OCI manifest with plugin manifest as config
    const manifest: ManifestOCI = {
      schemaVersion: 2,
      mediaType: MEDIATYPE_OCI_MANIFEST_V1,
      artifactType: "application/vnd.obsidian.plugin.v1+json",
      config: {
        mediaType: MEDIATYPE_OBSIDIAN_PLUGIN_CONFIG_V1,
        digest: configResult.digest,
        size: configResult.size,
      },
      layers: opts.layers,
      annotations: opts.annotations,
    };

    // Step 3: Push the OCI manifest
    const manifestResult = await this.pushManifest({
      ref: opts.ref,
      manifest,
      mediaType: MEDIATYPE_OCI_MANIFEST_V1,
    });

    return {
      digest: manifestResult.digest,
      configDigest: configResult.digest,
      manifest,
    };
  }

  /**
   * Pull a plugin manifest by extracting it from the OCI config blob.
   * This follows the OCI spec where the Obsidian manifest is stored as the config.
   *
   * @param opts.ref The tag or digest to pull
   * @returns Object with the plugin manifest, OCI manifest, and digests
   */
  async pullPluginManifest(opts: { ref: string }): Promise<{
    pluginManifest: ObsidianManifest;
    manifest: ManifestOCI;
    manifestDigest: string;
    configDigest: string;
  }> {
    // Step 1: Pull the OCI manifest
    const manifestResult = await this.getManifest({ ref: opts.ref });
    const manifest = manifestResult.manifest;

    // Step 2: Validate manifest has config
    if (!("config" in manifest) || !manifest.config) {
      throw new Error("Manifest does not contain a config");
    }

    const ociManifest = manifest as ManifestOCI;
    const manifestDigest =
      manifestResult.resp.headers.get("docker-content-digest") || "";

    // Step 3: Pull the config blob
    const { buffer: configBuffer } = await this.downloadBlob({
      digest: ociManifest.config.digest,
    });

    // Step 4: Parse the plugin manifest from config
    const configText = new TextDecoder().decode(configBuffer);
    const pluginManifest = JSON.parse(configText) as ObsidianManifest;

    return {
      pluginManifest,
      manifest: ociManifest,
      manifestDigest,
      configDigest: ociManifest.config.digest,
    };
  }
}
