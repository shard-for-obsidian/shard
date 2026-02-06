export interface MarketplacePlugin {
  // Primary identifiers
  id: string;
  registryUrl: string; // ghcr.io/owner/repo (PRIMARY)

  // Metadata from manifest
  name: string;
  author: string;
  description: string;
  version: string; // Latest published version

  // Optional metadata
  license?: string;
  minObsidianVersion?: string;
  authorUrl?: string;

  // Derived/optional
  repository?: string; // GitHub URL derived from org.opencontainers.image.source
  tags?: string[]; // For categorization

  // Marketplace metadata
  updatedAt: string; // ISO 8601 timestamp
}

export interface MarketplaceIndex {
  plugins: MarketplacePlugin[];
}

export interface CachedMarketplaceData {
  plugins: MarketplacePlugin[];
  fetchedAt: number;
}
