// packages/shard-lib/src/__tests__/oci-config-pull.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OciRegistryClient } from '../client/OciRegistryClient.js';
import type { ManifestOCI, ObsidianManifest } from '../types/ManifestTypes.js';

describe('OciRegistryClient.pullPluginManifest', () => {
  let mockAdapter: {
    fetch: ReturnType<typeof vi.fn>;
  };
  let client: OciRegistryClient;

  beforeEach(() => {
    mockAdapter = {
      fetch: vi.fn(),
    };

    client = new OciRegistryClient({
      name: 'ghcr.io/test/plugin',
      adapter: mockAdapter as any,
      token: 'test-token',
    });
  });

  it('should pull OCI manifest and extract plugin manifest from config', async () => {
    const pluginManifest: ObsidianManifest = {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      minAppVersion: '0.15.0',
      description: 'A test plugin',
      author: 'Test Author',
    };

    const ociManifest: ManifestOCI = {
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      artifactType: 'application/vnd.obsidian.plugin.v1+json',
      config: {
        mediaType: 'application/vnd.obsidianmd.plugin-manifest.v1+json',
        digest: 'sha256:config123',
        size: 200,
      },
      layers: [
        {
          mediaType: 'application/javascript',
          digest: 'sha256:mainjs123',
          size: 1000,
          annotations: {
            'org.opencontainers.image.title': 'main.js',
          },
        },
      ],
      annotations: {
        'org.opencontainers.image.created': '2024-01-01T00:00:00Z',
      },
    };

    // Mock authentication
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ token: 'auth-token' }),
    });

    // Mock manifest fetch
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      headers: {
        get: (key: string) =>
          key === 'docker-content-digest' ? 'sha256:manifest123' : null,
      },
      json: async () => ociManifest,
    });

    // Mock config blob download (GET redirect flow)
    const configBuffer = new TextEncoder().encode(
      JSON.stringify(pluginManifest),
    );
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 200,
      headers: {
        get: (key: string) => null, // Don't return digest to avoid validation
      },
      arrayBuffer: async () => configBuffer.buffer,
    });

    const result = await client.pullPluginManifest({
      ref: '1.0.0',
    });

    expect(result.pluginManifest).toEqual(pluginManifest);
    expect(result.manifest).toEqual(ociManifest);
    expect(result.manifestDigest).toBe('sha256:manifest123');
    expect(result.configDigest).toBe('sha256:config123');
  });

  it('should handle optional plugin manifest fields', async () => {
    const pluginManifest: ObsidianManifest = {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      minAppVersion: '0.15.0',
      description: 'A test plugin',
      author: 'Test Author',
      authorUrl: 'https://example.com',
      isDesktopOnly: true,
      fundingUrl: 'https://github.com/sponsors/test',
    };

    const ociManifest: ManifestOCI = {
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      config: {
        mediaType: 'application/vnd.obsidianmd.plugin-manifest.v1+json',
        digest: 'sha256:config456',
        size: 250,
      },
      layers: [],
    };

    // Mock authentication
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ token: 'auth-token' }),
    });

    // Mock manifest fetch
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      headers: {
        get: () => null,
      },
      json: async () => ociManifest,
    });

    // Mock config blob download
    const configBuffer = new TextEncoder().encode(
      JSON.stringify(pluginManifest),
    );
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 200,
      headers: {
        get: () => null,
      },
      arrayBuffer: async () => configBuffer.buffer,
    });

    const result = await client.pullPluginManifest({
      ref: '1.0.0',
    });

    expect(result.pluginManifest.authorUrl).toBe('https://example.com');
    expect(result.pluginManifest.isDesktopOnly).toBe(true);
    expect(result.pluginManifest.fundingUrl).toBe(
      'https://github.com/sponsors/test',
    );
  });

  it('should throw error if config is missing', async () => {
    const ociManifest = {
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      layers: [],
    };

    // Mock authentication
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ token: 'auth-token' }),
    });

    // Mock manifest fetch
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      headers: {
        get: () => null,
      },
      json: async () => ociManifest,
    });

    await expect(
      client.pullPluginManifest({
        ref: '1.0.0',
      }),
    ).rejects.toThrow('Manifest does not contain a config');
  });
});
