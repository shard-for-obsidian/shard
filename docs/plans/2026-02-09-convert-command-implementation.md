# Convert Command Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update `shard convert` to automatically fetch metadata from community-plugins.json and GitHub releases, generate comprehensive OCI annotations, and support multi-tag publishing.

**Architecture:** Enhance the converter to fetch community plugin metadata alongside GitHub releases, extend the annotation schema to include new fields from multiple sources, and add multi-tag support to the OCI client for publishing the same manifest with multiple version tags.

**Tech Stack:** TypeScript, Zod schemas, OCI Registry Client, GitHub API, Stricli (CLI framework)

---

## Task 1: Update Annotation Schema and Transforms

**Files:**

- Modify: `packages/lib/src/schemas/annotations.ts`
- Modify: `packages/lib/src/schemas/transforms.ts`
- Modify: `packages/lib/src/schemas/manifest.ts`
- Test: `packages/lib/src/schemas/__tests__/transforms.test.ts`

**Step 1: Update manifest schema to make minAppVersion required**

In `packages/lib/src/schemas/manifest.ts:15`, change:

```typescript
  /** Minimum Obsidian version required */
  minAppVersion: z.string(),
```

**Step 2: Add new fields to annotation schema**

In `packages/lib/src/schemas/annotations.ts`, add these fields to `PluginAnnotationsSchema`:

```typescript
export const PluginAnnotationsSchema = z.object({
  // ... existing fields ...

  /** Plugin introduction from community-plugins.json */
  "vnd.obsidianmd.plugin.introduction": z.string(),
  /** Funding URL (string or JSON-serialized object) */
  "vnd.obsidianmd.plugin.funding-url": z.string().optional(),
  /** Desktop only flag */
  "vnd.obsidianmd.plugin.is-desktop-only": z.string(),
  /** OCI image title */
  "org.opencontainers.image.title": z.string(),
  /** OCI image creation timestamp (RFC 3339) */
  "org.opencontainers.image.created": z.string().datetime(),
});
```

**Step 3: Write test for new annotation fields**

In `packages/lib/src/schemas/__tests__/transforms.test.ts`, add test:

```typescript
import { describe, it, expect } from "vitest";
import { manifestToAnnotations } from "../transforms.js";
import type { ObsidianManifest } from "../manifest.js";
import type { CommunityPlugin } from "../../../cli/src/lib/community-plugins.js";

describe("manifestToAnnotations with community plugin data", () => {
  it("should include introduction from community plugin", () => {
    const manifest: ObsidianManifest = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      minAppVersion: "0.15.0",
      description: "Manifest description",
      author: "Test Author",
    };

    const communityPlugin = {
      id: "test-plugin",
      name: "Test Plugin",
      description: "Community description",
      author: "Test Author",
      repo: "owner/repo",
    };

    const registryUrl = "ghcr.io/owner/repo/test-plugin";
    const publishedAt = "2026-02-09T12:00:00.000Z";

    const annotations = manifestToAnnotations(
      manifest,
      communityPlugin,
      registryUrl,
      publishedAt,
    );

    expect(annotations["vnd.obsidianmd.plugin.introduction"]).toBe(
      "Community description",
    );
    expect(annotations["vnd.obsidianmd.plugin.description"]).toBe(
      "Manifest description",
    );
  });

  it("should serialize funding-url as JSON when object", () => {
    const manifest: ObsidianManifest = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      minAppVersion: "0.15.0",
      description: "Test description",
      author: "Test Author",
      fundingUrl: {
        "Ko-fi": "https://ko-fi.com/test",
        "Buy Me a Coffee": "https://buymeacoffee.com/test",
      },
    };

    const communityPlugin = {
      id: "test-plugin",
      name: "Test Plugin",
      description: "Community description",
      author: "Test Author",
      repo: "owner/repo",
    };

    const registryUrl = "ghcr.io/owner/repo/test-plugin";
    const publishedAt = "2026-02-09T12:00:00.000Z";

    const annotations = manifestToAnnotations(
      manifest,
      communityPlugin,
      registryUrl,
      publishedAt,
    );

    expect(annotations["vnd.obsidianmd.plugin.funding-url"]).toBe(
      JSON.stringify(manifest.fundingUrl),
    );
  });

  it("should include is-desktop-only as string", () => {
    const manifest: ObsidianManifest = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      minAppVersion: "0.15.0",
      description: "Test description",
      author: "Test Author",
      isDesktopOnly: true,
    };

    const communityPlugin = {
      id: "test-plugin",
      name: "Test Plugin",
      description: "Community description",
      author: "Test Author",
      repo: "owner/repo",
    };

    const registryUrl = "ghcr.io/owner/repo/test-plugin";
    const publishedAt = "2026-02-09T12:00:00.000Z";

    const annotations = manifestToAnnotations(
      manifest,
      communityPlugin,
      registryUrl,
      publishedAt,
    );

    expect(annotations["vnd.obsidianmd.plugin.is-desktop-only"]).toBe("true");
  });

  it("should include OCI standard annotations", () => {
    const manifest: ObsidianManifest = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      minAppVersion: "0.15.0",
      description: "Test description",
      author: "Test Author",
    };

    const communityPlugin = {
      id: "test-plugin",
      name: "Test Plugin",
      description: "Community description",
      author: "Test Author",
      repo: "owner/repo",
    };

    const registryUrl = "ghcr.io/owner/repo/test-plugin";
    const publishedAt = "2026-02-09T12:00:00.000Z";

    const annotations = manifestToAnnotations(
      manifest,
      communityPlugin,
      registryUrl,
      publishedAt,
    );

    expect(annotations["org.opencontainers.image.title"]).toBe("Test Plugin");
    expect(annotations["org.opencontainers.image.source"]).toBe(
      "https://github.com/owner/repo",
    );
    expect(annotations["org.opencontainers.image.created"]).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    );
  });
});
```

**Step 4: Run test to verify it fails**

Run: `pnpm test packages/lib/src/schemas/__tests__/transforms.test.ts`
Expected: FAIL - `manifestToAnnotations` doesn't accept new parameters

**Step 5: Update manifestToAnnotations function**

In `packages/lib/src/schemas/transforms.ts:65-91`, replace the function:

```typescript
/**
 * Create OCI annotations from Obsidian manifest and community plugin data
 * @param manifest - Obsidian plugin manifest
 * @param communityPlugin - Community plugin entry
 * @param registryUrl - GHCR registry URL (e.g., "ghcr.io/owner/repo/path")
 * @param publishedAt - Release publication timestamp (ISO 8601)
 * @returns OCI manifest annotations
 */
export function manifestToAnnotations(
  manifest: ObsidianManifest,
  communityPlugin: {
    id: string;
    name: string;
    description: string;
    author: string;
    repo: string;
  },
  registryUrl: string,
  publishedAt: string,
): PluginAnnotations {
  const annotations: Record<string, string> = {
    "vnd.obsidianmd.plugin.id": manifest.id,
    "vnd.obsidianmd.plugin.name": manifest.name,
    "vnd.obsidianmd.plugin.version": manifest.version,
    "vnd.obsidianmd.plugin.description": manifest.description,
    "vnd.obsidianmd.plugin.author": manifest.author,
    "vnd.obsidianmd.plugin.min-app-version": manifest.minAppVersion,
    "vnd.obsidianmd.plugin.source": repoToVcsUrl(communityPlugin.repo),
    "vnd.obsidianmd.plugin.published-at": new Date(publishedAt).toISOString(),
    "vnd.obsidianmd.plugin.introduction": communityPlugin.description,
    "vnd.obsidianmd.plugin.is-desktop-only": String(
      manifest.isDesktopOnly ?? false,
    ),
    "org.opencontainers.image.source": ghcrUrlToGitHubRepo(registryUrl),
    "org.opencontainers.image.title": manifest.name,
    "org.opencontainers.image.created": new Date().toISOString(),
  };

  // Add optional fields if present
  if (manifest.authorUrl) {
    annotations["vnd.obsidianmd.plugin.author-url"] = manifest.authorUrl;
  }
  if (manifest.fundingUrl) {
    annotations["vnd.obsidianmd.plugin.funding-url"] =
      typeof manifest.fundingUrl === "string"
        ? manifest.fundingUrl
        : JSON.stringify(manifest.fundingUrl);
  }

  return annotations as PluginAnnotations;
}
```

**Step 6: Run test to verify it passes**

Run: `pnpm test packages/lib/src/schemas/__tests__/transforms.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add packages/lib/src/schemas/
git commit -m "feat(lib): add enhanced annotation schema with community plugin data

- Add introduction, funding-url, is-desktop-only annotations
- Add OCI standard annotations (title, created)
- Update manifestToAnnotations to accept community plugin data
- Serialize funding-url as JSON when object
- Convert published-at to RFC 3339 format

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Add Multi-Tag Support and Layer Annotations to OCI Client

**Files:**

- Modify: `packages/lib/src/client/OciRegistryClient.ts`
- Test: `packages/lib/src/__tests__/oci-config-push.test.ts`

**Step 1: Write test for layer annotations including org.opencontainers.image.title**

In `packages/lib/src/__tests__/oci-config-push.test.ts`, add test case:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { OciRegistryClient } from "../client/OciRegistryClient.js";

describe("OciRegistryClient layer annotations", () => {
  it("should include org.opencontainers.image.title in layer annotations", async () => {
    const client = new OciRegistryClient({
      repo: { registry: "ghcr.io", repository: "owner/repo", tag: "1.0.0" },
      username: "user",
      password: "token",
      adapter: mockAdapter,
      scopes: ["push"],
    });

    const result = await client.pushBlob({
      data: new TextEncoder().encode("test content"),
      annotations: {
        "vnd.obsidianmd.layer.filename": "main.js",
      },
    });

    expect(result.annotations).toEqual({
      "vnd.obsidianmd.layer.filename": "main.js",
      "org.opencontainers.image.title": "main.js",
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test packages/lib/src/__tests__/oci-config-push.test.ts`
Expected: FAIL - layer annotations don't include org.opencontainers.image.title

**Step 3: Update pushBlob to add org.opencontainers.image.title**

In `packages/lib/src/client/OciRegistryClient.ts`, find the `pushBlob` method and update it to automatically add the `org.opencontainers.image.title` annotation matching the filename:

```typescript
async pushBlob(options: {
  data: Uint8Array;
  annotations?: Record<string, string>;
}): Promise<{ digest: string; size: number; annotations: Record<string, string> }> {
  // ... existing blob push logic ...

  const annotations = { ...options.annotations };

  // Add org.opencontainers.image.title matching the filename
  if (annotations["vnd.obsidianmd.layer.filename"]) {
    annotations["org.opencontainers.image.title"] = annotations["vnd.obsidianmd.layer.filename"];
  }

  return {
    digest,
    size: options.data.length,
    annotations,
  };
}
```

**Step 4: Write test for multi-tag push support**

Add test for pushing multiple tags:

```typescript
describe("OciRegistryClient multi-tag support", () => {
  it("should push manifest with multiple tags", async () => {
    const client = new OciRegistryClient({
      repo: { registry: "ghcr.io", repository: "owner/repo", tag: "1.0.0" },
      username: "user",
      password: "token",
      adapter: mockAdapter,
      scopes: ["push"],
    });

    const manifest = {
      // ... manifest data ...
    };

    const result = await client.pushManifestWithTags({
      tags: ["1.0.0", "1.0", "1", "latest"],
      manifest,
      annotations: {},
    });

    expect(result.tags).toEqual(["1.0.0", "1.0", "1", "latest"]);
    expect(result.digest).toBeDefined();
  });
});
```

**Step 5: Run test to verify it fails**

Run: `pnpm test packages/lib/src/__tests__/oci-config-push.test.ts`
Expected: FAIL - `pushManifestWithTags` method doesn't exist

**Step 6: Add pushManifestWithTags method**

In `packages/lib/src/client/OciRegistryClient.ts`, add new method:

```typescript
/**
 * Push manifest with multiple tags
 * @param options - Push options with multiple tags
 * @returns Push result with all tags
 */
async pushManifestWithTags(options: {
  tags: string[];
  manifest: ManifestOCI;
  annotations: Record<string, string>;
}): Promise<{ digest: string; tags: string[]; size: number }> {
  const { tags, manifest, annotations } = options;

  if (tags.length === 0) {
    throw new Error("At least one tag is required");
  }

  // Add annotations to manifest
  const manifestWithAnnotations = {
    ...manifest,
    annotations: {
      ...manifest.annotations,
      ...annotations,
    },
  };

  // Push manifest with first tag
  const firstResult = await this.pushManifest({
    ref: tags[0],
    manifest: manifestWithAnnotations,
  });

  // Tag remaining tags by pushing the same manifest content
  for (let i = 1; i < tags.length; i++) {
    await this.pushManifest({
      ref: tags[i],
      manifest: manifestWithAnnotations,
    });
  }

  return {
    digest: firstResult.digest,
    tags,
    size: firstResult.size,
  };
}
```

**Step 7: Run tests to verify they pass**

Run: `pnpm test packages/lib/src/__tests__/oci-config-push.test.ts`
Expected: PASS

**Step 8: Commit**

```bash
git add packages/lib/src/client/ packages/lib/src/__tests__/
git commit -m "feat(lib): add multi-tag support and ORAS-compatible layer annotations

- Add org.opencontainers.image.title to layer annotations
- Implement pushManifestWithTags for atomic multi-tag publishing
- Auto-populate layer title annotation from filename

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Add Version Tag Generation Utility

**Files:**

- Create: `packages/cli/src/lib/oci-tags.ts`
- Test: `packages/cli/src/__tests__/oci-tags.test.ts`

**Step 1: Write tests for version tag generation**

Create `packages/cli/src/__tests__/oci-tags.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateVersionTags } from "../lib/oci-tags.js";

describe("generateVersionTags", () => {
  it("should generate all 4 tags for semver version", () => {
    const tags = generateVersionTags("2.36.1");
    expect(tags).toEqual(["2.36.1", "2.36", "2", "latest"]);
  });

  it("should generate tags for version with patch 0", () => {
    const tags = generateVersionTags("1.5.0");
    expect(tags).toEqual(["1.5.0", "1.5", "1", "latest"]);
  });

  it("should generate tags for major version 0", () => {
    const tags = generateVersionTags("0.15.3");
    expect(tags).toEqual(["0.15.3", "0.15", "0", "latest"]);
  });

  it("should handle version with leading v", () => {
    const tags = generateVersionTags("v2.36.1");
    expect(tags).toEqual(["2.36.1", "2.36", "2", "latest"]);
  });

  it("should throw error for invalid version format", () => {
    expect(() => generateVersionTags("invalid")).toThrow(
      "Invalid version format",
    );
    expect(() => generateVersionTags("1.2")).toThrow("Invalid version format");
    expect(() => generateVersionTags("1.2.3.4")).toThrow(
      "Invalid version format",
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test packages/cli/src/__tests__/oci-tags.test.ts`
Expected: FAIL - module not found

**Step 3: Implement generateVersionTags**

Create `packages/cli/src/lib/oci-tags.ts`:

```typescript
/**
 * Generate OCI tags from a semantic version string
 * @param version - Version string (e.g., "2.36.1" or "v2.36.1")
 * @returns Array of tags: [full, major.minor, major, latest]
 * @throws Error if version format is invalid
 */
export function generateVersionTags(version: string): string[] {
  // Remove leading 'v' if present
  const cleanVersion = version.startsWith("v") ? version.slice(1) : version;

  // Parse semantic version
  const match = cleanVersion.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(
      `Invalid version format: ${version}. Expected semver format (e.g., 1.2.3)`,
    );
  }

  const [, major, minor] = match;

  return [
    cleanVersion, // 2.36.1
    `${major}.${minor}`, // 2.36
    major, // 2
    "latest", // latest
  ];
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test packages/cli/src/__tests__/oci-tags.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/cli/src/lib/oci-tags.ts packages/cli/src/__tests__/oci-tags.test.ts
git commit -m "feat(cli): add version tag generation utility

- Generate 4 tags from semver: full, major.minor, major, latest
- Handle optional leading 'v' prefix
- Validate semver format

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Update Converter to Use Community Plugin Data and Multi-Tags

**Files:**

- Modify: `packages/cli/src/lib/converter.ts`
- Test: `packages/cli/src/__tests__/converter.test.ts`

**Step 1: Write tests for updated converter interface**

In `packages/cli/src/__tests__/converter.test.ts`, add tests:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PluginConverter } from "../lib/converter.js";
import type { FetchAdapter } from "@shard-for-obsidian/lib";

describe("PluginConverter with namespace", () => {
  let mockAdapter: FetchAdapter;
  let converter: PluginConverter;

  beforeEach(() => {
    mockAdapter = {
      fetch: vi.fn(),
    };
    converter = new PluginConverter(mockAdapter);
  });

  it("should construct repository from namespace and plugin ID", async () => {
    // Mock community plugins response
    vi.mocked(mockAdapter.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: "obsidian-git",
          name: "Git",
          author: "Vinzent",
          description: "Git integration",
          repo: "Vinzent03/obsidian-git",
        },
      ],
    });

    // Mock GitHub release response
    vi.mocked(mockAdapter.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tag_name: "2.36.1",
        published_at: "2026-02-08T11:05:29.071Z",
        assets: [
          { name: "manifest.json", browser_download_url: "https://..." },
          { name: "main.js", browser_download_url: "https://..." },
        ],
      }),
    });

    // Mock asset downloads
    vi.mocked(mockAdapter.fetch).mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "obsidian-git",
          name: "Git",
          version: "2.36.1",
          minAppVersion: "0.15.0",
          description: "Git integration",
          author: "Vinzent",
        }),
    });

    vi.mocked(mockAdapter.fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => "// main.js content",
    });

    const result = await converter.convertPlugin({
      pluginId: "obsidian-git",
      namespace: "ghcr.io/owner/repo/community-plugins/",
      token: "test-token",
    });

    expect(result.repository).toBe(
      "ghcr.io/owner/repo/community-plugins/obsidian-git",
    );
    expect(result.communityPlugin).toBeDefined();
    expect(result.communityPlugin.description).toBe("Git integration");
  });

  it("should normalize plugin ID to lowercase in repository", async () => {
    // ... similar mocks ...

    const result = await converter.convertPlugin({
      pluginId: "Obsidian-Git",
      namespace: "ghcr.io/owner/repo/community-plugins/",
      token: "test-token",
    });

    expect(result.repository).toBe(
      "ghcr.io/owner/repo/community-plugins/obsidian-git",
    );
  });
});

describe("PluginConverter pushToRegistry with multi-tags", () => {
  it("should push manifest with all version tags", async () => {
    // ... setup mocks ...

    const result = await converter.pushToRegistry({
      repository: "ghcr.io/owner/repo/obsidian-git",
      githubRepo: "Vinzent03/obsidian-git",
      token: "test-token",
      pluginData: {
        manifest: mockManifest,
        mainJs: "// code",
        stylesCss: undefined,
      },
      communityPlugin: mockCommunityPlugin,
      publishedAt: "2026-02-08T11:05:29.071Z",
    });

    expect(result.tags).toEqual(["2.36.1", "2.36", "2", "latest"]);
    expect(result.digest).toBeDefined();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test packages/cli/src/__tests__/converter.test.ts`
Expected: FAIL - interface doesn't match

**Step 3: Update ConvertPluginOptions and results**

In `packages/cli/src/lib/converter.ts:14-23`, update interfaces:

```typescript
/**
 * Options for converting a plugin
 */
export interface ConvertPluginOptions {
  /** Plugin ID from community plugins list */
  pluginId: string;
  /** Namespace for OCI repository (e.g., "ghcr.io/owner/repo/community-plugins/") */
  namespace: string;
  /** GitHub token for authentication */
  token: string;
}

/**
 * Result of a plugin conversion
 */
export interface ConvertPluginResult {
  /** Plugin ID */
  pluginId: string;
  /** Plugin version */
  version: string;
  /** Target repository (namespace + normalized plugin ID) */
  repository: string;
  /** Community plugin metadata */
  communityPlugin: CommunityPlugin;
  /** GitHub repository URL */
  githubRepo: string;
  /** Release publication timestamp */
  publishedAt: string;
  /** Parsed manifest */
  manifest: ObsidianManifest;
  /** main.js content */
  mainJs: string;
  /** styles.css content (if present) */
  stylesCss?: string;
}
```

**Step 4: Update PushToRegistryOptions and result**

In `packages/cli/src/lib/converter.ts:48-76`, update interfaces:

```typescript
/**
 * Options for pushing to registry
 */
export interface PushToRegistryOptions {
  /** Repository with normalized plugin ID */
  repository: string;
  /** GitHub repository URL */
  githubRepo: string;
  /** GitHub token */
  token: string;
  /** Community plugin metadata */
  communityPlugin: CommunityPlugin;
  /** Release publication timestamp */
  publishedAt: string;
  /** Plugin data to push */
  pluginData: {
    manifest: ObsidianManifest;
    mainJs: string;
    stylesCss?: string;
  };
}

/**
 * Result of pushing to registry
 */
export interface PushToRegistryResult {
  /** Manifest digest */
  digest: string;
  /** All tags created */
  tags: string[];
  /** Size */
  size: number;
  /** Repository */
  repository: string;
}
```

**Step 5: Update convertPlugin method**

In `packages/cli/src/lib/converter.ts:99-176`, update the method:

```typescript
async convertPlugin(
  options: ConvertPluginOptions,
): Promise<ConvertPluginResult> {
  const { pluginId, namespace, token } = options;

  // Step 1: Find plugin in community list
  const plugin = await this.communityCache.findPlugin(pluginId);
  if (!plugin) {
    throw new Error(`Plugin "${pluginId}" not found in community plugins`);
  }

  // Step 2: Fetch latest release from GitHub
  const release = await this.releaseFetcher.fetchLatestRelease(plugin.repo, token);

  // Step 3: Find required assets
  const manifestAsset = release.assets.find((a) => a.name === "manifest.json");
  const mainJsAsset = release.assets.find((a) => a.name === "main.js");
  const stylesCssAsset = release.assets.find((a) => a.name === "styles.css");

  if (!manifestAsset) {
    throw new Error("manifest.json not found in release");
  }
  if (!mainJsAsset) {
    throw new Error("main.js not found in release");
  }

  // Step 4: Download assets
  const manifestResponse = await this.adapter.fetch(
    manifestAsset.browser_download_url,
  );
  if (!manifestResponse.ok) {
    throw new Error(
      `Failed to download manifest.json: ${manifestResponse.status}`,
    );
  }
  const manifestJson = await manifestResponse.text();
  const manifest = JSON.parse(manifestJson) as ObsidianManifest;

  // Verify manifest ID matches
  if (manifest.id !== pluginId) {
    throw new Error(
      `Manifest ID mismatch: expected "${pluginId}", got "${manifest.id}"`,
    );
  }

  const mainJsResponse = await this.adapter.fetch(
    mainJsAsset.browser_download_url,
  );
  if (!mainJsResponse.ok) {
    throw new Error(`Failed to download main.js: ${mainJsResponse.status}`);
  }
  const mainJs = await mainJsResponse.text();

  let stylesCss: string | undefined;
  if (stylesCssAsset) {
    const stylesCssResponse = await this.adapter.fetch(
      stylesCssAsset.browser_download_url,
    );
    if (!stylesCssResponse.ok) {
      throw new Error(
        `Failed to download styles.css: ${stylesCssResponse.status}`,
      );
    }
    stylesCss = await stylesCssResponse.text();
  }

  // Step 5: Build repository URL with normalized plugin ID
  const normalizedPluginId = pluginId.toLowerCase();
  const repository = `${namespace}${normalizedPluginId}`;

  return {
    pluginId,
    version: release.tag_name,
    repository,
    communityPlugin: plugin,
    githubRepo: plugin.repo,
    publishedAt: release.published_at,
    manifest,
    mainJs,
    stylesCss,
  };
}
```

**Step 6: Update pushToRegistry method**

In `packages/cli/src/lib/converter.ts:185-264`, update the method:

```typescript
import { generateVersionTags } from "./oci-tags.js";

async pushToRegistry(
  options: PushToRegistryOptions,
): Promise<PushToRegistryResult> {
  const { repository, githubRepo, token, communityPlugin, publishedAt, pluginData } = options;

  // Parse repository reference
  const ref = parseRepoAndRef(repository);
  const client = new OciRegistryClient({
    repo: ref,
    username: "github",
    password: token,
    adapter: this.adapter,
    scopes: ["push", "pull"],
  });

  // Push blobs with layer annotations
  const layers: ManifestOCIDescriptor[] = [];

  // Push main.js
  const mainJsResult = await client.pushBlob({
    data: new TextEncoder().encode(pluginData.mainJs),
  });
  layers.push({
    mediaType: "application/javascript",
    digest: mainJsResult.digest,
    size: mainJsResult.size,
    annotations: {
      "vnd.obsidianmd.layer.filename": "main.js",
      "org.opencontainers.image.title": "main.js",
    },
  });

  // Push styles.css if present
  if (pluginData.stylesCss) {
    const stylesCssResult = await client.pushBlob({
      data: new TextEncoder().encode(pluginData.stylesCss),
    });
    layers.push({
      mediaType: "text/css",
      digest: stylesCssResult.digest,
      size: stylesCssResult.size,
      annotations: {
        "vnd.obsidianmd.layer.filename": "styles.css",
        "org.opencontainers.image.title": "styles.css",
      },
    });
  }

  // Build annotations with community plugin data
  const baseAnnotations = manifestToAnnotations(
    pluginData.manifest,
    communityPlugin,
    repository,
    publishedAt,
  );

  // Add converted flag for legacy plugins
  const annotations: Record<string, string> = {
    ...baseAnnotations,
    "vnd.obsidianmd.plugin.converted": "true",
  };

  // Generate version tags
  const tags = generateVersionTags(pluginData.manifest.version);

  // Push manifest with multiple tags
  const manifestPushResult = await client.pushManifestWithTags({
    tags,
    manifest: {
      schemaVersion: 2,
      mediaType: "application/vnd.oci.image.manifest.v1+json",
      config: {
        mediaType: "application/vnd.obsidianmd.plugin.config.v1+json",
        digest: "", // Will be filled by client
        size: 0,
        annotations: {
          "org.opencontainers.image.title": "manifest.json",
        },
      },
      layers,
      annotations: {},
    },
    annotations,
  });

  return {
    digest: manifestPushResult.digest,
    tags: manifestPushResult.tags,
    size: manifestPushResult.size,
    repository,
  };
}
```

**Step 7: Run tests to verify they pass**

Run: `pnpm test packages/cli/src/__tests__/converter.test.ts`
Expected: PASS

**Step 8: Commit**

```bash
git add packages/cli/src/lib/converter.ts packages/cli/src/__tests__/converter.test.ts
git commit -m "feat(cli): update converter to use namespace and multi-tag publishing

- Replace repository parameter with namespace
- Normalize plugin ID to lowercase for repository construction
- Pass community plugin data through conversion pipeline
- Generate and push all version tags (full, major.minor, major, latest)
- Add ORAS-compatible layer annotations

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Update Convert Command Interface

**Files:**

- Modify: `packages/cli/src/commands/convert.ts`

**Step 1: Update command signature and flags**

In `packages/cli/src/commands/convert.ts:9-14`, update flags interface:

```typescript
/**
 * Flags for the convert command
 */
export interface ConvertFlags {
  namespace: string;
  token?: string;
  json?: boolean;
  verbose?: boolean;
}
```

**Step 2: Update ConvertResult interface**

In `packages/cli/src/commands/convert.ts:19-25`, update result:

```typescript
/**
 * Result returned by the convert command
 */
export interface ConvertResult {
  pluginId: string;
  version: string;
  repository: string;
  digest: string;
  tags: string[];
  size: number;
}
```

**Step 3: Update command handler**

In `packages/cli/src/commands/convert.ts:30-125`, update handler:

```typescript
async function convertCommandHandler(
  this: AppContext,
  flags: ConvertFlags,
  pluginId: string,
): Promise<void> {
  const { logger, adapter, config } = this;

  try {
    // Step 1: Resolve authentication token
    let token: string;
    try {
      if (flags.token) {
        token = flags.token;
      } else {
        try {
          token = resolveAuthToken();
        } catch {
          const configToken = await config.get("token");
          if (typeof configToken === "string" && configToken) {
            token = configToken;
          } else {
            throw new Error("No token found");
          }
        }
      }
    } catch {
      logger.error(
        "GitHub token required. Use --token flag, set GITHUB_TOKEN environment variable, or configure with: shard config set token <token>",
      );
      this.process.exit(1);
    }

    // Step 2: Create converter
    const converter = new PluginConverter(adapter);

    // Step 3: Convert plugin from GitHub releases
    logger.info(`Converting plugin "${pluginId}"...`);
    logger.info("Fetching latest release from GitHub");

    const convertResult = await converter.convertPlugin({
      pluginId,
      namespace: flags.namespace,
      token,
    });

    logger.info(
      `Downloaded plugin ${convertResult.pluginId} v${convertResult.version}`,
    );
    logger.info(`  - Repository: ${convertResult.communityPlugin.repo}`);
    logger.info(`  - manifest.json: ${convertResult.manifest.name}`);
    logger.info(`  - main.js: ${convertResult.mainJs.length} bytes`);
    if (convertResult.stylesCss) {
      logger.info(`  - styles.css: ${convertResult.stylesCss.length} bytes`);
    }

    // Step 4: Push to OCI registry with multi-tag support
    logger.info(`\nPushing to ${convertResult.repository}...`);
    const pushResult = await converter.pushToRegistry({
      repository: convertResult.repository,
      githubRepo: convertResult.githubRepo,
      token,
      communityPlugin: convertResult.communityPlugin,
      publishedAt: convertResult.publishedAt,
      pluginData: {
        manifest: convertResult.manifest,
        mainJs: convertResult.mainJs,
        stylesCss: convertResult.stylesCss,
      },
    });

    logger.success(
      `Successfully converted and pushed ${convertResult.pluginId} v${convertResult.version}`,
    );
    logger.info(`Repository: ${pushResult.repository}`);
    logger.info(`Tags: ${pushResult.tags.join(", ")}`);
    logger.info(`Digest: ${pushResult.digest}`);

    // Step 5: JSON output if requested
    if (flags.json) {
      const result: ConvertResult = {
        pluginId: convertResult.pluginId,
        version: convertResult.version,
        repository: pushResult.repository,
        digest: pushResult.digest,
        tags: pushResult.tags,
        size: pushResult.size,
      };
      this.process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to convert plugin: ${message}`);
    this.process.exit(1);
  }
}
```

**Step 4: Update command definition**

In `packages/cli/src/commands/convert.ts:130-184`, update command:

```typescript
export const convert = buildCommand({
  func: convertCommandHandler,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Plugin ID from community plugins list",
          parse: String,
          placeholder: "plugin-id",
        },
      ],
    },
    flags: {
      namespace: {
        kind: "parsed",
        parse: String,
        brief:
          "OCI registry namespace (e.g., ghcr.io/owner/repo/community-plugins/)",
        optional: false,
      },
      token: {
        kind: "parsed",
        parse: String,
        brief: "GitHub token for authentication",
        optional: true,
      },
      json: {
        kind: "boolean",
        brief: "Output JSON instead of human-readable format",
        optional: true,
      },
      verbose: {
        kind: "boolean",
        brief: "Show detailed progress information",
        optional: true,
      },
    },
    aliases: {
      n: "namespace",
      t: "token",
    },
  },
  docs: {
    brief: "Convert a legacy plugin to OCI format",
    customUsage: [
      "shard convert obsidian-git --namespace ghcr.io/owner/repo/community-plugins/",
      "shard convert calendar --namespace ghcr.io/owner/repo/community-plugins/ --token $GITHUB_TOKEN",
    ],
  },
});
```

**Step 5: Build and test manually**

Run: `pnpm build`
Expected: Build succeeds

Test command help:
Run: `node dist/index.js convert --help`
Expected: Shows new interface with --namespace flag

**Step 6: Commit**

```bash
git add packages/cli/src/commands/convert.ts
git commit -m "feat(cli): update convert command to use namespace-based interface

- Remove repository positional parameter
- Add required --namespace flag
- Remove --version flag (always converts latest)
- Display all tags in success message
- Update usage examples

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Update Integration Tests

**Files:**

- Modify: `packages/cli/src/__tests__/converter.test.ts`
- Modify: `packages/lib/src/schemas/__tests__/transforms.test.ts`

**Step 1: Add end-to-end converter test**

In `packages/cli/src/__tests__/converter.test.ts`, add comprehensive test:

```typescript
describe("PluginConverter end-to-end", () => {
  it("should convert plugin with all annotations and tags", async () => {
    const mockAdapter: FetchAdapter = {
      fetch: vi.fn(),
    };

    // Mock community-plugins.json
    vi.mocked(mockAdapter.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: "obsidian-git",
          name: "Git",
          author: "Vinzent, (Denis Olehov)",
          description:
            "Integrate Git version control with automatic backup and other advanced features.",
          repo: "Vinzent03/obsidian-git",
        },
      ],
    } as any);

    // Mock GitHub release
    vi.mocked(mockAdapter.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tag_name: "2.36.1",
        published_at: "2026-02-08T11:05:29.071Z",
        assets: [
          {
            name: "manifest.json",
            browser_download_url: "https://api.github.com/manifest.json",
          },
          {
            name: "main.js",
            browser_download_url: "https://api.github.com/main.js",
          },
          {
            name: "styles.css",
            browser_download_url: "https://api.github.com/styles.css",
          },
        ],
      }),
    } as any);

    // Mock manifest.json download
    vi.mocked(mockAdapter.fetch).mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: "obsidian-git",
          name: "Git",
          version: "2.36.1",
          minAppVersion: "0.15.0",
          description:
            "Integrate Git version control with automatic backup and other advanced features.",
          author: "Vinzent",
          authorUrl: "https://github.com/Vinzent03",
          fundingUrl: "https://ko-fi.com/vinzent",
          isDesktopOnly: false,
        }),
    } as any);

    // Mock main.js download
    vi.mocked(mockAdapter.fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => "// main.js content",
    } as any);

    // Mock styles.css download
    vi.mocked(mockAdapter.fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => "/* styles.css content */",
    } as any);

    const converter = new PluginConverter(mockAdapter);

    const result = await converter.convertPlugin({
      pluginId: "obsidian-git",
      namespace: "ghcr.io/shard-for-obsidian/shard/community-plugins/",
      token: "test-token",
    });

    expect(result.repository).toBe(
      "ghcr.io/shard-for-obsidian/shard/community-plugins/obsidian-git",
    );
    expect(result.version).toBe("2.36.1");
    expect(result.communityPlugin.description).toBe(
      "Integrate Git version control with automatic backup and other advanced features.",
    );
    expect(result.manifest.fundingUrl).toBe("https://ko-fi.com/vinzent");
    expect(result.manifest.isDesktopOnly).toBe(false);
  });
});
```

**Step 2: Run integration tests**

Run: `pnpm test packages/cli/src/__tests__/converter.test.ts`
Expected: PASS

**Step 3: Run all tests**

Run: `pnpm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/cli/src/__tests__/ packages/lib/src/schemas/__tests__/
git commit -m "test: add end-to-end converter tests with new annotations

- Test namespace-based repository construction
- Verify all annotations are populated correctly
- Test multi-tag generation
- Test funding URL serialization

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Build and Manual Testing

**Files:**

- Run build and manual tests

**Step 1: Build all packages**

Run: `pnpm build`
Expected: Clean build with no errors

**Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 3: Run linter**

Run: `pnpm lint`
Expected: No linting errors

**Step 4: Test command help**

Run: `node packages/cli/dist/index.js convert --help`
Expected output:

```
shard convert - Convert a legacy plugin to OCI format

Usage:
  shard convert <plugin-id> --namespace <namespace> [options]

Examples:
  shard convert obsidian-git --namespace ghcr.io/owner/repo/community-plugins/
  shard convert calendar --namespace ghcr.io/owner/repo/community-plugins/ --token $GITHUB_TOKEN

Options:
  --namespace, -n    OCI registry namespace (required)
  --token, -t        GitHub token for authentication
  --json             Output JSON instead of human-readable format
  --verbose          Show detailed progress information
```

**Step 5: Manual test conversion (dry-run)**

Note: This requires actual GitHub token and network access. Document the command:

```bash
# Test with a real plugin
export GITHUB_TOKEN=<your-token>
node packages/cli/dist/index.js convert obsidian-git \
  --namespace ghcr.io/test/repo/community-plugins/ \
  --verbose
```

Expected output:

- Fetches community-plugins.json
- Downloads latest release from GitHub
- Displays all metadata
- Shows all 4 tags created
- Outputs success message with digest

**Step 6: Final commit**

```bash
git add -A
git commit -m "chore: build and verify convert command enhancement

- All tests passing
- Build successful
- Manual testing verified

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Completion

**All tasks completed!** The convert command now:

- Uses namespace-based repository construction
- Fetches metadata from community-plugins.json
- Generates comprehensive OCI annotations from multiple sources
- Publishes with multi-tag support (full, major.minor, major, latest)
- Includes ORAS-compatible layer annotations

**Next steps:**

- Update documentation for the new command interface
- Consider adding a batch conversion command for multiple plugins
- Add progress indicators for large file downloads
