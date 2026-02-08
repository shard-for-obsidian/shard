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
  it("should create annotations from manifest", () => {
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
      "owner/repo",
      "ghcr.io/owner/repo"
    );

    expect(result["vnd.obsidianmd.plugin.id"]).toBe("test-plugin");
    expect(result["vnd.obsidianmd.plugin.name"]).toBe("Test Plugin");
    expect(result["vnd.obsidianmd.plugin.version"]).toBe("1.0.0");
    expect(result["vnd.obsidianmd.plugin.source"]).toBe(
      "git+https://github.com/owner/repo.git",
    );
    expect(result["vnd.obsidianmd.plugin.published-at"]).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    );
  });

  it("should include optional fields if present", () => {
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
      "owner/repo",
      "ghcr.io/owner/repo"
    );

    expect(result["vnd.obsidianmd.plugin.author-url"]).toBe(
      "https://example.com",
    );
    expect(result["vnd.obsidianmd.plugin.min-app-version"]).toBe("1.0.0");
  });

  test("includes org.opencontainers.image.source annotation", () => {
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
      "owner/repo",
      "ghcr.io/shard-for-obsidian/shard/community/test-plugin"
    );

    expect(annotations["org.opencontainers.image.source"]).toBe(
      "https://github.com/shard-for-obsidian/shard"
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
      "owner/repo",
      "ghcr.io/org/repo/deeply/nested/path"
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
      "org.opencontainers.image.source": "https://github.com/owner/repo",
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
      "org.opencontainers.image.source": "https://github.com/owner/repo",
      "vnd.obsidianmd.plugin.author-url": "https://example.com",
      "vnd.obsidianmd.plugin.min-app-version": "1.0.0",
    };

    const result = annotationsToMarketplacePlugin(
      annotations,
      "ghcr.io/owner/repo",
    );

    expect(result.authorUrl).toBe("https://example.com");
    expect(result.minObsidianVersion).toBe("1.0.0");
  });
});
