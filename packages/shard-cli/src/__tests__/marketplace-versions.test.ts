import { describe, it, expect, vi } from "vitest";
import { marketplaceVersionsCommand } from "../commands/marketplace.js";
import { Logger } from "../lib/logger.js";
import type { FetchAdapter } from "@shard-for-obsidian/lib";

describe("marketplace versions command", () => {
  it("should list all available versions for a registry URL", async () => {
    const mockAdapter: FetchAdapter = {
      fetch: vi
        .fn()
        .mockResolvedValueOnce({
          // Tags list response
          ok: true,
          status: 200,
          json: async () => ({ tags: ["1.0.0", "0.9.0"] }),
        })
        .mockResolvedValueOnce({
          // Manifest for 1.0.0
          ok: true,
          status: 200,
          json: async () => ({
            created: "2026-02-06T01:25:08Z",
            layers: [{ size: 200000 }],
            annotations: {},
          }),
        })
        .mockResolvedValueOnce({
          // Manifest for 0.9.0
          ok: true,
          status: 200,
          json: async () => ({
            created: "2026-01-20T10:30:00Z",
            layers: [{ size: 180000 }],
            annotations: {},
          }),
        }),
    };

    const logger = new Logger();
    const versions = await marketplaceVersionsCommand({
      registryUrl: "ghcr.io/test/repo",
      token: "test-token",
      logger,
      adapter: mockAdapter,
    });

    expect(versions).toHaveLength(2);
    expect(versions[0].tag).toBe("1.0.0");
    expect(versions[0].size).toBe(200000);
    expect(versions[1].tag).toBe("0.9.0");
  });
});
