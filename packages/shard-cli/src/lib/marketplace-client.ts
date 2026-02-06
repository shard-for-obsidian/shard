import type { FetchAdapter } from "@shard-for-obsidian/lib";

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
  introduction?: string; // Markdown content from file body
  versions?: PluginVersion[]; // All available versions from OCI
}

export interface MarketplaceIndex {
  plugins: MarketplacePlugin[];
  generatedAt: string; // ISO 8601 timestamp
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
