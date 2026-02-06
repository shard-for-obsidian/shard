import { parseRepoAndRef, OciRegistryClient } from "@shard-for-obsidian/lib";
import type { RequestUrlParam, RequestUrlResponse } from "@shard-for-obsidian/lib";
import { ObsidianFetchAdapter } from "./adapters/obsidian-fetch-adapter.js";
import type { TagMetadata } from "./types.js";
import { requestUrl } from "obsidian";

export class GHCRWrapper {
  /**
   * Normalize repository URL to full ghcr.io format
   * Examples:
   * - "owner/repo" -> "ghcr.io/owner/repo"
   * - "owner/repo/subrepo" -> "ghcr.io/owner/repo/subrepo"
   * - "ghcr.io/owner/repo" -> "ghcr.io/owner/repo"
   * - "https://ghcr.io/owner/repo" -> "ghcr.io/owner/repo"
   * - "ghcr.io/owner/repo:tag" -> "ghcr.io/owner/repo:latest"
   */
  static normalizeRepoUrl(input: string): string {
    // Remove protocol if present
    let normalized = input.replace(/^https?:\/\//, "");

    // Add ghcr.io prefix if not present
    if (!normalized.startsWith("ghcr.io/")) {
      normalized = `ghcr.io/${normalized}`;
    }

    // Add :latest if no tag/digest specified
    if (!normalized.includes(":") && !normalized.includes("@")) {
      normalized = `${normalized}:latest`;
    }

    return normalized;
  }

  /**
   * Adapt Obsidian's requestUrl to the format expected by GHCRClient
   */
  static async obsidianRequestUrl(
    request: RequestUrlParam | string,
  ): Promise<RequestUrlResponse> {
    const req = typeof request === "string" ? { url: request } : request;

    const response = await requestUrl({
      url: req.url,
      method: req.method || "GET",
      headers: req.headers,
      body: req.body instanceof ArrayBuffer ? req.body : undefined,
    });

    // Create a lazy JSON getter to avoid parsing binary responses as JSON
    return {
      status: response.status,
      headers: response.headers,
      arrayBuffer: response.arrayBuffer,
      get json(): unknown {
        return response.json as unknown;
      },
      text: response.text,
    };
  }

  /**
   * Create a GHCRClient instance for the given repository
   */
  static createClient(repoUrl: string, token?: string): OciRegistryClient {
    const normalized = this.normalizeRepoUrl(repoUrl);
    const repo = parseRepoAndRef(normalized);

    const adapter = new ObsidianFetchAdapter((...args) =>
      this.obsidianRequestUrl(...args),
    );

    return new OciRegistryClient({
      repo: repo,
      insecure: false,
      username: token ? "github" : undefined,
      password: token || undefined,
      acceptOCIManifests: true,
      adapter: adapter,
    });
  }

  /**
   * Fetch all tags for a repository
   */
  static async getTags(repoUrl: string, token?: string): Promise<string[]> {
    const client = this.createClient(repoUrl, token);
    const tagList = await client.listAllTags();
    return tagList.tags.sort();
  }

  /**
   * Fetch metadata for a specific tag
   */
  static async getTagMetadata(
    repoUrl: string,
    tag: string,
    token?: string,
  ): Promise<TagMetadata> {
    const client = this.createClient(repoUrl, token);
    const { resp, manifest } = await client.getManifest({ ref: tag });

    // Calculate total size from layers
    // Calculate total size from layers (only for manifest types with layers)
    let size = 0;
    if (
      (manifest.mediaType ===
        "application/vnd.docker.distribution.manifest.v2+json" &&
        Array.isArray((manifest as { layers?: unknown[] }).layers)) ||
      (manifest.mediaType === "application/vnd.oci.image.manifest.v1+json" &&
        Array.isArray((manifest as { layers?: unknown[] }).layers))
    ) {
      // ManifestV2 or ManifestOCI
      size = (manifest as { layers: Array<{ size?: number }> }).layers.reduce(
        (sum, layer) => sum + (layer.size || 0),
        0,
      );
    }

    // Get digest from header or calculate it
    const digest = resp.headers.get("docker-content-digest") || "unknown";

    return {
      tag,
      digest,
      size,
    };
  }
}
