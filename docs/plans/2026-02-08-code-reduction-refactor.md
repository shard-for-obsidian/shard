# Code Reduction Refactoring Plan

**Date**: 2026-02-08
**Status**: Planning
**Goal**: Ruthlessly reduce codebase size by eliminating redundancy, consolidating logic, and removing abandoned code

## Executive Summary

This plan identifies opportunities to reduce the Shard monorepo codebase by approximately **1,000-1,250 lines of code (4-5%)** and **28 files** through:

1. Moving duplicate/shared logic to `@shard-for-obsidian/lib`
2. Removing abandoned Hugo marketplace implementation
3. Consolidating duplicate dependencies
4. Cleaning up underutilized dependencies

## Current State Analysis

### Codebase Statistics

- **Total source files**: 226 TypeScript/JavaScript files
- **Total lines of code**: ~25,640 LOC
- **Hugo marketplace**: ~697 LOC + 28 files (abandoned)

### Repository Structure

```
shard/
├── packages/
│   ├── shard-cli/          # CLI tool
│   ├── shard-installer/    # Obsidian plugin
│   └── shard-lib/          # Shared library
├── apps/
│   └── marketplace/        # SvelteKit marketplace (ACTIVE)
└── marketplace/            # Hugo marketplace (ABANDONED)
```

## Key Findings

### 1. Duplicate MarketplaceClient Implementation

**Impact**: ~96 LOC duplicate, can reduce to ~20 LOC

Both CLI and installer have nearly identical `MarketplaceClient` classes:

- `packages/shard-cli/src/lib/marketplace-client.ts` (96 LOC)
- `packages/shard-installer/src/marketplace/marketplace-client.ts` (94 LOC)

**Current Duplication**:

```typescript
// CLI version - basic client
export class MarketplaceClient {
  async fetchPlugins(): Promise<MarketplacePlugin[]>;
  async findPluginById(pluginId: string): Promise<MarketplacePlugin | null>;
  async searchPlugins(keyword: string): Promise<MarketplacePlugin[]>;
}

// Installer version - adds caching
export class MarketplaceClient {
  private cache: CachedMarketplaceData | null;
  async fetchPlugins(): Promise<MarketplacePlugin[]>; // with cache
  clearCache(): void;
  setMarketplaceUrl(url: string): void;
  setCacheTTL(ttl: number): void;
}
```

**Recommendation**: Consolidate into lib with optional caching adapter pattern.

**Files**:

- `packages/shard-cli/src/lib/marketplace-client.ts`
- `packages/shard-installer/src/marketplace/marketplace-client.ts`

### 2. Duplicate Digest Utilities

**Impact**: ~28 LOC duplicate

Two implementations of SHA-256 digest calculation:

- `packages/shard-cli/src/lib/digest.ts` (28 LOC) - Node.js `crypto` module
- `packages/shard-lib/src/utils/DigestUtils.ts` (37 LOC) - Web Crypto API

**Current Duplication**:

```typescript
// CLI version (Node.js)
import { createHash } from "node:crypto";
export function calculateDigest(data: ArrayBuffer | Uint8Array): string {
  const hash = createHash("sha256");
  hash.update(new Uint8Array(data));
  return `sha256:${hash.digest("hex")}`;
}

// Lib version (Web Crypto)
export async function digestFromManifestStr(
  manifestStr: string,
): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(manifestStr),
  );
  return `sha256:${encodeHex(hash)}`;
}
```

**Recommendation**: Keep lib version (Web Crypto works in both Node.js and browser), remove CLI duplicate.

**Files**:

- `packages/shard-cli/src/lib/digest.ts` (DELETE)
- `packages/shard-lib/src/utils/DigestUtils.ts` (KEEP)

### 3. OCI Tags Query Logic Should Move to Lib

**Impact**: ~187 LOC can move to lib

The file `packages/shard-cli/src/lib/oci-tags.ts` contains pure business logic:

- `queryOciTags()` - queries available versions from OCI registry
- `queryTagMetadata()` - queries version metadata and annotations
- Auth challenge parsing for GHCR
- Token exchange logic

**Why Move**:

- Works via `FetchAdapter` interface (already in lib)
- Contains no Node.js-specific code
- Currently used by root-level generation script
- Would be useful for future web-based tools

**Current Location**: `packages/shard-cli/src/lib/oci-tags.ts`
**Target Location**: `packages/shard-lib/src/oci/tags.ts`

### 4. Marketplace Generation Script Has Embedded Fetch Adapter

**Impact**: ~13 LOC duplicate adapter logic

`marketplace/scripts/generate-plugins-json.ts` has an inline `nodeFetchAdapter` that duplicates logic from `packages/shard-cli/src/adapters/node-fetch-adapter.ts`.

**Current Duplication** (lines 22-35):

```typescript
const nodeFetchAdapter: FetchAdapter = {
  fetch: async (url, options) => {
    const response = await fetch(url, options);
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      json: async () => response.json(),
      text: async () => response.text(),
      arrayBuffer: async () => response.arrayBuffer(),
    };
  },
};
```

**Recommendation**: Move both Node and Obsidian fetch adapters to lib package.

**Files**:

- `packages/shard-cli/src/adapters/node-fetch-adapter.ts`
- `packages/shard-installer/src/adapters/obsidian-fetch-adapter.ts`
- `marketplace/scripts/generate-plugins-json.ts` (inline adapter)

### 5. Complete Hugo Marketplace Removal

**Impact**: ~697 LOC + 28 files

The `/marketplace` directory contains an abandoned Hugo-based marketplace implementation:

```
marketplace/
├── content/             # Hugo content
├── data/               # Generated plugins.json
├── layouts/            # Hugo templates (abandoned)
├── static/             # Static assets
├── public/             # Build output
├── plugins/            # Plugin markdown files (3 files, KEEP)
├── scripts/            # Generation script (KEEP, move)
└── hugo.toml           # Hugo config (DELETE)
```

**What to Keep**:

- Plugin markdown files (`.md`) - source of truth
- Generation script - still needed

**What to Delete**:

- All Hugo templates and layouts
- Hugo configuration
- Hugo build artifacts

**Active Implementation**: `apps/marketplace` (SvelteKit)

### 6. Plugin Markdown Files Location

**Impact**: Organizational clarity

Plugin markdown files are currently in `/marketplace/plugins/` but should be colocated with the active SvelteKit marketplace in `/apps/marketplace/content/plugins/`.

**Current**: `marketplace/plugins/*.md`
**Target**: `apps/marketplace/content/plugins/*.md`

**Files to Move**:

- `nldates-obsidian.md`
- `notebook-navigator.md`
- `shard-installer.md`

### 7. Unused/Duplicate Dependencies

#### Root Package (`package.json`)

- **`gray-matter`**: Listed as BOTH dependency AND devDependency
  - Only used in build scripts
  - **Action**: Remove from `dependencies`, keep in `devDependencies`

#### Marketplace App (`apps/marketplace/package.json`)

- **`clsx`** + **`tailwind-merge`**: Overlapping functionality
  - `clsx` - simple className concatenation
  - `tailwind-merge` - Tailwind-aware class merging (superior)
  - `tailwind-variants` - Variant composition (different use case)
  - **Action**: Remove `clsx`, use `tailwind-merge` consistently

#### CLI Package (`packages/shard-cli/package.json`)

- **`pino`**: Only 2 imports across entire CLI
  - Heavyweight logging library
  - **Consider**: Replace with simple console logging or tiny logger util
- **`@stricli/core`**: 19 imports ✅ (actively used, keep)
- **`cli-progress`**: devDependency, used for progress bars
- **`ora`**: devDependency, used for spinners

## Refactoring Plan

### Phase 1: Move Shared Logic to Lib Package

**Estimated Impact**: ~323 LOC moved to lib, ~323 LOC removed from CLI/installer

#### 1.1 Move OCI Tags Logic

**Files**:

- **Source**: `packages/shard-cli/src/lib/oci-tags.ts` (187 LOC)
- **Target**: `packages/shard-lib/src/oci/tags.ts`

**Exports to Add**:

```typescript
// packages/shard-lib/src/oci/tags.ts
export interface QueryOciTagsOptions { ... }
export interface QueryTagMetadataOptions { ... }
export interface TagMetadata { ... }
export async function queryOciTags(options: QueryOciTagsOptions): Promise<string[]>
export async function queryTagMetadata(options: QueryTagMetadataOptions): Promise<TagMetadata>
```

**Update Imports**:

- `marketplace/scripts/generate-plugins-json.ts`
- `packages/shard-cli/src/commands/registry/versions.ts` (if exists)
- Any CLI commands using these functions

#### 1.2 Consolidate MarketplaceClient

**Files**:

- **Delete**: `packages/shard-cli/src/lib/marketplace-client.ts` (96 LOC)
- **Delete**: `packages/shard-installer/src/marketplace/marketplace-client.ts` (94 LOC)
- **Create**: `packages/shard-lib/src/marketplace/client.ts`

**New Implementation**:

```typescript
// packages/shard-lib/src/marketplace/client.ts
export interface MarketplaceClientOptions {
  marketplaceUrl: string;
  adapter: FetchAdapter;
  cache?: {
    enabled: boolean;
    ttl: number;
  };
}

export class MarketplaceClient {
  private cache?: Map<string, { data: MarketplacePlugin[], timestamp: number }>;

  constructor(private options: MarketplaceClientOptions) {
    if (options.cache?.enabled) {
      this.cache = new Map();
    }
  }

  async fetchPlugins(): Promise<MarketplacePlugin[]> { ... }
  async findPluginById(pluginId: string): Promise<MarketplacePlugin | null> { ... }
  async searchPlugins(keyword: string): Promise<MarketplacePlugin[]> { ... }
  clearCache(): void { ... }
}
```

**Update Imports**:

- CLI: `import { MarketplaceClient } from '@shard-for-obsidian/lib/marketplace'`
- Installer: Same import
- Types already exported from lib schemas ✅

#### 1.3 Remove Duplicate Digest Utility

**Files**:

- **Delete**: `packages/shard-cli/src/lib/digest.ts` (28 LOC)
- **Keep**: `packages/shard-lib/src/utils/DigestUtils.ts`

**Update Imports**:

- Find all `import { calculateDigest } from '../lib/digest'` in CLI
- Replace with `import { digestFromManifestStr } from '@shard-for-obsidian/lib'`
- May need adapter function if signatures differ

#### 1.4 Move Fetch Adapters to Lib

**Files**:

- **Move**: `packages/shard-cli/src/adapters/node-fetch-adapter.ts` → `packages/shard-lib/src/adapters/node.ts`
- **Keep**: `packages/shard-installer/src/adapters/obsidian-fetch-adapter.ts` (already references lib types)

**New Exports**:

```typescript
// packages/shard-lib/src/adapters/index.ts
export { NodeFetchAdapter } from "./node.js";
export { ObsidianFetchAdapter } from "./obsidian.js";

// packages/shard-lib/src/index.ts
export * from "./adapters/index.js";
```

**Update Imports**:

- CLI: `import { NodeFetchAdapter } from '@shard-for-obsidian/lib'`
- Generation script: Same import
- Installer: Keep existing (or also move to lib)

**Decision Point**: Should `ObsidianFetchAdapter` also move to lib?

- **Pros**: Single source of truth, lib has Obsidian types already
- **Cons**: Lib depends on `obsidian` package (currently installer-only)
- **Recommendation**: Keep in installer for now, create `adapters/` subpackage later if needed

#### Phase 1 Summary

| Action                        | LOC Removed | LOC Moved to Lib | Files Affected             |
| ----------------------------- | ----------- | ---------------- | -------------------------- |
| Move OCI tags                 | 187         | 187              | 1 file                     |
| Consolidate MarketplaceClient | 190         | ~80              | 2 files deleted, 1 created |
| Remove digest duplicate       | 28          | 0                | 1 file deleted             |
| Move Node adapter             | 12          | 12               | 1 file                     |
| **Total**                     | **417**     | **279**          | **5 files**                |

### Phase 2: Remove Hugo Marketplace

**Estimated Impact**: ~697 LOC removed, 28 files removed

#### 2.1 Relocate Plugin Content

```bash
# Create content directory in SvelteKit app
mkdir -p apps/marketplace/content/plugins

# Move plugin markdown files
mv marketplace/plugins/*.md apps/marketplace/content/plugins/

# Keep .gitkeep if desired
```

**Files to Move**:

- `nldates-obsidian.md`
- `notebook-navigator.md`
- `shard-installer.md`

#### 2.2 Move Generation Script

```bash
# Move script to SvelteKit app
mv marketplace/scripts/generate-plugins-json.ts apps/marketplace/scripts/
```

**Update Script Paths**:

```typescript
// apps/marketplace/scripts/generate-plugins-json.ts
// Old paths:
const pluginsDir = path.join(process.cwd(), "marketplace/plugins");
const dataDir = path.join(process.cwd(), "marketplace/data");

// New paths:
const pluginsDir = path.join(process.cwd(), "apps/marketplace/content/plugins");
const outputPath = path.join(
  process.cwd(),
  "apps/marketplace/static/plugins.json",
);
```

**Update Imports** (after Phase 1):

```typescript
// Old imports
import {
  queryOciTags,
  queryTagMetadata,
} from "../../packages/shard-cli/src/lib/oci-tags.js";

// New imports
import { queryOciTags, queryTagMetadata } from "@shard-for-obsidian/lib/oci";
import { NodeFetchAdapter } from "@shard-for-obsidian/lib/adapters";
```

Remove inline adapter, use:

```typescript
const nodeFetchAdapter = new NodeFetchAdapter();
```

#### 2.3 Update Root Package Scripts

```json
// package.json
{
  "scripts": {
    "marketplace:generate": "tsx apps/marketplace/scripts/generate-plugins-json.ts",
    "marketplace:dev": "pnpm marketplace:generate && pnpm --filter marketplace dev",
    "marketplace:build": "pnpm marketplace:generate && pnpm --filter marketplace build"
  }
}
```

#### 2.4 Delete Hugo Implementation

```bash
# Remove entire Hugo marketplace
rm -rf marketplace/
```

**Files to Delete**:

- `marketplace/content/`
- `marketplace/layouts/`
- `marketplace/static/`
- `marketplace/public/`
- `marketplace/plugins/` (already moved)
- `marketplace/scripts/` (already moved)
- `marketplace/data/`
- `marketplace/hugo.toml`
- `marketplace/.gitignore`
- `marketplace/.hugo_build.lock`
- `marketplace/README.md`

#### Phase 2 Summary

| Action                    | LOC Removed | Files Removed | Files Moved |
| ------------------------- | ----------- | ------------- | ----------- |
| Delete Hugo templates     | ~400        | 15            | -           |
| Delete Hugo config        | ~50         | 3             | -           |
| Delete Hugo static assets | ~200        | 8             | -           |
| Move plugins              | -           | -             | 3           |
| Move script               | -           | -             | 1           |
| **Total**                 | **~650**    | **26**        | **4**       |

### Phase 3: Dependency Cleanup

**Estimated Impact**: 3-5 dependencies removed, minimal LOC changes

#### 3.1 Root Package Cleanup

**File**: `package.json`

```json
// BEFORE
{
  "dependencies": {
    "gray-matter": "^4.0.3"  // ❌ Remove
  },
  "devDependencies": {
    "gray-matter": "^4.0.3"  // ✅ Keep
  }
}

// AFTER
{
  "devDependencies": {
    "gray-matter": "^4.0.3"  // ✅ Only here
  }
}
```

#### 3.2 Marketplace Package Cleanup

**File**: `apps/marketplace/package.json`

```json
// BEFORE
{
  "dependencies": {
    "clsx": "^2.1.1",              // ❌ Remove (redundant)
    "tailwind-merge": "^2.5.5",    // ✅ Keep
    "tailwind-variants": "^0.2.1"  // ✅ Keep
  }
}

// AFTER
{
  "dependencies": {
    "tailwind-merge": "^2.6.1",    // ✅ Keep
    "tailwind-variants": "^0.2.1"  // ✅ Keep
  }
}
```

**Code Changes**:

```typescript
// Find all uses of clsx in apps/marketplace
// Replace with tailwind-merge

// Before
import { clsx } from "clsx";
const className = clsx("base", isActive && "active");

// After
import { twMerge } from "tailwind-merge";
const className = twMerge("base", isActive && "active");

// Or use cn() helper
import { cn } from "$lib/utils";
const className = cn("base", isActive && "active");
```

#### 3.3 Evaluate Pino in CLI

**File**: `packages/shard-cli/package.json`

**Current Usage**: Only 2 imports of `pino` in entire CLI package

**Options**:

1. **Keep pino**: It's already there, provides structured logging
2. **Remove pino**: Replace with simple console logging
3. **Replace with tiny logger**: Create `packages/shard-cli/src/infrastructure/logger.ts` with console-based impl

**Recommendation**: Evaluate in separate task. Pino provides value for CLI tools (structured logs, log levels, pretty printing). If only 2 imports, might be overkill, but not urgent.

**Decision**: Defer to Phase 4 (optional)

#### Phase 3 Summary

| Action                       | Dependencies Removed | LOC Changes          |
| ---------------------------- | -------------------- | -------------------- |
| Remove duplicate gray-matter | 1                    | 0                    |
| Remove clsx from marketplace | 1                    | ~10 (import changes) |
| **Total**                    | **2**                | **~10**              |

### Phase 4: Optional Aggressive Consolidation

**Estimated Impact**: Additional ~250 LOC moved to lib

#### 4.1 Community Plugins Logic

**Files**:

- `packages/shard-cli/src/lib/community-cache.ts` (45 LOC)
- `packages/shard-cli/src/lib/community-plugins.ts` (18 LOC)

**Current Usage**: CLI-only commands for querying Obsidian community plugins

**Decision Point**: Move to lib?

- **Pros**: Could be useful for future web tools, marketplace comparisons
- **Cons**: Currently CLI-specific use case
- **Recommendation**: Keep in CLI for now, move if another package needs it

#### 4.2 GitHub Release Utilities

**Files**:

- `packages/shard-cli/src/lib/github-release.ts` (95 LOC)

**Current Usage**: CLI commands that fetch GitHub releases

**Decision Point**: Move to lib?

- **Pros**: General-purpose GitHub API client
- **Cons**: CLI-specific workflow
- **Recommendation**: Keep in CLI for now

#### 4.3 Plugin Converter

**Files**:

- `packages/shard-cli/src/lib/converter.ts` (261 LOC)

**Current Usage**: CLI command to convert plugins to OCI format

**Decision**: **Keep in CLI** - This is CLI-specific workflow logic

#### Phase 4 Summary

**Recommendation**: Skip Phase 4 for now. The logic in question is either:

1. CLI-specific workflows (converter, GitHub release)
2. Premature abstraction (community plugins)

Move these to lib only when a second consumer needs them (YAGNI principle).

## Implementation Order

### Recommended Sequence

1. ✅ **Review this plan** - Get buy-in on approach
2. **Phase 1** - Move shared logic to lib (biggest architectural win)
3. **Phase 2** - Remove Hugo marketplace (most visible cleanup)
4. **Phase 3** - Dependency cleanup (quick wins)
5. **Phase 4** - Optional (defer indefinitely)

### Alternative: "Big Bang" Approach

Execute all phases in single PR:

- **Pros**: One-time coordination, complete cleanup
- **Cons**: Large PR, harder to review, higher risk

**Recommendation**: Execute phases sequentially for easier review and rollback.

## Expected Outcomes

### Quantitative Improvements

| Metric       | Before | After  | Reduction  |
| ------------ | ------ | ------ | ---------- |
| Total LOC    | 25,640 | 24,620 | 1,020 (4%) |
| Source Files | 226    | 220    | 6 files    |
| Hugo Files   | 28     | 0      | 28 files   |
| Dependencies | ~50    | ~48    | 2-5 deps   |

### Qualitative Improvements

1. **Single Source of Truth**: Shared logic lives in lib package
2. **Clearer Architecture**: CLI and installer consume lib, no cross-dependencies
3. **Easier Maintenance**: Changes to shared logic happen once
4. **Faster Builds**: Fewer files to process, smaller dependency tree
5. **Better Developer Experience**: One place to look for core logic

## Risks and Mitigations

### Risk 1: Breaking Changes in Lib

**Scenario**: Moving code to lib changes behavior

**Mitigation**:

- Write tests for lib exports before moving
- Ensure existing tests pass after move
- Use type system to catch breaking changes

### Risk 2: Generation Script Breakage

**Scenario**: Moving Hugo files breaks marketplace generation

**Mitigation**:

- Test generation script after each path change
- Keep backup of `plugins.json` before regenerating
- Update CI/CD to run generation as smoke test

### Risk 3: Adapter Compatibility

**Scenario**: Fetch adapter changes break one platform

**Mitigation**:

- Test both Node and Obsidian adapters independently
- Create integration tests for OCI registry queries
- Test CLI and installer builds after changes

### Risk 4: Import Path Confusion

**Scenario**: Moving files creates import path hell

**Mitigation**:

- Use TypeScript's `paths` in `tsconfig.json` for clean imports
- Update all imports in single commit
- Use IDE's "find all references" before moving files

## Testing Strategy

### Phase 1 Testing

- [ ] Unit tests for moved lib functions
- [ ] CLI commands still work (manual testing)
- [ ] Installer plugin still works in Obsidian
- [ ] Generation script produces valid `plugins.json`

### Phase 2 Testing

- [ ] SvelteKit marketplace builds successfully
- [ ] Generation script with new paths works
- [ ] Plugin markdown files are found and parsed
- [ ] `plugins.json` contains expected data

### Phase 3 Testing

- [ ] `pnpm install` succeeds after dep removal
- [ ] Marketplace app builds without `clsx`
- [ ] No runtime errors from removed dependencies

## Success Criteria

### Definition of Done

- [ ] All phases completed (or explicitly deferred)
- [ ] All tests passing
- [ ] No build errors in any package
- [ ] Documentation updated (this plan marked as complete)
- [ ] PR merged to main branch

### Validation Checklist

- [ ] `pnpm build` succeeds in root
- [ ] `pnpm test` passes in all packages
- [ ] CLI commands work: `shard search`, `shard pull`, etc.
- [ ] Installer builds: `pnpm --filter shard-installer build`
- [ ] Marketplace builds: `pnpm --filter marketplace build`
- [ ] Generation script works: `pnpm marketplace:generate`
- [ ] Code size reduced by >900 LOC
- [ ] File count reduced by >25 files

## Open Questions

1. **ObsidianFetchAdapter Location**: Move to lib or keep in installer?
   - **Lean toward**: Keep in installer for now
   - **Reason**: Lib doesn't depend on `obsidian` package currently

2. **Pino Replacement**: Remove or keep?
   - **Lean toward**: Keep for now
   - **Reason**: Provides value, not urgent to replace

3. **Community Plugins Logic**: Move to lib preemptively?
   - **Lean toward**: Keep in CLI
   - **Reason**: YAGNI - no second consumer yet

4. **Test Coverage**: Should we add tests before moving?
   - **Lean toward**: Yes for critical paths
   - **Reason**: Regression prevention

## Related Documents

- [SvelteKit Marketplace Migration Design](./2026-02-06-sveltekit-marketplace-migration-design.md)
- [Scoped Packages Design](./2026-02-06-scoped-packages-design.md)
- [Zod Schema Implementation](./2026-02-07-zod-implementation.md)

## Appendix: File Manifest

### Files to Delete (Phase 1)

```
packages/shard-cli/src/lib/marketplace-client.ts
packages/shard-cli/src/lib/digest.ts
packages/shard-installer/src/marketplace/marketplace-client.ts
```

### Files to Move (Phase 1)

```
packages/shard-cli/src/lib/oci-tags.ts → packages/shard-lib/src/oci/tags.ts
packages/shard-cli/src/adapters/node-fetch-adapter.ts → packages/shard-lib/src/adapters/node.ts
```

### Files to Create (Phase 1)

```
packages/shard-lib/src/marketplace/client.ts
packages/shard-lib/src/oci/index.ts
packages/shard-lib/src/adapters/index.ts
```

### Files to Delete (Phase 2)

```
marketplace/                          # Entire directory
├── content/
├── data/
├── layouts/
├── public/
├── static/
├── hugo.toml
├── .hugo_build.lock
├── .gitignore
└── README.md
```

### Files to Move (Phase 2)

```
marketplace/plugins/*.md → apps/marketplace/content/plugins/
marketplace/scripts/generate-plugins-json.ts → apps/marketplace/scripts/
```

### Files to Modify (All Phases)

```
package.json                                    # Update scripts
packages/shard-cli/package.json                # Remove gray-matter? (or keep)
apps/marketplace/package.json                  # Remove clsx
packages/shard-lib/src/index.ts                # Add exports
apps/marketplace/scripts/generate-plugins-json.ts  # Update imports
```

## Conclusion

This refactoring will result in a **cleaner, more maintainable codebase** with:

- **~1,000 LOC removed** (4% reduction)
- **28 files removed** (Hugo implementation)
- **Clearer architecture** (lib as single source of truth)
- **Fewer dependencies** (2-5 removed)

The work is divided into manageable phases that can be executed independently with clear rollback points. Phase 1 provides the most architectural value, Phase 2 the most visible cleanup, and Phase 3 quick wins.

**Next Steps**: Get approval on this plan, then proceed with Phase 1 implementation.
