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

  it('should automatically add org.opencontainers.image.title to layer annotations', async () => {
    const pluginManifest: ObsidianManifest = {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      minAppVersion: '0.15.0',
      description: 'A test plugin',
      author: 'Test Author',
    };

    // Create layer data that will be pushed as a blob
    const layerData = new TextEncoder().encode('console.log("test");');

    // Mock authentication response
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ token: 'auth-token' }),
    });

    // Mock layer blob push - POST to initiate
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 202,
      headers: {
        get: (key: string) => (key === 'location' ? '/upload/layer123' : null),
      },
    });

    // Mock layer blob push - PUT to complete
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 201,
      headers: {
        get: (key: string) => null,
      },
    });

    // Push the layer blob with filename annotation
    const layerResult = await client.pushBlob({
      data: layerData,
      annotations: {
        'vnd.obsidianmd.layer.filename': 'main.js',
      },
    });

    // Verify that the returned annotations include both the original and the auto-added title
    expect(layerResult.annotations).toBeDefined();
    expect(layerResult.annotations?.['vnd.obsidianmd.layer.filename']).toBe('main.js');
    expect(layerResult.annotations?.['org.opencontainers.image.title']).toBe('main.js');
  });

  it('should not add org.opencontainers.image.title if vnd.obsidianmd.layer.filename is missing', async () => {
    const layerData = new TextEncoder().encode('console.log("test");');

    // Mock authentication response
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ token: 'auth-token' }),
    });

    // Mock layer blob push - POST to initiate
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 202,
      headers: {
        get: (key: string) => (key === 'location' ? '/upload/layer123' : null),
      },
    });

    // Mock layer blob push - PUT to complete
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 201,
      headers: {
        get: (key: string) => null,
      },
    });

    // Push the layer blob without filename annotation
    const layerResult = await client.pushBlob({
      data: layerData,
    });

    // Verify that no annotations are added
    expect(layerResult.annotations).toBeUndefined();
  });
});

describe('OciRegistryClient.pushManifestWithTags', () => {
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

  it('should push manifest with multiple tags', async () => {
    const manifest = {
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      artifactType: 'application/vnd.obsidian.plugin.v1+json',
      config: {
        mediaType: 'application/vnd.obsidianmd.plugin-manifest.v1+json',
        digest: 'sha256:config123',
        size: 100,
      },
      layers: [],
    };

    const tags = ['1.0.0', 'latest', 'stable'];
    const annotations = {
      'vnd.obsidianmd.plugin.published-at': '2024-01-01T00:00:00Z',
    };

    // Mock authentication response
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ token: 'auth-token' }),
    });

    // Mock manifest push for first tag
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 201,
      headers: {
        get: (key: string) => null,
      },
    });

    // Mock manifest push for second tag
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 201,
      headers: {
        get: (key: string) => null,
      },
    });

    // Mock manifest push for third tag
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 201,
      headers: {
        get: (key: string) => null,
      },
    });

    const result = await client.pushManifestWithTags({
      tags,
      manifest,
      annotations,
    });

    // Verify result
    expect(result.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.tags).toEqual(tags);
    expect(result.size).toBeGreaterThan(0);

    // Verify that manifest was pushed for all tags
    expect(mockAdapter.fetch).toHaveBeenCalledTimes(4); // 1 auth + 3 manifest pushes
  });

  it('should merge manifest annotations with provided annotations', async () => {
    const manifest = {
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      artifactType: 'application/vnd.obsidian.plugin.v1+json',
      config: {
        mediaType: 'application/vnd.obsidianmd.plugin-manifest.v1+json',
        digest: 'sha256:config123',
        size: 100,
      },
      layers: [],
      annotations: {
        'existing.annotation': 'existing-value',
      },
    };

    const tags = ['1.0.0'];
    const annotations = {
      'vnd.obsidianmd.plugin.published-at': '2024-01-01T00:00:00Z',
    };

    // Mock authentication response
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ token: 'auth-token' }),
    });

    // Mock manifest push
    mockAdapter.fetch.mockResolvedValueOnce({
      status: 201,
      headers: {
        get: (key: string) => null,
      },
    });

    await client.pushManifestWithTags({
      tags,
      manifest,
      annotations,
    });

    // Verify that the manifest was pushed with merged annotations
    const lastCall = mockAdapter.fetch.mock.calls[mockAdapter.fetch.mock.calls.length - 1];
    const body = lastCall?.[1]?.body;
    const pushedManifest = JSON.parse(new TextDecoder().decode(body));

    expect(pushedManifest.annotations).toEqual({
      'existing.annotation': 'existing-value',
      'vnd.obsidianmd.plugin.published-at': '2024-01-01T00:00:00Z',
    });
  });

  it('should throw error when tags array is empty', async () => {
    const manifest = {
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      artifactType: 'application/vnd.obsidian.plugin.v1+json',
      config: {
        mediaType: 'application/vnd.obsidianmd.plugin-manifest.v1+json',
        digest: 'sha256:config123',
        size: 100,
      },
      layers: [],
    };

    await expect(
      client.pushManifestWithTags({
        tags: [],
        manifest,
        annotations: {},
      })
    ).rejects.toThrow('tags array cannot be empty');
  });
});
