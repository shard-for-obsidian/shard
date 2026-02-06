import type { FetchAdapter } from "@shard-for-obsidian/lib";
import { parseRepoAndRef } from "@shard-for-obsidian/lib";

export interface QueryOciTagsOptions {
  registryUrl: string;
  adapter: FetchAdapter;
  token?: string;
}

export interface QueryTagMetadataOptions {
  registryUrl: string;
  tag: string;
  adapter: FetchAdapter;
  token?: string;
}

export interface TagMetadata {
  publishedAt: string;
  size: number;
  annotations: Record<string, string>;
}

/**
 * Query all available tags from an OCI registry.
 */
export async function queryOciTags(
  opts: QueryOciTagsOptions,
): Promise<string[]> {
  const { registryUrl, adapter, token } = opts;
  const ref = parseRepoAndRef(registryUrl);

  // OCI Distribution API: GET /v2/<name>/tags/list
  const url = `https://${ref.index.name}/v2/${ref.remoteName}/tags/list`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await adapter.fetch(url, { headers });

  if (!response.ok) {
    throw new Error(
      `Failed to query OCI tags: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as { tags?: string[] };

  return data.tags || [];
}

/**
 * Query metadata for a specific tag.
 */
export async function queryTagMetadata(
  opts: QueryTagMetadataOptions,
): Promise<TagMetadata> {
  const { registryUrl, tag, adapter, token } = opts;
  const ref = parseRepoAndRef(registryUrl);

  // OCI Distribution API: GET /v2/<name>/manifests/<tag>
  const url = `https://${ref.index.name}/v2/${ref.remoteName}/manifests/${tag}`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.oci.image.manifest.v1+json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await adapter.fetch(url, { headers });

  if (!response.ok) {
    throw new Error(
      `Failed to query tag metadata: ${response.status} ${response.statusText}`,
    );
  }

  const manifest = (await response.json()) as {
    created?: string;
    config?: { size: number };
    layers?: Array<{ size: number }>;
    annotations?: Record<string, string>;
  };

  // Extract metadata
  const publishedAt = manifest.created || new Date().toISOString();
  const layerSizes = manifest.layers?.map((l) => l.size) || [];
  const size = layerSizes.reduce((sum, s) => sum + s, 0);
  const annotations = manifest.annotations || {};

  return {
    publishedAt,
    size,
    annotations,
  };
}
