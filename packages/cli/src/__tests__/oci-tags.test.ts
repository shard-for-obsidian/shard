import { describe, it, expect, vi } from "vitest";
import { queryOciTags, queryTagMetadata, generateVersionTags } from "../lib/oci-tags.js";
import type { FetchAdapter } from "@shard-for-obsidian/lib";

describe("OCI Tags Query", () => {
  it("should query available tags from OCI registry", async () => {
    const mockAdapter: FetchAdapter = {
      fetch: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ tags: ["1.0.0", "0.9.0", "0.8.0"] }),
      }),
    };

    const tags = await queryOciTags({
      registryUrl: "ghcr.io/owner/repo",
      adapter: mockAdapter,
    });

    expect(tags).toEqual(["1.0.0", "0.9.0", "0.8.0"]);
  });

  it("should query metadata for specific tag", async () => {
    const mockAdapter: FetchAdapter = {
      fetch: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          created: "2026-02-06T01:25:08Z",
          config: { size: 1234 },
          layers: [{ size: 100000 }, { size: 145678 }],
          annotations: {
            "vnd.obsidianmd.plugin.commit": "abc123",
          },
        }),
      }),
    };

    const metadata = await queryTagMetadata({
      registryUrl: "ghcr.io/owner/repo",
      tag: "1.0.0",
      adapter: mockAdapter,
    });

    expect(metadata.publishedAt).toBe("2026-02-06T01:25:08Z");
    expect(metadata.size).toBe(245678); // sum of layers
    expect(metadata.annotations["vnd.obsidianmd.plugin.commit"]).toBe(
      "abc123",
    );
  });
});

describe("generateVersionTags", () => {
  it("should generate tags from standard semver", () => {
    const tags = generateVersionTags("2.36.1");
    expect(tags).toEqual(["2.36.1", "2.36", "2", "latest"]);
  });

  it("should handle patch version 0", () => {
    const tags = generateVersionTags("1.5.0");
    expect(tags).toEqual(["1.5.0", "1.5", "1", "latest"]);
  });

  it("should handle major version 0", () => {
    const tags = generateVersionTags("0.15.3");
    expect(tags).toEqual(["0.15.3", "0.15", "0", "latest"]);
  });

  it("should strip leading 'v' prefix", () => {
    const tags = generateVersionTags("v2.36.1");
    expect(tags).toEqual(["2.36.1", "2.36", "2", "latest"]);
  });

  it("should throw error for invalid semver format", () => {
    expect(() => generateVersionTags("invalid")).toThrow(
      "Invalid semantic version format: invalid. Expected format: X.Y.Z"
    );
  });

  it("should throw error for incomplete version", () => {
    expect(() => generateVersionTags("1.2")).toThrow(
      "Invalid semantic version format: 1.2. Expected format: X.Y.Z"
    );
  });

  it("should throw error for version with too many parts", () => {
    expect(() => generateVersionTags("1.2.3.4")).toThrow(
      "Invalid semantic version format: 1.2.3.4. Expected format: X.Y.Z"
    );
  });

  it("should throw error for version with non-numeric parts", () => {
    expect(() => generateVersionTags("1.2.beta")).toThrow(
      "Invalid semantic version format: 1.2.beta. Expected format: X.Y.Z"
    );
  });
});
