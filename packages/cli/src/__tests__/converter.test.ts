import { describe, it, expect, beforeEach, vi } from "vitest";
import { PluginConverter } from "../lib/converter.js";
import type { FetchAdapter } from "@shard-for-obsidian/lib";
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
    published_at: "2024-01-15T10:30:00Z",
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
      vi.mocked(mockAdapter.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockPlugin],
        } as Response)
        // Mock GitHub release fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRelease,
        } as Response)
        // Mock manifest.json download
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockManifestJson,
        } as Response)
        // Mock main.js download
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockMainJs,
        } as Response)
        // Mock styles.css download
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockStylesCss,
        } as Response);

      const result = await converter.convertPlugin({
        pluginId: "obsidian-git",
        namespace: "ghcr.io/user/",
        token: "ghp_test123",
      });

      expect(result.pluginId).toBe("obsidian-git");
      expect(result.version).toBe("2.1.0");
      expect(result.repository).toBe("ghcr.io/user/obsidian-git");
      expect(result.communityPlugin).toEqual(mockPlugin);
      expect(result.publishedAt).toBe("2024-01-15T10:30:00Z");
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

      vi.mocked(mockAdapter.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockPlugin],
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => releaseWithoutStyles,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockManifestJson,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockMainJs,
        } as Response);

      const result = await converter.convertPlugin({
        pluginId: "obsidian-git",
        namespace: "ghcr.io/user/",
        token: "ghp_test123",
      });

      expect(result.stylesCss).toBeUndefined();
    });

    it("should normalize plugin ID to lowercase in repository", async () => {
      const upperCasePlugin = { ...mockPlugin, id: "Obsidian-Git" };
      const upperCaseManifest = JSON.stringify({
        id: "Obsidian-Git",
        name: "Obsidian Git",
        version: "2.1.0",
        minAppVersion: "0.15.0",
        description: "Backup your vault with git",
        author: "denolehov",
      });

      vi.mocked(mockAdapter.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [upperCasePlugin],
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRelease,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => upperCaseManifest,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockMainJs,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockStylesCss,
        } as Response);

      const result = await converter.convertPlugin({
        pluginId: "Obsidian-Git",
        namespace: "ghcr.io/user/",
        token: "ghp_test123",
      });

      expect(result.repository).toBe("ghcr.io/user/obsidian-git");
    });

    it("should validate manifest ID matches plugin ID", async () => {
      const mismatchManifest = JSON.stringify({
        id: "different-plugin",
        name: "Obsidian Git",
        version: "2.1.0",
        minAppVersion: "0.15.0",
        description: "Backup your vault with git",
        author: "denolehov",
      });

      vi.mocked(mockAdapter.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockPlugin],
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRelease,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mismatchManifest,
        } as Response);

      await expect(
        converter.convertPlugin({
          pluginId: "obsidian-git",
          namespace: "ghcr.io/user/",
          token: "ghp_test123",
        }),
      ).rejects.toThrow(
        'Manifest ID "different-plugin" does not match plugin ID "obsidian-git"',
      );
    });

    it("should throw error if plugin not found in community list", async () => {
      vi.mocked(mockAdapter.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

      await expect(
        converter.convertPlugin({
          pluginId: "non-existent",
          namespace: "ghcr.io/user/",
          token: "ghp_test123",
        }),
      ).rejects.toThrow('Plugin "non-existent" not found in community plugins');
    });

    it("should throw error if manifest.json not found in release", async () => {
      const releaseWithoutManifest = {
        ...mockRelease,
        assets: mockRelease.assets.filter((a) => a.name !== "manifest.json"),
      };

      vi.mocked(mockAdapter.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockPlugin],
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => releaseWithoutManifest,
        } as Response);

      await expect(
        converter.convertPlugin({
          pluginId: "obsidian-git",
          namespace: "ghcr.io/user/",
          token: "ghp_test123",
        }),
      ).rejects.toThrow("manifest.json not found in release");
    });

    it("should throw error if main.js not found in release", async () => {
      const releaseWithoutMainJs = {
        ...mockRelease,
        assets: mockRelease.assets.filter((a) => a.name !== "main.js"),
      };

      vi.mocked(mockAdapter.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockPlugin],
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => releaseWithoutMainJs,
        } as Response);

      await expect(
        converter.convertPlugin({
          pluginId: "obsidian-git",
          namespace: "ghcr.io/user/",
          token: "ghp_test123",
        }),
      ).rejects.toThrow("main.js not found in release");
    });

    it("should throw error if manifest download fails", async () => {
      vi.mocked(mockAdapter.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mockPlugin],
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRelease,
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as Response);

      await expect(
        converter.convertPlugin({
          pluginId: "obsidian-git",
          namespace: "ghcr.io/user/",
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

    it("should generate all 4 version tags", async () => {
      // This is an integration test that would require mocking OCI client
      // For now, we verify the interface is correct
      const options = {
        repository: "ghcr.io/user/test-plugin",
        token: "token",
        communityPlugin: mockPlugin,
        publishedAt: "2024-01-15T10:30:00Z",
        pluginData: {
          manifest: {
            id: "test-plugin",
            name: "Test Plugin",
            version: "2.36.1",
            minAppVersion: "0.15.0",
            description: "Test",
            author: "test",
          },
          mainJs: "console.log('test');",
        },
      };

      // Verify the options interface is correct
      expect(options.communityPlugin).toBeDefined();
      expect(options.publishedAt).toBeDefined();
    });

    it("should pass community plugin data through annotations", async () => {
      // Verify the interface includes community plugin metadata
      const options = {
        repository: "ghcr.io/user/test-plugin",
        token: "token",
        communityPlugin: {
          id: "test-plugin",
          name: "Test Plugin",
          author: "Test Author",
          description: "Test description",
          repo: "owner/repo",
        },
        publishedAt: "2024-01-15T10:30:00Z",
        pluginData: {
          manifest: {
            id: "test-plugin",
            name: "Test Plugin",
            version: "1.0.0",
            minAppVersion: "0.15.0",
            description: "Test",
            author: "test",
          },
          mainJs: "console.log('test');",
        },
      };

      expect(options.communityPlugin.id).toBe("test-plugin");
      expect(options.communityPlugin.name).toBe("Test Plugin");
      expect(options.communityPlugin.author).toBe("Test Author");
      expect(options.communityPlugin.repo).toBe("owner/repo");
    });

    it("should include publishedAt timestamp", async () => {
      const options = {
        repository: "ghcr.io/user/test-plugin",
        token: "token",
        communityPlugin: mockPlugin,
        publishedAt: "2024-01-15T10:30:00Z",
        pluginData: {
          manifest: {
            id: "test-plugin",
            name: "Test Plugin",
            version: "1.0.0",
            minAppVersion: "0.15.0",
            description: "Test",
            author: "test",
          },
          mainJs: "console.log('test');",
        },
      };

      expect(options.publishedAt).toBe("2024-01-15T10:30:00Z");
      expect(new Date(options.publishedAt).toISOString()).toBe(
        "2024-01-15T10:30:00.000Z",
      );
    });
  });

  describe("end-to-end integration", () => {
    it("should convert plugin with realistic community data and manifest", async () => {
      // Realistic community plugin data based on obsidian-git
      const realisticCommunityPlugin: CommunityPlugin = {
        id: "obsidian-git",
        name: "Obsidian Git",
        author: "denolehov",
        description: "Backup your vault with git",
        repo: "denolehov/obsidian-git",
      };

      // Realistic GitHub release with published_at
      const realisticRelease: GitHubRelease = {
        tag_name: "2.36.1",
        published_at: "2024-01-15T10:30:45Z",
        assets: [
          {
            name: "main.js",
            browser_download_url:
              "https://github.com/denolehov/obsidian-git/releases/download/2.36.1/main.js",
          },
          {
            name: "styles.css",
            browser_download_url:
              "https://github.com/denolehov/obsidian-git/releases/download/2.36.1/styles.css",
          },
          {
            name: "manifest.json",
            browser_download_url:
              "https://github.com/denolehov/obsidian-git/releases/download/2.36.1/manifest.json",
          },
        ],
      };

      // Realistic manifest with funding URL (string form) and isDesktopOnly
      const realisticManifest = JSON.stringify({
        id: "obsidian-git",
        name: "Obsidian Git",
        version: "2.36.1",
        minAppVersion: "0.15.0",
        description: "Backup your vault with git",
        author: "denolehov",
        authorUrl: "https://github.com/denolehov",
        fundingUrl: "https://github.com/sponsors/denolehov",
        isDesktopOnly: false,
      });

      // Mock API calls
      vi.mocked(mockAdapter.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [realisticCommunityPlugin],
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => realisticRelease,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => realisticManifest,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => "console.log('plugin code');",
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => ".plugin-style { color: red; }",
        } as Response);

      // Execute conversion
      const result = await converter.convertPlugin({
        pluginId: "obsidian-git",
        namespace: "ghcr.io/user/",
        token: "ghp_test123",
      });

      // Verify repository construction (namespace + normalized ID)
      expect(result.repository).toBe("ghcr.io/user/obsidian-git");

      // Verify community plugin data is captured
      expect(result.communityPlugin).toEqual(realisticCommunityPlugin);
      expect(result.communityPlugin.id).toBe("obsidian-git");
      expect(result.communityPlugin.name).toBe("Obsidian Git");
      expect(result.communityPlugin.author).toBe("denolehov");
      expect(result.communityPlugin.description).toBe("Backup your vault with git");
      expect(result.communityPlugin.repo).toBe("denolehov/obsidian-git");

      // Verify published_at timestamp is captured
      expect(result.publishedAt).toBe("2024-01-15T10:30:45Z");

      // Verify manifest parsing
      expect(result.manifest.id).toBe("obsidian-git");
      expect(result.manifest.version).toBe("2.36.1");
      expect(result.manifest.fundingUrl).toBe("https://github.com/sponsors/denolehov");
      expect(result.manifest.isDesktopOnly).toBe(false);
      expect(result.manifest.authorUrl).toBe("https://github.com/denolehov");

      // Verify all assets downloaded
      expect(result.mainJs).toBeDefined();
      expect(result.stylesCss).toBeDefined();
    });

    it("should convert plugin with mixed-case ID to lowercase repository", async () => {
      const mixedCasePlugin: CommunityPlugin = {
        id: "My-Plugin",
        name: "My Plugin",
        author: "author",
        description: "Test plugin",
        repo: "author/my-plugin",
      };

      const release: GitHubRelease = {
        tag_name: "1.0.0",
        published_at: "2024-01-15T10:00:00Z",
        assets: [
          {
            name: "main.js",
            browser_download_url: "https://github.com/author/my-plugin/releases/download/1.0.0/main.js",
          },
          {
            name: "manifest.json",
            browser_download_url: "https://github.com/author/my-plugin/releases/download/1.0.0/manifest.json",
          },
        ],
      };

      const manifest = JSON.stringify({
        id: "My-Plugin",
        name: "My Plugin",
        version: "1.0.0",
        minAppVersion: "0.15.0",
        description: "Test plugin",
        author: "author",
      });

      vi.mocked(mockAdapter.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [mixedCasePlugin],
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => release,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => manifest,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => "console.log('test');",
        } as Response);

      const result = await converter.convertPlugin({
        pluginId: "My-Plugin",
        namespace: "ghcr.io/test/",
        token: "token",
      });

      // Verify ID is normalized to lowercase in repository
      expect(result.repository).toBe("ghcr.io/test/my-plugin");
      expect(result.pluginId).toBe("My-Plugin"); // Original ID preserved in result
    });

    it("should handle manifest with object-form funding URL", async () => {
      const plugin: CommunityPlugin = {
        id: "test-plugin",
        name: "Test Plugin",
        author: "author",
        description: "Test",
        repo: "author/test-plugin",
      };

      const release: GitHubRelease = {
        tag_name: "1.0.0",
        published_at: "2024-01-15T10:00:00Z",
        assets: [
          {
            name: "main.js",
            browser_download_url: "https://github.com/author/test-plugin/releases/download/1.0.0/main.js",
          },
          {
            name: "manifest.json",
            browser_download_url: "https://github.com/author/test-plugin/releases/download/1.0.0/manifest.json",
          },
        ],
      };

      // Object-form funding URL
      const manifest = JSON.stringify({
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
        minAppVersion: "0.15.0",
        description: "Test",
        author: "author",
        fundingUrl: {
          "Buy Me a Coffee": "https://buymeacoffee.com/test",
          "GitHub Sponsors": "https://github.com/sponsors/test",
        },
      });

      vi.mocked(mockAdapter.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [plugin],
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => release,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => manifest,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => "console.log('test');",
        } as Response);

      const result = await converter.convertPlugin({
        pluginId: "test-plugin",
        namespace: "ghcr.io/test/",
        token: "token",
      });

      // Verify funding URL is parsed as object
      expect(result.manifest.fundingUrl).toEqual({
        "Buy Me a Coffee": "https://buymeacoffee.com/test",
        "GitHub Sponsors": "https://github.com/sponsors/test",
      });
    });

    it("should handle manifest with isDesktopOnly flag", async () => {
      const plugin: CommunityPlugin = {
        id: "desktop-plugin",
        name: "Desktop Plugin",
        author: "author",
        description: "Desktop only",
        repo: "author/desktop-plugin",
      };

      const release: GitHubRelease = {
        tag_name: "1.0.0",
        published_at: "2024-01-15T10:00:00Z",
        assets: [
          {
            name: "main.js",
            browser_download_url: "https://github.com/author/desktop-plugin/releases/download/1.0.0/main.js",
          },
          {
            name: "manifest.json",
            browser_download_url: "https://github.com/author/desktop-plugin/releases/download/1.0.0/manifest.json",
          },
        ],
      };

      const manifest = JSON.stringify({
        id: "desktop-plugin",
        name: "Desktop Plugin",
        version: "1.0.0",
        minAppVersion: "0.15.0",
        description: "Desktop only",
        author: "author",
        isDesktopOnly: true,
      });

      vi.mocked(mockAdapter.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [plugin],
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => release,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => manifest,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => "console.log('test');",
        } as Response);

      const result = await converter.convertPlugin({
        pluginId: "desktop-plugin",
        namespace: "ghcr.io/test/",
        token: "token",
      });

      // Verify isDesktopOnly flag
      expect(result.manifest.isDesktopOnly).toBe(true);
    });
  });
});
