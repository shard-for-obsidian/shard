# Misc Command Tweaks

**Date**: 2026-02-10
**Status**: Draft

## Overview

Three related changes across the CLI, lib, and marketplace packages:

1. **Annotation mapping/format tweaks** — Fix config media type, remove `vnd.obsidianmd.layer.filename` layer annotations, change source URL format, populate `introduction` from community-plugins.json description, add `org.opencontainers.image.description`
2. **`shard marketplace sync` command** — New CLI command to fetch an OCI manifest and generate a marketplace content markdown file from its annotations
3. **Clean up pnpm scripts** — Fold `generate-plugins-json` into the Vite build pipeline as a plugin; remove standalone `marketplace:generate` root script

---

## 1. Annotation Mapping / Format Tweaks

### Changes

#### A. Config media type (`converter.ts:302`)

The converter hardcodes `"application/vnd.obsidian.plugin.config.v1+json"` instead of using the existing constant `MEDIATYPE_OBSIDIAN_PLUGIN_CONFIG_V1` (`"application/vnd.obsidianmd.plugin-manifest.v1+json"`).

**Fix**: Import and use `MEDIATYPE_OBSIDIAN_PLUGIN_CONFIG_V1` from `ManifestTypes.ts`.

**Files**: `packages/cli/src/lib/converter.ts:302`

#### B. Remove `vnd.obsidianmd.layer.filename` from all layer annotations

Layers should only have `org.opencontainers.image.title` (for ORAS compatibility). The `vnd.obsidianmd.layer.filename` annotation is redundant.

**Affected commands** (all three):

- `packages/cli/src/lib/converter.ts:231,247` — convert command
- `packages/cli/src/commands/registry/push.ts:116,134` — registry push command
- `packages/cli/src/commands/publish.ts:116,134` — publish command

**Change**: Remove the `"vnd.obsidianmd.layer.filename"` key from all layer annotation objects. Keep only `"org.opencontainers.image.title"`.

#### C. Replace `repoToVcsUrl` with `repoToGitHubUrl`

The `repoToVcsUrl()` function produces `git+https://github.com/owner/repo.git`. The source annotation should use the plain format `https://github.com/owner/repo`.

**Files**: `packages/lib/src/schemas/transforms.ts`

**Steps**:

1. Create new function `repoToGitHubUrl(repo: string): string` returning `https://github.com/${repo}`
2. Replace all calls to `repoToVcsUrl()` with `repoToGitHubUrl()` in:
   - `manifestToAnnotations()` (line 133)
   - `manifestToAnnotationsLegacy()` (line 88)
3. Remove `repoToVcsUrl()` function
4. Remove `vcsUrlToGitHubUrl()` function — it was the inverse of `repoToVcsUrl` and becomes unnecessary
5. Update `annotationsToMarketplacePlugin()` (line 190) — it currently calls `vcsUrlToGitHubUrl(source)` to convert VCS URLs to GitHub URLs. Since source is now already a plain GitHub URL, just use it directly.
6. Update the `PluginAnnotationsSchema` source field regex (annotations.ts:19) — remove `regex(/^git\+https:\/\//)`, change to `z.string().url()`
7. Update exports in `packages/lib/src/schemas/index.ts`
8. Update tests in `packages/lib/src/schemas/__tests__/transforms.test.ts`

#### D. Populate `vnd.obsidianmd.plugin.introduction` from `communityPlugin.description`

Currently `manifestToAnnotations()` uses `communityPlugin.introduction ?? ""`. Change to use `communityPlugin.description` (the short summary from community-plugins.json).

**File**: `packages/lib/src/schemas/transforms.ts:135`

**Change**:

```typescript
// Before
"vnd.obsidianmd.plugin.introduction": communityPlugin.introduction ?? "",
// After
"vnd.obsidianmd.plugin.introduction": communityPlugin.description,
```

Note: `communityPlugin.description` is a required field on `CommunityPluginMetadata`, so no fallback needed.

#### E. Add `org.opencontainers.image.description`

Add `org.opencontainers.image.description` annotation populated from `manifest.description` (the Obsidian manifest.json description).

**File**: `packages/lib/src/schemas/transforms.ts:131` (after the existing description line)

**Change** in `manifestToAnnotations()`:

```typescript
"vnd.obsidianmd.plugin.description": manifest.description,
"org.opencontainers.image.description": manifest.description,
```

Also add to `manifestToAnnotationsLegacy()` (line 86, same pattern).

**Schema update**: Add to `PluginAnnotationsSchema` in `annotations.ts`:

```typescript
"org.opencontainers.image.description": z.string().optional(),
```

Optional because legacy manifests won't have it.

---

## 2. `shard marketplace sync` Command

### Usage

```
shard marketplace sync <reference> <outdir> [--overwrite] [--token <token>]
```

**Example**:

```
shard marketplace sync ghcr.io/user/repo/community-plugins/notebook-navigator content/plugins
```

### Behavior

1. Parse `<reference>` — append `:latest` tag if no tag specified
2. Fetch the OCI manifest using `queryTagMetadata()` from `packages/lib/src/oci/tags.ts`
3. Extract the plugin ID from the reference path (last segment before the tag)
4. Extract annotations from the manifest
5. Generate markdown file at `<outdir>/<plugin-id>.md`:

```markdown
---
url: ghcr.io/user/repo/community-plugins/<plugin-id>
name: {{annotations["vnd.obsidianmd.plugin.name"]}}
introduction: {{annotations["vnd.obsidianmd.plugin.introduction"]}}
repository: {{annotations["vnd.obsidianmd.plugin.source"]}}
---

{{annotations["vnd.obsidianmd.plugin.description"]}}
```

6. If the file already exists and `--overwrite` is not set, prompt with Node.js `readline` for y/n confirmation. If declined, skip and exit cleanly.

### Implementation

**New files**:

- `packages/cli/src/commands/marketplace/index.ts` — route map for marketplace subcommands
- `packages/cli/src/commands/marketplace/sync.ts` — sync command implementation

**Modified files**:

- `packages/cli/src/index.ts` — register `marketplace` route map

**Command structure** (using `@stricli/core`):

```typescript
// packages/cli/src/commands/marketplace/index.ts
export const marketplaceRouteMap = buildRouteMap({
  routes: { sync },
});

// packages/cli/src/commands/marketplace/sync.ts
export const sync = buildCommand({
  func: syncCommandHandler,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "OCI reference (e.g., ghcr.io/user/repo/plugin-id)",
          parse: String,
          placeholder: "reference",
        },
        {
          brief: "Output directory for markdown files",
          parse: String,
          placeholder: "outdir",
        },
      ],
    },
    flags: {
      overwrite: {
        kind: "boolean",
        brief: "Overwrite existing files without prompting",
        optional: true,
      },
      token: {
        kind: "parsed",
        parse: String,
        brief: "GitHub token",
        optional: true,
      },
    },
  },
});
```

**Overwrite prompt**: Use Node.js `readline` module:

```typescript
import * as readline from "node:readline/promises";

async function confirmOverwrite(filePath: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await rl.question(
    `File ${filePath} already exists. Overwrite? [y/N] `,
  );
  rl.close();
  return answer.toLowerCase() === "y";
}
```

### Dependencies

Uses existing lib functions:

- `queryTagMetadata()` from `@shard-for-obsidian/lib` for manifest fetching
- `NodeFetchAdapter` for HTTP
- Standard `node:fs` and `node:path` for file operations

No new package dependencies required.

---

## 3. Clean Up pnpm Scripts / Build Pipeline

### Problem

The root `package.json` has a standalone `marketplace:generate` script that must be run manually before `marketplace:build`. This is error-prone and not integrated into the build.

### Solution

Convert `generate-plugins-json.ts` logic into a Vite plugin that runs at build time.

### Implementation

**New file**: `apps/marketplace/plugins/vite-plugin-generate-plugins.ts`

A Vite plugin that:

- Hooks into `buildStart` (runs before SvelteKit processes routes)
- Executes the same logic as `generate-plugins-json.ts` — reads `content/plugins/*.md`, queries OCI tags/metadata, writes `static/plugins.json`
- During dev (`serve` mode), also watches `content/plugins/` for changes and regenerates

```typescript
import type { Plugin } from "vite";

export function generatePluginsPlugin(): Plugin {
  return {
    name: "generate-plugins-json",
    async buildStart() {
      // Same logic as generate-plugins-json.ts
      await generatePluginsJson();
    },
    configureServer(server) {
      // Watch content/plugins/ for changes in dev mode
      server.watcher.add("content/plugins");
      server.watcher.on("change", async (path) => {
        if (path.includes("content/plugins")) {
          await generatePluginsJson();
        }
      });
    },
  };
}
```

**Modified files**:

- `apps/marketplace/vite.config.ts` — add the plugin:

  ```typescript
  import { generatePluginsPlugin } from "./plugins/vite-plugin-generate-plugins";
  export default defineConfig({
    plugins: [generatePluginsPlugin(), tailwindcss(), sveltekit()],
  });
  ```

- `package.json` (root) — remove scripts:
  - Remove `marketplace:generate`
  - Simplify `marketplace:dev` to `pnpm --filter marketplace dev`
  - Simplify `marketplace:build` to `pnpm --filter marketplace build`
  - Keep `marketplace:preview` as-is

- `apps/marketplace/scripts/generate-plugins-json.ts` — refactor:
  - Extract the core `generatePluginsJson()` function as a named export
  - Keep the script runnable standalone for debugging (check `import.meta.url`)
  - Or: delete the standalone script entirely and move logic into the Vite plugin

### Search index

The `build:search` / `prebuild` hook in `apps/marketplace/package.json` could also move into the Vite plugin (run after plugins.json generation). This keeps the entire data pipeline in one place. The prebuild hook and `build:search` script would then be removed.

---

## File Change Summary

### `packages/lib/src/schemas/transforms.ts`

- Add `repoToGitHubUrl()`, remove `repoToVcsUrl()` and `vcsUrlToGitHubUrl()`
- `manifestToAnnotations()`: use `repoToGitHubUrl()` for source, set introduction to `communityPlugin.description`, add `org.opencontainers.image.description`
- `manifestToAnnotationsLegacy()`: use `repoToGitHubUrl()` for source, add `org.opencontainers.image.description`
- `annotationsToMarketplacePlugin()`: use source directly (no longer VCS format)

### `packages/lib/src/schemas/annotations.ts`

- Update `vnd.obsidianmd.plugin.source` regex to `z.string().url()`
- Add `org.opencontainers.image.description` (optional)

### `packages/lib/src/schemas/index.ts`

- Export `repoToGitHubUrl`, remove exports for `repoToVcsUrl` and `vcsUrlToGitHubUrl`

### `packages/lib/src/schemas/__tests__/transforms.test.ts`

- Update tests for new function names and URL formats

### `packages/cli/src/lib/converter.ts`

- Import and use `MEDIATYPE_OBSIDIAN_PLUGIN_CONFIG_V1` for config media type
- Remove `vnd.obsidianmd.layer.filename` from layer annotations (keep `org.opencontainers.image.title`)

### `packages/cli/src/commands/registry/push.ts`

- Remove `vnd.obsidianmd.layer.filename` from layer annotations

### `packages/cli/src/commands/publish.ts`

- Remove `vnd.obsidianmd.layer.filename` from layer annotations

### `packages/cli/src/commands/marketplace/index.ts` (new)

- Route map with `sync` subcommand

### `packages/cli/src/commands/marketplace/sync.ts` (new)

- Sync command: fetch manifest, generate markdown, handle overwrite prompt

### `packages/cli/src/index.ts`

- Register `marketplace` route map

### `apps/marketplace/plugins/vite-plugin-generate-plugins.ts` (new)

- Vite plugin wrapping generate-plugins-json logic

### `apps/marketplace/vite.config.ts`

- Add generatePluginsPlugin

### `apps/marketplace/scripts/generate-plugins-json.ts`

- Refactor into importable function (or delete if fully moved to plugin)

### `package.json` (root)

- Remove `marketplace:generate`
- Simplify `marketplace:dev` and `marketplace:build`

### `apps/marketplace/package.json`

- Potentially remove `prebuild` and `build:search` if search index generation moves into the Vite plugin
