export interface GHCRPluginSettings {
	githubToken: string;
}

export const DEFAULT_SETTINGS: GHCRPluginSettings = {
	githubToken: ''
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
