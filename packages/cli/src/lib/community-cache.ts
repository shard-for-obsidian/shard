import type { FetchAdapter } from "@shard-for-obsidian/lib";
import {
  COMMUNITY_PLUGINS_URL,
  type CommunityPlugin,
} from "./community-plugins.js";

/**
 * Cache for Obsidian community plugins.
 * Fetches and caches the list of community plugins from the official repository.
 */
export class CommunityPluginsCache {
  private adapter: FetchAdapter;
  private plugins: CommunityPlugin[] | null = null;

  constructor(adapter: FetchAdapter) {
    this.adapter = adapter;
  }

  /**
   * Fetch the list of community plugins.
   * Results are cached for subsequent calls.
   *
   * @returns Array of community plugins
   * @throws Error if fetch fails
   */
  async fetch(): Promise<CommunityPlugin[]> {
    // Return cached data if available
    if (this.plugins !== null) {
      return this.plugins;
    }

    // Fetch from URL
    const response = await this.adapter.fetch(COMMUNITY_PLUGINS_URL);

    if (!response.ok) {
      throw new Error(`Failed to fetch community plugins: ${response.status}`);
    }

    const plugins = (await response.json()) as CommunityPlugin[];
    this.plugins = plugins;
    return plugins;
  }

  /**
   * Find a plugin by ID.
   * Fetches the plugin list if not already cached.
   *
   * @param id - Plugin ID to search for
   * @returns Plugin if found, undefined otherwise
   */
  async findPlugin(id: string): Promise<CommunityPlugin | undefined> {
    const plugins = await this.fetch();
    return plugins.find((plugin) => plugin.id === id);
  }
}
