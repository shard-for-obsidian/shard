/**
 * URL to the Obsidian community plugins JSON file
 */
export const COMMUNITY_PLUGINS_URL =
  "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/refs/heads/master/community-plugins.json";

/**
 * Represents a community plugin entry from the Obsidian marketplace
 */
export interface CommunityPlugin {
  /** Plugin ID (used in folder name and as identifier) */
  id: string;
  /** Display name of the plugin */
  name: string;
  /** Author name */
  author: string;
  /** Plugin description */
  description: string;
  /** GitHub repository in format "owner/repo" */
  repo: string;
}
