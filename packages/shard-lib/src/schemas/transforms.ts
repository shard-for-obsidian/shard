import type { ObsidianManifest } from "./manifest.js";
import type { PluginAnnotations } from "./annotations.js";
import type { MarketplacePlugin } from "./marketplace.js";

/**
 * Convert GitHub repo format to VCS URL
 * @param repo - Repository in "owner/repo" format
 * @returns VCS URL in "git+https://github.com/owner/repo.git" format
 * @throws Error if repo format is invalid
 */
export function repoToVcsUrl(repo: string): string {
  if (!repo.includes("/")) {
    throw new Error(`Invalid repo format: ${repo}. Expected "owner/repo"`);
  }
  return `git+https://github.com/${repo}.git`;
}

/**
 * Extract GitHub URL from VCS URL
 * @param vcsUrl - VCS URL in "git+https://..." format
 * @returns GitHub URL in "https://github.com/owner/repo" format
 * @throws Error if VCS URL format is invalid
 */
export function vcsUrlToGitHubUrl(vcsUrl: string): string {
  if (!vcsUrl.startsWith("git+")) {
    throw new Error(
      `Invalid VCS URL format: ${vcsUrl}. Expected "git+https://..."`,
    );
  }

  // Remove "git+" prefix and optional ".git" suffix
  const url = vcsUrl.slice(4).replace(/\.git$/, "");
  return url;
}

/**
 * Extract GitHub repository URL from GHCR registry URL
 * @param registryUrl - GHCR URL (e.g., "ghcr.io/owner/repo/path")
 * @returns GitHub repository URL (e.g., "https://github.com/owner/repo")
 * @throws Error if GHCR URL format is invalid
 */
export function ghcrUrlToGitHubRepo(registryUrl: string): string {
  // Remove protocol if present
  const normalized = registryUrl.replace(/^https?:\/\//, "");

  // Remove ghcr.io/ prefix
  const path = normalized.replace(/^ghcr\.io\//, "");

  // Extract first two segments (owner/repo)
  const segments = path.split("/");
  if (segments.length < 2) {
    throw new Error(`Invalid GHCR URL: ${registryUrl}`);
  }

  return `https://github.com/${segments[0]}/${segments[1]}`;
}

/**
 * Create OCI annotations from Obsidian manifest
 * @param manifest - Obsidian plugin manifest
 * @param repo - Repository in "owner/repo" format
 * @returns OCI manifest annotations
 */
export function manifestToAnnotations(
  manifest: ObsidianManifest,
  repo: string,
): PluginAnnotations {
  const annotations: Record<string, string> = {
    "vnd.obsidianmd.plugin.id": manifest.id,
    "vnd.obsidianmd.plugin.name": manifest.name,
    "vnd.obsidianmd.plugin.version": manifest.version,
    "vnd.obsidianmd.plugin.description": manifest.description,
    "vnd.obsidianmd.plugin.author": manifest.author,
    "vnd.obsidianmd.plugin.source": repoToVcsUrl(repo),
    "vnd.obsidianmd.plugin.published-at": new Date().toISOString(),
  };

  // Add optional fields if present
  if (manifest.authorUrl) {
    annotations["vnd.obsidianmd.plugin.author-url"] = manifest.authorUrl;
  }
  if (manifest.minAppVersion) {
    annotations["vnd.obsidianmd.plugin.min-app-version"] =
      manifest.minAppVersion;
  }

  return annotations as PluginAnnotations;
}

/**
 * Create marketplace plugin from OCI annotations
 * @param annotations - OCI manifest annotations
 * @param registryUrl - OCI registry URL (e.g., "ghcr.io/owner/repo")
 * @returns Marketplace plugin object
 */
export function annotationsToMarketplacePlugin(
  annotations: PluginAnnotations,
  registryUrl: string,
): MarketplacePlugin {
  const plugin: MarketplacePlugin = {
    id: annotations["vnd.obsidianmd.plugin.id"],
    registryUrl,
    name: annotations["vnd.obsidianmd.plugin.name"],
    author: annotations["vnd.obsidianmd.plugin.author"],
    description: annotations["vnd.obsidianmd.plugin.description"],
  };

  // Add optional fields if present
  if (annotations["vnd.obsidianmd.plugin.author-url"]) {
    plugin.authorUrl = annotations["vnd.obsidianmd.plugin.author-url"];
  }
  if (annotations["vnd.obsidianmd.plugin.min-app-version"]) {
    plugin.minObsidianVersion =
      annotations["vnd.obsidianmd.plugin.min-app-version"];
  }

  // Extract GitHub URL from source
  const source = annotations["vnd.obsidianmd.plugin.source"];
  if (source) {
    plugin.repository = vcsUrlToGitHubUrl(source);
  }

  return plugin;
}
