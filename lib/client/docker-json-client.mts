/*
 * Copyright 2012 Mark Cavage, Inc.  All rights reserved.
 * Copyright (c) 2015, Joyent, Inc.
 */

import { HttpError } from "./errors.mjs";
import type {
  ByteArray,
  DockerResponse as DockerResponseInterface,
  RequestUrlParam,
  RequestUrlResponse,
} from "./types.mjs";

// --- API

interface HttpReqOpts {
  method: string;
  path: string;
  searchParams?: URLSearchParams;
  headers?: Record<string, string>;
  body?: BodyInit;
  retry?: boolean;
  connectTimeout?: number;
  expectStatus?: number[];
  redirect?: RequestRedirect;
}

export class DockerJsonClient {
  accept: string;
  name: string;
  contentType: string;
  url: string;
  userAgent: string;
  requestUrl: (request: RequestUrlParam | string) => Promise<RequestUrlResponse>;

  constructor(options: {
    name?: string;
    accept?: string;
    contentType?: string;
    url: string;
    userAgent: string;
    requestUrl: (request: RequestUrlParam | string) => Promise<RequestUrlResponse>;
  }) {
    this.accept = options.accept ?? "application/json";
    this.name = options.name ?? "DockerJsonClient";
    this.contentType = options.contentType ?? "application/json";
    this.url = options.url;
    this.userAgent = options.userAgent;
    this.requestUrl = options.requestUrl;
  }

  async request(opts: HttpReqOpts): Promise<DockerResponse> {
    const headers: Record<string, string> = opts.headers
      ? { ...opts.headers }
      : {};
    if (!headers["accept"] && this.accept) {
      headers["accept"] = this.accept;
    }
    headers["user-agent"] = this.userAgent;

    const url = new URL(opts.path, this.url);
    for (const param of opts.searchParams ?? []) {
      url.searchParams.append(param[0], param[1]);
    }

    const rawResp = await this.requestUrl({
      url: url.toString(),
      method: opts.method,
      headers: headers,
      body: opts.body as string | ArrayBuffer,
      throw: false, // Handle errors ourselves
    });

    const resp = new DockerResponse({
      headers: rawResp.headers,
      status: rawResp.status,
      arrayBuffer: rawResp.arrayBuffer,
    });

    const expectStatus = opts.expectStatus ?? [200];
    if (!expectStatus.includes(rawResp.status)) {
      throw await resp.dockerThrowable(
        `Unexpected HTTP ${rawResp.status} from ${opts.path}`,
      );
    }
    return resp;
  }
}

export class DockerResponse implements DockerResponseInterface {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  private _arrayBuffer: ArrayBuffer;

  // Cache the body once we decode it once.
  private decodedBody?: ByteArray;

  constructor(opts: {
    headers: Record<string, string>;
    status: number;
    arrayBuffer: ArrayBuffer;
  }) {
    this.headers = opts.headers;
    this.status = opts.status;
    this.statusText = ""; // requestUrl doesn't provide statusText
    this._arrayBuffer = opts.arrayBuffer;
  }

  async dockerBody(): Promise<ByteArray> {
    this.decodedBody ??= new Uint8Array(this._arrayBuffer);
    return this.decodedBody;
  }

  async dockerJson<Tjson = Record<string, unknown>>(): Promise<Tjson> {
    const body = this.decodedBody ?? (await this.dockerBody());
    const text = new TextDecoder().decode(body);

    // Parse the body as JSON, if we can.
    try {
      return JSON.parse(text);
    } catch (thrown) {
      const err = thrown as Error;
      // res.log.trace(jsonErr, 'Invalid JSON in response');
      throw new Error("Invalid JSON in response: " + err.message);
    }
  }

  async dockerErrors(): Promise<
    Array<{
      code?: string;
      message: string;
      detail?: string;
    }>
  > {
    const obj = await this.dockerJson().catch(() => null);

    // Upcast error to a RestError (if we can)
    // Be nice and handle errors like
    // { error: { code: '', message: '' } }
    // in addition to { code: '', message: '' }.
    const errObj = (
      obj?.error
        ? [obj.error]
        : ((obj?.errors as unknown[]) ?? (obj ? [obj] : []))
    ) as Array<{
      code?: string;
      message: string;
      detail?: string;
    }>;
    return errObj.flatMap((x) => (typeof x?.message === "string" ? [x] : []));
  }

  async dockerThrowable(baseMsg: string): Promise<HttpError> {
    // no point trying to parse HTML
    if (this.headers["content-type"]?.startsWith("text/html")) {
      return new HttpError(this, [], `${baseMsg} (w/ HTML body)`);
    }

    try {
      const errors = this.status >= 400 ? await this.dockerErrors() : [];
      if (errors.length === 0) {
        const text = new TextDecoder().decode(await this.dockerBody());
        if (text.length > 1) {
          errors.push({ message: text.slice(0, 512) });
        }
      }
      const errorTexts = errors.map(
        (x) =>
          "    " +
          [x.code, x.message, x.detail ? JSON.stringify(x.detail) : ""]
            .filter((x) => x)
            .join(": "),
      );

      return new HttpError(this, errors, [baseMsg, ...errorTexts].join("\n"));
    } catch (thrown) {
      const err = thrown as Error;
      return new HttpError(
        this,
        [],
        `${baseMsg} - and failed to parse error body: ${err.message}`,
      );
    }
  }
}
