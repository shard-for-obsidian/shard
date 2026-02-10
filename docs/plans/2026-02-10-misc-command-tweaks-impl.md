# Misc Command Tweaks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix annotation formats, add `shard marketplace sync` command, and fold marketplace data generation into the Vite build pipeline.

**Architecture:** Three independent workstreams: (1) lib schema/transform changes with updated tests, (2) CLI command changes consuming those lib updates + new marketplace sync command, (3) marketplace build pipeline refactor. Workstream 1 must land before 2. Workstream 3 is independent.

**Tech Stack:** TypeScript, Zod, Vitest, @stricli/core (CLI framework), Vite (marketplace build), SvelteKit, Node.js readline

---

### Task 1: Lib — Update schemas, transforms, and tests

This task covers all changes in `packages/lib/`. It batches together the URL helper refactor, annotation schema changes, transform function updates, and test rewrites since they are tightly coupled.

**Files:**

- Modify: `packages/lib/src/schemas/transforms.ts`
- Modify: `packages/lib/src/schemas/annotations.ts`
- Modify: `packages/lib/src/schemas/index.ts`
- Modify: `packages/lib/src/schemas/__tests__/transforms.test.ts`

**Step 1: Update `annotations.ts` schema**

In `packages/lib/src/schemas/annotations.ts`:

1. Change the `vnd.obsidianmd.plugin.source` validator from `z.string().regex(...)` to `z.string().url()` (line 19):

```typescript
  /** Source URL (e.g., https://github.com/owner/repo) */
  "vnd.obsidianmd.plugin.source": z.string().url(),
```

2. Add `org.opencontainers.image.description` as an optional field after line 37 (after `image.title`):

```typescript
  /** OCI standard: Plugin description */
  "org.opencontainers.image.description": z.string().optional(),
```

**Step 2: Refactor URL helpers and transform functions in `transforms.ts`**

In `packages/lib/src/schemas/transforms.ts`:

1. **Replace `repoToVcsUrl`** (lines 5-16) with:

```typescript
/**
 * Convert GitHub repo format to GitHub URL
 * @param repo - Repository in "owner/repo" format
 * @returns GitHub URL in "https://github.com/owner/repo" format
 * @throws Error if repo format is invalid
 */
export function repoToGitHubUrl(repo: string): string {
  if (!repo.includes("/")) {
    throw new Error(`Invalid repo format: ${repo}. Expected "owner/repo"`);
  }
  return `https://github.com/${repo}`;
}
```

2. **Delete `vcsUrlToGitHubUrl`** entirely (lines 18-34). It is no longer needed.

3. **Update `manifestToAnnotationsLegacy`** (line 88): change `repoToVcsUrl(ownerRepo)` to `repoToGitHubUrl(ownerRepo)`. Also add `org.opencontainers.image.description` after line 86:

```typescript
    "vnd.obsidianmd.plugin.description": manifest.description,
    "org.opencontainers.image.description": manifest.description,
    "vnd.obsidianmd.plugin.author": manifest.author,
    "vnd.obsidianmd.plugin.source": repoToGitHubUrl(ownerRepo),
```

4. **Update `manifestToAnnotations`** (line 133): change `repoToVcsUrl(communityPlugin.repo)` to `repoToGitHubUrl(communityPlugin.repo)`. Also:
   - Line 131, add `org.opencontainers.image.description` after description:
     ```typescript
     "vnd.obsidianmd.plugin.description": manifest.description,
     "org.opencontainers.image.description": manifest.description,
     ```
   - Line 135, change introduction source:
     ```typescript
     "vnd.obsidianmd.plugin.introduction": communityPlugin.description,
     ```

5. **Update `annotationsToMarketplacePlugin`** (line 188-191): source is now already a plain GitHub URL, so use it directly:

```typescript
// Source is already a GitHub URL
const source = annotations["vnd.obsidianmd.plugin.source"];
if (source) {
  plugin.repository = source;
}
```

**Step 3: Update exports in `index.ts`**

In `packages/lib/src/schemas/index.ts`, line 22-23: replace `repoToVcsUrl` and `vcsUrlToGitHubUrl` with `repoToGitHubUrl`:

```typescript
export {
  repoToGitHubUrl,
  ghcrUrlToGitHubRepo,
  manifestToAnnotations,
  manifestToAnnotationsLegacy,
  annotationsToMarketplacePlugin,
  type CommunityPluginMetadata,
} from "./transforms.js";
```

Note: also add `ghcrUrlToGitHubRepo` to exports — it's used but wasn't previously exported from the barrel.

**Step 4: Rewrite tests in `transforms.test.ts`**

In `packages/lib/src/schemas/__tests__/transforms.test.ts`:

1. Update imports (line 2-8): replace `repoToVcsUrl, vcsUrlToGitHubUrl` with `repoToGitHubUrl`

2. Replace the `repoToVcsUrl` describe block (lines 10-18) with:

```typescript
describe("repoToGitHubUrl", () => {
  it("should convert owner/repo to GitHub URL", () => {
    const result = repoToGitHubUrl("owner/repo");
    expect(result).toBe("https://github.com/owner/repo");
  });

  it("should throw on invalid repo format", () => {
    expect(() => repoToGitHubUrl("invalid")).toThrow();
  });
});
```

3. Delete the entire `vcsUrlToGitHubUrl` describe block (lines 21-35).

4. Update the `manifestToAnnotations` tests:
   - Line 107-109: change expected source to `"https://github.com/owner/repo"`
   - Line 114-139 ("should include introduction field"): change the assertion — introduction now comes from `communityPlugin.description`, not `communityPlugin.introduction`. The test fixture already has `description: "A test plugin"` on the communityPlugin, so the test with `communityPluginWithIntro` should assert the description is used:

     ```typescript
     it("should use community plugin description as introduction", () => {
       // ...same manifest setup...
       const result = manifestToAnnotations(
         manifest,
         communityPlugin, // description: "A test plugin"
         "ghcr.io/owner/repo",
         "2026-02-09T10:00:00Z",
       );

       expect(result["vnd.obsidianmd.plugin.introduction"]).toBe(
         "A test plugin",
       );
     });
     ```

   - Add a new test for `org.opencontainers.image.description`:
     ```typescript
     it("should include org.opencontainers.image.description from manifest", () => {
       // ...same manifest setup with description: "A test plugin"...
       const result = manifestToAnnotations(
         manifest,
         communityPlugin,
         "ghcr.io/owner/repo",
         "2026-02-09T10:00:00Z",
       );
       expect(result["org.opencontainers.image.description"]).toBe(
         "A test plugin",
       );
     });
     ```

5. Update `annotationsToMarketplacePlugin` tests (lines 329-383): change the source annotation values from `"git+https://github.com/owner/repo.git"` to `"https://github.com/owner/repo"`.

6. Update integration tests:
   - Line 427: change expected source to `"https://github.com/denolehov/obsidian-git"`
   - Line 429-431: introduction should now be `"Backup your vault with git"` (from `communityPlugin.description`)
   - Line 509-537 ("should handle plugin without optional introduction field"): introduction should now be `"Test description"` (the `communityPlugin.description`), not `""`
   - Line 571: change expected source to `"https://github.com/owner/repo"`
   - Line 600-624 ("should ensure all required annotations"): add `"org.opencontainers.image.description"` to `requiredOciFields` array

**Step 5: Run tests**

Run: `cd /Users/gillisandrew/Projects/gillisandrew/shard && pnpm --filter @shard-for-obsidian/lib test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add packages/lib/src/schemas/
git commit -m "feat(lib): update annotation format — plain GitHub URLs, introduction from community description, add image.description

- Replace repoToVcsUrl with repoToGitHubUrl (https://github.com/owner/repo)
- Remove vcsUrlToGitHubUrl (no longer needed)
- Populate introduction annotation from communityPlugin.description
- Add org.opencontainers.image.description annotation
- Update PluginAnnotationsSchema source validator to z.string().url()
- Update all tests for new URL format and introduction source

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: CLI — Remove layer filename annotations, fix config media type, add marketplace sync

This task covers all CLI changes. It depends on Task 1 (lib changes must be in place).

**Files:**

- Modify: `packages/cli/src/lib/converter.ts`
- Modify: `packages/cli/src/commands/registry/push.ts`
- Modify: `packages/cli/src/commands/publish.ts`
- Modify: `packages/cli/src/index.ts`
- Create: `packages/cli/src/commands/marketplace/index.ts`
- Create: `packages/cli/src/commands/marketplace/sync.ts`

**Step 1: Fix converter.ts — config media type + layer annotations**

In `packages/cli/src/lib/converter.ts`:

1. Add import for the media type constant (after line 7):

```typescript
import {
  OciRegistryClient,
  parseRepoAndRef,
  MEDIATYPE_OBSIDIAN_PLUGIN_CONFIG_V1,
} from "@shard-for-obsidian/lib";
```

2. Remove `"vnd.obsidianmd.layer.filename"` from main.js layer annotations (line 231). The annotations block becomes:

```typescript
      annotations: {
        "org.opencontainers.image.title": ASSET_MAIN_JS,
      },
```

3. Remove `"vnd.obsidianmd.layer.filename"` from styles.css layer annotations (line 247). The annotations block becomes:

```typescript
      annotations: {
        "org.opencontainers.image.title": ASSET_STYLES_CSS,
      },
```

4. Replace the hardcoded config media type (line 302) with the constant:

```typescript
      mediaType: MEDIATYPE_OBSIDIAN_PLUGIN_CONFIG_V1,
```

**Step 2: Fix push.ts — remove layer filename annotations**

In `packages/cli/src/commands/registry/push.ts`:

1. Lines 115-117: remove `"vnd.obsidianmd.layer.filename": "main.js"` from annotations. Add `"org.opencontainers.image.title": "main.js"`:

```typescript
layers.push({
  mediaType: "application/javascript",
  digest: mainJsResult.digest,
  size: mainJsResult.size,
  annotations: {
    "org.opencontainers.image.title": "main.js",
  },
});
```

2. Lines 133-135: same for styles.css:

```typescript
layers.push({
  mediaType: "text/css",
  digest: stylesCssResult.digest,
  size: stylesCssResult.size,
  annotations: {
    "org.opencontainers.image.title": "styles.css",
  },
});
```

**Step 3: Fix publish.ts — remove layer filename annotations**

In `packages/cli/src/commands/publish.ts`:

Same changes as push.ts — lines 115-117 and 133-135. Replace `"vnd.obsidianmd.layer.filename"` with `"org.opencontainers.image.title"` in both layer annotation objects.

**Step 4: Create marketplace route map**

Create `packages/cli/src/commands/marketplace/index.ts`:

```typescript
import { buildRouteMap } from "@stricli/core";
import { sync } from "./sync.js";

/**
 * Marketplace route map for content management operations
 */
export const marketplaceRouteMap = buildRouteMap({
  routes: {
    sync,
  },
  docs: {
    brief: "Marketplace content management",
  },
});
```

**Step 5: Create sync command**

Create `packages/cli/src/commands/marketplace/sync.ts`:

```typescript
import { buildCommand } from "@stricli/core";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import type { AppContext } from "../../infrastructure/context.js";
import { resolveAuthToken } from "../../lib/auth.js";
import { queryTagMetadata, NodeFetchAdapter } from "@shard-for-obsidian/lib";

/**
 * Flags for the sync command
 */
export interface SyncFlags {
  overwrite?: boolean;
  token?: string;
}

/**
 * Prompt user for y/n confirmation
 */
async function confirmOverwrite(filePath: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await rl.question(
      `File ${filePath} already exists. Overwrite? [y/N] `,
    );
    return answer.toLowerCase() === "y";
  } finally {
    rl.close();
  }
}

/**
 * Extract plugin ID from OCI reference path.
 * e.g. "ghcr.io/user/repo/community-plugins/notebook-navigator" -> "notebook-navigator"
 * e.g. "ghcr.io/user/repo/community-plugins/notebook-navigator:latest" -> "notebook-navigator"
 */
function extractPluginId(reference: string): string {
  // Remove tag if present
  const refWithoutTag = reference.split(":")[0];
  const segments = refWithoutTag.split("/");
  return segments[segments.length - 1];
}

/**
 * Extract registry URL (without tag) from reference
 */
function extractRegistryUrl(reference: string): string {
  return reference.split(":")[0];
}

/**
 * Sync a plugin from OCI registry to a local markdown file
 */
async function syncCommandHandler(
  this: AppContext,
  flags: SyncFlags,
  reference: string,
  outdir: string,
): Promise<void> {
  const { logger, config } = this;

  try {
    // Step 1: Resolve token
    let token = "";
    if (flags.token) {
      token = flags.token;
    } else {
      try {
        token = resolveAuthToken();
      } catch {
        const configToken = await config.get("token");
        if (typeof configToken === "string" && configToken) {
          token = configToken;
        }
        // Token is optional — public registries may not need it
      }
    }

    // Step 2: Parse reference
    const registryUrl = extractRegistryUrl(reference);
    const pluginId = extractPluginId(reference);
    const tag = reference.includes(":") ? reference.split(":")[1] : "latest";

    logger.info(`Fetching manifest for ${registryUrl}:${tag}...`);

    // Step 3: Fetch manifest metadata
    const adapter = new NodeFetchAdapter();
    const metadata = await queryTagMetadata({
      registryUrl,
      tag,
      adapter,
      token,
    });

    const annotations = metadata.annotations;

    // Step 4: Extract annotation values
    const name = annotations["vnd.obsidianmd.plugin.name"] ?? pluginId;
    const introduction =
      annotations["vnd.obsidianmd.plugin.introduction"] ?? "";
    const repository = annotations["vnd.obsidianmd.plugin.source"] ?? "";
    const description = annotations["vnd.obsidianmd.plugin.description"] ?? "";

    // Step 5: Build markdown content
    const markdown = [
      "---",
      `url: ${registryUrl}`,
      `name: ${JSON.stringify(name)}`,
      `introduction: ${JSON.stringify(introduction)}`,
      `repository: ${repository}`,
      "---",
      description,
      "",
    ].join("\n");

    // Step 6: Write file
    const outPath = path.resolve(outdir, `${pluginId}.md`);

    // Ensure output directory exists
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    // Check if file exists
    if (fs.existsSync(outPath) && !flags.overwrite) {
      const confirmed = await confirmOverwrite(outPath);
      if (!confirmed) {
        logger.info("Skipped.");
        return;
      }
    }

    fs.writeFileSync(outPath, markdown, "utf-8");
    logger.success(`Wrote ${outPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to sync plugin: ${message}`);
    this.process.exit(1);
  }
}

/**
 * Build the sync command
 */
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
        brief: "GitHub token for authentication",
        optional: true,
      },
    },
    aliases: {
      t: "token",
    },
  },
  docs: {
    brief: "Sync a plugin from OCI registry to a local markdown file",
    customUsage: [
      "shard marketplace sync ghcr.io/user/repo/community/my-plugin content/plugins",
      "shard marketplace sync ghcr.io/user/repo/community/my-plugin content/plugins --overwrite",
    ],
  },
});
```

**Step 6: Register marketplace route map**

In `packages/cli/src/index.ts`:

1. Add import after line 19:

```typescript
import { marketplaceRouteMap } from "./commands/marketplace/index.js";
```

2. Add to routes object (after line 66, before `completion`):

```typescript
    marketplace: marketplaceRouteMap,
```

**Step 7: Build and verify**

Run: `cd /Users/gillisandrew/Projects/gillisandrew/shard && pnpm --filter @shard-for-obsidian/cli build`
Expected: Build succeeds

Run: `cd /Users/gillisandrew/Projects/gillisandrew/shard && pnpm shard marketplace sync --help`
Expected: Shows sync command help text

**Step 8: Commit**

```bash
git add packages/cli/src/
git commit -m "feat(cli): fix annotation formats and add marketplace sync command

- Use MEDIATYPE_OBSIDIAN_PLUGIN_CONFIG_V1 constant for config media type
- Remove vnd.obsidianmd.layer.filename from all layer annotations
- Use org.opencontainers.image.title for ORAS compatibility
- Add shard marketplace sync command for generating content markdown

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Marketplace — Fold generate-plugins-json into Vite plugin, clean up scripts

This task is independent of Tasks 1 and 2. It refactors the marketplace build pipeline.

**Files:**

- Modify: `apps/marketplace/scripts/generate-plugins-json.ts`
- Create: `apps/marketplace/plugins/vite-plugin-generate-plugins.ts`
- Modify: `apps/marketplace/vite.config.ts`
- Modify: `apps/marketplace/package.json`
- Modify: `package.json` (root)

**Step 1: Extract `generatePluginsJson()` as a named export**

In `apps/marketplace/scripts/generate-plugins-json.ts`:

1. Export the `generatePluginsJson` function (add `export` keyword, line 33):

```typescript
export async function generatePluginsJson(): Promise<void> {
```

2. Wrap the standalone invocation at the bottom (lines 192-196) in an `import.meta` guard so it only runs when executed directly:

```typescript
// Run standalone when executed directly
const isMainModule =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMainModule) {
  generatePluginsJson().catch((error) => {
    console.error("Failed to generate plugins.json:", error);
    process.exit(1);
  });
}
```

**Step 2: Extract `buildSearchIndex()` as a named export**

In `apps/marketplace/scripts/build-search-index.ts`:

1. Export the `buildSearchIndex` function (add `export` keyword, line 25):

```typescript
export async function buildSearchIndex() {
```

2. Wrap the standalone invocation (lines 75-78) in the same `import.meta` guard:

```typescript
const isMainModule =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMainModule) {
  buildSearchIndex().catch((error) => {
    console.error("Failed to build search index:", error);
    process.exit(1);
  });
}
```

**Step 3: Create the Vite plugin**

Create `apps/marketplace/plugins/vite-plugin-generate-plugins.ts`:

```typescript
import type { Plugin } from "vite";
import { generatePluginsJson } from "../scripts/generate-plugins-json.js";
import { buildSearchIndex } from "../scripts/build-search-index.js";

export function generatePluginsPlugin(): Plugin {
  return {
    name: "generate-plugins-json",
    async buildStart() {
      await generatePluginsJson();
      await buildSearchIndex();
    },
    configureServer(server) {
      server.watcher.add("content/plugins");
      server.watcher.on("change", async (changedPath) => {
        if (changedPath.includes("content/plugins")) {
          await generatePluginsJson();
          await buildSearchIndex();
        }
      });
    },
  };
}
```

**Step 4: Wire up vite.config.ts**

In `apps/marketplace/vite.config.ts`, add the plugin import and registration:

```typescript
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { generatePluginsPlugin } from "./plugins/vite-plugin-generate-plugins.js";

export default defineConfig({
  plugins: [generatePluginsPlugin(), tailwindcss(), sveltekit()],
  resolve: {
    alias: {
      $types: "../../../packages/shard-installer/src/marketplace/types",
    },
  },
});
```

**Step 5: Clean up marketplace package.json**

In `apps/marketplace/package.json`, remove the `prebuild` and `build:search` scripts since the Vite plugin handles both:

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch"
  }
}
```

**Step 6: Clean up root package.json scripts**

In `package.json` (root):

1. Remove `"marketplace:generate"` line entirely
2. Simplify `"marketplace:dev"` to `"pnpm --filter marketplace dev"`
3. Simplify `"marketplace:build"` to `"pnpm --filter marketplace build"`
4. Keep `"marketplace:preview"` as-is

Result:

```json
    "marketplace:dev": "pnpm --filter marketplace dev",
    "marketplace:build": "pnpm --filter marketplace build",
    "marketplace:preview": "pnpm --filter marketplace preview",
```

**Step 7: Verify build**

Run: `cd /Users/gillisandrew/Projects/gillisandrew/shard && pnpm marketplace:build`
Expected: Build succeeds — Vite plugin runs `generatePluginsJson()` then `buildSearchIndex()` during `buildStart`, then SvelteKit builds normally.

Note: This requires `GITHUB_TOKEN` in the environment for OCI tag queries. If not available, the plugin generation will warn but may still produce output from cached/existing content.

**Step 8: Commit**

```bash
git add apps/marketplace/ package.json
git commit -m "refactor(marketplace): fold data generation into Vite build pipeline

- Extract generatePluginsJson and buildSearchIndex as importable functions
- Create Vite plugin that runs both during buildStart
- Add dev mode file watching for content/plugins/ changes
- Remove standalone marketplace:generate script from root
- Simplify marketplace:dev and marketplace:build scripts
- Remove prebuild/build:search hooks from marketplace package.json

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Code review

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:requesting-code-review

Review all changes from Tasks 1-3 against the design doc at `docs/plans/2026-02-10-misc-command-tweaks.md`. Verify:

1. Config media type uses `MEDIATYPE_OBSIDIAN_PLUGIN_CONFIG_V1` constant
2. No `vnd.obsidianmd.layer.filename` remains anywhere — only `org.opencontainers.image.title` on layers
3. Source URLs are plain `https://github.com/owner/repo` format
4. `introduction` annotation populated from `communityPlugin.description`
5. `org.opencontainers.image.description` annotation present
6. `shard marketplace sync` produces correct markdown format
7. Vite plugin correctly replaces the standalone script pipeline
8. All tests pass: `pnpm test`
9. CLI builds: `pnpm --filter @shard-for-obsidian/cli build`
10. No stale exports (repoToVcsUrl, vcsUrlToGitHubUrl) remain
