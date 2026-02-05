export interface RepositoryConfig {
  repoUrl: string; // e.g., "owner/repo" or "owner/repo/subrepo" (normalized with ghcr.io prefix)
  showAllTags: boolean; // Per-repo semver filter toggle
}

export interface InstalledPluginInfo {
  tag: string; // "v1.2.3"
  digest: string; // "sha256:abc123..."
  installedAt: number; // Unix timestamp
  pluginId: string; // e.g., "io.ghcr.owner.repo.subrepo" (reverse domain notation)
}

export interface GHCRPluginSettings {
  githubToken: string; // Secret key ref
  repositories: RepositoryConfig[]; // Managed repos
  installedPlugins: Record<string, InstalledPluginInfo>; // Install tracking
  marketplaceUrl: string; // URL to marketplace JSON endpoint
  marketplaceCacheTTL: number; // Cache TTL in milliseconds
}

export const DEFAULT_SETTINGS: GHCRPluginSettings = {
  githubToken: "",
  repositories: [],
  installedPlugins: {},
  marketplaceUrl: "https://raw.githubusercontent.com/gillisandrew/shard/main/marketplace/plugins.json",
  marketplaceCacheTTL: 3600000, // 1 hour
};

export interface TagMetadata {
  tag: string;
  digest: string;
  size: number;
}

export interface ParsedRepo {
  fullUrl: string;
  owner: string;
  repo: string;
}

export interface InstallResult {
  pluginId: string;
  filesInstalled: number;
}

export interface CachedTagList {
  tags: string[]; // All fetched tags
  fetchedAt: number; // Unix timestamp
  error?: string; // Error if fetch failed
}
