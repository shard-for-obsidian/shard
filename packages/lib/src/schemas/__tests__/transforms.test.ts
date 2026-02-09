import { describe, it, expect, test } from "vitest";
import {
  repoToVcsUrl,
  vcsUrlToGitHubUrl,
  ghcrUrlToGitHubRepo,
  manifestToAnnotations,
  annotationsToMarketplacePlugin,
} from "../transforms.js";

describe("repoToVcsUrl", () => {
  it("should convert owner/repo to VCS URL", () => {
    const result = repoToVcsUrl("owner/repo");
    expect(result).toBe("git+https://github.com/owner/repo.git");
  });

  it("should throw on invalid repo format", () => {
    expect(() => repoToVcsUrl("invalid")).toThrow();
  });
});

describe("vcsUrlToGitHubUrl", () => {
  it("should extract GitHub URL from VCS URL", () => {
    const result = vcsUrlToGitHubUrl("git+https://github.com/owner/repo.git");
    expect(result).toBe("https://github.com/owner/repo");
  });

  it("should handle URL without .git suffix", () => {
    const result = vcsUrlToGitHubUrl("git+https://github.com/owner/repo");
    expect(result).toBe("https://github.com/owner/repo");
  });

  it("should throw on invalid VCS URL", () => {
    expect(() => vcsUrlToGitHubUrl("https://github.com/owner/repo")).toThrow();
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
      "git+https://github.com/owner/repo.git",
    );
    expect(result["vnd.obsidianmd.plugin.published-at"]).toBe(publishedAt);
    expect(result["vnd.obsidianmd.plugin.min-app-version"]).toBe("1.0.0");
  });

  it("should include introduction field from community plugin", () => {
    const manifest = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      minAppVersion: "1.0.0",
      description: "A test plugin",
      author: "Test Author",
    };

    const communityPluginWithIntro = {
      ...communityPlugin,
      introduction: "# Test Plugin\n\nThis is a detailed introduction.",
    };

    const result = manifestToAnnotations(
      manifest,
      communityPluginWithIntro,
      "ghcr.io/owner/repo",
      "2026-02-09T10:00:00Z"
    );

    expect(result["vnd.obsidianmd.plugin.introduction"]).toBe(
      "# Test Plugin\n\nThis is a detailed introduction.",
    );
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
      "vnd.obsidianmd.plugin.source": "git+https://github.com/owner/repo.git",
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
      "vnd.obsidianmd.plugin.source": "git+https://github.com/owner/repo.git",
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
