import { describe, it, expect } from "vitest";
import { ObsidianManifestSchema } from "../manifest.js";

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
