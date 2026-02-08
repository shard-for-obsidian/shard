import type { FetchAdapter } from "../client/FetchAdapter.js";
import type {
  MarketplacePlugin,
  MarketplaceIndex,
} from "../schemas/marketplace.js";

export const DEFAULT_MARKETPLACE_URL =
  "https://shard-for-obsidian.github.io/shard/plugins.json";

export interface MarketplaceClientOptions {
  marketplaceUrl?: string;
  adapter: FetchAdapter;
  cache?: {
    enabled: boolean;
    ttl: number;
  };
}

interface CacheEntry {
  plugins: MarketplacePlugin[];
  fetchedAt: number;
}

/**
 * Client for fetching marketplace data from the registry.
 * Supports optional caching with configurable TTL.
 */
export class MarketplaceClient {
  private marketplaceUrl: string;
  private adapter: FetchAdapter;
  private cache?: Map<string, CacheEntry>;
  private cacheTTL?: number;

  constructor(options: MarketplaceClientOptions) {
    this.marketplaceUrl = options.marketplaceUrl || DEFAULT_MARKETPLACE_URL;
    this.adapter = options.adapter;

    if (options.cache?.enabled) {
      this.cache = new Map();
      this.cacheTTL = options.cache.ttl;
    }
  }

  /**
   * Fetch all plugins from the marketplace.
   * Uses cached data if available and not expired.
   */
  async fetchPlugins(): Promise<MarketplacePlugin[]> {
    // Check cache if enabled
    if (this.cache && this.cacheTTL) {
      const cached = this.cache.get(this.marketplaceUrl);
      if (cached) {
        const age = Date.now() - cached.fetchedAt;
        if (age < this.cacheTTL) {
          return cached.plugins;
        }
      }
    }

    // Fetch fresh data
    try {
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

      // Update cache if enabled
      if (this.cache) {
        this.cache.set(this.marketplaceUrl, {
          plugins: data.plugins,
          fetchedAt: Date.now(),
        });
      }

      return data.plugins;
    } catch (error) {
      // If fetch fails but we have stale cache, use it
      if (this.cache) {
        const cached = this.cache.get(this.marketplaceUrl);
        if (cached) {
          console.warn(
            "[MarketplaceClient] Using stale cache due to fetch error:",
            error,
          );
          return cached.plugins;
        }
      }

      // Otherwise, rethrow the error
      throw error;
    }
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

  /**
   * Clear the cache and force a fresh fetch on next call.
   */
  clearCache(): void {
    this.cache?.clear();
  }

  /**
   * Update the marketplace URL.
   */
  setMarketplaceUrl(url: string): void {
    this.marketplaceUrl = url;
    this.clearCache();
  }

  /**
   * Update the cache TTL.
   */
  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
  }
}
