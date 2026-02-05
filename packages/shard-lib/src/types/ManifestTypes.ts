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
