import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { FetchAdapter, ManifestOCI } from "@shard-for-obsidian/lib";
import { verifyPlugin, type VerifyPluginOptions } from "../verify.js";
import { computeFileHash } from "../hash.js";

describe("verifyPlugin", () => {
  let tmpDir: string;
  let pluginDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "shard-verify-test-"));
    pluginDir = path.join(tmpDir, "test-plugin");
    await fs.mkdir(pluginDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should verify plugin with matching hashes (without styles.css)", async () => {
    // Create local plugin files
    const manifest = { id: "test-plugin", version: "1.0.0", name: "Test" };
    await fs.writeFile(
      path.join(pluginDir, "manifest.json"),
      JSON.stringify(manifest),
    );
    await fs.writeFile(path.join(pluginDir, "main.js"), "console.log('test')");

    // Compute actual hashes
    const manifestHash = await computeFileHash(
      path.join(pluginDir, "manifest.json"),
    );
    const mainJsHash = await computeFileHash(path.join(pluginDir, "main.js"));

    // Mock OCI manifest with matching hashes
    const mockManifest: ManifestOCI = {
      schemaVersion: 2,
      config: {
        mediaType: "application/vnd.obsidianmd.plugin-manifest.v1+json",
        size: 100,
        digest: "sha256:config",
      },
      layers: [
        {
          mediaType: "application/json",
          size: 56,
          digest: manifestHash,
          annotations: { "org.opencontainers.image.title": "manifest.json" },
        },
        {
          mediaType: "application/javascript",
          size: 19,
          digest: mainJsHash,
          annotations: { "org.opencontainers.image.title": "main.js" },
        },
      ],
    };

    const mockFetch = vi.fn();
    const mockAdapter: FetchAdapter = {
      fetch: mockFetch,
    };

    // Mock authentication
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ token: "auth-token" }),
    });

    // Mock manifest fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: () => null,
      },
      json: async () => mockManifest,
    });

    const result = await verifyPlugin({
      pluginDirectory: pluginDir,
      namespace: "ghcr.io/test",
      adapter: mockAdapter,
      token: "test-token",
    });

    expect(result.verified).toBe(true);
    expect(result.pluginId).toBe("test-plugin");
    expect(result.version).toBe("1.0.0");
    expect(result.files).toHaveLength(2);
    expect(result.files[0].filename).toBe("manifest.json");
    expect(result.files[0].verified).toBe(true);
    expect(result.files[1].filename).toBe("main.js");
    expect(result.files[1].verified).toBe(true);
  });

  it("should fail verification with hash mismatch", async () => {
    // Create local plugin files
    const manifest = { id: "test-plugin", version: "1.0.0", name: "Test" };
    await fs.writeFile(
      path.join(pluginDir, "manifest.json"),
      JSON.stringify(manifest),
    );
    await fs.writeFile(
      path.join(pluginDir, "main.js"),
      "console.log('different')",
    );

    // Compute actual hash for manifest
    const manifestHash = await computeFileHash(
      path.join(pluginDir, "manifest.json"),
    );

    // Mock OCI manifest with different hash for main.js
    const mockManifest: ManifestOCI = {
      schemaVersion: 2,
      config: {
        mediaType: "application/vnd.obsidianmd.plugin-manifest.v1+json",
        size: 100,
        digest: "sha256:config",
      },
      layers: [
        {
          mediaType: "application/json",
          size: 56,
          digest: manifestHash,
          annotations: { "org.opencontainers.image.title": "manifest.json" },
        },
        {
          mediaType: "application/javascript",
          size: 19,
          digest: "sha256:wronghash",
          annotations: { "org.opencontainers.image.title": "main.js" },
        },
      ],
    };

    const mockFetch = vi.fn();
    const mockAdapter: FetchAdapter = {
      fetch: mockFetch,
    };

    // Mock authentication
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ token: "auth-token" }),
    });

    // Mock manifest fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: () => null,
      },
      json: async () => mockManifest,
    });

    const result = await verifyPlugin({
      pluginDirectory: pluginDir,
      namespace: "ghcr.io/test",
      adapter: mockAdapter,
      token: "test-token",
    });

    expect(result.verified).toBe(false);
    expect(result.files[1].verified).toBe(false);
    expect(result.files[1].expectedHash).toBe("sha256:wronghash");
  });

  it("should throw error if manifest.json is missing", async () => {
    const mockAdapter: FetchAdapter = {
      fetch: vi.fn(),
    };

    await expect(
      verifyPlugin({
        pluginDirectory: pluginDir,
        namespace: "ghcr.io/test",
        adapter: mockAdapter,
        token: "test-token",
      }),
    ).rejects.toThrow("manifest.json not found");
  });
});
