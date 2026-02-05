/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * Registry types for Docker/OCI registry operations
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

export interface DockerResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;

  dockerBody(): Promise<ReturnType<Uint8Array["slice"]>>;
  dockerJson(): Promise<unknown>;

  dockerErrors(): Promise<Array<RegistryError>>;
  dockerThrowable(baseMsg: string): Promise<Error>;
}
