export interface PluginVersion {
  tag: string;
  publishedAt: string; // ISO 8601
  size: number; // bytes
  annotations: Record<string, string>;
}

export interface MarketplacePlugin {
  // Primary identifiers
  id: string;
  registryUrl: string; // ghcr.io/owner/repo (PRIMARY)

  // Metadata from manifest
  name: string;
  author: string;
  description: string;

  // Optional metadata
  license?: string;
  minObsidianVersion?: string;
  authorUrl?: string;

  // Derived/optional
  repository?: string; // GitHub URL derived from org.opencontainers.image.source
  tags?: string[]; // For categorization

  // New fields
  introduction: string; // Markdown content from file body
  versions: PluginVersion[]; // All available versions from OCI
}

export interface MarketplaceIndex {
  plugins: MarketplacePlugin[];
  generatedAt: string; // ISO 8601 timestamp
}

export interface CachedMarketplaceData {
  plugins: MarketplacePlugin[];
  fetchedAt: number;
}
