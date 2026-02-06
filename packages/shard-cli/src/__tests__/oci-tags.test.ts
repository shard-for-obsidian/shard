import { describe, it, expect, vi } from "vitest";
import { queryOciTags, queryTagMetadata } from "../lib/oci-tags.js";
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
            "org.opencontainers.image.revision": "abc123",
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
    expect(metadata.annotations["org.opencontainers.image.revision"]).toBe(
      "abc123",
    );
  });
});
