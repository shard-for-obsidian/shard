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
 * Community plugin metadata from community-plugins.json
 */
export interface CommunityPluginMetadata {
  id: string;
  name: string;
  description: string;
  author: string;
  repo: string;
  introduction?: string;
}

/**
 * Create OCI annotations from Obsidian manifest (legacy signature for local plugins)
 * @param manifest - Obsidian plugin manifest
 * @param ownerRepo - GitHub repository in "owner/repo" format
 * @param registryUrl - GHCR registry URL (e.g., "ghcr.io/owner/repo/path")
 * @returns Partial OCI manifest annotations (without community-specific fields)
 */
export function manifestToAnnotationsLegacy(
  manifest: ObsidianManifest,
  ownerRepo: string,
  registryUrl: string,
): Partial<PluginAnnotations> {
  const annotations: Record<string, string> = {
    "vnd.obsidianmd.plugin.id": manifest.id,
    "vnd.obsidianmd.plugin.name": manifest.name,
    "vnd.obsidianmd.plugin.version": manifest.version,
    "vnd.obsidianmd.plugin.description": manifest.description,
    "vnd.obsidianmd.plugin.author": manifest.author,
    "vnd.obsidianmd.plugin.source": repoToVcsUrl(ownerRepo),
    "vnd.obsidianmd.plugin.is-desktop-only": String(manifest.isDesktopOnly ?? false),
    "vnd.obsidianmd.plugin.min-app-version": manifest.minAppVersion,
    "org.opencontainers.image.source": ghcrUrlToGitHubRepo(registryUrl),
    "org.opencontainers.image.title": manifest.name,
    "org.opencontainers.image.created": new Date().toISOString(),
  };

  // Add optional fields if present
  if (manifest.authorUrl) {
    annotations["vnd.obsidianmd.plugin.author-url"] = manifest.authorUrl;
  }

  // Handle funding URL - serialize as JSON if object, otherwise as string
  if (manifest.fundingUrl) {
    if (typeof manifest.fundingUrl === "string") {
      annotations["vnd.obsidianmd.plugin.funding-url"] = manifest.fundingUrl;
    } else {
      annotations["vnd.obsidianmd.plugin.funding-url"] = JSON.stringify(manifest.fundingUrl);
    }
  }

  return annotations as Partial<PluginAnnotations>;
}

/**
 * Create OCI annotations from Obsidian manifest
 * @param manifest - Obsidian plugin manifest
 * @param communityPlugin - Community plugin metadata from community-plugins.json
 * @param registryUrl - GHCR registry URL (e.g., "ghcr.io/owner/repo/path")
 * @param publishedAt - ISO 8601 timestamp of publication
 * @returns OCI manifest annotations
 */
export function manifestToAnnotations(
  manifest: ObsidianManifest,
  communityPlugin: CommunityPluginMetadata,
  registryUrl: string,
  publishedAt: string,
): PluginAnnotations {
  const annotations: Record<string, string> = {
    "vnd.obsidianmd.plugin.id": manifest.id,
    "vnd.obsidianmd.plugin.name": manifest.name,
    "vnd.obsidianmd.plugin.version": manifest.version,
    "vnd.obsidianmd.plugin.description": manifest.description,
    "vnd.obsidianmd.plugin.author": manifest.author,
    "vnd.obsidianmd.plugin.source": repoToVcsUrl(communityPlugin.repo),
    "vnd.obsidianmd.plugin.published-at": publishedAt,
    "vnd.obsidianmd.plugin.introduction": communityPlugin.introduction ?? "",
    "vnd.obsidianmd.plugin.is-desktop-only": String(manifest.isDesktopOnly ?? false),
    "vnd.obsidianmd.plugin.min-app-version": manifest.minAppVersion,
    "org.opencontainers.image.source": ghcrUrlToGitHubRepo(registryUrl),
    "org.opencontainers.image.title": manifest.name,
    "org.opencontainers.image.created": new Date().toISOString(),
  };

  // Add optional fields if present
  if (manifest.authorUrl) {
    annotations["vnd.obsidianmd.plugin.author-url"] = manifest.authorUrl;
  }

  // Handle funding URL - serialize as JSON if object, otherwise as string
  if (manifest.fundingUrl) {
    if (typeof manifest.fundingUrl === "string") {
      annotations["vnd.obsidianmd.plugin.funding-url"] = manifest.fundingUrl;
    } else {
      annotations["vnd.obsidianmd.plugin.funding-url"] = JSON.stringify(manifest.fundingUrl);
    }
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
