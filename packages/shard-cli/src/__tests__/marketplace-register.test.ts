import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { marketplaceRegisterCommand } from "../commands/marketplace.js";
import { Logger } from "../lib/logger.js";
import type { FetchAdapter } from "@shard-for-obsidian/lib";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

describe("marketplace register command", () => {
  let tempDir: string;
  let marketplaceDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "shard-test-"));
    marketplaceDir = path.join(tempDir, "marketplace");
    await fs.mkdir(path.join(marketplaceDir, "plugins"), { recursive: true });

    // Mock cwd to temp directory
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("should generate markdown file with frontmatter and no version", async () => {
    const pluginManifest = {
      id: "test-plugin",
      name: "Test Plugin",
      author: "Test Author",
      description: "Test description",
      version: "1.0.0",
      minAppVersion: "1.0.0",
    };

    const ociManifest = {
      schemaVersion: 2,
      mediaType: "application/vnd.oci.image.manifest.v1+json",
      config: {
        mediaType: "application/vnd.obsidianmd.plugin-manifest.v1+json",
        digest: "sha256:config123",
        size: 200,
      },
      layers: [],
      annotations: {
        "vnd.obsidianmd.plugin.source": "git+https://github.com/test/repo.git",
      },
    };

    const mockAdapter: FetchAdapter = {
      fetch: vi
        .fn()
        // Mock authentication
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ token: "auth-token" }),
        })
        // Mock manifest fetch
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          headers: {
            get: () => null,
          },
          json: async () => ociManifest,
        })
        // Mock config blob download
        .mockResolvedValueOnce({
          status: 200,
          headers: {
            get: () => null,
          },
          arrayBuffer: async () =>
            new TextEncoder().encode(JSON.stringify(pluginManifest)).buffer,
        }),
    };

    const logger = new Logger();
    const result = await marketplaceRegisterCommand({
      repository: "ghcr.io/test/repo",
      token: "test-token",
      introduction: "# Test Plugin\n\nBrief intro",
      logger,
      adapter: mockAdapter,
    });

    expect(result.pluginId).toBe("test-plugin");
    expect(result.mdPath).toContain("test-plugin.md");

    // Read generated markdown file
    const content = await fs.readFile(result.mdPath, "utf-8");

    // Should have frontmatter
    expect(content).toContain("---");
    expect(content).toContain("id: test-plugin");
    expect(content).toContain("name: Test Plugin");
    expect(content).toContain("registryUrl: ghcr.io/test/repo");

    // Should NOT have version in frontmatter
    expect(content).not.toMatch(/^version:/m);

    // Should have introduction in body
    expect(content).toContain("# Test Plugin");
    expect(content).toContain("Brief intro");
  });
});
