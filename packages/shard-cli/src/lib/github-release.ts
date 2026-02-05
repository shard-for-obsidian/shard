import type { FetchAdapter } from "shard-lib";

/**
 * Represents a GitHub release asset
 */
export interface GitHubReleaseAsset {
  /** Name of the asset file */
  name: string;
  /** URL to download the asset */
  browser_download_url: string;
}

/**
 * Represents a GitHub release
 */
export interface GitHubRelease {
  /** Tag name of the release (e.g., "1.2.3") */
  tag_name: string;
  /** Array of release assets */
  assets: GitHubReleaseAsset[];
}

/**
 * Fetcher for GitHub releases.
 * Provides methods to fetch releases from the GitHub API.
 */
export class GitHubReleaseFetcher {
  private adapter: FetchAdapter;

  constructor(adapter: FetchAdapter) {
    this.adapter = adapter;
  }

  /**
   * Fetch the latest release from a GitHub repository.
   *
   * @param repo - Repository in format "owner/repo"
   * @param token - Optional GitHub token for authentication
   * @returns Latest release information
   * @throws Error if fetch fails
   */
  async fetchLatestRelease(
    repo: string,
    token?: string,
  ): Promise<GitHubRelease> {
    const url = `https://api.github.com/repos/${repo}/releases/latest`;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await this.adapter.fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Failed to fetch latest release: ${response.status}`);
    }

    return (await response.json()) as GitHubRelease;
  }

  /**
   * Fetch a specific release by tag from a GitHub repository.
   *
   * @param repo - Repository in format "owner/repo"
   * @param tag - Tag name (e.g., "1.2.3")
   * @param token - Optional GitHub token for authentication
   * @returns Release information
   * @throws Error if fetch fails
   */
  async fetchReleaseByTag(
    repo: string,
    tag: string,
    token?: string,
  ): Promise<GitHubRelease> {
    const url = `https://api.github.com/repos/${repo}/releases/tags/${tag}`;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await this.adapter.fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Failed to fetch release ${tag}: ${response.status}`);
    }

    return (await response.json()) as GitHubRelease;
  }
}
