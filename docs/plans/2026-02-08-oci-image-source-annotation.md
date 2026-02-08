# OCI Image Source Annotation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `org.opencontainers.image.source` annotation to all OCI manifests to enable GHCR packages to inherit repository access permissions.

**Architecture:** Parse GHCR registry URLs to extract GitHub repository URLs (first two path segments after `ghcr.io/`), add as standard OCI annotation in `manifestToAnnotations()`, update all call sites (convert, publish, registry push).

**Tech Stack:** TypeScript, Zod schemas, OCI Registry Client

---

## Task 1: Add GHCR URL Parser

**Files:**

- Modify: `packages/shard-lib/src/schemas/transforms.ts`
- Test: `packages/shard-lib/src/schemas/__tests__/transforms.test.ts`

**Step 1: Write the failing test**

Add to `packages/shard-lib/src/schemas/__tests__/transforms.test.ts`:

```typescript
describe("ghcrUrlToGitHubRepo", () => {
  test("converts standard GHCR URL", () => {
    expect(ghcrUrlToGitHubRepo("ghcr.io/owner/repo")).toBe(
      "https://github.com/owner/repo",
    );
  });

  test("converts GHCR URL with subpath", () => {
    expect(
      ghcrUrlToGitHubRepo("ghcr.io/shard-for-obsidian/shard/community/plugin"),
    ).toBe("https://github.com/shard-for-obsidian/shard");
  });

  test("handles URL with https protocol", () => {
    expect(ghcrUrlToGitHubRepo("https://ghcr.io/owner/repo")).toBe(
      "https://github.com/owner/repo",
    );
  });

  test("handles URL with http protocol", () => {
    expect(ghcrUrlToGitHubRepo("http://ghcr.io/owner/repo")).toBe(
      "https://github.com/owner/repo",
    );
  });

  test("throws on invalid URL with single segment", () => {
    expect(() => ghcrUrlToGitHubRepo("ghcr.io/invalid")).toThrow(
      "Invalid GHCR URL: ghcr.io/invalid",
    );
  });

  test("throws on invalid URL with no segments", () => {
    expect(() => ghcrUrlToGitHubRepo("ghcr.io/")).toThrow(
      "Invalid GHCR URL: ghcr.io/",
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test transforms.test.ts`
Expected: FAIL with "ghcrUrlToGitHubRepo is not defined"

**Step 3: Write minimal implementation**

Add to `packages/shard-lib/src/schemas/transforms.ts` after the `vcsUrlToGitHubUrl` function:

```typescript
/**
 * Extract GitHub repository URL from GHCR registry URL
 * @param registryUrl - GHCR URL (e.g., "ghcr.io/owner/repo/path")
 * @returns GitHub repository URL (e.g., "https://github.com/owner/repo")
 * @throws Error if GHCR URL format is invalid
 */
export function ghcrUrlToGitHubRepo(registryUrl: string): string {
  // Remove protocol if present
  const normalized = registryUrl.replace(/^https?:\/\//, "");

  // Remove ghcr.io/ prefix
  const path = normalized.replace(/^ghcr\.io\//, "");

  // Extract first two segments (owner/repo)
  const segments = path.split("/");
  if (segments.length < 2) {
    throw new Error(`Invalid GHCR URL: ${registryUrl}`);
  }

  return `https://github.com/${segments[0]}/${segments[1]}`;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test transforms.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/shard-lib/src/schemas/transforms.ts packages/shard-lib/src/schemas/__tests__/transforms.test.ts
git commit -m "feat: add ghcrUrlToGitHubRepo parser function"
```

---

## Task 2: Update manifestToAnnotations Signature

**Files:**

- Modify: `packages/shard-lib/src/schemas/transforms.ts`
- Test: `packages/shard-lib/src/schemas/__tests__/transforms.test.ts`

**Step 1: Write the failing test**

Add to the existing `manifestToAnnotations` tests in `packages/shard-lib/src/schemas/__tests__/transforms.test.ts`:

```typescript
describe("manifestToAnnotations", () => {
  // ... existing tests ...

  test("includes org.opencontainers.image.source annotation", () => {
    const manifest: ObsidianManifest = {
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
      "ghcr.io/shard-for-obsidian/shard/community/test-plugin",
    );

    expect(annotations["org.opencontainers.image.source"]).toBe(
      "https://github.com/shard-for-obsidian/shard",
    );
  });

  test("includes org.opencontainers.image.source with nested path", () => {
    const manifest: ObsidianManifest = {
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
      "ghcr.io/org/repo/deeply/nested/path",
    );

    expect(annotations["org.opencontainers.image.source"]).toBe(
      "https://github.com/org/repo",
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test transforms.test.ts`
Expected: FAIL with "Expected 2 arguments, but got 3" or similar TypeScript error

**Step 3: Update function signature and implementation**

Modify `manifestToAnnotations` in `packages/shard-lib/src/schemas/transforms.ts`:

```typescript
/**
 * Create OCI annotations from Obsidian manifest
 * @param manifest - Obsidian plugin manifest
 * @param repo - Repository in "owner/repo" format
 * @param registryUrl - GHCR registry URL (e.g., "ghcr.io/owner/repo/path")
 * @returns OCI manifest annotations
 */
export function manifestToAnnotations(
  manifest: ObsidianManifest,
  repo: string,
  registryUrl: string,
): PluginAnnotations {
  const annotations: Record<string, string> = {
    "vnd.obsidianmd.plugin.id": manifest.id,
    "vnd.obsidianmd.plugin.name": manifest.name,
    "vnd.obsidianmd.plugin.version": manifest.version,
    "vnd.obsidianmd.plugin.description": manifest.description,
    "vnd.obsidianmd.plugin.author": manifest.author,
    "vnd.obsidianmd.plugin.source": repoToVcsUrl(repo),
    "vnd.obsidianmd.plugin.published-at": new Date().toISOString(),
    "org.opencontainers.image.source": ghcrUrlToGitHubRepo(registryUrl),
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
```

**Step 4: Fix existing test call sites**

Update all existing `manifestToAnnotations` tests to include the third parameter. Find and update each test call in `transforms.test.ts`:

```typescript
// Before:
const annotations = manifestToAnnotations(manifest, "owner/repo");

// After:
const annotations = manifestToAnnotations(
  manifest,
  "owner/repo",
  "ghcr.io/owner/repo",
);
```

**Step 5: Run test to verify it passes**

Run: `pnpm test transforms.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add packages/shard-lib/src/schemas/transforms.ts packages/shard-lib/src/schemas/__tests__/transforms.test.ts
git commit -m "feat: add registryUrl parameter to manifestToAnnotations"
```

---

## Task 3: Update Converter Call Site

**Files:**

- Modify: `packages/shard-cli/src/lib/converter.ts:233`

**Step 1: Update the call to manifestToAnnotations**

In `packages/shard-cli/src/lib/converter.ts`, find the `manifestToAnnotations` call around line 233 and update it:

```typescript
// Before:
const baseAnnotations = manifestToAnnotations(pluginData.manifest, githubRepo);

// After:
const baseAnnotations = manifestToAnnotations(
  pluginData.manifest,
  githubRepo,
  repository,
);
```

**Step 2: Verify TypeScript compilation**

Run: `pnpm build`
Expected: Build succeeds with no TypeScript errors

**Step 3: Run converter tests**

Run: `pnpm test converter.test.ts`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add packages/shard-cli/src/lib/converter.ts
git commit -m "feat: pass registryUrl to manifestToAnnotations in converter"
```

---

## Task 4: Update Publish Command Call Site

**Files:**

- Modify: `packages/shard-cli/src/commands/publish.ts`

**Step 1: Find manifestToAnnotations usage**

Search for `manifestToAnnotations` in the publish command file.

Run: `grep -n "manifestToAnnotations" packages/shard-cli/src/commands/publish.ts`

**Step 2: Update the call site**

Add the `repository` parameter to the `manifestToAnnotations` call (the repository URL should already be available in the context):

```typescript
// Find the existing call and add the third parameter
const annotations = manifestToAnnotations(
  manifest,
  githubRepo,
  repository, // Add this parameter
);
```

**Step 3: Verify TypeScript compilation**

Run: `pnpm build`
Expected: Build succeeds with no TypeScript errors

**Step 4: Run publish tests**

Run: `pnpm test publish`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/shard-cli/src/commands/publish.ts
git commit -m "feat: pass registryUrl to manifestToAnnotations in publish command"
```

---

## Task 5: Update Registry Push Command Call Site

**Files:**

- Modify: `packages/shard-cli/src/commands/registry/push.ts`

**Step 1: Find manifestToAnnotations usage**

Search for `manifestToAnnotations` in the registry push command file.

Run: `grep -n "manifestToAnnotations" packages/shard-cli/src/commands/registry/push.ts`

**Step 2: Update the call site**

Add the `repository` parameter to the `manifestToAnnotations` call:

```typescript
// Find the existing call and add the third parameter
const annotations = manifestToAnnotations(
  manifest,
  githubRepo,
  repository, // Add this parameter
);
```

**Step 3: Verify TypeScript compilation**

Run: `pnpm build`
Expected: Build succeeds with no TypeScript errors

**Step 4: Run registry push tests**

Run: `pnpm test registry`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/shard-cli/src/commands/registry/push.ts
git commit -m "feat: pass registryUrl to manifestToAnnotations in registry push"
```

---

## Task 6: Update PluginAnnotations Type

**Files:**

- Modify: `packages/shard-lib/src/schemas/annotations.ts`

**Step 1: Add org.opencontainers.image.source to type**

Update the `PluginAnnotations` type to include the standard OCI annotation:

```typescript
export const PluginAnnotationsSchema = z.object({
  "vnd.obsidianmd.plugin.id": z.string(),
  "vnd.obsidianmd.plugin.name": z.string(),
  "vnd.obsidianmd.plugin.version": z.string(),
  "vnd.obsidianmd.plugin.description": z.string(),
  "vnd.obsidianmd.plugin.author": z.string(),
  "vnd.obsidianmd.plugin.source": VcsUrlSchema,
  "vnd.obsidianmd.plugin.published-at": z.string().datetime(),
  "vnd.obsidianmd.plugin.author-url": z.string().url().optional(),
  "vnd.obsidianmd.plugin.min-app-version": z.string().optional(),
  "org.opencontainers.image.source": z.string().url(), // Add this line
});
```

**Step 2: Verify TypeScript compilation**

Run: `pnpm build`
Expected: Build succeeds with no TypeScript errors

**Step 3: Run schema tests**

Run: `pnpm test annotations`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add packages/shard-lib/src/schemas/annotations.ts
git commit -m "feat: add org.opencontainers.image.source to PluginAnnotations schema"
```

---

## Task 7: Integration Test

**Files:**

- Test: Run full conversion workflow

**Step 1: Build all packages**

Run: `pnpm build`
Expected: Build succeeds

**Step 2: Run all tests**

Run: `pnpm test`
Expected: All tests PASS

**Step 3: Manual verification (optional)**

If you have access to a test plugin, run a conversion and verify the annotation is present:

```bash
# Set token
export GITHUB_TOKEN=your_token

# Convert a test plugin
pnpm shard convert calendar ghcr.io/test-org/test-repo/calendar --json
```

Expected output should include the annotation when inspecting the manifest.

**Step 4: Final commit**

```bash
git add .
git commit -m "test: verify all integration tests pass"
```

---

## Task 8: Documentation

**Files:**

- Modify: `scripts/README.md`

**Step 1: Update convert-community-plugins.sh documentation**

Add a note about the annotation in the "What it does" section:

```markdown
### What it does

1. Fetches the latest community plugins list from GitHub
2. Converts each plugin using `shard convert`
3. Pushes to `ghcr.io/shard-for-obsidian/shard/community/<plugin-id>`
4. Adds `org.opencontainers.image.source` annotation for package permission inheritance
5. Logs each conversion to `./conversion-logs/<plugin-id>.log`
6. Shows progress and summary statistics
```

**Step 2: Commit documentation**

```bash
git add scripts/README.md
git commit -m "docs: document org.opencontainers.image.source annotation"
```

---

## Completion Checklist

- [ ] GHCR URL parser implemented and tested
- [ ] manifestToAnnotations updated with registryUrl parameter
- [ ] Converter call site updated
- [ ] Publish command call site updated
- [ ] Registry push command call site updated
- [ ] PluginAnnotations type schema updated
- [ ] All tests passing
- [ ] Documentation updated
- [ ] All changes committed

## Verification

After completing all tasks:

1. Run `pnpm build` - should succeed
2. Run `pnpm test` - all tests should pass
3. Check that all commits are properly formatted
4. Verify git log shows clean commit history
