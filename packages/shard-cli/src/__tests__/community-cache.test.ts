/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CommunityPluginsCache } from "../lib/community-cache.js";
import type { FetchAdapter } from "shard-lib";
import type { CommunityPlugin } from "../lib/community-plugins.js";

describe("CommunityPluginsCache", () => {
  let mockAdapter: FetchAdapter;
  let cache: CommunityPluginsCache;

  const mockPlugins: CommunityPlugin[] = [
    {
      id: "obsidian-git",
      name: "Obsidian Git",
      author: "denolehov",
      description: "Backup your vault with git",
      repo: "denolehov/obsidian-git",
    },
    {
      id: "calendar",
      name: "Calendar",
      author: "liamcain",
      description: "Simple calendar widget",
      repo: "liamcain/obsidian-calendar-plugin",
    },
  ];

  beforeEach(() => {
    // Reset mock adapter before each test
    mockAdapter = {
      fetch: vi.fn(),
    };
    cache = new CommunityPluginsCache(mockAdapter);
  });

  describe("fetch", () => {
    it("should fetch and parse community plugins", async () => {
      // Mock successful fetch
      (mockAdapter.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockPlugins,
      });

      const plugins = await cache.fetch();

      expect(plugins).toEqual(mockPlugins);
      expect(mockAdapter.fetch).toHaveBeenCalledWith(
        "https://raw.githubusercontent.com/obsidianmd/obsidian-releases/refs/heads/master/community-plugins.json",
      );
    });

    it("should cache plugins after first fetch", async () => {
      (mockAdapter.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockPlugins,
      });

      // First fetch
      const plugins1 = await cache.fetch();
      expect(plugins1).toEqual(mockPlugins);
      expect(mockAdapter.fetch).toHaveBeenCalledTimes(1);

      // Second fetch should use cache
      const plugins2 = await cache.fetch();
      expect(plugins2).toEqual(mockPlugins);
      expect(mockAdapter.fetch).toHaveBeenCalledTimes(1); // Still 1
    });

    it("should throw error on fetch failure", async () => {
      (mockAdapter.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(cache.fetch()).rejects.toThrow(
        "Failed to fetch community plugins: 404",
      );
    });

    it("should throw error on network failure", async () => {
      (mockAdapter.fetch as any).mockRejectedValue(
        new Error("Network error"),
      );

      await expect(cache.fetch()).rejects.toThrow("Network error");
    });
  });

  describe("findPlugin", () => {
    beforeEach(async () => {
      (mockAdapter.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockPlugins,
      });
      await cache.fetch(); // Pre-populate cache
    });

    it("should find plugin by exact ID", async () => {
      const plugin = await cache.findPlugin("obsidian-git");
      expect(plugin).toEqual(mockPlugins[0]);
    });

    it("should return undefined for non-existent plugin", async () => {
      const plugin = await cache.findPlugin("non-existent");
      expect(plugin).toBeUndefined();
    });

    it("should be case-sensitive", async () => {
      const plugin = await cache.findPlugin("OBSIDIAN-GIT");
      expect(plugin).toBeUndefined();
    });

    it("should fetch plugins if not cached", async () => {
      const newCache = new CommunityPluginsCache(mockAdapter);
      (mockAdapter.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockPlugins,
      });

      const plugin = await newCache.findPlugin("calendar");
      expect(plugin).toEqual(mockPlugins[1]);
      expect(mockAdapter.fetch).toHaveBeenCalledTimes(2); // 1 from setup + 1 from findPlugin
    });
  });
});
