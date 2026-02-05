/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Media type constants for Docker and OCI manifests
export const MEDIATYPE_MANIFEST_V2 =
  "application/vnd.docker.distribution.manifest.v2+json";
export const MEDIATYPE_MANIFEST_LIST_V2 =
  "application/vnd.docker.distribution.manifest.list.v2+json";

export const MEDIATYPE_OCI_MANIFEST_V1 =
  "application/vnd.oci.image.manifest.v1+json";
export const MEDIATYPE_OCI_MANIFEST_INDEX_V1 =
  "application/vnd.oci.image.index.v1+json";

export const DEFAULT_USERAGENT: string = `open-obsidian-plugin-spec/0.1.0`;

// Manifest type discriminated union
export type Manifest =
  | ManifestV2
  | ManifestV2List
  | ManifestOCI
  | ManifestOCIIndex;

// Docker V2 Manifest
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

// Docker V2 Manifest List (multi-platform)
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
      "os.version"?: string; // windows version
      "os.features"?: string[];
      variant?: string; // cpu variant
      features?: string[]; // cpu features
    };
  }>;
}

// OCI Image Manifest
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

// OCI Image Index (multi-platform)
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
      "os.version"?: string; // windows version
      "os.features"?: string[];
      variant?: string; // cpu variant
      features?: string[]; // cpu features
    };
    /** Used for OCI Image Layouts */
    annotations?: Record<string, string>;
  }>;
  annotations?: Record<string, string>;
}
