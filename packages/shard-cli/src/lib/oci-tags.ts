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

interface AuthChallenge {
  realm: string;
  service: string;
  scope: string;
}

export interface TagMetadata {
  publishedAt: string;
  size: number;
  annotations: Record<string, string>;
}

/**
 * Parse WWW-Authenticate header to extract auth challenge.
 */
function parseAuthChallenge(header: string): AuthChallenge | null {
  // Format: Bearer realm="...",service="...",scope="..."
  const realmMatch = /realm="([^"]+)"/.exec(header);
  const serviceMatch = /service="([^"]+)"/.exec(header);
  const scopeMatch = /scope="([^"]+)"/.exec(header);

  if (!realmMatch || !serviceMatch || !scopeMatch) {
    return null;
  }

  return {
    realm: realmMatch[1],
    service: serviceMatch[1],
    scope: scopeMatch[1],
  };
}

/**
 * Exchange GitHub token for OCI registry token.
 */
async function getRegistryToken(
  challenge: AuthChallenge,
  adapter: FetchAdapter,
  githubToken: string,
): Promise<string | null> {
  const url = `${challenge.realm}?service=${challenge.service}&scope=${challenge.scope}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  // For GHCR, we need to use Basic auth with the GitHub token
  // Username can be anything, password is the token
  if (githubToken) {
    const basicAuth = Buffer.from(`token:${githubToken}`).toString("base64");
    headers.Authorization = `Basic ${basicAuth}`;
  }

  try {
    const response = await adapter.fetch(url, { headers });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { token?: string };
    return data.token || null;
  } catch {
    return null;
  }
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

  // Try initial request
  let response = await adapter.fetch(url, { headers });

  // If 401, try to exchange token and retry
  if (response.status === 401 && token) {
    const wwwAuth = response.headers.get("www-authenticate");
    if (wwwAuth) {
      const challenge = parseAuthChallenge(wwwAuth);
      if (challenge) {
        const registryToken = await getRegistryToken(challenge, adapter, token);
        if (registryToken) {
          headers.Authorization = `Bearer ${registryToken}`;
          response = await adapter.fetch(url, { headers });
        }
      }
    }
  }

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

  // Try initial request
  let response = await adapter.fetch(url, { headers });

  // If 401, try to exchange token and retry
  if (response.status === 401 && token) {
    const wwwAuth = response.headers.get("www-authenticate");
    if (wwwAuth) {
      const challenge = parseAuthChallenge(wwwAuth);
      if (challenge) {
        const registryToken = await getRegistryToken(challenge, adapter, token);
        if (registryToken) {
          headers.Authorization = `Bearer ${registryToken}`;
          response = await adapter.fetch(url, { headers });
        }
      }
    }
  }

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
