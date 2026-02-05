import { requestUrl } from "obsidian";
import type {
  MarketplacePlugin,
  MarketplaceIndex,
  CachedMarketplaceData,
} from "./types";

export class MarketplaceClient {
  private cache: CachedMarketplaceData | null = null;

  constructor(
    private marketplaceUrl: string,
    private cacheTTL: number,
  ) {}

  /**
   * Fetch plugins from the marketplace.
   * Uses cached data if available and not expired.
   */
  async fetchPlugins(): Promise<MarketplacePlugin[]> {
    // Check if we have valid cached data
    if (this.cache) {
      const age = Date.now() - this.cache.fetchedAt;
      if (age < this.cacheTTL) {
        return this.cache.plugins;
      }
    }

    // Fetch fresh data from marketplace
    try {
      const response = await requestUrl({
        url: this.marketplaceUrl,
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (response.status !== 200) {
        throw new Error(
          `Failed to fetch marketplace data: ${response.status}`,
        );
      }

      const data = response.json as MarketplaceIndex;

      if (!data.plugins || !Array.isArray(data.plugins)) {
        throw new Error("Invalid marketplace data format");
      }

      // Update cache
      this.cache = {
        plugins: data.plugins,
        fetchedAt: Date.now(),
      };

      return data.plugins;
    } catch (error) {
      // If fetch fails but we have stale cache, use it
      if (this.cache) {
        console.warn(
          "[MarketplaceClient] Using stale cache due to fetch error:",
          error,
        );
        return this.cache.plugins;
      }

      // Otherwise, rethrow the error
      throw error;
    }
  }

  /**
   * Clear the cache and force a fresh fetch on next call.
   */
  clearCache(): void {
    this.cache = null;
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
