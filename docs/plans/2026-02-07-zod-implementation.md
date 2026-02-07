# Zod Integration & Annotation Schema Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Zod schemas for type safety and validation, refactor OCI annotations to use VCS-style URLs and remove deprecated fields.

**Architecture:** Create Zod schemas as single source of truth for types. Use `z.infer<>` to derive TypeScript types. Validate at system boundaries (OCI responses, file reads, API inputs). Add transform utilities to convert between old/new formats.

**Tech Stack:** Zod 3.x, TypeScript 5.x, Vitest

---

## Resolved Design Decisions

1. **VCS URL Validation**: Use prefix-only regex `/^git\+https:\/\//` - flexible for different hosts
2. **Schema Key Format**: Full annotation keys in schema (e.g., `"vnd.obsidianmd.plugin.id"`)
3. **Transform Input Format**: `manifestToAnnotations(manifest, repo)` accepts old format `"owner/repo"` and converts internally
4. **Test Organization**: Single `schemas.test.ts` for schemas, separate `transforms.test.ts` for utilities
5. **Error Handling**: Transform utilities throw errors on invalid input

---

## Task 1: Add Zod Dependency

**Files:**

- Modify: `packages/shard-lib/package.json`

**Step 1: Add zod to dependencies**

Add to dependencies section (not devDependencies):

```json
{
  "dependencies": {
    "zod": "^3.24.1"
  }
}
```

**Step 2: Install dependencies**

Run: `pnpm install`
Expected: Zod installed successfully

**Step 3: Commit**

```bash
git add packages/shard-lib/package.json pnpm-lock.yaml
git commit -m "feat: add zod dependency to shard-lib"
```

---

## Task 2: Create Obsidian Manifest Schema

**Files:**

- Create: `packages/shard-lib/src/schemas/manifest.ts`
- Create: `packages/shard-lib/src/schemas/__tests__/schemas.test.ts`

**Step 1: Write failing test for manifest schema**

Create `packages/shard-lib/src/schemas/__tests__/schemas.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shard-lib && pnpm test schemas.test.ts`
Expected: FAIL with module not found error

**Step 3: Create manifest schema**

Create `packages/shard-lib/src/schemas/manifest.ts`:

```typescript
import { z } from "zod";

/**
 * Obsidian plugin manifest schema
 * Based on official Obsidian manifest.json structure
 */
export const ObsidianManifestSchema = z.object({
  /** Plugin ID */
  id: z.string(),
  /** Display name */
  name: z.string(),
  /** Plugin version */
  version: z.string(),
  /** Minimum Obsidian version required */
  minAppVersion: z.string(),
  /** Plugin description */
  description: z.string(),
  /** Plugin author */
  author: z.string(),
  /** Author URL (optional) */
  authorUrl: z.string().url().optional(),
  /** Is desktop only? (optional) */
  isDesktopOnly: z.boolean().optional(),
  /** Funding URLs (optional) */
  fundingUrl: z.union([z.string().url(), z.record(z.string())]).optional(),
});

/**
 * Inferred TypeScript type from schema
 */
export type ObsidianManifest = z.infer<typeof ObsidianManifestSchema>;
```

**Step 4: Run test to verify it passes**

Run: `cd packages/shard-lib && pnpm test schemas.test.ts`
Expected: All 3 tests pass

**Step 5: Commit**

```bash
git add packages/shard-lib/src/schemas/
git commit -m "feat: add Obsidian manifest Zod schema"
```

---

## Task 3: Create OCI Annotations Schema

**Files:**

- Create: `packages/shard-lib/src/schemas/annotations.ts`
- Modify: `packages/shard-lib/src/schemas/__tests__/schemas.test.ts`

**Step 1: Write failing test for annotations schema**

Add to `packages/shard-lib/src/schemas/__tests__/schemas.test.ts`:

```typescript
import { PluginAnnotationsSchema } from "../annotations.js";

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
      "vnd.obsidianmd.plugin.converted": "true",
      "vnd.obsidianmd.plugin.author-url": "https://example.com",
      "vnd.obsidianmd.plugin.min-app-version": "1.0.0",
    };

    const result = PluginAnnotationsSchema.safeParse(annotationsWithOptionals);
    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shard-lib && pnpm test schemas.test.ts`
Expected: FAIL with module not found error

**Step 3: Create annotations schema**

Create `packages/shard-lib/src/schemas/annotations.ts`:

```typescript
import { z } from "zod";

/**
 * OCI manifest annotations for Obsidian plugins
 * Uses full annotation keys as they appear in OCI manifests
 */
export const PluginAnnotationsSchema = z.object({
  /** Plugin ID */
  "vnd.obsidianmd.plugin.id": z.string(),
  /** Display name */
  "vnd.obsidianmd.plugin.name": z.string(),
  /** Plugin version */
  "vnd.obsidianmd.plugin.version": z.string(),
  /** Plugin description */
  "vnd.obsidianmd.plugin.description": z.string(),
  /** Plugin author */
  "vnd.obsidianmd.plugin.author": z.string(),
  /** VCS source URL (e.g., git+https://github.com/owner/repo.git) */
  "vnd.obsidianmd.plugin.source": z.string().regex(/^git\+https:\/\//),
  /** Publication timestamp (ISO 8601) */
  "vnd.obsidianmd.plugin.published-at": z.string().datetime(),
  /** Indicates plugin was converted from legacy format */
  "vnd.obsidianmd.plugin.converted": z.string().optional(),
  /** Author URL */
  "vnd.obsidianmd.plugin.author-url": z.string().url().optional(),
  /** Minimum Obsidian version required */
  "vnd.obsidianmd.plugin.min-app-version": z.string().optional(),
});

/**
 * Inferred TypeScript type from schema
 */
export type PluginAnnotations = z.infer<typeof PluginAnnotationsSchema>;
```

**Step 4: Run test to verify it passes**

Run: `cd packages/shard-lib && pnpm test schemas.test.ts`
Expected: All 6 tests pass (3 manifest + 3 annotations)

**Step 5: Commit**

```bash
git add packages/shard-lib/src/schemas/
git commit -m "feat: add OCI plugin annotations Zod schema"
```

---

## Task 4: Create Marketplace Schema

**Files:**

- Create: `packages/shard-lib/src/schemas/marketplace.ts`
- Modify: `packages/shard-lib/src/schemas/__tests__/schemas.test.ts`

**Step 1: Write failing test for marketplace schema**

Add to `packages/shard-lib/src/schemas/__tests__/schemas.test.ts`:

```typescript
import {
  MarketplacePluginSchema,
  PluginVersionSchema,
} from "../marketplace.js";

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
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shard-lib && pnpm test schemas.test.ts`
Expected: FAIL with module not found error

**Step 3: Create marketplace schema**

Create `packages/shard-lib/src/schemas/marketplace.ts`:

```typescript
import { z } from "zod";

/**
 * Plugin version information from OCI registry
 */
export const PluginVersionSchema = z.object({
  /** Version tag */
  tag: z.string(),
  /** Publication timestamp (ISO 8601) */
  publishedAt: z.string(),
  /** Size in bytes */
  size: z.number(),
  /** OCI manifest annotations */
  annotations: z.record(z.string()),
});

/**
 * Marketplace plugin information
 * Combines data from OCI annotations and marketplace metadata
 */
export const MarketplacePluginSchema = z.object({
  // Primary identifiers
  /** Plugin ID */
  id: z.string(),
  /** OCI registry URL (e.g., ghcr.io/owner/repo) */
  registryUrl: z.string(),

  // Metadata from manifest
  /** Display name */
  name: z.string(),
  /** Plugin author */
  author: z.string(),
  /** Plugin description */
  description: z.string(),

  // Optional metadata
  /** License identifier */
  license: z.string().optional(),
  /** Minimum Obsidian version required */
  minObsidianVersion: z.string().optional(),
  /** Author URL */
  authorUrl: z.string().url().optional(),

  // Derived/optional
  /** GitHub repository URL (derived from source annotation) */
  repository: z.string().url().optional(),
  /** Category tags */
  tags: z.array(z.string()).optional(),

  // New fields
  /** Markdown introduction content */
  introduction: z.string().optional(),
  /** Available versions from OCI */
  versions: z.array(PluginVersionSchema).optional(),
});

/**
 * Marketplace index containing all plugins
 */
export const MarketplaceIndexSchema = z.object({
  /** List of plugins */
  plugins: z.array(MarketplacePluginSchema),
  /** Generation timestamp (ISO 8601) */
  generatedAt: z.string(),
});

/**
 * Cached marketplace data
 */
export const CachedMarketplaceDataSchema = z.object({
  /** List of plugins */
  plugins: z.array(MarketplacePluginSchema),
  /** Fetch timestamp (Unix epoch milliseconds) */
  fetchedAt: z.number(),
});

/**
 * Inferred TypeScript types from schemas
 */
export type PluginVersion = z.infer<typeof PluginVersionSchema>;
export type MarketplacePlugin = z.infer<typeof MarketplacePluginSchema>;
export type MarketplaceIndex = z.infer<typeof MarketplaceIndexSchema>;
export type CachedMarketplaceData = z.infer<typeof CachedMarketplaceDataSchema>;
```

**Step 4: Run test to verify it passes**

Run: `cd packages/shard-lib && pnpm test schemas.test.ts`
Expected: All 9 tests pass

**Step 5: Commit**

```bash
git add packages/shard-lib/src/schemas/
git commit -m "feat: add marketplace Zod schemas"
```

---

## Task 5: Create Transform Utilities

**Files:**

- Create: `packages/shard-lib/src/schemas/transforms.ts`
- Create: `packages/shard-lib/src/schemas/__tests__/transforms.test.ts`

**Step 1: Write failing tests for transform utilities**

Create `packages/shard-lib/src/schemas/__tests__/transforms.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  repoToVcsUrl,
  vcsUrlToGitHubUrl,
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

    const result = manifestToAnnotations(manifest, "owner/repo");

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

    const result = manifestToAnnotations(manifest, "owner/repo");

    expect(result["vnd.obsidianmd.plugin.author-url"]).toBe(
      "https://example.com",
    );
    expect(result["vnd.obsidianmd.plugin.min-app-version"]).toBe("1.0.0");
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
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shard-lib && pnpm test transforms.test.ts`
Expected: FAIL with module not found error

**Step 3: Create transform utilities**

Create `packages/shard-lib/src/schemas/transforms.ts`:

```typescript
import type { ObsidianManifest } from "./manifest.js";
import type { PluginAnnotations } from "./annotations.js";
import type { MarketplacePlugin } from "./marketplace.js";

/**
 * Convert GitHub repo format to VCS URL
 * @param repo - Repository in "owner/repo" format
 * @returns VCS URL in "git+https://github.com/owner/repo.git" format
 * @throws Error if repo format is invalid
 */
export function repoToVcsUrl(repo: string): string {
  if (!repo.includes("/")) {
    throw new Error(`Invalid repo format: ${repo}. Expected "owner/repo"`);
  }
  return `git+https://github.com/${repo}.git`;
}

/**
 * Extract GitHub URL from VCS URL
 * @param vcsUrl - VCS URL in "git+https://..." format
 * @returns GitHub URL in "https://github.com/owner/repo" format
 * @throws Error if VCS URL format is invalid
 */
export function vcsUrlToGitHubUrl(vcsUrl: string): string {
  if (!vcsUrl.startsWith("git+")) {
    throw new Error(
      `Invalid VCS URL format: ${vcsUrl}. Expected "git+https://..."`,
    );
  }

  // Remove "git+" prefix and optional ".git" suffix
  const url = vcsUrl.slice(4).replace(/\.git$/, "");
  return url;
}

/**
 * Create OCI annotations from Obsidian manifest
 * @param manifest - Obsidian plugin manifest
 * @param repo - Repository in "owner/repo" format
 * @returns OCI manifest annotations
 */
export function manifestToAnnotations(
  manifest: ObsidianManifest,
  repo: string,
): PluginAnnotations {
  const annotations: Record<string, string> = {
    "vnd.obsidianmd.plugin.id": manifest.id,
    "vnd.obsidianmd.plugin.name": manifest.name,
    "vnd.obsidianmd.plugin.version": manifest.version,
    "vnd.obsidianmd.plugin.description": manifest.description,
    "vnd.obsidianmd.plugin.author": manifest.author,
    "vnd.obsidianmd.plugin.source": repoToVcsUrl(repo),
    "vnd.obsidianmd.plugin.published-at": new Date().toISOString(),
  };

  // Add optional fields if present
  if (manifest.authorUrl) {
    annotations["vnd.obsidianmd.plugin.author-url"] = manifest.authorUrl;
  }
  if (manifest.minAppVersion) {
    annotations["vnd.obsidianmd.plugin.min-app-version"] =
      manifest.minAppVersion;
  }

  return annotations as PluginAnnotations;
}

/**
 * Create marketplace plugin from OCI annotations
 * @param annotations - OCI manifest annotations
 * @param registryUrl - OCI registry URL (e.g., "ghcr.io/owner/repo")
 * @returns Marketplace plugin object
 */
export function annotationsToMarketplacePlugin(
  annotations: PluginAnnotations,
  registryUrl: string,
): MarketplacePlugin {
  const plugin: MarketplacePlugin = {
    id: annotations["vnd.obsidianmd.plugin.id"],
    registryUrl,
    name: annotations["vnd.obsidianmd.plugin.name"],
    author: annotations["vnd.obsidianmd.plugin.author"],
    description: annotations["vnd.obsidianmd.plugin.description"],
  };

  // Add optional fields if present
  if (annotations["vnd.obsidianmd.plugin.author-url"]) {
    plugin.authorUrl = annotations["vnd.obsidianmd.plugin.author-url"];
  }
  if (annotations["vnd.obsidianmd.plugin.min-app-version"]) {
    plugin.minObsidianVersion =
      annotations["vnd.obsidianmd.plugin.min-app-version"];
  }

  // Extract GitHub URL from source
  const source = annotations["vnd.obsidianmd.plugin.source"];
  if (source) {
    plugin.repository = vcsUrlToGitHubUrl(source);
  }

  return plugin;
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/shard-lib && pnpm test transforms.test.ts`
Expected: All 8 tests pass

**Step 5: Commit**

```bash
git add packages/shard-lib/src/schemas/
git commit -m "feat: add schema transform utilities"
```

---

## Task 6: Create Schema Index and Export

**Files:**

- Create: `packages/shard-lib/src/schemas/index.ts`

**Step 1: Create index file with exports**

Create `packages/shard-lib/src/schemas/index.ts`:

```typescript
// Schemas
export { ObsidianManifestSchema, type ObsidianManifest } from "./manifest.js";

export {
  PluginAnnotationsSchema,
  type PluginAnnotations,
} from "./annotations.js";

export {
  PluginVersionSchema,
  MarketplacePluginSchema,
  MarketplaceIndexSchema,
  CachedMarketplaceDataSchema,
  type PluginVersion,
  type MarketplacePlugin,
  type MarketplaceIndex,
  type CachedMarketplaceData,
} from "./marketplace.js";

// Transform utilities
export {
  repoToVcsUrl,
  vcsUrlToGitHubUrl,
  manifestToAnnotations,
  annotationsToMarketplacePlugin,
} from "./transforms.js";
```

**Step 2: Verify exports work**

Run: `cd packages/shard-lib && pnpm build`
Expected: Build succeeds, no errors

**Step 3: Commit**

```bash
git add packages/shard-lib/src/schemas/index.ts
git commit -m "feat: add schema module exports"
```

---

## Task 7: Update Converter to Use New Annotation Schema

**Files:**

- Modify: `packages/shard-cli/src/lib/converter.ts:231-250`
- Modify: `packages/shard-cli/src/__tests__/converter.test.ts`

**Step 1: Update test fixtures with new annotation format**

Modify `packages/shard-cli/src/__tests__/converter.test.ts` to update mock annotations:

Find the mock annotation creation and update to use new format:

```typescript
// Change from:
"vnd.obsidianmd.plugin.repo": mockPlugin.repo,
"vnd.obsidianmd.plugin.original-repo": "obsidianmd/obsidian-releases",

// To:
"vnd.obsidianmd.plugin.source": "git+https://github.com/owner/repo.git",
// (remove original-repo entirely)
```

**Step 2: Run converter tests to see failures**

Run: `cd packages/shard-cli && pnpm test converter.test.ts`
Expected: Tests fail due to annotation format mismatch

**Step 3: Update converter.ts to use new schema**

Modify `packages/shard-cli/src/lib/converter.ts`:

Add import at top:

```typescript
import { manifestToAnnotations } from "@shard-for-obsidian/lib/schemas";
```

Replace lines 231-250 (annotation creation) with:

```typescript
// Create annotations using schema transform
const baseAnnotations = manifestToAnnotations(pluginData.manifest, githubRepo);

// Add converted flag for legacy plugins
const annotations: Record<string, string> = {
  ...baseAnnotations,
  "vnd.obsidianmd.plugin.converted": "true",
};
```

**Step 4: Run converter tests to verify they pass**

Run: `cd packages/shard-cli && pnpm test converter.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add packages/shard-cli/src/lib/converter.ts packages/shard-cli/src/__tests__/converter.test.ts
git commit -m "feat: update converter to use new annotation schema"
```

---

## Task 8: Update Type Exports to Use Zod-Derived Types

**Files:**

- Modify: `packages/shard-lib/src/types/ManifestTypes.ts`
- Modify: `packages/shard-lib/src/index.ts` (if exists)
- Modify: `packages/shard-installer/src/marketplace/types.ts`

**Step 1: Update ManifestTypes.ts**

Modify `packages/shard-lib/src/types/ManifestTypes.ts`:

Replace the `ObsidianManifest` interface with export from schema:

```typescript
// Add at top of file:
export type { ObsidianManifest } from "../schemas/manifest.js";

// Remove the old interface:
// export interface ObsidianManifest { ... }
```

Keep all OCI manifest types unchanged (ManifestOCI, ManifestV2, etc.).

**Step 2: Update marketplace types**

Modify `packages/shard-installer/src/marketplace/types.ts`:

Replace all interfaces with schema re-exports:

```typescript
// Re-export types from schemas
export type {
  PluginVersion,
  MarketplacePlugin,
  MarketplaceIndex,
  CachedMarketplaceData,
} from "@shard-for-obsidian/lib/schemas";
```

**Step 3: Run all tests to verify**

Run: `pnpm test`
Expected: All tests pass across all packages

**Step 4: Build all packages**

Run: `pnpm -r build`
Expected: All packages build successfully

**Step 5: Commit**

```bash
git add packages/shard-lib/src/types/ManifestTypes.ts packages/shard-installer/src/marketplace/types.ts
git commit -m "refactor: use Zod-derived types throughout codebase"
```

---

## Task 9: Update All Test Fixtures

**Files:**

- Modify: `packages/shard-lib/src/__tests__/oci-config-push.test.ts`
- Modify: `packages/shard-lib/src/__tests__/oci-config-pull.test.ts`
- Modify: `packages/shard-cli/src/__tests__/oci-tags.test.ts`
- Modify: `packages/shard-cli/src/__tests__/marketplace-register.test.ts`

**Step 1: Update oci-config-push.test.ts annotations**

Find any mock annotations and update:

- Change `vnd.obsidianmd.plugin.repo` to `vnd.obsidianmd.plugin.source` with VCS URL format
- Remove `vnd.obsidianmd.plugin.original-repo`

**Step 2: Update oci-config-pull.test.ts annotations**

Same changes as step 1.

**Step 3: Update oci-tags.test.ts annotations**

Same changes as step 1.

**Step 4: Update marketplace-register.test.ts annotations**

Same changes as step 1.

**Step 5: Run all tests**

Run: `pnpm test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add packages/shard-lib/src/__tests__/ packages/shard-cli/src/__tests__/
git commit -m "test: update fixtures to use new annotation schema"
```

---

## Task 10: Export Schemas from Main Package

**Files:**

- Modify: `packages/shard-lib/src/index.ts` (create if doesn't exist)

**Step 1: Check if index.ts exists**

Run: `ls packages/shard-lib/src/index.ts`

**Step 2: Update or create index.ts**

If exists, add schema exports:

```typescript
// Add to existing exports:
export * from "./schemas/index.js";
```

If doesn't exist, create with:

```typescript
// Type exports
export * from "./types/ManifestTypes.js";

// Schema exports
export * from "./schemas/index.js";

// Add other existing exports as needed
```

**Step 3: Verify exports work**

Run: `cd packages/shard-lib && pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/shard-lib/src/index.ts
git commit -m "feat: export schemas from main package"
```

---

## Verification Steps

After completing all tasks:

1. **Run all tests**: `pnpm test` - Expected: All pass
2. **Build all packages**: `pnpm -r build` - Expected: Success
3. **Type check**: `pnpm -r ts-check` - Expected: No errors
4. **Lint**: `pnpm -r lint` - Expected: No errors

---

## Notes

- All transform utilities throw errors on invalid input (consistent with Zod's `.parse()`)
- VCS URL validation uses prefix-only regex for flexibility
- Schema keys use full annotation format (e.g., `"vnd.obsidianmd.plugin.id"`)
- Transform utilities accept old format and convert internally
- Test organization: `schemas.test.ts` for schemas, `transforms.test.ts` for utilities
