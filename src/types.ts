export interface RepositoryConfig {
	repoUrl: string;        // "owner/repo" normalized format
	showAllTags: boolean;   // Per-repo semver filter toggle
}

export interface InstalledPluginInfo {
	tag: string;            // "v1.2.3"
	digest: string;         // "sha256:abc123..."
	installedAt: number;    // Unix timestamp
	pluginId: string;       // "owner.repo" (directory name)
}

export interface GHCRPluginSettings {
	githubToken: string;                                    // Secret key ref
	repositories: RepositoryConfig[];                       // Managed repos
	installedPlugins: Record<string, InstalledPluginInfo>; // Install tracking
}

export const DEFAULT_SETTINGS: GHCRPluginSettings = {
	githubToken: '',
	repositories: [],
	installedPlugins: {}
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
	tags: string[];          // All fetched tags
	fetchedAt: number;       // Unix timestamp
	error?: string;          // Error if fetch failed
}
