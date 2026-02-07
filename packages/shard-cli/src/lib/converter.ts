import type {
  FetchAdapter,
  ObsidianManifest,
  ManifestOCIDescriptor,
} from "@shard-for-obsidian/lib";
import { OciRegistryClient, parseRepoAndRef } from "@shard-for-obsidian/lib";
import { manifestToAnnotations } from "@shard-for-obsidian/lib/schemas";
import { CommunityPluginsCache } from "./community-cache.js";
import { GitHubReleaseFetcher } from "./github-release.js";

/**
 * Options for converting a plugin
 */
export interface ConvertPluginOptions {
  /** Plugin ID from community plugins list */
  pluginId: string;
  /** Optional specific version to convert (defaults to latest) */
  version?: string;
  /** Target OCI repository */
  repository: string;
  /** GitHub token for authentication */
  token: string;
}

/**
 * Result of a plugin conversion
 */
export interface ConvertPluginResult {
  /** Plugin ID */
  pluginId: string;
  /** Plugin version */
  version: string;
  /** Target repository with tag */
  repository: string;
  /** GitHub repository URL */
  githubRepo: string;
  /** Parsed manifest */
  manifest: ObsidianManifest;
  /** main.js content */
  mainJs: string;
  /** styles.css content (if present) */
  stylesCss?: string;
}

/**
 * Options for pushing to registry
 */
export interface PushToRegistryOptions {
  /** Repository with tag */
  repository: string;
  /** GitHub repository URL */
  githubRepo: string;
  /** GitHub token */
  token: string;
  /** Plugin data to push */
  pluginData: {
    manifest: ObsidianManifest;
    mainJs: string;
    stylesCss?: string;
  };
}

/**
 * Result of pushing to registry
 */
export interface PushToRegistryResult {
  /** Manifest digest */
  digest: string;
  /** Tag */
  tag: string;
  /** Size */
  size: number;
  /** Repository */
  repository: string;
}

/**
 * Converts legacy Obsidian plugins to OCI format.
 * Fetches plugins from GitHub releases and pushes to OCI registry.
 */
export class PluginConverter {
  private adapter: FetchAdapter;
  private communityCache: CommunityPluginsCache;
  private releaseFetcher: GitHubReleaseFetcher;

  constructor(adapter: FetchAdapter) {
    this.adapter = adapter;
    this.communityCache = new CommunityPluginsCache(adapter);
    this.releaseFetcher = new GitHubReleaseFetcher(adapter);
  }

  /**
   * Convert a plugin from GitHub releases to OCI format.
   *
   * @param options - Conversion options
   * @returns Conversion result with plugin data
   * @throws Error if plugin not found or conversion fails
   */
  async convertPlugin(
    options: ConvertPluginOptions,
  ): Promise<ConvertPluginResult> {
    const { pluginId, version, repository, token } = options;

    // Step 1: Find plugin in community list
    const plugin = await this.communityCache.findPlugin(pluginId);
    if (!plugin) {
      throw new Error(`Plugin "${pluginId}" not found in community plugins`);
    }

    // Step 2: Fetch release from GitHub
    const release = version
      ? await this.releaseFetcher.fetchReleaseByTag(plugin.repo, version, token)
      : await this.releaseFetcher.fetchLatestRelease(plugin.repo, token);

    // Step 3: Find required assets
    const manifestAsset = release.assets.find(
      (a) => a.name === "manifest.json",
    );
    const mainJsAsset = release.assets.find((a) => a.name === "main.js");
    const stylesCssAsset = release.assets.find((a) => a.name === "styles.css");

    if (!manifestAsset) {
      throw new Error("manifest.json not found in release");
    }
    if (!mainJsAsset) {
      throw new Error("main.js not found in release");
    }

    // Step 4: Download assets
    const manifestResponse = await this.adapter.fetch(
      manifestAsset.browser_download_url,
    );
    if (!manifestResponse.ok) {
      throw new Error(
        `Failed to download manifest.json: ${manifestResponse.status}`,
      );
    }
    const manifestJson = await manifestResponse.text();
    const manifest = JSON.parse(manifestJson) as ObsidianManifest;

    const mainJsResponse = await this.adapter.fetch(
      mainJsAsset.browser_download_url,
    );
    if (!mainJsResponse.ok) {
      throw new Error(`Failed to download main.js: ${mainJsResponse.status}`);
    }
    const mainJs = await mainJsResponse.text();

    let stylesCss: string | undefined;
    if (stylesCssAsset) {
      const stylesCssResponse = await this.adapter.fetch(
        stylesCssAsset.browser_download_url,
      );
      if (!stylesCssResponse.ok) {
        throw new Error(
          `Failed to download styles.css: ${stylesCssResponse.status}`,
        );
      }
      stylesCss = await stylesCssResponse.text();
    }

    // Step 5: Build result
    const fullRepository = repository.includes(":")
      ? repository
      : `${repository}:${release.tag_name}`;

    return {
      pluginId,
      version: release.tag_name,
      repository: fullRepository,
      githubRepo: plugin.repo,
      manifest,
      mainJs,
      stylesCss,
    };
  }

  /**
   * Push plugin data to OCI registry.
   *
   * @param options - Push options
   * @returns Push result
   * @throws Error if push fails
   */
  async pushToRegistry(
    options: PushToRegistryOptions,
  ): Promise<PushToRegistryResult> {
    const { repository, githubRepo, token, pluginData } = options;

    // Parse repository reference
    const ref = parseRepoAndRef(repository);
    const client = new OciRegistryClient({
      repo: ref,
      username: "github",
      password: token,
      adapter: this.adapter,
      scopes: ["push", "pull"],
    });

    // Push blobs
    const layers: ManifestOCIDescriptor[] = [];

    // Push main.js
    const mainJsResult = await client.pushBlob({
      data: new TextEncoder().encode(pluginData.mainJs),
    });
    layers.push({
      mediaType: "application/javascript",
      digest: mainJsResult.digest,
      size: mainJsResult.size,
      annotations: {
        "vnd.obsidianmd.layer.filename": "main.js",
      },
    });

    // Push styles.css if present
    if (pluginData.stylesCss) {
      const stylesCssResult = await client.pushBlob({
        data: new TextEncoder().encode(pluginData.stylesCss),
      });
      layers.push({
        mediaType: "text/css",
        digest: stylesCssResult.digest,
        size: stylesCssResult.size,
        annotations: {
          "vnd.obsidianmd.layer.filename": "styles.css",
        },
      });
    }

    // Push manifest with vendor annotations
    // Create annotations using schema transform
    const baseAnnotations = manifestToAnnotations(pluginData.manifest, githubRepo);

    // Add converted flag for legacy plugins
    const annotations: Record<string, string> = {
      ...baseAnnotations,
      "vnd.obsidianmd.plugin.converted": "true",
    };

    const manifestPushResult = await client.pushPluginManifest({
      ref: ref.tag || pluginData.manifest.version,
      pluginManifest: pluginData.manifest,
      layers,
      annotations,
    });

    // Calculate total size from manifest
    const totalSize = manifestPushResult.manifest.layers.reduce(
      (sum, layer) => sum + layer.size,
      0,
    );

    return {
      digest: manifestPushResult.digest,
      tag: ref.tag || pluginData.manifest.version,
      size: totalSize,
      repository,
    };
  }
}
