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
