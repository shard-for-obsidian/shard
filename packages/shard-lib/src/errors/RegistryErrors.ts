import type { DockerResponse, RegistryError } from "../types/AuthTypes.js";

/** Base class for custom error classes. */
export class ApiError extends Error {
  constructor(message: string, init?: { cause?: unknown }) {
    super(message);
    this.name = new.target.name;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class HttpError extends ApiError {
  override name = "HttpError";
  constructor(
    public resp: DockerResponse,
    public errors: RegistryError[],
    message: string,
  ) {
    super(message);
  }
}
export class BadDigestError extends ApiError {
  override readonly name = "BadDigestError";
}
export class InvalidContentError extends ApiError {
  override readonly name = "InvalidContentError";
}

export class InternalError extends ApiError {
  override readonly name = "InternalError";
}

export class ManifestVerificationError extends ApiError {
  override readonly name = "ManifestVerificationError";
}

export class InvalidManifestError extends ApiError {
  override readonly name = "InvalidManifestError";
}

export class DownloadError extends ApiError {
  override readonly name = "DownloadError";
}

export class UploadError extends ApiError {
  override readonly name = "UploadError";
}

export class BlobReadError extends ApiError {
  override readonly name = "BlobReadError";
}

export class TooManyRedirectsError extends ApiError {
  override readonly name = "TooManyRedirectsError";
}
