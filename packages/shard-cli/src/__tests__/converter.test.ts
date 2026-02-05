/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PluginConverter } from "../lib/converter.js";
import type { FetchAdapter } from "shard-lib";
import type { CommunityPlugin } from "../lib/community-plugins.js";
import type { GitHubRelease } from "../lib/github-release.js";

describe("PluginConverter", () => {
  let mockAdapter: FetchAdapter;
  let converter: PluginConverter;

  const mockPlugin: CommunityPlugin = {
    id: "obsidian-git",
    name: "Obsidian Git",
    author: "denolehov",
    description: "Backup your vault with git",
    repo: "denolehov/obsidian-git",
  };

  const mockRelease: GitHubRelease = {
    tag_name: "2.1.0",
    assets: [
      {
        name: "main.js",
        browser_download_url:
          "https://github.com/denolehov/obsidian-git/releases/download/2.1.0/main.js",
      },
      {
        name: "styles.css",
        browser_download_url:
          "https://github.com/denolehov/obsidian-git/releases/download/2.1.0/styles.css",
      },
      {
        name: "manifest.json",
        browser_download_url:
          "https://github.com/denolehov/obsidian-git/releases/download/2.1.0/manifest.json",
      },
    ],
  };

  const mockManifestJson = JSON.stringify({
    id: "obsidian-git",
    name: "Obsidian Git",
    version: "2.1.0",
    minAppVersion: "0.15.0",
    description: "Backup your vault with git",
    author: "denolehov",
  });

  const mockMainJs = "console.log('plugin code');";
  const mockStylesCss = ".plugin-style { color: red; }";

  beforeEach(() => {
    mockAdapter = {
      fetch: vi.fn(),
    };
    converter = new PluginConverter(mockAdapter);
  });

  describe("convertPlugin", () => {
    it("should convert a plugin with all assets", async () => {
      // Mock community plugin lookup
      (mockAdapter.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockPlugin],
        })
        // Mock GitHub release fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRelease,
        })
        // Mock manifest.json download
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockManifestJson,
        })
        // Mock main.js download
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockMainJs,
        })
        // Mock styles.css download
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockStylesCss,
        });

      const result = await converter.convertPlugin({
        pluginId: "obsidian-git",
        repository: "ghcr.io/user/obsidian-git",
        token: "ghp_test123",
      });

      expect(result.pluginId).toBe("obsidian-git");
      expect(result.version).toBe("2.1.0");
      expect(result.repository).toBe("ghcr.io/user/obsidian-git:2.1.0");
      expect(result.manifest).toEqual({
        id: "obsidian-git",
        name: "Obsidian Git",
        version: "2.1.0",
        minAppVersion: "0.15.0",
        description: "Backup your vault with git",
        author: "denolehov",
      });
      expect(result.mainJs).toBe(mockMainJs);
      expect(result.stylesCss).toBe(mockStylesCss);
    });

    it("should convert a plugin without styles.css", async () => {
      const releaseWithoutStyles = {
        ...mockRelease,
        assets: mockRelease.assets.filter((a) => a.name !== "styles.css"),
      };

      (mockAdapter.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockPlugin],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => releaseWithoutStyles,
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockManifestJson,
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockMainJs,
        });

      const result = await converter.convertPlugin({
        pluginId: "obsidian-git",
        repository: "ghcr.io/user/obsidian-git",
        token: "ghp_test123",
      });

      expect(result.stylesCss).toBeUndefined();
    });

    it("should use specific version if provided", async () => {
      (mockAdapter.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockPlugin],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRelease,
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockManifestJson,
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockMainJs,
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockStylesCss,
        });

      const result = await converter.convertPlugin({
        pluginId: "obsidian-git",
        version: "2.1.0",
        repository: "ghcr.io/user/obsidian-git",
        token: "ghp_test123",
      });

      expect(result.version).toBe("2.1.0");
    });

    it("should throw error if plugin not found in community list", async () => {
      (mockAdapter.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await expect(
        converter.convertPlugin({
          pluginId: "non-existent",
          repository: "ghcr.io/user/plugin",
          token: "ghp_test123",
        }),
      ).rejects.toThrow('Plugin "non-existent" not found in community plugins');
    });

    it("should throw error if manifest.json not found in release", async () => {
      const releaseWithoutManifest = {
        ...mockRelease,
        assets: mockRelease.assets.filter((a) => a.name !== "manifest.json"),
      };

      (mockAdapter.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockPlugin],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => releaseWithoutManifest,
        });

      await expect(
        converter.convertPlugin({
          pluginId: "obsidian-git",
          repository: "ghcr.io/user/plugin",
          token: "ghp_test123",
        }),
      ).rejects.toThrow("manifest.json not found in release");
    });

    it("should throw error if main.js not found in release", async () => {
      const releaseWithoutMainJs = {
        ...mockRelease,
        assets: mockRelease.assets.filter((a) => a.name !== "main.js"),
      };

      (mockAdapter.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockPlugin],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => releaseWithoutMainJs,
        });

      await expect(
        converter.convertPlugin({
          pluginId: "obsidian-git",
          repository: "ghcr.io/user/plugin",
          token: "ghp_test123",
        }),
      ).rejects.toThrow("main.js not found in release");
    });

    it("should throw error if manifest download fails", async () => {
      (mockAdapter.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockPlugin],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRelease,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

      await expect(
        converter.convertPlugin({
          pluginId: "obsidian-git",
          repository: "ghcr.io/user/plugin",
          token: "ghp_test123",
        }),
      ).rejects.toThrow("Failed to download manifest.json: 404");
    });
  });

  describe("pushToRegistry", () => {
    it("should have correct method signature", () => {
      // Type test - ensures method exists and has correct interface
      expect(typeof converter.pushToRegistry).toBe("function");
    });
  });
});
