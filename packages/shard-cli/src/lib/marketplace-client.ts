import type { FetchAdapter } from "@shard-for-obsidian/lib";

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

export const DEFAULT_MARKETPLACE_URL =
  "https://shard-for-obsidian.github.io/shard/plugins.json";

/**
 * Client for fetching marketplace data from the registry.
 */
export class MarketplaceClient {
  constructor(
    private adapter: FetchAdapter,
    private marketplaceUrl: string = DEFAULT_MARKETPLACE_URL,
  ) {}

  /**
   * Fetch all plugins from the marketplace.
   */
  async fetchPlugins(): Promise<MarketplacePlugin[]> {
    const response = await this.adapter.fetch(this.marketplaceUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch marketplace data: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as MarketplaceIndex;

    if (!data.plugins || !Array.isArray(data.plugins)) {
      throw new Error("Invalid marketplace data format");
    }

    return data.plugins;
  }

  /**
   * Find a plugin by ID.
   */
  async findPluginById(pluginId: string): Promise<MarketplacePlugin | null> {
    const plugins = await this.fetchPlugins();
    return plugins.find((p) => p.id === pluginId) || null;
  }

  /**
   * Search plugins by keyword (searches in name, description, author, tags).
   */
  async searchPlugins(keyword: string): Promise<MarketplacePlugin[]> {
    const plugins = await this.fetchPlugins();
    const lowerKeyword = keyword.toLowerCase();

    return plugins.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerKeyword) ||
        p.description.toLowerCase().includes(lowerKeyword) ||
        p.author.toLowerCase().includes(lowerKeyword) ||
        p.id.toLowerCase().includes(lowerKeyword) ||
        p.tags?.some((tag) => tag.toLowerCase().includes(lowerKeyword)),
    );
  }
}
