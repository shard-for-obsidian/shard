/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {
  parseRepo,
  urlFromIndex,
  DEFAULT_USERAGENT,
  splitIntoTwo,
  MEDIATYPE_MANIFEST_V2,
  MEDIATYPE_MANIFEST_LIST_V2,
  MEDIATYPE_OCI_MANIFEST_V1,
  MEDIATYPE_OCI_MANIFEST_INDEX_V1,
} from "./common.mjs";

import { REALM, SERVICE } from "./ghcr.mjs";

import type {
  Manifest,
  RegistryRepo,
  RegistryClientOpts,
  AuthInfo,
  TagList,
  ByteArray,
} from "./types.mjs";

import {
  DockerJsonClient,
  type DockerResponse,
} from "./docker-json-client.mjs";

import * as e from "./errors.mjs";

import { parseLinkHeader } from "./util/link-header.mjs";

function encodeHex(data: ArrayBuffer) {
  return [...new Uint8Array(data)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

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
function _getRegistryErrorMessage(err: any) {
  if (err.body && Array.isArray(err.body.errors) && err.body.errors[0]) {
    return err.body.errors[0].message;
  } else if (err.body && err.body.details) {
    return err.body.details;
  } else if (Array.isArray(err.errors) && err.errors[0].message) {
    return err.errors[0].message;
  } else if (err.message) {
    return err.message;
  } else if (err.details) {
    return err.details;
  }
  return err.toString();
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
    manifest = JSON.parse(manifestStr);
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

export class GHCRClient {
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
  private readonly _api: DockerJsonClient;

  /**
   * Create a new GHCR client for a particular repository.
   *
   * @param opts.insecure {Boolean} Optional. Default false. Set to true
   *      to *not* fail on an invalid or this-signed server certificate.
   * @param opts.requestUrl {Function} Required. Obsidian's requestUrl function.
   * ... TODO: lots more to document
   *
   */
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
    this._commonHttpClientOpts = {
      userAgent: opts.userAgent || DEFAULT_USERAGENT,
    };

    this._api = new DockerJsonClient({
      url: this._url,
      ...this._commonHttpClientOpts,
      requestUrl: opts.requestUrl,
    });
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

    const resp = await this._api.request({
      method: "GET",
      path: tokenUrl,
      headers: headers,
      expectStatus: [200, 401],
    });
    if (resp.status === 401) {
      // Convert *all* 401 errors to use a generic error constructor
      // with a simple error message.
      const errMsg = _getRegistryErrorMessage(await resp.dockerJson());
      throw await resp.dockerThrowable("Registry auth failed: " + errMsg);
    }
    const body = await resp.dockerJson();
    if (typeof body?.token !== "string") {
      console.error("TODO: auth resp:", body);
      throw await resp.dockerThrowable(
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
    const res = await this._api.request({
      method: "GET",
      path: `/v2/${encodeURI(this.repo.remoteName)}/tags/list`,
      headers: this._headers,
    });
    return await res.dockerJson<TagList>();
  }

  async listAllTags(props: { pageSize?: number } = {}): Promise<TagList> {
    const pages = await Array.fromAsync(this.listTagsPaginated(props));
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
      const res = await this._api.request({
        method: "GET",
        path,
        headers: this._headers,
      });
      const links = parseLinkHeader(res.headers["link"] ?? null);
      const nextLink = links.find((x) => x.rel == "next");
      // If there's no next link then we use a null to end the loop.
      path = nextLink?.url ?? null;
      yield await res.dockerJson<TagList>();
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
    resp: DockerResponse;
    manifest: Manifest;
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

    const resp = await this._api.request({
      method: "GET",
      path: `/v2/${encodeURI(this.repo.remoteName ?? "")}/manifests/${encodeURI(opts.ref)}`,
      headers: headers,
      redirect: opts.followRedirects == false ? "manual" : "follow",
      expectStatus: [200, 401],
    });
    if (resp.status === 401) {
      const errMsg = _getRegistryErrorMessage(await resp.dockerJson());
      throw await resp.dockerThrowable(
        `Manifest ${JSON.stringify(opts.ref)} Not Found: ${errMsg}`,
      );
    }

    const manifest = await resp.dockerJson<Manifest>();
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
   * Note that 'responses' is an *array* of restify http response objects, with
   * the last response being at the end of the array. When there is more than
   * one response, it means a redirect has been followed.
   */
  async _makeHttpRequest(opts: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    followRedirects?: boolean;
    maxRedirects?: number;
  }): Promise<DockerResponse[]> {
    const followRedirects = opts.followRedirects ?? true;
    const maxRedirects = opts.maxRedirects ?? 3;
    let numRedirs = 0;
    const req = {
      path: opts.path,
      headers: opts.headers,
    };
    const ress = new Array<DockerResponse>();

    while (numRedirs < maxRedirects) {
      numRedirs += 1;

      const client = this._api;
      client.accept = ""; // TODO: do better
      const resp = await client.request({
        method: opts.method,
        path: req.path,
        headers: req.headers,
        redirect: "manual",
        expectStatus: [200, 302, 307],
      });
      ress.push(resp);

      if (!followRedirects) return ress;
      if (!(resp.status === 302 || resp.status === 307)) return ress;

      const location = resp.headers["location"];
      if (!location) return ress;

      const loc = new URL(location, new URL(req.path, this._url));
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
  ): Promise<DockerResponse[]> {
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
   * - `ress[0].headers['docker-content-digest']` is the digest of the
   *   content to be downloaded
   * - `ress[-1].headers['content-length']` is the number of bytes to download
   * - `ress[-1].headers[*]` as appropriate for HTTP caching, range gets, etc.
   */
  async headBlob(opts: { digest: string }): Promise<DockerResponse[]> {
    const resp = await this._headOrGetBlob("HEAD", opts.digest);
    // No need to cancel body - requestUrl returns complete responses
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
    ress: DockerResponse[];
    buffer: ArrayBuffer;
  }> {
    const ress = await this._headOrGetBlob("GET", opts.digest);
    const lastResp = ress[ress.length - 1];
    if (!lastResp) {
      throw new e.BlobReadError(
        `No response available for blob ${opts.digest}`,
      );
    }

    const buffer = (await lastResp.dockerBody()).buffer;

    const dcdHeader = ress[0]?.headers["docker-content-digest"];
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

  /*
   * Upload an image manifest. `ref` is either a tag or a digest.
   * <https://github.com/opencontainers/distribution-spec/blob/main/spec.md#pushing-manifests>
   */

  /*
   * Upload a blob. The request stream will be used to complete the upload in a single request.
   * <https://github.com/opencontainers/distribution-spec/blob/main/spec.md#post-then-put>
   */
}
