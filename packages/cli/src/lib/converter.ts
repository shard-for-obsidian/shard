import type {
  FetchAdapter,
  ObsidianManifest,
  ManifestOCIDescriptor,
  CommunityPluginMetadata,
} from "@shard-for-obsidian/lib";
import { OciRegistryClient, parseRepoAndRef } from "@shard-for-obsidian/lib";
import { manifestToAnnotations } from "@shard-for-obsidian/lib/schemas";
import { CommunityPluginsCache } from "./community-cache.js";
import { GitHubReleaseFetcher } from "./github-release.js";
import { generateVersionTags } from "./oci-tags.js";
import type { CommunityPlugin } from "./community-plugins.js";
import { normalizeNamespace } from "./namespace.js";

// Asset filename constants
const ASSET_MANIFEST_JSON = "manifest.json";
const ASSET_MAIN_JS = "main.js";
const ASSET_STYLES_CSS = "styles.css";

/**
 * Options for converting a plugin
 */
export interface ConvertPluginOptions {
  /** Plugin ID from community plugins list */
  pluginId: string;
  /** Target OCI namespace (e.g., "ghcr.io/owner/") */
  namespace: string;
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
  /** Target repository (namespace + normalized plugin ID) */
  repository: string;
  /** Community plugin metadata */
  communityPlugin: CommunityPlugin;
  /** Publication timestamp (ISO 8601) */
  publishedAt: string;
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
  /** GitHub token */
  token: string;
  /** Community plugin metadata */
  communityPlugin: CommunityPlugin;
  /** Publication timestamp (ISO 8601) */
  publishedAt: string;
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
  /** Tags applied to the manifest */
  tags: string[];
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
    const { pluginId, namespace, token } = options;

    // Step 1: Find plugin in community list
    const plugin = await this.communityCache.findPlugin(pluginId);
    if (!plugin) {
      throw new Error(`Plugin "${pluginId}" not found in community plugins`);
    }

    // Step 2: Fetch latest release from GitHub
    const release = await this.releaseFetcher.fetchLatestRelease(plugin.repo, token);

    // Step 3: Find required assets
    const manifestAsset = release.assets.find(
      (a) => a.name === ASSET_MANIFEST_JSON,
    );
    const mainJsAsset = release.assets.find((a) => a.name === ASSET_MAIN_JS);
    const stylesCssAsset = release.assets.find((a) => a.name === ASSET_STYLES_CSS);

    if (!manifestAsset) {
      throw new Error(`${ASSET_MANIFEST_JSON} not found in release`);
    }
    if (!mainJsAsset) {
      throw new Error(`${ASSET_MAIN_JS} not found in release`);
    }

    // Step 4: Download assets
    const manifestResponse = await this.adapter.fetch(
      manifestAsset.browser_download_url,
    );
    if (!manifestResponse.ok) {
      throw new Error(
        `Failed to download ${ASSET_MANIFEST_JSON}: ${manifestResponse.status}`,
      );
    }
    const manifestJson = await manifestResponse.text();
    let manifest: ObsidianManifest;
    try {
      manifest = JSON.parse(manifestJson) as ObsidianManifest;
    } catch (error) {
      throw new Error(
        `Failed to parse ${ASSET_MANIFEST_JSON}: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
      );
    }

    // Step 5: Validate manifest ID matches plugin ID
    const normalizedPluginId = pluginId.toLowerCase();
    if (manifest.id !== pluginId) {
      throw new Error(
        `Manifest ID "${manifest.id}" does not match plugin ID "${pluginId}"`,
      );
    }

    const mainJsResponse = await this.adapter.fetch(
      mainJsAsset.browser_download_url,
    );
    if (!mainJsResponse.ok) {
      throw new Error(`Failed to download ${ASSET_MAIN_JS}: ${mainJsResponse.status}`);
    }
    const mainJs = await mainJsResponse.text();

    let stylesCss: string | undefined;
    if (stylesCssAsset) {
      const stylesCssResponse = await this.adapter.fetch(
        stylesCssAsset.browser_download_url,
      );
      if (!stylesCssResponse.ok) {
        throw new Error(
          `Failed to download ${ASSET_STYLES_CSS}: ${stylesCssResponse.status}`,
        );
      }
      stylesCss = await stylesCssResponse.text();
    }

    // Step 6: Build repository from namespace + normalized plugin ID
    const normalizedNamespace = normalizeNamespace(namespace);
    const repository = `${normalizedNamespace}/${normalizedPluginId}`;

    return {
      pluginId,
      version: release.tag_name,
      repository,
      communityPlugin: plugin,
      publishedAt: release.published_at,
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
    const { repository, token, communityPlugin, publishedAt, pluginData } = options;

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

    // Push main.js with annotations
    const mainJsResult = await client.pushBlob({
      data: new TextEncoder().encode(pluginData.mainJs),
      annotations: {
        "vnd.obsidianmd.layer.filename": ASSET_MAIN_JS,
        "org.opencontainers.image.title": ASSET_MAIN_JS,
      },
    });
    layers.push({
      mediaType: "application/javascript",
      digest: mainJsResult.digest,
      size: mainJsResult.size,
      annotations: mainJsResult.annotations,
    });

    // Push styles.css if present with annotations
    if (pluginData.stylesCss) {
      const stylesCssResult = await client.pushBlob({
        data: new TextEncoder().encode(pluginData.stylesCss),
        annotations: {
          "vnd.obsidianmd.layer.filename": ASSET_STYLES_CSS,
          "org.opencontainers.image.title": ASSET_STYLES_CSS,
        },
      });
      layers.push({
        mediaType: "text/css",
        digest: stylesCssResult.digest,
        size: stylesCssResult.size,
        annotations: stylesCssResult.annotations,
      });
    }

    // Create community plugin metadata for annotations
    const communityMetadata: CommunityPluginMetadata = {
      id: communityPlugin.id,
      name: communityPlugin.name,
      description: communityPlugin.description,
      author: communityPlugin.author,
      repo: communityPlugin.repo,
    };

    // Create annotations using schema transform
    const baseAnnotations = manifestToAnnotations(
      pluginData.manifest,
      communityMetadata,
      repository,
      publishedAt,
    );

    // Add converted flag for legacy plugins
    const annotations: Record<string, string> = {
      ...baseAnnotations,
      "vnd.obsidianmd.plugin.converted": "true",
    };

    // Generate version tags
    const tags = generateVersionTags(pluginData.manifest.version);

    // Push plugin manifest as config blob with title annotation
    const manifestStr = JSON.stringify(pluginData.manifest);
    const manifestBuffer = new TextEncoder().encode(manifestStr);

    const configResult = await client.pushBlob({
      data: manifestBuffer,
      annotations: {
        "org.opencontainers.image.title": pluginData.manifest.name,
      },
    });

    // Build OCI manifest with plugin manifest as config
    const manifest = {
      schemaVersion: 2 as const,
      mediaType: "application/vnd.oci.image.manifest.v1+json" as const,
      artifactType: "application/vnd.obsidian.plugin.v1+json",
      config: {
        mediaType: "application/vnd.obsidian.plugin.config.v1+json",
        digest: configResult.digest,
        size: configResult.size,
        annotations: configResult.annotations,
      },
      layers,
      annotations,
    };

    // Push manifest with all tags
    const manifestPushResult = await client.pushManifestWithTags({
      tags,
      manifest,
      annotations,
    });

    // Calculate total size from manifest
    const totalSize = layers.reduce((sum, layer) => sum + layer.size, 0);

    return {
      digest: manifestPushResult.digest,
      tags: manifestPushResult.tags,
      size: totalSize,
      repository,
    };
  }
}
