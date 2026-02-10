import { describe, it, expect } from "vitest";
import type {
  MarketplacePlugin,
  MarketplaceIndex,
} from "@shard-for-obsidian/lib";

describe("MarketplacePlugin types", () => {
  it("should support plugin with introduction and versions", () => {
    const plugin: MarketplacePlugin = {
      id: "test-plugin",
      registryUrl: "ghcr.io/owner/repo",
      name: "Test Plugin",
      author: "Test Author",
      description: "Test description",
      introduction: "# Test Plugin\n\nIntro text",
      versions: [
        {
          canonicalTag: "1.0.0",
          sha: "sha256:abc123",
          publishedAt: "2026-02-06T00:00:00Z",
          size: 123456,
          annotations: {
            "vnd.obsidianmd.plugin.commit": "abc123",
          },
        },
      ],
    };

    expect(plugin.introduction).toBe("# Test Plugin\n\nIntro text");
    expect(plugin.versions).toBeDefined();
    expect(plugin.versions).toHaveLength(1);
    expect(plugin.versions![0].canonicalTag).toBe("1.0.0");
  });

  it("should support plugin without introduction and versions (migration compatibility)", () => {
    const plugin: MarketplacePlugin = {
      id: "legacy-plugin",
      registryUrl: "ghcr.io/owner/legacy",
      name: "Legacy Plugin",
      author: "Legacy Author",
      description: "Legacy description",
    };

    expect(plugin.introduction).toBeUndefined();
    expect(plugin.versions).toBeUndefined();
  });

  it("should support marketplace index with generatedAt", () => {
    const index: MarketplaceIndex = {
      plugins: [],
      generatedAt: "2026-02-06T12:00:00Z",
    };

    expect(index.generatedAt).toBe("2026-02-06T12:00:00Z");
  });
});
