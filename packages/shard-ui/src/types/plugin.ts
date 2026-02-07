/**
 * Represents a plugin in the Shard marketplace
 */
export interface MarketplacePlugin {
  /** Unique identifier for the plugin */
  id: string;

  /** Display name of the plugin */
  name: string;

  /** Brief description of what the plugin does */
  description: string;

  /** Author of the plugin */
  author: string;

  /** Plugin repository URL */
  repo: string;

  /** Latest version number */
  version?: string;

  /** Download count (if available) */
  downloads?: number;

  /** Last update timestamp */
  updated?: string;

  /** Plugin tags/categories */
  tags?: string[];

  /** Whether the plugin is featured */
  featured?: boolean;

  /** Plugin icon URL or emoji */
  icon?: string;
}
