import { describe, it, expect, test } from "vitest";
import {
  repoToGitHubUrl,
  ghcrUrlToGitHubRepo,
  manifestToAnnotations,
  annotationsToMarketplacePlugin,
} from "../transforms.js";

describe("repoToGitHubUrl", () => {
  it("should convert owner/repo to GitHub URL", () => {
    const result = repoToGitHubUrl("owner/repo");
    expect(result).toBe("https://github.com/owner/repo");
  });

  it("should throw on invalid repo format", () => {
    expect(() => repoToGitHubUrl("invalid")).toThrow();
  });
});

describe("ghcrUrlToGitHubRepo", () => {
  test("converts standard GHCR URL", () => {
    expect(ghcrUrlToGitHubRepo("ghcr.io/owner/repo")).toBe(
      "https://github.com/owner/repo"
    );
  });

  test("converts GHCR URL with subpath", () => {
    expect(
      ghcrUrlToGitHubRepo("ghcr.io/shard-for-obsidian/shard/community/plugin")
    ).toBe("https://github.com/shard-for-obsidian/shard");
  });

  test("handles URL with https protocol", () => {
    expect(ghcrUrlToGitHubRepo("https://ghcr.io/owner/repo")).toBe(
      "https://github.com/owner/repo"
    );
  });

  test("handles URL with http protocol", () => {
    expect(ghcrUrlToGitHubRepo("http://ghcr.io/owner/repo")).toBe(
      "https://github.com/owner/repo"
    );
  });

  test("throws on invalid URL with single segment", () => {
    expect(() => ghcrUrlToGitHubRepo("ghcr.io/invalid")).toThrow(
      "Invalid GHCR URL: ghcr.io/invalid"
    );
  });

  test("throws on invalid URL with no segments", () => {
    expect(() => ghcrUrlToGitHubRepo("ghcr.io/")).toThrow(
      "Invalid GHCR URL: ghcr.io/"
    );
  });
});

describe("manifestToAnnotations", () => {
  const communityPlugin = {
    id: "test-plugin",
    name: "Test Plugin",
    description: "A test plugin",
    author: "Test Author",
    repo: "owner/repo",
  };

  it("should create annotations from manifest with community plugin data", () => {
    const manifest = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      minAppVersion: "1.0.0",
      description: "A test plugin",
      author: "Test Author",
    };

    const publishedAt = "2026-02-09T10:00:00Z";
    const registryUrl = "ghcr.io/owner/repo";

    const result = manifestToAnnotations(
      manifest,
      communityPlugin,
      registryUrl,
      publishedAt
    );

    expect(result["vnd.obsidianmd.plugin.id"]).toBe("test-plugin");
    expect(result["vnd.obsidianmd.plugin.name"]).toBe("Test Plugin");
    expect(result["vnd.obsidianmd.plugin.version"]).toBe("1.0.0");
    expect(result["vnd.obsidianmd.plugin.source"]).toBe(
      "https://github.com/owner/repo",
    );
    expect(result["vnd.obsidianmd.plugin.published-at"]).toBe(publishedAt);
    expect(result["vnd.obsidianmd.plugin.min-app-version"]).toBe("1.0.0");
  });

  it("should use community plugin description as introduction", () => {
    const manifest = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      minAppVersion: "1.0.0",
      description: "A test plugin",
      author: "Test Author",
    };

    const result = manifestToAnnotations(
      manifest,
      communityPlugin,  // description: "A test plugin"
      "ghcr.io/owner/repo",
      "2026-02-09T10:00:00Z"
    );

    expect(result["vnd.obsidianmd.plugin.introduction"]).toBe("A test plugin");
  });

  it("should include org.opencontainers.image.description from manifest", () => {
    const manifest = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      minAppVersion: "1.0.0",
      description: "A test plugin",
      author: "Test Author",
    };

    const result = manifestToAnnotations(
      manifest, communityPlugin, "ghcr.io/owner/repo", "2026-02-09T10:00:00Z"
    );
    expect(result["org.opencontainers.image.description"]).toBe("A test plugin");
  });

  it("should serialize funding-url as JSON when it's an object", () => {
    const manifest = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      minAppVersion: "1.0.0",
      description: "A test plugin",
      author: "Test Author",
      fundingUrl: {
        "Buy Me a Coffee": "https://buymeacoffee.com/test",
        "GitHub Sponsors": "https://github.com/sponsors/test",
      },
    };

    const result = manifestToAnnotations(
      manifest,
      communityPlugin,
      "ghcr.io/owner/repo",
      "2026-02-09T10:00:00Z"
    );

    expect(result["vnd.obsidianmd.plugin.funding-url"]).toBe(
      JSON.stringify({
        "Buy Me a Coffee": "https://buymeacoffee.com/test",
        "GitHub Sponsors": "https://github.com/sponsors/test",
      }),
    );
  });

  it("should include funding-url as string when it's a string", () => {
    const manifest = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      minAppVersion: "1.0.0",
      description: "A test plugin",
      author: "Test Author",
      fundingUrl: "https://github.com/sponsors/test",
    };

    const result = manifestToAnnotations(
      manifest,
      communityPlugin,
      "ghcr.io/owner/repo",
      "2026-02-09T10:00:00Z"
    );

    expect(result["vnd.obsidianmd.plugin.funding-url"]).toBe(
      "https://github.com/sponsors/test",
    );
  });

  it("should convert is-desktop-only to string representation", () => {
    const manifest = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      minAppVersion: "1.0.0",
      description: "A test plugin",
      author: "Test Author",
      isDesktopOnly: true,
    };

    const result = manifestToAnnotations(
      manifest,
      communityPlugin,
      "ghcr.io/owner/repo",
      "2026-02-09T10:00:00Z"
    );

    expect(result["vnd.obsidianmd.plugin.is-desktop-only"]).toBe("true");
  });

  it("should default is-desktop-only to 'false' when not present", () => {
    const manifest = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      minAppVersion: "1.0.0",
      description: "A test plugin",
      author: "Test Author",
    };

    const result = manifestToAnnotations(
      manifest,
      communityPlugin,
      "ghcr.io/owner/repo",
      "2026-02-09T10:00:00Z"
    );

    expect(result["vnd.obsidianmd.plugin.is-desktop-only"]).toBe("false");
  });

  it("should include OCI standard annotations", () => {
    const manifest = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      minAppVersion: "1.0.0",
      description: "A test plugin",
      author: "Test Author",
    };

    const publishedAt = "2026-02-09T10:00:00Z";

    const result = manifestToAnnotations(
      manifest,
      communityPlugin,
      "ghcr.io/owner/repo",
      publishedAt
    );

    expect(result["org.opencontainers.image.title"]).toBe("Test Plugin");
    expect(result["org.opencontainers.image.created"]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(result["org.opencontainers.image.source"]).toBe(
      "https://github.com/owner/repo"
    );
  });

  it("should handle RFC 3339 timestamp format", () => {
    const manifest = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      minAppVersion: "1.0.0",
      description: "A test plugin",
      author: "Test Author",
    };

    const publishedAt = "2026-02-09T10:30:45.123Z";

    const result = manifestToAnnotations(
      manifest,
      communityPlugin,
      "ghcr.io/owner/repo",
      publishedAt
    );

    expect(result["vnd.obsidianmd.plugin.published-at"]).toBe(publishedAt);
    expect(result["org.opencontainers.image.created"]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("should include optional author-url if present", () => {
    const manifest = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      minAppVersion: "1.0.0",
      description: "A test plugin",
      author: "Test Author",
      authorUrl: "https://example.com",
    };

    const result = manifestToAnnotations(
      manifest,
      communityPlugin,
      "ghcr.io/owner/repo",
      "2026-02-09T10:00:00Z"
    );

    expect(result["vnd.obsidianmd.plugin.author-url"]).toBe(
      "https://example.com",
    );
  });

  test("includes org.opencontainers.image.source with nested path", () => {
    const manifest = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      minAppVersion: "0.15.0",
      description: "A test plugin",
      author: "Test Author",
    };

    const annotations = manifestToAnnotations(
      manifest,
      communityPlugin,
      "ghcr.io/org/repo/deeply/nested/path",
      "2026-02-09T10:00:00Z"
    );

    expect(annotations["org.opencontainers.image.source"]).toBe(
      "https://github.com/org/repo"
    );
  });
});

describe("annotationsToMarketplacePlugin", () => {
  it("should create marketplace plugin from annotations", () => {
    const annotations = {
      "vnd.obsidianmd.plugin.id": "test-plugin",
      "vnd.obsidianmd.plugin.name": "Test Plugin",
      "vnd.obsidianmd.plugin.version": "1.0.0",
      "vnd.obsidianmd.plugin.description": "A test plugin",
      "vnd.obsidianmd.plugin.author": "Test Author",
      "vnd.obsidianmd.plugin.source": "https://github.com/owner/repo",
      "vnd.obsidianmd.plugin.published-at": "2026-02-07T10:00:00Z",
      "vnd.obsidianmd.plugin.introduction": "Test plugin introduction",
      "vnd.obsidianmd.plugin.is-desktop-only": "false",
      "vnd.obsidianmd.plugin.min-app-version": "1.0.0",
      "org.opencontainers.image.source": "https://github.com/owner/repo",
      "org.opencontainers.image.title": "Test Plugin",
      "org.opencontainers.image.created": new Date().toISOString(),
    };

    const result = annotationsToMarketplacePlugin(
      annotations,
      "ghcr.io/owner/repo",
    );

    expect(result.id).toBe("test-plugin");
    expect(result.name).toBe("Test Plugin");
    expect(result.repository).toBe("https://github.com/owner/repo");
    expect(result.registryUrl).toBe("ghcr.io/owner/repo");
  });

  it("should include optional fields if present", () => {
    const annotations = {
      "vnd.obsidianmd.plugin.id": "test-plugin",
      "vnd.obsidianmd.plugin.name": "Test Plugin",
      "vnd.obsidianmd.plugin.version": "1.0.0",
      "vnd.obsidianmd.plugin.description": "A test plugin",
      "vnd.obsidianmd.plugin.author": "Test Author",
      "vnd.obsidianmd.plugin.source": "https://github.com/owner/repo",
      "vnd.obsidianmd.plugin.published-at": "2026-02-07T10:00:00Z",
      "vnd.obsidianmd.plugin.introduction": "Test plugin introduction",
      "vnd.obsidianmd.plugin.is-desktop-only": "false",
      "vnd.obsidianmd.plugin.min-app-version": "1.0.0",
      "org.opencontainers.image.source": "https://github.com/owner/repo",
      "org.opencontainers.image.title": "Test Plugin",
      "org.opencontainers.image.created": new Date().toISOString(),
      "vnd.obsidianmd.plugin.author-url": "https://example.com",
    };

    const result = annotationsToMarketplacePlugin(
      annotations,
      "ghcr.io/owner/repo",
    );

    expect(result.authorUrl).toBe("https://example.com");
    expect(result.minObsidianVersion).toBe("1.0.0");
  });
});

describe("manifestToAnnotations - integration tests", () => {
  it("should create complete annotations for realistic plugin with all features", () => {
    // Realistic community plugin data based on obsidian-git
    const communityPlugin = {
      id: "obsidian-git",
      name: "Obsidian Git",
      description: "Backup your vault with git",
      author: "denolehov",
      repo: "denolehov/obsidian-git",
      introduction: "# Obsidian Git\n\nSimple plugin to backup your Obsidian.md vault with git.",
    };

    const manifest = {
      id: "obsidian-git",
      name: "Obsidian Git",
      version: "2.36.1",
      minAppVersion: "0.15.0",
      description: "Backup your vault with git",
      author: "denolehov",
      authorUrl: "https://github.com/denolehov",
      fundingUrl: "https://github.com/sponsors/denolehov",
      isDesktopOnly: false,
    };

    const publishedAt = "2024-01-15T10:30:45Z";
    const registryUrl = "ghcr.io/user/obsidian-git";

    const annotations = manifestToAnnotations(
      manifest,
      communityPlugin,
      registryUrl,
      publishedAt
    );

    // Verify all Obsidian-specific annotations
    expect(annotations["vnd.obsidianmd.plugin.id"]).toBe("obsidian-git");
    expect(annotations["vnd.obsidianmd.plugin.name"]).toBe("Obsidian Git");
    expect(annotations["vnd.obsidianmd.plugin.version"]).toBe("2.36.1");
    expect(annotations["vnd.obsidianmd.plugin.description"]).toBe("Backup your vault with git");
    expect(annotations["vnd.obsidianmd.plugin.author"]).toBe("denolehov");
    expect(annotations["vnd.obsidianmd.plugin.author-url"]).toBe("https://github.com/denolehov");
    expect(annotations["vnd.obsidianmd.plugin.source"]).toBe("https://github.com/denolehov/obsidian-git");
    expect(annotations["vnd.obsidianmd.plugin.published-at"]).toBe(publishedAt);
    expect(annotations["vnd.obsidianmd.plugin.introduction"]).toBe(
      "Backup your vault with git"
    );
    expect(annotations["vnd.obsidianmd.plugin.funding-url"]).toBe("https://github.com/sponsors/denolehov");
    expect(annotations["vnd.obsidianmd.plugin.is-desktop-only"]).toBe("false");
    expect(annotations["vnd.obsidianmd.plugin.min-app-version"]).toBe("0.15.0");

    // Verify all OCI standard annotations
    expect(annotations["org.opencontainers.image.title"]).toBe("Obsidian Git");
    expect(annotations["org.opencontainers.image.source"]).toBe("https://github.com/user/obsidian-git");
    expect(annotations["org.opencontainers.image.created"]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("should handle plugin with object-form funding URL", () => {
    const communityPlugin = {
      id: "test-plugin",
      name: "Test Plugin",
      description: "Test description",
      author: "Test Author",
      repo: "owner/repo",
    };

    const manifest = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      minAppVersion: "0.15.0",
      description: "Test description",
      author: "Test Author",
      fundingUrl: {
        "Buy Me a Coffee": "https://buymeacoffee.com/test",
        "GitHub Sponsors": "https://github.com/sponsors/test",
      },
    };

    const annotations = manifestToAnnotations(
      manifest,
      communityPlugin,
      "ghcr.io/owner/repo",
      "2024-01-15T10:00:00Z"
    );

    // Verify funding URL is serialized as JSON string
    expect(annotations["vnd.obsidianmd.plugin.funding-url"]).toBe(
      JSON.stringify({
        "Buy Me a Coffee": "https://buymeacoffee.com/test",
        "GitHub Sponsors": "https://github.com/sponsors/test",
      })
    );
  });

  it("should handle desktop-only plugin", () => {
    const communityPlugin = {
      id: "desktop-plugin",
      name: "Desktop Plugin",
      description: "Desktop only",
      author: "author",
      repo: "owner/desktop-plugin",
    };

    const manifest = {
      id: "desktop-plugin",
      name: "Desktop Plugin",
      version: "1.0.0",
      minAppVersion: "0.15.0",
      description: "Desktop only",
      author: "author",
      isDesktopOnly: true,
    };

    const annotations = manifestToAnnotations(
      manifest,
      communityPlugin,
      "ghcr.io/owner/desktop-plugin",
      "2024-01-15T10:00:00Z"
    );

    expect(annotations["vnd.obsidianmd.plugin.is-desktop-only"]).toBe("true");
  });

  it("should use community plugin description as introduction", () => {
    const communityPlugin = {
      id: "test-plugin",
      name: "Test Plugin",
      description: "Test description",
      author: "Test Author",
      repo: "owner/repo",
      // No introduction field
    };

    const manifest = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      minAppVersion: "0.15.0",
      description: "Test description",
      author: "Test Author",
    };

    const annotations = manifestToAnnotations(
      manifest,
      communityPlugin,
      "ghcr.io/owner/repo",
      "2024-01-15T10:00:00Z"
    );

    // Introduction should be from communityPlugin.description
    expect(annotations["vnd.obsidianmd.plugin.introduction"]).toBe("Test description");
  });

  it("should correctly transform repository URL from namespace with nested path", () => {
    const communityPlugin = {
      id: "test-plugin",
      name: "Test Plugin",
      description: "Test description",
      author: "Test Author",
      repo: "owner/repo",
    };

    const manifest = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      minAppVersion: "0.15.0",
      description: "Test description",
      author: "Test Author",
    };

    // Registry URL with nested path
    const registryUrl = "ghcr.io/shard-for-obsidian/shard/community/test-plugin";

    const annotations = manifestToAnnotations(
      manifest,
      communityPlugin,
      registryUrl,
      "2024-01-15T10:00:00Z"
    );

    // Should extract only owner/repo from nested path
    expect(annotations["org.opencontainers.image.source"]).toBe(
      "https://github.com/shard-for-obsidian/shard"
    );
    expect(annotations["vnd.obsidianmd.plugin.source"]).toBe("https://github.com/owner/repo");
  });

  it("should ensure all required annotations are present", () => {
    const communityPlugin = {
      id: "test-plugin",
      name: "Test Plugin",
      description: "Test description",
      author: "Test Author",
      repo: "owner/repo",
    };

    const manifest = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      minAppVersion: "0.15.0",
      description: "Test description",
      author: "Test Author",
    };

    const annotations = manifestToAnnotations(
      manifest,
      communityPlugin,
      "ghcr.io/owner/repo",
      "2024-01-15T10:00:00Z"
    );

    // Required Obsidian annotations
    const requiredObsidianFields = [
      "vnd.obsidianmd.plugin.id",
      "vnd.obsidianmd.plugin.name",
      "vnd.obsidianmd.plugin.version",
      "vnd.obsidianmd.plugin.description",
      "vnd.obsidianmd.plugin.author",
      "vnd.obsidianmd.plugin.source",
      "vnd.obsidianmd.plugin.published-at",
      "vnd.obsidianmd.plugin.introduction",
      "vnd.obsidianmd.plugin.is-desktop-only",
      "vnd.obsidianmd.plugin.min-app-version",
    ];

    // Required OCI annotations
    const requiredOciFields = [
      "org.opencontainers.image.title",
      "org.opencontainers.image.source",
      "org.opencontainers.image.created",
      "org.opencontainers.image.description",
    ];

    // Verify all required fields are present
    for (const field of [...requiredObsidianFields, ...requiredOciFields]) {
      expect(annotations).toHaveProperty(field);
      expect(annotations[field as keyof typeof annotations]).toBeDefined();
    }
  });
});
