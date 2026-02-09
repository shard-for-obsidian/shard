// packages/shard-lib/src/__tests__/oci-config-push.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OciRegistryClient } from '../client/OciRegistryClient.js';
import type { ObsidianManifest } from '../types/ManifestTypes.js';

describe('OciRegistryClient.pushPluginManifest', () => {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      adapter: mockAdapter as any,
      token: 'test-token',
    });
  });

  it('should push manifest as config blob and create OCI manifest', async () => {
    const pluginManifest: ObsidianManifest = {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      minAppVersion: '0.15.0',
      description: 'A test plugin',
      author: 'Test Author',
    };

    const layers = [
      {
        mediaType: 'application/javascript',
        digest: 'sha256:mainjs123',
        size: 1000,
        annotations: {
          'vnd.obsidianmd.layer.filename': 'main.js',
        },
      },
    ];

    // Mock authentication response
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ token: 'auth-token' }),
    });

    // Mock config blob push - POST to initiate
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 202,
      headers: {
        get: (key: string) => (key === 'location' ? '/upload/uuid123' : null),
      },
    });

    // Mock config blob push - PUT to complete
    // The actual digest will be calculated from the manifest content
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 201,
      headers: {
        get: (key: string) => null, // Don't return digest to avoid validation
      },
    });

    // Mock manifest push
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 201,
      headers: {
        get: (key: string) => null, // Don't return digest to avoid validation
      },
    });

    const result = await client.pushPluginManifest({
      ref: '1.0.0',
      pluginManifest,
      layers,
    });

    expect(result.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.configDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.manifest).toBeDefined();
    expect(result.manifest.config.mediaType).toBe(
      'application/vnd.obsidianmd.plugin-manifest.v1+json',
    );
    expect(result.manifest.layers).toEqual(layers);
  });

  it('should include annotations in the manifest', async () => {
    const pluginManifest: ObsidianManifest = {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      minAppVersion: '0.15.0',
      description: 'A test plugin',
      author: 'Test Author',
    };

    const layers = [
      {
        mediaType: 'application/javascript',
        digest: 'sha256:mainjs123',
        size: 1000,
        annotations: {
          'vnd.obsidianmd.layer.filename': 'main.js',
        },
      },
    ];

    const annotations = {
      'vnd.obsidianmd.plugin.published-at': '2024-01-01T00:00:00Z',
      'custom.annotation': 'value',
    };

    // Mock all responses
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ token: 'auth-token' }),
    });
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 202,
      headers: {
        get: (key: string) => (key === 'location' ? '/upload/uuid123' : null),
      },
    });
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 201,
      headers: {
        get: (key: string) => null,
      },
    });
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 201,
      headers: {
        get: (key: string) => null,
      },
    });

    const result = await client.pushPluginManifest({
      ref: '1.0.0',
      pluginManifest,
      layers,
      annotations,
    });

    expect(result.manifest.annotations).toEqual(annotations);
  });
});
