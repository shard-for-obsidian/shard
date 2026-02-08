import { describe, it, expect } from "vitest";
import { ObsidianManifestSchema } from "../manifest.js";
import { PluginAnnotationsSchema } from "../annotations.js";
import {
  MarketplacePluginSchema,
  PluginVersionSchema,
} from "../marketplace.js";

describe("ObsidianManifestSchema", () => {
  it("should validate valid manifest", () => {
    const validManifest = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      minAppVersion: "1.0.0",
      description: "A test plugin",
      author: "Test Author",
    };

    const result = ObsidianManifestSchema.safeParse(validManifest);
    expect(result.success).toBe(true);
  });

  it("should validate manifest with optional fields", () => {
    const manifestWithOptionals = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      minAppVersion: "1.0.0",
      description: "A test plugin",
      author: "Test Author",
      authorUrl: "https://example.com",
      isDesktopOnly: true,
      fundingUrl: "https://funding.example.com",
    };

    const result = ObsidianManifestSchema.safeParse(manifestWithOptionals);
    expect(result.success).toBe(true);
  });

  it("should reject manifest missing required fields", () => {
    const invalidManifest = {
      id: "test-plugin",
      name: "Test Plugin",
    };

    const result = ObsidianManifestSchema.safeParse(invalidManifest);
    expect(result.success).toBe(false);
  });
});

describe("PluginAnnotationsSchema", () => {
  it("should validate valid annotations with VCS URL", () => {
    const validAnnotations = {
      "vnd.obsidianmd.plugin.id": "test-plugin",
      "vnd.obsidianmd.plugin.name": "Test Plugin",
      "vnd.obsidianmd.plugin.version": "1.0.0",
      "vnd.obsidianmd.plugin.description": "A test plugin",
      "vnd.obsidianmd.plugin.author": "Test Author",
      "vnd.obsidianmd.plugin.source": "git+https://github.com/owner/repo.git",
      "vnd.obsidianmd.plugin.published-at": "2026-02-07T10:00:00Z",
      "org.opencontainers.image.source": "https://github.com/owner/repo",
    };

    const result = PluginAnnotationsSchema.safeParse(validAnnotations);
    expect(result.success).toBe(true);
  });

  it("should reject annotations with invalid source URL (no git+ prefix)", () => {
    const invalidAnnotations = {
      "vnd.obsidianmd.plugin.id": "test-plugin",
      "vnd.obsidianmd.plugin.name": "Test Plugin",
      "vnd.obsidianmd.plugin.version": "1.0.0",
      "vnd.obsidianmd.plugin.description": "A test plugin",
      "vnd.obsidianmd.plugin.author": "Test Author",
      "vnd.obsidianmd.plugin.source": "https://github.com/owner/repo.git",
      "vnd.obsidianmd.plugin.published-at": "2026-02-07T10:00:00Z",
    };

    const result = PluginAnnotationsSchema.safeParse(invalidAnnotations);
    expect(result.success).toBe(false);
  });

  it("should validate annotations with optional fields", () => {
    const annotationsWithOptionals = {
      "vnd.obsidianmd.plugin.id": "test-plugin",
      "vnd.obsidianmd.plugin.name": "Test Plugin",
      "vnd.obsidianmd.plugin.version": "1.0.0",
      "vnd.obsidianmd.plugin.description": "A test plugin",
      "vnd.obsidianmd.plugin.author": "Test Author",
      "vnd.obsidianmd.plugin.source": "git+https://github.com/owner/repo.git",
      "vnd.obsidianmd.plugin.published-at": "2026-02-07T10:00:00Z",
      "org.opencontainers.image.source": "https://github.com/owner/repo",
      "vnd.obsidianmd.plugin.converted": "true",
      "vnd.obsidianmd.plugin.author-url": "https://example.com",
      "vnd.obsidianmd.plugin.min-app-version": "1.0.0",
    };

    const result = PluginAnnotationsSchema.safeParse(annotationsWithOptionals);
    expect(result.success).toBe(true);
  });
});

describe("MarketplacePluginSchema", () => {
  it("should validate valid marketplace plugin", () => {
    const validPlugin = {
      id: "test-plugin",
      registryUrl: "ghcr.io/owner/repo",
      name: "Test Plugin",
      author: "Test Author",
      description: "A test plugin",
    };

    const result = MarketplacePluginSchema.safeParse(validPlugin);
    expect(result.success).toBe(true);
  });

  it("should validate plugin with optional fields", () => {
    const pluginWithOptionals = {
      id: "test-plugin",
      registryUrl: "ghcr.io/owner/repo",
      name: "Test Plugin",
      author: "Test Author",
      description: "A test plugin",
      license: "MIT",
      minObsidianVersion: "1.0.0",
      authorUrl: "https://example.com",
      repository: "https://github.com/owner/repo",
      tags: ["productivity", "notes"],
      introduction: "# Test Plugin\n\nThis is a test.",
      versions: [
        {
          tag: "1.0.0",
          publishedAt: "2026-02-07T10:00:00Z",
          size: 12345,
          annotations: { "vnd.obsidianmd.plugin.id": "test-plugin" },
        },
      ],
    };

    const result = MarketplacePluginSchema.safeParse(pluginWithOptionals);
    expect(result.success).toBe(true);
  });
});

describe("PluginVersionSchema", () => {
  it("should validate valid plugin version", () => {
    const validVersion = {
      tag: "1.0.0",
      publishedAt: "2026-02-07T10:00:00Z",
      size: 12345,
      annotations: {},
    };

    const result = PluginVersionSchema.safeParse(validVersion);
    expect(result.success).toBe(true);
  });
});
