# Marketplace & Legacy Plugin Converter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build GitHub-hosted community marketplace and legacy Obsidian plugin converter with OCI manifest format changes.

**Architecture:** Modify OCI format to store manifest.json as config blob. Add CLI commands for converting legacy plugins and generating marketplace listings. Create marketplace repo structure with GitHub Actions. Update installer to consume marketplace.

**Tech Stack:** TypeScript, Node.js, OCI/GHCR, GitHub Actions, vitest

---

## Phase 1: OCI Format Changes

### Task 1: Update shard-lib types for config-based manifest

**Files:**
- Modify: `packages/shard-lib/src/types/ManifestTypes.ts`
- Test: `packages/shard-lib/src/__tests__/manifest-config.test.ts`

**Step 1: Write failing test for manifest config structure**

Create test file:
```typescript
// packages/shard-lib/src/__tests__/manifest-config.test.ts
import { describe, it, expect } from 'vitest';
import type { ObsidianManifest } from '../types/ManifestTypes.js';

describe('Obsidian Manifest as OCI Config', () => {
  it('should define ObsidianManifest type with required fields', () => {
    const manifest: ObsidianManifest = {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      minAppVersion: '0.15.0',
      description: 'A test plugin',
      author: 'Test Author',
    };

    expect(manifest.id).toBe('test-plugin');
    expect(manifest.version).toBe('1.0.0');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shard-lib && pnpm test manifest-config`
Expected: FAIL with "Cannot find module '../types/ManifestTypes.js'"

**Step 3: Add ObsidianManifest type to ManifestTypes**

```typescript
// packages/shard-lib/src/types/ManifestTypes.ts
// Add to existing file

/**
 * Obsidian plugin manifest structure
 * Stored in OCI image config field
 */
export interface ObsidianManifest {
  /** Plugin ID */
  id: string;
  /** Display name */
  name: string;
  /** Plugin version */
  version: string;
  /** Minimum Obsidian version required */
  minAppVersion: string;
  /** Plugin description */
  description: string;
  /** Plugin author */
  author: string;
  /** Author URL (optional) */
  authorUrl?: string;
  /** Is desktop only? (optional) */
  isDesktopOnly?: boolean;
  /** Funding URLs (optional) */
  fundingUrl?: string | { [key: string]: string };
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/shard-lib && pnpm test manifest-config`
Expected: PASS (1 test)

**Step 5: Commit**

```bash
git add packages/shard-lib/src/types/ManifestTypes.ts packages/shard-lib/src/__tests__/manifest-config.test.ts
git commit -m "feat(lib): add ObsidianManifest type for OCI config"
```

---

### Task 2: Update OciRegistryClient.pushManifest to support config as manifest

**Files:**
- Modify: `packages/shard-lib/src/client/OciRegistryClient.ts`
- Test: `packages/shard-lib/src/__tests__/oci-config-push.test.ts`

**Step 1: Write failing test for pushManifest with config**

```typescript
// packages/shard-lib/src/__tests__/oci-config-push.test.ts
import { describe, it, expect, vi } from 'vitest';
import { OciRegistryClient } from '../client/OciRegistryClient.js';
import type { FetchAdapter } from '../client/FetchAdapter.js';

describe('OciRegistryClient config-based manifest', () => {
  it('should push manifest with Obsidian manifest as config', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Map([
        ['location', '/v2/test/repo/manifests/sha256:abc123']
      ]),
      json: async () => ({}),
      text: async () => '',
    });

    const adapter: FetchAdapter = { fetch: mockFetch };
    const client = new OciRegistryClient({
      repo: { registry: 'ghcr.io', repository: 'test/repo', tag: '1.0.0' },
      username: 'test',
      password: 'token',
      adapter,
      scopes: ['push'],
    });

    const pluginManifest = {
      id: 'test-plugin',
      name: 'Test',
      version: '1.0.0',
      minAppVersion: '0.15.0',
      description: 'Test',
      author: 'Test',
    };

    // This should fail - method doesn't exist yet
    await expect(
      client.pushPluginManifest({
        ref: '1.0.0',
        pluginManifest,
        layers: [],
      })
    ).rejects.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shard-lib && pnpm test oci-config-push`
Expected: FAIL with "pushPluginManifest is not a function"

**Step 3: Add pushPluginManifest method**

Add to `packages/shard-lib/src/client/OciRegistryClient.ts`:

```typescript
import type { ObsidianManifest } from '../types/ManifestTypes.js';

// Add interface for push options
export interface PushPluginManifestOptions {
  ref: string;
  pluginManifest: ObsidianManifest;
  layers: ManifestOCIDescriptor[];
  annotations?: { [key: string]: string };
}

// Add method to OciRegistryClient class
async pushPluginManifest(opts: PushPluginManifestOptions): Promise<{ digest: string; size: number }> {
  const { ref, pluginManifest, layers, annotations } = opts;

  // Push plugin manifest as config blob
  const configContent = new TextEncoder().encode(JSON.stringify(pluginManifest));
  const configResult = await this.pushBlob({ data: configContent });

  // Build OCI manifest
  const manifest: ManifestOCI = {
    schemaVersion: 2,
    mediaType: 'application/vnd.oci.image.manifest.v1+json',
    artifactType: 'application/vnd.obsidian.plugin.v1+json',
    config: {
      mediaType: 'application/vnd.obsidian.plugin.manifest.v1+json',
      digest: configResult.digest,
      size: configResult.size,
    },
    layers,
    annotations: {
      'org.opencontainers.image.created': new Date().toISOString(),
      ...annotations,
    },
  };

  // Push OCI manifest
  return await this.pushManifest({
    ref,
    manifest,
    mediaType: 'application/vnd.oci.image.manifest.v1+json',
  });
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/shard-lib && pnpm test oci-config-push`
Expected: PASS (1 test)

**Step 5: Commit**

```bash
git add packages/shard-lib/src/client/OciRegistryClient.ts packages/shard-lib/src/__tests__/oci-config-push.test.ts
git commit -m "feat(lib): add pushPluginManifest with config-based manifest"
```

---

### Task 3: Update OciRegistryClient.pullManifest to extract config

**Files:**
- Modify: `packages/shard-lib/src/client/OciRegistryClient.ts`
- Test: `packages/shard-lib/src/__tests__/oci-config-pull.test.ts`

**Step 1: Write failing test for pulling config**

```typescript
// packages/shard-lib/src/__tests__/oci-config-pull.test.ts
import { describe, it, expect, vi } from 'vitest';
import { OciRegistryClient } from '../client/OciRegistryClient.js';
import type { FetchAdapter } from '../client/FetchAdapter.js';

describe('OciRegistryClient pull config', () => {
  it('should pull and parse Obsidian manifest from config', async () => {
    const pluginManifest = {
      id: 'test-plugin',
      name: 'Test',
      version: '1.0.0',
      minAppVersion: '0.15.0',
      description: 'Test',
      author: 'Test',
    };

    const configBlob = new TextEncoder().encode(JSON.stringify(pluginManifest));

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: async () => ({
          schemaVersion: 2,
          config: {
            digest: 'sha256:config123',
            size: configBlob.byteLength,
          },
          layers: [],
        }),
        arrayBuffer: async () => new ArrayBuffer(0),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        arrayBuffer: async () => configBlob.buffer,
      });

    const adapter: FetchAdapter = { fetch: mockFetch };
    const client = new OciRegistryClient({
      repo: { registry: 'ghcr.io', repository: 'test/repo', tag: '1.0.0' },
      username: 'test',
      password: 'token',
      adapter,
      scopes: ['pull'],
    });

    const result = await client.pullPluginManifest({ ref: '1.0.0' });

    expect(result.pluginManifest.id).toBe('test-plugin');
    expect(result.pluginManifest.version).toBe('1.0.0');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shard-lib && pnpm test oci-config-pull`
Expected: FAIL with "pullPluginManifest is not a function"

**Step 3: Add pullPluginManifest method**

Add to `packages/shard-lib/src/client/OciRegistryClient.ts`:

```typescript
export interface PullPluginManifestResult {
  pluginManifest: ObsidianManifest;
  layers: ManifestOCIDescriptor[];
  ociManifest: ManifestOCI;
}

async pullPluginManifest(opts: { ref: string }): Promise<PullPluginManifestResult> {
  // Pull OCI manifest
  const ociManifest = await this.pullManifest({ ref: opts.ref });

  // Pull config blob (contains plugin manifest)
  const configBlob = await this.pullBlob({ digest: ociManifest.config.digest });

  // Parse plugin manifest from config
  const configText = new TextDecoder().decode(configBlob);
  const pluginManifest = JSON.parse(configText) as ObsidianManifest;

  return {
    pluginManifest,
    layers: ociManifest.layers,
    ociManifest,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/shard-lib && pnpm test oci-config-pull`
Expected: PASS (1 test)

**Step 5: Commit**

```bash
git add packages/shard-lib/src/client/OciRegistryClient.ts packages/shard-lib/src/__tests__/oci-config-pull.test.ts
git commit -m "feat(lib): add pullPluginManifest to extract config"
```

---

### Task 4: Update CLI push command to use new format

**Files:**
- Modify: `packages/shard-cli/src/commands/push.ts`

**Step 1: Update push command to use pushPluginManifest**

Replace config blob + manifest push logic with new method:

```typescript
// packages/shard-cli/src/commands/push.ts
// Replace Steps 3-6 with:

// Step 3: Push plugin files as layers
const layers: ManifestOCIDescriptor[] = [];

// Push main.js
logger.log("Pushing main.js...");
const mainJsResult = await client.pushBlob({
  data: plugin.mainJs.content,
});
layers.push({
  mediaType: "application/javascript",
  digest: mainJsResult.digest,
  size: mainJsResult.size,
  annotations: {
    "org.opencontainers.image.title": "main.js",
  },
});
logger.log(
  `Pushed main.js: ${mainJsResult.digest.slice(0, 19)}... (${mainJsResult.size} bytes)`,
);

// Push styles.css if present
if (plugin.stylesCss) {
  logger.log("Pushing styles.css...");
  const stylesCssResult = await client.pushBlob({
    data: plugin.stylesCss.content,
  });
  layers.push({
    mediaType: "text/css",
    digest: stylesCssResult.digest,
    size: stylesCssResult.size,
    annotations: {
      "org.opencontainers.image.title": "styles.css",
    },
  });
  logger.log(
    `Pushed styles.css: ${stylesCssResult.digest.slice(0, 19)}... (${stylesCssResult.size} bytes)`,
  );
}

// Step 4: Push manifest with plugin manifest as config
logger.log("Pushing manifest...");
const manifestPushResult = await client.pushPluginManifest({
  ref: ref.tag || version,
  pluginManifest: plugin.manifest.parsed,
  layers,
});

logger.success(`Successfully pushed ${fullRef}`);
logger.log(`Manifest digest: ${manifestPushResult.digest}`);
```

**Step 2: Run manual test**

Run: `cd packages/shard-cli && pnpm build && node dist/index.js push --help`
Expected: Help text displays without errors

**Step 3: Commit**

```bash
git add packages/shard-cli/src/commands/push.ts
git commit -m "feat(cli): update push to use config-based manifest"
```

---

### Task 5: Update CLI pull command to use new format

**Files:**
- Modify: `packages/shard-cli/src/commands/pull.ts`

**Step 1: Read current pull command**

Run: `cat packages/shard-cli/src/commands/pull.ts`

**Step 2: Update pull to use pullPluginManifest**

Replace manifest pull logic:

```typescript
// packages/shard-cli/src/commands/pull.ts
// Find and replace the pullManifest section with:

// Pull plugin manifest
logger.log("Pulling manifest...");
const manifestResult = await client.pullPluginManifest({ ref: ref.tag || "latest" });
const { pluginManifest, layers } = manifestResult;

logger.log(`Found plugin: ${pluginManifest.name} v${pluginManifest.version}`);

// Pull and extract each layer
for (const layer of layers) {
  const title = layer.annotations?.["org.opencontainers.image.title"];
  if (!title) continue;

  logger.log(`Pulling ${title}...`);
  const blob = await client.pullBlob({ digest: layer.digest });

  const filePath = path.join(outputDir, title);
  await fs.writeFile(filePath, Buffer.from(blob));
  logger.log(`Extracted ${title}`);
}

// Write manifest.json separately from config
const manifestPath = path.join(outputDir, "manifest.json");
await fs.writeFile(manifestPath, JSON.stringify(pluginManifest, null, 2));
logger.log("Extracted manifest.json");
```

**Step 3: Build and test**

Run: `cd packages/shard-cli && pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/shard-cli/src/commands/pull.ts
git commit -m "feat(cli): update pull to use config-based manifest"
```

---

### Task 6: Update installer to use new format

**Files:**
- Modify: `packages/shard-installer/src/installer/installer.ts`

**Step 1: Read current installer**

Run: `cat packages/shard-installer/src/installer/installer.ts | head -100`

**Step 2: Update installer to use pullPluginManifest**

Find the installation logic and update to use new method:

```typescript
// packages/shard-installer/src/installer/installer.ts
// Update the pull/install method to use pullPluginManifest

async installPlugin(reference: string): Promise<void> {
  // ... existing setup ...

  // Pull manifest with config
  const manifestResult = await client.pullPluginManifest({ ref });
  const { pluginManifest, layers } = manifestResult;

  // Extract layers to plugin directory
  const pluginDir = path.join(this.pluginsDir, pluginManifest.id);
  await fs.mkdir(pluginDir, { recursive: true });

  for (const layer of layers) {
    const title = layer.annotations?.["org.opencontainers.image.title"];
    if (!title) continue;

    const blob = await client.pullBlob({ digest: layer.digest });
    const filePath = path.join(pluginDir, title);
    await fs.writeFile(filePath, Buffer.from(blob));
  }

  // Write manifest.json from config
  const manifestPath = path.join(pluginDir, "manifest.json");
  await fs.writeFile(manifestPath, JSON.stringify(pluginManifest, null, 2));

  // ... rest of installation ...
}
```

**Step 3: Build**

Run: `cd packages/shard-installer && pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/shard-installer/src/installer/installer.ts
git commit -m "feat(installer): use config-based manifest format"
```

---

## Phase 2: Legacy Plugin Converter

### Task 7: Create community plugin types

**Files:**
- Create: `packages/shard-cli/src/lib/community-plugins.ts`
- Test: `packages/shard-cli/src/__tests__/community-plugins.test.ts`

**Step 1: Write failing test**

```typescript
// packages/shard-cli/src/__tests__/community-plugins.test.ts
import { describe, it, expect } from 'vitest';
import type { CommunityPlugin } from '../lib/community-plugins.js';

describe('CommunityPlugin types', () => {
  it('should define CommunityPlugin interface', () => {
    const plugin: CommunityPlugin = {
      id: 'test-plugin',
      name: 'Test Plugin',
      author: 'Test Author',
      description: 'A test plugin',
      repo: 'test/test-plugin',
    };

    expect(plugin.id).toBe('test-plugin');
    expect(plugin.repo).toBe('test/test-plugin');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shard-cli && pnpm test community-plugins`
Expected: FAIL with "Cannot find module"

**Step 3: Create types**

```typescript
// packages/shard-cli/src/lib/community-plugins.ts

/**
 * Community plugin entry from Obsidian releases
 */
export interface CommunityPlugin {
  id: string;
  name: string;
  author: string;
  description: string;
  repo: string;
}

/**
 * Community plugins JSON structure
 */
export type CommunityPluginsList = CommunityPlugin[];

/**
 * URL to community plugins JSON
 */
export const COMMUNITY_PLUGINS_URL =
  'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/refs/heads/master/community-plugins.json';
```

**Step 4: Run test to verify it passes**

Run: `cd packages/shard-cli && pnpm test community-plugins`
Expected: PASS (1 test)

**Step 5: Commit**

```bash
git add packages/shard-cli/src/lib/community-plugins.ts packages/shard-cli/src/__tests__/community-plugins.test.ts
git commit -m "feat(cli): add community plugin types"
```

---

### Task 8: Implement community plugins cache

**Files:**
- Create: `packages/shard-cli/src/lib/community-cache.ts`
- Test: `packages/shard-cli/src/__tests__/community-cache.test.ts`

**Step 1: Write failing test**

```typescript
// packages/shard-cli/src/__tests__/community-cache.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CommunityPluginsCache } from '../lib/community-cache.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

describe('CommunityPluginsCache', () => {
  let tempDir: string;
  let cache: CommunityPluginsCache;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shard-test-'));
    cache = new CommunityPluginsCache(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should fetch and cache plugins list', async () => {
    const plugins = await cache.getPluginsList();
    expect(Array.isArray(plugins)).toBe(true);
    expect(plugins.length).toBeGreaterThan(0);
  });

  it('should find plugin by ID', async () => {
    const plugin = await cache.findPlugin('obsidian-git');
    expect(plugin).toBeDefined();
    expect(plugin?.id).toBe('obsidian-git');
    expect(plugin?.repo).toContain('obsidian-git');
  });

  it('should return undefined for unknown plugin', async () => {
    const plugin = await cache.findPlugin('non-existent-plugin-xyz');
    expect(plugin).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shard-cli && pnpm test community-cache`
Expected: FAIL with "Cannot find module"

**Step 3: Implement cache**

```typescript
// packages/shard-cli/src/lib/community-cache.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { COMMUNITY_PLUGINS_URL, type CommunityPlugin } from './community-plugins.js';

export class CommunityPluginsCache {
  private cacheDir: string;
  private cacheFile: string;
  private cacheTTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || path.join(process.env.HOME || '/tmp', '.shard', 'cache');
    this.cacheFile = path.join(this.cacheDir, 'community-plugins.json');
  }

  async getPluginsList(): Promise<CommunityPlugin[]> {
    // Check if cache exists and is fresh
    try {
      const stats = await fs.stat(this.cacheFile);
      const age = Date.now() - stats.mtimeMs;

      if (age < this.cacheTTL) {
        const content = await fs.readFile(this.cacheFile, 'utf-8');
        return JSON.parse(content) as CommunityPlugin[];
      }
    } catch (err) {
      // Cache doesn't exist, continue to fetch
    }

    // Fetch fresh data
    const response = await fetch(COMMUNITY_PLUGINS_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch community plugins: ${response.statusText}`);
    }

    const plugins = (await response.json()) as CommunityPlugin[];

    // Save to cache
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.writeFile(this.cacheFile, JSON.stringify(plugins, null, 2));

    return plugins;
  }

  async findPlugin(id: string): Promise<CommunityPlugin | undefined> {
    const plugins = await this.getPluginsList();
    return plugins.find((p) => p.id === id);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/shard-cli && pnpm test community-cache`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add packages/shard-cli/src/lib/community-cache.ts packages/shard-cli/src/__tests__/community-cache.test.ts
git commit -m "feat(cli): implement community plugins cache"
```

---

### Task 9: Create GitHub release fetcher

**Files:**
- Create: `packages/shard-cli/src/lib/github-release.ts`
- Test: `packages/shard-cli/src/__tests__/github-release.test.ts`

**Step 1: Write failing test**

```typescript
// packages/shard-cli/src/__tests__/github-release.test.ts
import { describe, it, expect } from 'vitest';
import { GitHubReleaseFetcher } from '../lib/github-release.js';

describe('GitHubReleaseFetcher', () => {
  it('should fetch latest release', async () => {
    const fetcher = new GitHubReleaseFetcher('Vinzent03/obsidian-git');
    const release = await fetcher.getLatestRelease();

    expect(release).toBeDefined();
    expect(release.tagName).toBeTruthy();
    expect(release.assets.length).toBeGreaterThan(0);
  });

  it('should fetch specific version', async () => {
    const fetcher = new GitHubReleaseFetcher('Vinzent03/obsidian-git');
    const releases = await fetcher.getReleases();

    expect(releases.length).toBeGreaterThan(0);
    const firstRelease = releases[0];
    expect(firstRelease.tagName).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shard-cli && pnpm test github-release`
Expected: FAIL with "Cannot find module"

**Step 3: Implement fetcher**

```typescript
// packages/shard-cli/src/lib/github-release.ts

export interface GitHubAsset {
  name: string;
  url: string;
  browserDownloadUrl: string;
}

export interface GitHubRelease {
  tagName: string;
  name: string;
  assets: GitHubAsset[];
}

export class GitHubReleaseFetcher {
  private repo: string;
  private baseUrl = 'https://api.github.com';

  constructor(repo: string) {
    this.repo = repo;
  }

  async getReleases(): Promise<GitHubRelease[]> {
    const url = `${this.baseUrl}/repos/${this.repo}/releases`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch releases: ${response.statusText}`);
    }

    const data = await response.json();
    return data.map((release: any) => ({
      tagName: release.tag_name,
      name: release.name,
      assets: release.assets.map((asset: any) => ({
        name: asset.name,
        url: asset.url,
        browserDownloadUrl: asset.browser_download_url,
      })),
    }));
  }

  async getLatestRelease(): Promise<GitHubRelease> {
    const url = `${this.baseUrl}/repos/${this.repo}/releases/latest`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch latest release: ${response.statusText}`);
    }

    const release = await response.json();
    return {
      tagName: release.tag_name,
      name: release.name,
      assets: release.assets.map((asset: any) => ({
        name: asset.name,
        url: asset.url,
        browserDownloadUrl: asset.browser_download_url,
      })),
    };
  }

  async getRelease(version: string): Promise<GitHubRelease | undefined> {
    const releases = await this.getReleases();
    return releases.find((r) => r.tagName === version || r.tagName === `v${version}`);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/shard-cli && pnpm test github-release`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add packages/shard-cli/src/lib/github-release.ts packages/shard-cli/src/__tests__/github-release.test.ts
git commit -m "feat(cli): implement GitHub release fetcher"
```

---

### Task 10: Create plugin converter logic

**Files:**
- Create: `packages/shard-cli/src/lib/converter.ts`
- Test: `packages/shard-cli/src/__tests__/converter.test.ts`

**Step 1: Write failing test**

```typescript
// packages/shard-cli/src/__tests__/converter.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PluginConverter } from '../lib/converter.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

describe('PluginConverter', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shard-converter-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should download and extract plugin assets', async () => {
    const converter = new PluginConverter();
    const result = await converter.convert({
      pluginId: 'obsidian-git',
      version: 'latest',
      outputDir: tempDir,
    });

    expect(result.manifest).toBeDefined();
    expect(result.files.mainJs).toBeDefined();
    expect(result.annotations['org.obsidian.plugin.repo']).toContain('obsidian-git');

    // Verify files exist
    const manifestPath = path.join(tempDir, 'manifest.json');
    const mainJsPath = path.join(tempDir, 'main.js');

    expect(await fs.stat(manifestPath)).toBeDefined();
    expect(await fs.stat(mainJsPath)).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shard-cli && pnpm test converter`
Expected: FAIL with "Cannot find module"

**Step 3: Implement converter**

```typescript
// packages/shard-cli/src/lib/converter.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { CommunityPluginsCache } from './community-cache.js';
import { GitHubReleaseFetcher } from './github-release.js';
import type { ObsidianManifest } from 'shard-lib';

export interface ConvertOptions {
  pluginId: string;
  version?: string;
  outputDir: string;
}

export interface ConvertResult {
  manifest: ObsidianManifest;
  files: {
    mainJs: ArrayBuffer;
    stylesCss?: ArrayBuffer;
  };
  annotations: { [key: string]: string };
}

export class PluginConverter {
  private cache: CommunityPluginsCache;

  constructor() {
    this.cache = new CommunityPluginsCache();
  }

  async convert(opts: ConvertOptions): Promise<ConvertResult> {
    const { pluginId, version = 'latest', outputDir } = opts;

    // Find plugin in community list
    const plugin = await this.cache.findPlugin(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found in community list: ${pluginId}`);
    }

    // Fetch release from GitHub
    const fetcher = new GitHubReleaseFetcher(plugin.repo);
    const release = version === 'latest'
      ? await fetcher.getLatestRelease()
      : await fetcher.getRelease(version);

    if (!release) {
      throw new Error(`Release not found: ${version}`);
    }

    // Download assets to temp directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shard-convert-'));

    try {
      // Download manifest.json
      const manifestAsset = release.assets.find((a) => a.name === 'manifest.json');
      if (!manifestAsset) {
        throw new Error('manifest.json not found in release assets');
      }

      const manifestResponse = await fetch(manifestAsset.browserDownloadUrl);
      const manifestContent = await manifestResponse.arrayBuffer();
      await fs.writeFile(
        path.join(tempDir, 'manifest.json'),
        Buffer.from(manifestContent)
      );

      // Download main.js
      const mainJsAsset = release.assets.find((a) => a.name === 'main.js');
      if (!mainJsAsset) {
        throw new Error('main.js not found in release assets');
      }

      const mainJsResponse = await fetch(mainJsAsset.browserDownloadUrl);
      const mainJsContent = await mainJsResponse.arrayBuffer();
      await fs.writeFile(
        path.join(tempDir, 'main.js'),
        Buffer.from(mainJsContent)
      );

      // Download styles.css (optional)
      let stylesCssContent: ArrayBuffer | undefined;
      const stylesCssAsset = release.assets.find((a) => a.name === 'styles.css');
      if (stylesCssAsset) {
        const stylesCssResponse = await fetch(stylesCssAsset.browserDownloadUrl);
        stylesCssContent = await stylesCssResponse.arrayBuffer();
        await fs.writeFile(
          path.join(tempDir, 'styles.css'),
          Buffer.from(stylesCssContent)
        );
      }

      // Copy to output directory
      await fs.mkdir(outputDir, { recursive: true });
      await fs.cp(tempDir, outputDir, { recursive: true });

      // Parse manifest
      const manifestText = new TextDecoder().decode(manifestContent);
      const manifest = JSON.parse(manifestText) as ObsidianManifest;

      // Build annotations
      const annotations = {
        'org.obsidian.plugin.repo': plugin.repo,
        'org.obsidian.plugin.source': 'community',
      };

      return {
        manifest,
        files: {
          mainJs: mainJsContent,
          stylesCss: stylesCssContent,
        },
        annotations,
      };
    } finally {
      // Clean up temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/shard-cli && pnpm test converter`
Expected: PASS (1 test)

**Step 5: Commit**

```bash
git add packages/shard-cli/src/lib/converter.ts packages/shard-cli/src/__tests__/converter.test.ts
git commit -m "feat(cli): implement plugin converter"
```

---

### Task 11: Add convert command to CLI

**Files:**
- Create: `packages/shard-cli/src/commands/convert.ts`
- Modify: `packages/shard-cli/src/index.ts`

**Step 1: Create convert command**

```typescript
// packages/shard-cli/src/commands/convert.ts
import * as os from 'node:os';
import * as path from 'node:path';
import { PluginConverter } from '../lib/converter.js';
import { OciRegistryClient, parseRepoAndRef } from 'shard-lib';
import type { Logger } from '../lib/logger.js';
import type { FetchAdapter, ManifestOCIDescriptor } from 'shard-lib';
import * as fs from 'node:fs/promises';

export interface ConvertCommandOptions {
  pluginId: string;
  version?: string;
  repository?: string;
  token?: string;
  outputDir?: string;
  logger: Logger;
  adapter: FetchAdapter;
}

export interface ConvertCommandResult {
  pluginId: string;
  version: string;
  repository?: string;
  digest?: string;
}

export async function convertCommand(opts: ConvertCommandOptions): Promise<ConvertCommandResult> {
  const { pluginId, version = 'latest', repository, token, outputDir, logger, adapter } = opts;

  // Convert plugin
  logger.log(`Converting plugin: ${pluginId}...`);
  const tempDir = outputDir || await fs.mkdtemp(path.join(os.tmpdir(), 'shard-convert-'));

  const converter = new PluginConverter();
  const result = await converter.convert({
    pluginId,
    version,
    outputDir: tempDir,
  });

  logger.log(`Converted ${result.manifest.name} v${result.manifest.version}`);

  // If repository specified, push to GHCR
  if (repository && token) {
    logger.log(`Pushing to ${repository}...`);

    const fullRef = repository.includes(':')
      ? repository
      : `${repository}:${result.manifest.version}`;

    const ref = parseRepoAndRef(fullRef);
    const client = new OciRegistryClient({
      repo: ref,
      username: 'github',
      password: token,
      adapter,
      scopes: ['push', 'pull'],
    });

    // Push files as layers
    const layers: ManifestOCIDescriptor[] = [];

    // Push main.js
    const mainJsResult = await client.pushBlob({ data: result.files.mainJs });
    layers.push({
      mediaType: 'application/javascript',
      digest: mainJsResult.digest,
      size: mainJsResult.size,
      annotations: {
        'org.opencontainers.image.title': 'main.js',
      },
    });

    // Push styles.css if present
    if (result.files.stylesCss) {
      const stylesCssResult = await client.pushBlob({ data: result.files.stylesCss });
      layers.push({
        mediaType: 'text/css',
        digest: stylesCssResult.digest,
        size: stylesCssResult.size,
        annotations: {
          'org.opencontainers.image.title': 'styles.css',
        },
      });
    }

    // Push manifest with annotations
    const manifestPushResult = await client.pushPluginManifest({
      ref: ref.tag || result.manifest.version,
      pluginManifest: result.manifest,
      layers,
      annotations: result.annotations,
    });

    logger.success(`Successfully pushed ${fullRef}`);
    logger.log(`Manifest digest: ${manifestPushResult.digest}`);

    // Clean up temp directory if not user-specified
    if (!outputDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }

    return {
      pluginId,
      version: result.manifest.version,
      repository: fullRef,
      digest: manifestPushResult.digest,
    };
  }

  // Just save locally
  logger.success(`Converted plugin saved to ${tempDir}`);

  return {
    pluginId,
    version: result.manifest.version,
  };
}
```

**Step 2: Add convert to index.ts**

Add to `packages/shard-cli/src/index.ts`:

```typescript
import { convertCommand } from "./commands/convert.js";

// Update USAGE to include convert
const USAGE = `
Usage: shard <command> [options]

Commands:
  push <directory> <repository>   Push a plugin to GHCR
  pull <repository>               Pull a plugin from GHCR
  convert <plugin-id>             Convert legacy Obsidian plugin to Shard format

Push Options:
  <directory>                     Path to plugin build output (e.g., ./dist)
  <repository>                    GHCR repository (e.g., ghcr.io/user/plugin)
  --token <pat>                   GitHub Personal Access Token
  --json                          Output JSON result to stdout
  --help                          Show help

Pull Options:
  <repository>                    Full reference with tag (e.g., ghcr.io/user/plugin:1.0.0)
  --output <dir>                  Where to extract files (required)
  --token <pat>                   GitHub Personal Access Token
  --json                          Output JSON result to stdout
  --help                          Show help

Convert Options:
  <plugin-id>                     Plugin ID from community plugins list
  --version <version>             Specific version to convert (default: latest)
  --repository <repo>             GHCR repository to push to (optional)
  --output-dir <dir>              Save locally instead of pushing
  --token <pat>                   GitHub Personal Access Token (required if pushing)
  --json                          Output JSON result to stdout
  --help                          Show help

Environment Variables:
  GITHUB_TOKEN                    GitHub token (alternative to --token)
  GH_TOKEN                        GitHub token (gh CLI compatibility)

Examples:
  shard push ./dist ghcr.io/user/my-plugin
  shard pull ghcr.io/user/my-plugin:1.0.0 --output ./plugin
  shard convert obsidian-git --repository ghcr.io/user/obsidian-git
  shard convert obsidian-git --output-dir ./converted
`;

// Add convert command handler
} else if (command === "convert") {
  // Parse convert arguments
  if (args.positionals.length < 2) {
    throw new Error("Convert command requires <plugin-id>");
  }

  const pluginId = args.positionals[1];
  const version = args.values.version as string | undefined;
  const repository = args.values.repository as string | undefined;
  const outputDir = args.values.output as string | undefined;
  const token = repository ? resolveAuthToken(args.values.token) : undefined;

  if (repository && !token) {
    throw new Error("--token required when pushing to repository");
  }

  // Execute convert
  const result = await convertCommand({
    pluginId,
    version,
    repository,
    token,
    outputDir,
    logger,
    adapter,
  });

  // Output result
  if (args.values.json) {
    console.log(JSON.stringify(result, null, 2));
  }
  process.exit(0);
}

// Add --version and --repository options to parseArgs
options: {
  token: { type: "string" },
  json: { type: "boolean", default: false },
  help: { type: "boolean", default: false },
  output: { type: "string" },
  version: { type: "string" },
  repository: { type: "string" },
},
```

**Step 3: Build and test**

Run: `cd packages/shard-cli && pnpm build && node dist/index.js convert --help`
Expected: Help text shows convert command

**Step 4: Commit**

```bash
git add packages/shard-cli/src/commands/convert.ts packages/shard-cli/src/index.ts
git commit -m "feat(cli): add convert command for legacy plugins"
```

---

## Phase 3: Marketplace Infrastructure

### Task 12: Create marketplace repository structure

**Files:**
- Create: `marketplace/.gitignore`
- Create: `marketplace/README.md`
- Create: `marketplace/plugins/.gitkeep`
- Create: `marketplace/.github/workflows/generate-index.yml`

**Step 1: Create marketplace directory structure**

Run: `mkdir -p marketplace/plugins marketplace/.github/workflows`

**Step 2: Create .gitignore**

```bash
# marketplace/.gitignore
plugins.json
```

**Step 3: Create README**

```markdown
# marketplace/README.md
# Shard Community Marketplace

Community marketplace for Shard plugins distributed via GitHub Container Registry.

## Submitting a Plugin

To submit your plugin to the marketplace:

1. Fork this repository
2. Create a markdown file in `plugins/` directory named `{plugin-id}.md`
3. Add YAML frontmatter with plugin metadata
4. Include your plugin's README in the body
5. Submit a pull request

## Plugin Metadata Format

```yaml
---
id: your-plugin-id
name: Your Plugin Name
author: Your Name
description: Brief description of your plugin
repo: github-username/repo-name
ghcr: ghcr.io/username/plugin-name:version
---

# Your Plugin README

[Plugin description and documentation]
```

## Fields

- **id**: Unique plugin identifier (matches Obsidian plugin ID)
- **name**: Display name
- **author**: Plugin author name
- **description**: One-line description
- **repo**: GitHub repository (username/repo)
- **ghcr**: Full GHCR reference with tag

## Review Process

All submissions are manually reviewed for:
- Valid metadata format
- Accurate GHCR reference
- Appropriate content
```

**Step 4: Create workflow**

```yaml
# marketplace/.github/workflows/generate-index.yml
name: Generate Plugin Index

on:
  push:
    branches: [main]
    paths:
      - 'plugins/**/*.md'

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate plugins.json
        run: |
          cat > generate-index.js << 'EOF'
          const fs = require('fs');
          const path = require('path');
          const matter = require('gray-matter');

          const pluginsDir = './plugins';
          const outputFile = './plugins.json';

          // Read all markdown files
          const files = fs.readdirSync(pluginsDir)
            .filter(f => f.endsWith('.md'));

          // Parse frontmatter from each file
          const plugins = files.map(file => {
            const content = fs.readFileSync(path.join(pluginsDir, file), 'utf-8');
            const { data } = matter(content);
            return data;
          });

          // Write JSON
          fs.writeFileSync(outputFile, JSON.stringify(plugins, null, 2));
          console.log(`Generated ${plugins.length} plugin entries`);
          EOF

          npm install gray-matter
          node generate-index.js

      - name: Commit plugins.json
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add plugins.json
          git diff --quiet && git diff --staged --quiet || git commit -m "Update plugins.json"
          git push
```

**Step 5: Create .gitkeep**

Run: `touch marketplace/plugins/.gitkeep`

**Step 6: Commit**

```bash
git add marketplace/
git commit -m "feat: create marketplace repository structure"
```

---

## Phase 4: Marketplace Registration

### Task 13: Add marketplace register command

**Files:**
- Create: `packages/shard-cli/src/commands/marketplace.ts`
- Modify: `packages/shard-cli/src/index.ts`

**Step 1: Create marketplace command**

```typescript
// packages/shard-cli/src/commands/marketplace.ts
import { OciRegistryClient, parseRepoAndRef } from 'shard-lib';
import type { Logger } from '../lib/logger.js';
import type { FetchAdapter } from 'shard-lib';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface MarketplaceRegisterOptions {
  ghcrReference: string;
  token: string;
  logger: Logger;
  adapter: FetchAdapter;
}

export interface MarketplaceRegisterResult {
  pluginId: string;
  markdownFile: string;
}

export async function marketplaceRegisterCommand(
  opts: MarketplaceRegisterOptions
): Promise<MarketplaceRegisterResult> {
  const { ghcrReference, token, logger, adapter } = opts;

  logger.log(`Fetching plugin from ${ghcrReference}...`);

  // Parse reference
  const ref = parseRepoAndRef(ghcrReference);
  const client = new OciRegistryClient({
    repo: ref,
    username: 'github',
    password: token,
    adapter,
    scopes: ['pull'],
  });

  // Pull manifest
  const manifestResult = await client.pullPluginManifest({ ref: ref.tag || 'latest' });
  const { pluginManifest, ociManifest } = manifestResult;

  logger.log(`Found plugin: ${pluginManifest.name} v${pluginManifest.version}`);

  // Extract repo URL from annotations
  const repoUrl = ociManifest.annotations?.['org.obsidian.plugin.repo'];
  if (!repoUrl) {
    throw new Error('Plugin missing org.obsidian.plugin.repo annotation');
  }

  logger.log(`Fetching README from ${repoUrl}...`);

  // Fetch README from GitHub
  let readmeContent = '';
  try {
    const readmeUrl = `https://raw.githubusercontent.com/${repoUrl}/HEAD/README.md`;
    const response = await fetch(readmeUrl);
    if (response.ok) {
      readmeContent = await response.text();
    } else {
      logger.log('README.md not found, using empty content');
    }
  } catch (err) {
    logger.log(`Failed to fetch README: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Generate markdown file
  const frontmatter = `---
id: ${pluginManifest.id}
name: ${pluginManifest.name}
author: ${pluginManifest.author}
description: ${pluginManifest.description}
repo: ${repoUrl}
ghcr: ${ghcrReference}
---`;

  const markdownContent = `${frontmatter}\n\n${readmeContent}`;
  const markdownFile = `${pluginManifest.id}.md`;

  // Write to current directory
  await fs.writeFile(markdownFile, markdownContent);

  logger.success(`Generated marketplace listing: ${markdownFile}`);
  logger.log('');
  logger.log('Next steps:');
  logger.log('1. Review the generated markdown file');
  logger.log('2. Fork the marketplace repository');
  logger.log('3. Add the file to the plugins/ directory');
  logger.log('4. Submit a pull request');

  return {
    pluginId: pluginManifest.id,
    markdownFile,
  };
}
```

**Step 2: Update index.ts**

Add to `packages/shard-cli/src/index.ts`:

```typescript
import { marketplaceRegisterCommand } from "./commands/marketplace.js";

// Update USAGE
const USAGE = `
Usage: shard <command> [options]

Commands:
  push <directory> <repository>            Push a plugin to GHCR
  pull <repository>                        Pull a plugin from GHCR
  convert <plugin-id>                      Convert legacy Obsidian plugin
  marketplace register <ghcr-reference>    Generate marketplace listing

...

Marketplace Options:
  <ghcr-reference>                Full GHCR reference (e.g., ghcr.io/user/plugin:1.0.0)
  --token <pat>                   GitHub Personal Access Token
  --json                          Output JSON result to stdout
  --help                          Show help

...

Examples:
  shard marketplace register ghcr.io/user/my-plugin:1.0.0
`;

// Add marketplace command handler
} else if (command === "marketplace") {
  if (args.positionals.length < 2) {
    throw new Error("Marketplace command requires subcommand");
  }

  const subcommand = args.positionals[1];

  if (subcommand === "register") {
    if (args.positionals.length < 3) {
      throw new Error("Register requires <ghcr-reference>");
    }

    const ghcrReference = args.positionals[2];
    const token = resolveAuthToken(args.values.token);

    const result = await marketplaceRegisterCommand({
      ghcrReference,
      token,
      logger,
      adapter,
    });

    if (args.values.json) {
      console.log(JSON.stringify(result, null, 2));
    }
    process.exit(0);
  } else {
    throw new Error(`Unknown marketplace subcommand: ${subcommand}`);
  }
}
```

**Step 3: Build and test**

Run: `cd packages/shard-cli && pnpm build && node dist/index.js marketplace --help`
Expected: Help shows marketplace command

**Step 4: Commit**

```bash
git add packages/shard-cli/src/commands/marketplace.ts packages/shard-cli/src/index.ts
git commit -m "feat(cli): add marketplace register command"
```

---

## Phase 5: Installer Integration

### Task 14: Add marketplace config to installer settings

**Files:**
- Modify: `packages/shard-installer/src/settings.ts`
- Modify: `packages/shard-installer/src/types.ts`

**Step 1: Update settings types**

Add to `packages/shard-installer/src/types.ts`:

```typescript
export interface ShardSettings {
  repositories: string[];
  marketplaceUrl: string;
  marketplaceCacheTTL: number; // milliseconds
  // ... existing settings
}

export const DEFAULT_SETTINGS: ShardSettings = {
  repositories: [],
  marketplaceUrl: 'https://raw.githubusercontent.com/USER/shard-marketplace/main/plugins.json',
  marketplaceCacheTTL: 60 * 60 * 1000, // 1 hour
  // ... existing defaults
};
```

**Step 2: Update settings tab**

Add to `packages/shard-installer/src/settings.ts` in the display method:

```typescript
// Add marketplace URL setting
containerEl.createEl('h3', { text: 'Marketplace Settings' });

new Setting(containerEl)
  .setName('Marketplace URL')
  .setDesc('URL to plugins.json for community marketplace')
  .addText(text => text
    .setPlaceholder('https://...')
    .setValue(this.plugin.settings.marketplaceUrl)
    .onChange(async (value) => {
      this.plugin.settings.marketplaceUrl = value;
      await this.plugin.saveSettings();
    }));

new Setting(containerEl)
  .setName('Marketplace Cache TTL')
  .setDesc('How long to cache marketplace data (minutes)')
  .addText(text => text
    .setPlaceholder('60')
    .setValue(String(this.plugin.settings.marketplaceCacheTTL / 60000))
    .onChange(async (value) => {
      const minutes = parseInt(value) || 60;
      this.plugin.settings.marketplaceCacheTTL = minutes * 60 * 1000;
      await this.plugin.saveSettings();
    }));
```

**Step 3: Build**

Run: `cd packages/shard-installer && pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/shard-installer/src/settings.ts packages/shard-installer/src/types.ts
git commit -m "feat(installer): add marketplace configuration settings"
```

---

### Task 15: Implement marketplace client

**Files:**
- Create: `packages/shard-installer/src/marketplace/marketplace-client.ts`
- Create: `packages/shard-installer/src/marketplace/types.ts`

**Step 1: Create marketplace types**

```typescript
// packages/shard-installer/src/marketplace/types.ts

export interface MarketplacePlugin {
  id: string;
  name: string;
  author: string;
  description: string;
  repo: string;
  ghcr: string;
}

export type MarketplacePluginsList = MarketplacePlugin[];
```

**Step 2: Create marketplace client**

```typescript
// packages/shard-installer/src/marketplace/marketplace-client.ts
import { requestUrl } from 'obsidian';
import type { MarketplacePlugin, MarketplacePluginsList } from './types.js';

export interface MarketplaceCache {
  data: MarketplacePluginsList;
  timestamp: number;
}

export class MarketplaceClient {
  private marketplaceUrl: string;
  private cacheTTL: number;
  private cache: MarketplaceCache | null = null;

  constructor(marketplaceUrl: string, cacheTTL: number) {
    this.marketplaceUrl = marketplaceUrl;
    this.cacheTTL = cacheTTL;
  }

  async getPlugins(forceRefresh = false): Promise<MarketplacePluginsList> {
    // Check cache
    if (!forceRefresh && this.cache) {
      const age = Date.now() - this.cache.timestamp;
      if (age < this.cacheTTL) {
        return this.cache.data;
      }
    }

    // Fetch fresh data
    const response = await requestUrl({
      url: this.marketplaceUrl,
      method: 'GET',
    });

    if (response.status !== 200) {
      throw new Error(`Failed to fetch marketplace: ${response.status}`);
    }

    const plugins = response.json as MarketplacePluginsList;

    // Update cache
    this.cache = {
      data: plugins,
      timestamp: Date.now(),
    };

    return plugins;
  }

  async searchPlugins(query: string): Promise<MarketplacePlugin[]> {
    const plugins = await this.getPlugins();
    const lowerQuery = query.toLowerCase();

    return plugins.filter(
      (p) =>
        p.id.toLowerCase().includes(lowerQuery) ||
        p.name.toLowerCase().includes(lowerQuery) ||
        p.description.toLowerCase().includes(lowerQuery) ||
        p.author.toLowerCase().includes(lowerQuery)
    );
  }

  async getPlugin(id: string): Promise<MarketplacePlugin | undefined> {
    const plugins = await this.getPlugins();
    return plugins.find((p) => p.id === id);
  }

  clearCache(): void {
    this.cache = null;
  }
}
```

**Step 3: Build**

Run: `cd packages/shard-installer && pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/shard-installer/src/marketplace/
git commit -m "feat(installer): implement marketplace client"
```

---

### Task 16: Add marketplace UI to installer

**Files:**
- Modify: `packages/shard-installer/src/main.ts`
- Create: `packages/shard-installer/src/marketplace/marketplace-view.ts`

**Step 1: Create marketplace view**

```typescript
// packages/shard-installer/src/marketplace/marketplace-view.ts
import { ItemView, WorkspaceLeaf, Setting } from 'obsidian';
import type ShardInstallerPlugin from '../main.js';
import { MarketplaceClient } from './marketplace-client.js';
import type { MarketplacePlugin } from './types.js';

export const MARKETPLACE_VIEW_TYPE = 'shard-marketplace';

export class MarketplaceView extends ItemView {
  private plugin: ShardInstallerPlugin;
  private client: MarketplaceClient;
  private plugins: MarketplacePlugin[] = [];

  constructor(leaf: WorkspaceLeaf, plugin: ShardInstallerPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.client = new MarketplaceClient(
      plugin.settings.marketplaceUrl,
      plugin.settings.marketplaceCacheTTL
    );
  }

  getViewType(): string {
    return MARKETPLACE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Shard Marketplace';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.createEl('h2', { text: 'Shard Community Marketplace' });

    // Refresh button
    const controls = container.createDiv({ cls: 'marketplace-controls' });
    new Setting(controls)
      .setName('Refresh marketplace')
      .addButton((button) =>
        button
          .setButtonText('Refresh')
          .onClick(async () => {
            await this.loadPlugins(true);
          })
      );

    // Plugin list
    const listContainer = container.createDiv({ cls: 'marketplace-list' });
    await this.loadPlugins();
    this.renderPlugins(listContainer);
  }

  async loadPlugins(forceRefresh = false): Promise<void> {
    try {
      this.plugins = await this.client.getPlugins(forceRefresh);
    } catch (err) {
      console.error('Failed to load marketplace:', err);
      this.plugins = [];
    }
  }

  renderPlugins(container: HTMLElement): void {
    container.empty();

    if (this.plugins.length === 0) {
      container.createEl('p', { text: 'No plugins available' });
      return;
    }

    for (const plugin of this.plugins) {
      const pluginEl = container.createDiv({ cls: 'marketplace-plugin' });

      pluginEl.createEl('h3', { text: plugin.name });
      pluginEl.createEl('p', {
        cls: 'marketplace-plugin-author',
        text: `by ${plugin.author}`,
      });
      pluginEl.createEl('p', {
        cls: 'marketplace-plugin-description',
        text: plugin.description,
      });

      const actionsEl = pluginEl.createDiv({ cls: 'marketplace-plugin-actions' });

      actionsEl.createEl('a', {
        text: 'View on GitHub',
        href: `https://github.com/${plugin.repo}`,
      });

      new Setting(actionsEl).addButton((button) =>
        button.setButtonText('Install').onClick(async () => {
          await this.installPlugin(plugin);
        })
      );
    }
  }

  async installPlugin(plugin: MarketplacePlugin): Promise<void> {
    // TODO: Integrate with installer
    console.log('Installing plugin:', plugin);
  }

  async onClose(): Promise<void> {
    // Clean up
  }
}
```

**Step 2: Register view in main.ts**

Add to `packages/shard-installer/src/main.ts`:

```typescript
import { MarketplaceView, MARKETPLACE_VIEW_TYPE } from './marketplace/marketplace-view.js';

// In onload method:
this.registerView(
  MARKETPLACE_VIEW_TYPE,
  (leaf) => new MarketplaceView(leaf, this)
);

// Add command to open marketplace
this.addCommand({
  id: 'open-marketplace',
  name: 'Open Shard Marketplace',
  callback: () => {
    this.activateView();
  },
});

// Add method to activate view
async activateView(): Promise<void> {
  const { workspace } = this.app;

  let leaf = workspace.getLeavesOfType(MARKETPLACE_VIEW_TYPE)[0];

  if (!leaf) {
    leaf = workspace.getRightLeaf(false);
    await leaf.setViewState({
      type: MARKETPLACE_VIEW_TYPE,
      active: true,
    });
  }

  workspace.revealLeaf(leaf);
}
```

**Step 3: Build**

Run: `cd packages/shard-installer && pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/shard-installer/src/marketplace/marketplace-view.ts packages/shard-installer/src/main.ts
git commit -m "feat(installer): add marketplace UI view"
```

---

## Final Steps

### Task 17: Update documentation

**Files:**
- Modify: `README.md`
- Create: `docs/MARKETPLACE.md`
- Create: `docs/CONVERTING.md`

**Step 1: Update main README**

Update feature checklist in `README.md`:

```markdown
## Features
- [x] Core library for GHCR interaction
- [x] Obsidian plugin installer
- [x] CLI tool for plugin management
  - [x] Push plugins to GHCR
  - [x] Pull plugins from GHCR
  - [x] Convert legacy Obsidian plugins
  - [x] Generate marketplace listings
- [x] GitHub hosted community marketplace for Shard plugins
- [x] Legacy Obsidian community plugin directory integration
```

**Step 2: Create marketplace docs**

```markdown
# docs/MARKETPLACE.md
# Shard Community Marketplace

## Overview

The Shard community marketplace is a GitHub-hosted registry of Shard plugins distributed via GHCR.

## For Users

### Browsing Plugins

1. Open Obsidian
2. Run command: "Open Shard Marketplace"
3. Browse available plugins
4. Click "Install" to install a plugin

### Installing from Marketplace

Plugins are fetched directly from GHCR using the `ghcr` reference in the marketplace listing.

## For Plugin Authors

### Publishing Your Plugin

1. Build your plugin
2. Push to GHCR: `shard push ./dist ghcr.io/user/plugin`
3. Generate listing: `shard marketplace register ghcr.io/user/plugin:1.0.0`
4. Fork the marketplace repository
5. Add the generated `.md` file to `plugins/` directory
6. Submit a pull request

### Converting Legacy Plugins

Convert existing Obsidian community plugins to Shard format:

```bash
shard convert obsidian-git --repository ghcr.io/user/obsidian-git
shard marketplace register ghcr.io/user/obsidian-git:latest
```

## Marketplace Repository

The marketplace is a GitHub repository with:
- `plugins/` - Markdown files with plugin metadata
- `plugins.json` - Auto-generated index (do not edit manually)
- GitHub Actions - Regenerates `plugins.json` on every push

## Metadata Format

Each plugin is described in a markdown file with YAML frontmatter:

```yaml
---
id: plugin-id
name: Plugin Name
author: Author Name
description: One-line description
repo: github-user/repo-name
ghcr: ghcr.io/user/plugin:version
---

# Plugin README

[Full description and documentation]
```
```

**Step 3: Create conversion docs**

```markdown
# docs/CONVERTING.md
# Converting Legacy Obsidian Plugins

## Overview

The `shard convert` command converts legacy Obsidian community plugins to Shard format.

## How It Works

1. Fetches plugin metadata from official community plugins list
2. Downloads latest (or specified) release from GitHub
3. Extracts plugin files (manifest.json, main.js, styles.css)
4. Packages as OCI image with manifest in config blob
5. Optionally pushes to GHCR

## Usage

### Convert and Push to GHCR

```bash
shard convert obsidian-git --repository ghcr.io/user/obsidian-git
```

### Convert Specific Version

```bash
shard convert obsidian-git --version 2.20.0 --repository ghcr.io/user/obsidian-git
```

### Convert to Local Directory

```bash
shard convert obsidian-git --output-dir ./converted
```

## OCI Annotations

Converted plugins include OCI annotations:
- `org.obsidian.plugin.repo` - Original GitHub repository
- `org.obsidian.plugin.source` - Set to "community"

These annotations preserve provenance and enable marketplace registration.

## Limitations

- Only works with plugins in the official community list
- Requires plugins to have GitHub releases with required assets
- Cannot convert private or unreleased plugins

## After Conversion

After converting, you can register the plugin in the marketplace:

```bash
shard marketplace register ghcr.io/user/obsidian-git:latest
```

This generates a markdown file ready for PR submission.
```

**Step 4: Commit**

```bash
git add README.md docs/MARKETPLACE.md docs/CONVERTING.md
git commit -m "docs: add marketplace and conversion documentation"
```

---

### Task 18: Run full integration test

**Step 1: Build all packages**

Run: `pnpm build`
Expected: All packages build successfully

**Step 2: Run all tests**

Run: `pnpm test`
Expected: All tests pass

**Step 3: Lint all packages**

Run: `pnpm lint`
Expected: No lint errors

**Step 4: Manual integration test - Convert a plugin**

Run: `cd packages/shard-cli && node dist/index.js convert calendar --output-dir /tmp/shard-test`
Expected: Plugin files downloaded to /tmp/shard-test

**Step 5: Verify converted files**

Run: `ls /tmp/shard-test`
Expected: manifest.json, main.js present

**Step 6: Commit final changes**

```bash
git add .
git commit -m "test: verify full integration"
```

---

## Execution

Plan complete and saved to `docs/plans/2026-02-05-marketplace-converter-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
