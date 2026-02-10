import { describe, it, expect } from "vitest";
import { normalizeNamespace } from "../namespace.js";

describe("normalizeNamespace", () => {
  it("should trim whitespace", () => {
    expect(normalizeNamespace("  ghcr.io/owner/repo  ")).toBe(
      "ghcr.io/owner/repo",
    );
  });

  it("should remove trailing slash", () => {
    expect(normalizeNamespace("ghcr.io/owner/repo/")).toBe(
      "ghcr.io/owner/repo",
    );
  });

  it("should remove multiple trailing slashes", () => {
    expect(normalizeNamespace("ghcr.io/owner/repo///")).toBe(
      "ghcr.io/owner/repo",
    );
  });

  it("should handle both whitespace and trailing slashes", () => {
    expect(normalizeNamespace("  ghcr.io/owner/repo/  ")).toBe(
      "ghcr.io/owner/repo",
    );
  });

  it("should throw error if no slash present", () => {
    expect(() => normalizeNamespace("ghcr.io")).toThrow(
      'Namespace must contain at least one "/" (e.g., ghcr.io/owner/repo)',
    );
  });

  it("should throw error for consecutive slashes", () => {
    expect(() => normalizeNamespace("ghcr.io//owner/repo")).toThrow(
      "Namespace cannot contain consecutive slashes",
    );
  });

  it("should accept valid namespace unchanged", () => {
    expect(
      normalizeNamespace("ghcr.io/shard-for-obsidian/shard/community-plugins"),
    ).toBe("ghcr.io/shard-for-obsidian/shard/community-plugins");
  });
});
