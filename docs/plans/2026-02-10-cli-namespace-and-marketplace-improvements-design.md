# CLI Namespace and Marketplace Improvements Design

**Date**: 2026-02-10
**Status**: Approved

## Overview

This design addresses five related issues in the Shard CLI and marketplace:

**CLI Fixes (packages/cli/)**

1. **Namespace handling**: Change from "prefix concatenation" to "container semantics" by always inserting a `/` separator between namespace and plugin ID
2. **ORAS compatibility**: Update manifest config blob annotation to use `"manifest.json"` as title instead of plugin name

**Marketplace Improvements (apps/marketplace/)** 3. **Import script refactor**: Fetch plugin metadata from GHCR OCI registry and use Zod transforms to generate/update markdown files 4. **Version deduplication**: Group versions by SHA digest, display full semver as canonical with additional tags listed alongside 5. **UI polish**: Add collapsible annotations section to each version card

## Architecture

### Data Flow

```
GHCR (source of truth)
  ↓ fetch manifests + annotations
Import script (with Zod transforms)
  ↓ generate/update markdown
Markdown files (editorial content + computed metadata)
  ↓ build time
plugins.json (pre-computed, SHA-grouped)
  ↓ load
Svelte UI (progressive disclosure)
```

**Key Principle**: Treat GHCR as the authoritative source while allowing editorial markdown to override specific fields. The import script becomes a "sync" operation rather than a one-way generation.

## CLI Changes

### 1. Namespace Container Semantics

**File**: `packages/cli/src/lib/converter.ts`

**Change at line 186**:

```typescript
// Before
const repository = `${namespace}${normalizedPluginId}`;

// After
const repository = `${namespace}/${normalizedPluginId}`;
```

**Behavior**:

- Users provide namespace as `ghcr.io/owner/repo` (recommended) or `ghcr.io/owner/repo/` (trailing slash stripped)
- Both produce: `ghcr.io/owner/repo/plugin-id`
- Fixes bug where namespace without trailing slash caused incorrect concatenation like `community-pluginsurl-into-selection`

**Testing**:

- Update `packages/cli/src/__tests__/converter.test.ts` to verify slash insertion
- Update `packages/cli/src/lib/__tests__/namespace.test.ts` to document container semantics

### 2. ORAS-Compatible Manifest Title

**File**: `packages/cli/src/lib/converter.ts`

**Change at line 290**:

```typescript
// Before
const configResult = await client.pushBlob({
  data: manifestBuffer,
  annotations: {
    "org.opencontainers.image.title": pluginData.manifest.name,
  },
});

// After
const configResult = await client.pushBlob({
  data: manifestBuffer,
  annotations: {
    "org.opencontainers.image.title": ASSET_MANIFEST_JSON,
  },
});
```

**Rationale**: Uses existing `ASSET_MANIFEST_JSON` constant (defined at line 15) to ensure ORAS extracts the manifest with correct filename `manifest.json`, matching how `main.js` and `styles.css` layers are already annotated.

## Marketplace Changes

### 3. OCI-to-Markdown Transform with Zod

**New file**: `packages/lib/src/marketplace/oci-to-markdown.ts`

**Zod schemas**:

```typescript
import { z } from "zod";

// Schema for OCI manifest annotations
const OciAnnotationsSchema = z.object({
  "org.opencontainers.image.title": z.string(),
  "org.opencontainers.image.description": z.string().optional(),
  "org.opencontainers.image.version": z.string(),
  "org.opencontainers.image.created": z.string(),
  "org.opencontainers.image.authors": z.string().optional(),
  "org.opencontainers.image.url": z.string().optional(),
  "org.opencontainers.image.source": z.string().optional(),
  "org.opencontainers.image.licenses": z.string().optional(),
  "vnd.obsidianmd.plugin.id": z.string(),
  "vnd.obsidianmd.plugin.name": z.string(),
  "vnd.obsidianmd.plugin.author": z.string(),
  "vnd.obsidianmd.plugin.description": z.string(),
  "vnd.obsidianmd.plugin.repo": z.string(),
  "vnd.obsidianmd.plugin.minAppVersion": z.string().optional(),
}).passthrough(); // Allow other annotations

// Transform to frontmatter structure
const FrontmatterSchema = OciAnnotationsSchema.transform((annotations) => ({
  id: annotations["vnd.obsidianmd.plugin.id"],
  name: annotations["vnd.obsidianmd.plugin.name"],
  author: annotations["vnd.obsidianmd.plugin.author"],
  description: annotations["vnd.obsidianmd.plugin.description"],
  repository: annotations["org.opencontainers.image.source"],
  license: annotations["org.opencontainers.image.licenses"],
  minObsidianVersion: annotations["vnd.obsidianmd.plugin.minAppVersion"],
  registryUrl: /* derived from repo URL */,
}));
```

**Updated `apps/marketplace/scripts/generate-plugins-json.ts` flow**:

1. Scan `apps/marketplace/content/plugins/*.md` for existing markdown
2. For each markdown file, extract `registryUrl` from frontmatter
3. Query GHCR for latest tag to get annotations
4. Use Zod transform to generate computed frontmatter
5. **Merge**: Markdown frontmatter overrides computed values (editorial control)
6. If markdown file doesn't exist but plugin exists in GHCR, generate new markdown with default introduction
7. Write/update markdown files with computed frontmatter
8. Continue existing flow to build `plugins.json`

**Benefits**:

- GHCR is source of truth for metadata
- Editorial markdown can override any field
- Type-safe transformation with Zod validation
- Automatic markdown generation for new plugins

### 4. Version Deduplication by SHA

**Changes in `apps/marketplace/scripts/generate-plugins-json.ts`**:

**New types**:

```typescript
interface GroupedVersion {
  sha: string;
  canonicalTag: string; // Full semver (highest priority)
  additionalTags: string[];
  publishedAt: string;
  size: number;
  annotations: Record<string, string>;
}
```

**Grouping logic**:

```typescript
// After fetching all tag metadata
const versionMap = new Map<
  string,
  {
    tags: string[];
    publishedAt: string;
    size: number;
    annotations: Record<string, string>;
  }
>();

for (const metadata of allTagMetadata) {
  const existing = versionMap.get(metadata.sha);
  if (existing) {
    existing.tags.push(metadata.tag);
  } else {
    versionMap.set(metadata.sha, {
      tags: [metadata.tag],
      publishedAt: metadata.publishedAt,
      size: metadata.size,
      annotations: metadata.annotations,
    });
  }
}

// Convert to grouped versions with canonical tag selection
const groupedVersions: GroupedVersion[] = Array.from(versionMap.entries()).map(
  ([sha, data]) => {
    // Sort tags: full semver > short semver > latest/other
    const sorted = sortTagsByPriority(data.tags);
    return {
      sha,
      canonicalTag: sorted[0],
      additionalTags: sorted.slice(1),
      publishedAt: data.publishedAt,
      size: data.size,
      annotations: data.annotations,
    };
  },
);
```

**Tag priority function**:

```typescript
function sortTagsByPriority(tags: string[]): string[] {
  return tags.sort((a, b) => {
    // Full semver (X.Y.Z) highest priority
    const aIsFullSemver = /^\d+\.\d+\.\d+/.test(a);
    const bIsFullSemver = /^\d+\.\d+\.\d+/.test(b);
    if (aIsFullSemver && !bIsFullSemver) return -1;
    if (!aIsFullSemver && bIsFullSemver) return 1;
    // Lexicographic for same type
    return b.localeCompare(a, undefined, { numeric: true });
  });
}
```

**Updated type in `packages/lib/src/marketplace/index.ts`**:

```typescript
export interface PluginVersion {
  canonicalTag: string;
  additionalTags?: string[]; // New optional field
  sha: string; // New required field
  publishedAt: string;
  size: number;
  annotations: Record<string, string>;
}
```

**Example display**:

- Version card shows: `1.2.3`
- Below: "Also tagged as: 1.2, latest"
- All tags point to same SHA/content

### 5. Progressive Disclosure UI

**Step 1: Add shadcn-svelte Collapsible component**

Install the Collapsible component to `apps/marketplace/src/lib/components/ui/collapsible/`:

- Follow shadcn-svelte installation for Collapsible component
- Creates: `collapsible.svelte`, `index.ts` with Root, Trigger, Content exports

**Step 2: Update version card in `apps/marketplace/src/routes/plugins/[id]/+page.svelte`**:

Add import:

```svelte
import * as Collapsible from "$lib/components/ui/collapsible";
```

Replace lines 160-169 with:

```svelte
{#if version.additionalTags && version.additionalTags.length > 0}
  <div class="mt-2">
    <p class="text-xs text-muted-foreground">
      Also tagged as: {version.additionalTags.join(", ")}
    </p>
  </div>
{/if}

{#if version.annotations && Object.keys(version.annotations).length > 0}
  <Collapsible.Root class="mt-2">
    <Collapsible.Trigger class="text-xs text-muted-foreground hover:text-foreground">
      Show annotations ({Object.keys(version.annotations).length})
    </Collapsible.Trigger>
    <Collapsible.Content class="mt-2 space-y-1 pl-2">
      {#each Object.entries(version.annotations) as [key, value]}
        <p class="text-xs text-muted-foreground">
          <span class="font-mono">{key}:</span> {value}
        </p>
      {/each}
    </Collapsible.Content>
  </Collapsible.Root>
{/if}
```

**Features**:

- Show canonical tag as main version (e.g., `1.2.3`)
- Display `additionalTags` as comma-separated list if present
- Annotations collapsed by default with summary showing count
- Click to expand/collapse per version
- Uses shadcn-svelte Collapsible for consistent design system

## Implementation Order

1. **CLI fixes** (namespace + ORAS) - independent, can ship immediately
2. **Zod transform module** - foundation for marketplace changes
3. **Import script refactor** - generates new data structure
4. **UI updates** - consumes new data structure

## Testing Strategy

- **CLI**: Unit tests for namespace concatenation and annotation constants
- **Marketplace**: Integration test that verifies GHCR fetch → Zod transform → markdown generation
- **UI**: Manual verification of collapsible annotations and tag grouping display
