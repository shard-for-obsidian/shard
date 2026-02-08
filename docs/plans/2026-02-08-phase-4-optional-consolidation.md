# Phase 4: Optional Aggressive Consolidation

**Date**: 2026-02-08
**Status**: Deferred
**Parent Plan**: [Code Reduction Refactoring](./2026-02-08-code-reduction-refactor.md)

## Overview

This document outlines **Phase 4** of the code reduction refactoring plan - optional aggressive consolidation of CLI-specific utilities that could potentially be moved to the lib package. This phase is **deferred** and should only be executed when a second consumer (other than CLI) needs these utilities.

**YAGNI Principle**: "You Aren't Gonna Need It" - We should not prematurely abstract code that's only used in one place.

## Estimated Impact

**If all Phase 4 items are implemented**: Additional ~250 LOC moved to lib

However, this comes with **maintenance overhead** and **premature abstraction** risks that outweigh the benefits at this time.

## Deferred Items

### 4.1 Community Plugins Logic

**Current Location**: CLI package only

**Files**:

- `packages/shard-cli/src/lib/community-cache.ts` (45 LOC)
- `packages/shard-cli/src/lib/community-plugins.ts` (18 LOC)

**What it does**:

- Fetches and caches the Obsidian community plugins list
- Queries plugins by ID from the official community registry
- Used by CLI commands to convert legacy plugins to Shard format

**Current Usage**: CLI-only commands for querying Obsidian community plugins

#### Analysis

**Why it's CLI-specific**:

1. Used exclusively by the `convert` command
2. Deals with legacy plugin conversion workflow
3. Caching strategy is optimized for CLI usage patterns
4. No other package has expressed need for this functionality

**Pros of moving to lib**:

- Could be useful for future web tools that compare plugins
- Could enable marketplace comparisons (Shard vs Community)
- Potential browser-based conversion tool

**Cons of moving to lib**:

- Premature abstraction (YAGNI violation)
- Adds complexity to lib package
- Caching strategy may not fit other consumers
- No clear second use case exists today

**Decision**: **Keep in CLI for now**

**When to reconsider**:

- Marketplace app needs to compare plugins against community registry
- Web-based conversion tool is planned
- Another package needs to query community plugins

#### Implementation Guide (If Moved)

If a second consumer emerges, here's how to move it:

1. **Create lib module**:

   ```
   packages/shard-lib/src/community/
   ├── index.ts
   ├── client.ts        # CommunityPluginsClient
   ├── cache.ts         # CommunityPluginsCache
   └── types.ts         # CommunityPlugin interface
   ```

2. **Adapt caching strategy**:

   ```typescript
   // Make caching optional/configurable
   export interface CommunityClientOptions {
     adapter: FetchAdapter;
     cache?: {
       enabled: boolean;
       ttl: number;
     };
   }
   ```

3. **Update CLI to use lib**:

   ```typescript
   // packages/shard-cli/src/lib/community-plugins.ts
   export {
     CommunityPluginsClient,
     CommunityPluginsCache,
     type CommunityPlugin,
   } from "@shard-for-obsidian/lib";
   ```

4. **Add tests to lib**:
   - Test fetching community plugins
   - Test caching behavior
   - Test error handling

---

### 4.2 GitHub Release Utilities

**Current Location**: CLI package only

**Files**:

- `packages/shard-cli/src/lib/github-release.ts` (95 LOC)

**What it does**:

- Fetches GitHub releases for a repository
- Extracts manifest.json and main.js from release assets
- Used by the plugin converter to fetch legacy plugin files

**Current Usage**: CLI commands that fetch GitHub releases for conversion

#### Analysis

**Why it's CLI-specific**:

1. Used exclusively by the `convert` command workflow
2. Tightly coupled to the conversion process
3. Makes specific assumptions about plugin structure
4. Release asset extraction logic is conversion-specific

**Pros of moving to lib**:

- General-purpose GitHub API client could be useful
- Potential for marketplace to show GitHub release info
- Could enable automatic update checking

**Cons of moving to lib**:

- Not a general-purpose GitHub client (very plugin-specific)
- Extraction logic is tied to conversion workflow
- Would need significant refactoring to be generic
- No clear second use case exists today

**Decision**: **Keep in CLI for now**

**When to reconsider**:

- Marketplace needs to display GitHub release information
- Installer needs to check for updates via GitHub
- Another package needs to interact with GitHub releases

#### Implementation Guide (If Moved)

If a second consumer emerges, here's how to move it:

1. **Refactor into two modules**:

   ```
   packages/shard-lib/src/github/
   ├── index.ts
   ├── client.ts        # Generic GitHub API client
   └── releases.ts      # Release-specific operations
   ```

2. **Separate concerns**:

   ```typescript
   // Generic client
   export class GitHubClient {
     constructor(
       private adapter: FetchAdapter,
       private token?: string,
     ) {}

     async getRelease(
       owner: string,
       repo: string,
       tag: string,
     ): Promise<Release>;
     async getLatestRelease(owner: string, repo: string): Promise<Release>;
   }

   // Plugin-specific operations (could stay in CLI)
   export class PluginReleaseExtractor {
     async extractManifest(release: Release): Promise<Manifest>;
     async extractMainJs(release: Release): Promise<string>;
   }
   ```

3. **Update CLI**:

   ```typescript
   // Use generic client from lib
   import { GitHubClient } from "@shard-for-obsidian/lib";

   // Keep plugin-specific logic in CLI
   const client = new GitHubClient(adapter, token);
   const release = await client.getLatestRelease(owner, repo);
   const manifest = await extractManifestFromRelease(release);
   ```

---

### 4.3 Plugin Converter

**Current Location**: CLI package only

**Files**:

- `packages/shard-cli/src/lib/converter.ts` (261 LOC)
- `packages/shard-cli/src/commands/convert.ts` (command wrapper)

**What it does**:

- Converts legacy Obsidian plugins to Shard format
- Fetches from GitHub releases or community registry
- Creates OCI manifests and pushes to registry
- Handles manifest validation and transformation

**Current Usage**: CLI command to convert plugins to OCI format

#### Analysis

**Why it's CLI-specific**:

1. This is a **workflow**, not a library function
2. Orchestrates multiple operations (fetch, transform, push)
3. Has CLI-specific error handling and logging
4. Tightly coupled to command-line usage patterns
5. No conceivable use case outside of CLI

**Decision**: **Definitely keep in CLI**

This is CLI-specific workflow logic and should **never** be moved to lib.

#### Why This Shouldn't Move

```typescript
// This is a workflow orchestration, not a library function
export async function convertPlugin(opts: ConvertOptions): Promise<void> {
  // 1. Fetch from GitHub or community registry
  // 2. Validate manifest
  // 3. Download assets
  // 4. Transform to OCI format
  // 5. Push to registry
  // 6. Log results
  // All of these steps are CLI-specific orchestration
}
```

**What could be in lib** (already is):

- ✅ OCI registry client
- ✅ Manifest validation
- ✅ Manifest transformation
- ✅ GitHub API client (if genericized per 4.2)
- ✅ Community plugins client (if needed per 4.1)

The **converter orchestrates these** - it's the glue code that belongs in CLI.

---

## Decision Matrix

| Item                 | Move to Lib?         | Reasoning                             |
| -------------------- | -------------------- | ------------------------------------- |
| Community Plugins    | ❌ No                | Only CLI uses it, no second consumer  |
| GitHub Release Utils | ❌ No                | Too specific, needs refactoring first |
| Plugin Converter     | ❌ **Definitely No** | Workflow orchestration, CLI-specific  |

---

## Triggering Conditions

Phase 4 items should be reconsidered when:

### Community Plugins (`4.1`)

- [ ] Marketplace needs to compare Shard plugins with community plugins
- [ ] Web-based tool for browsing community plugins is planned
- [ ] Installer needs to check if plugin exists in community registry
- [ ] At least 2 packages need this functionality

### GitHub Release Utils (`4.2`)

- [ ] Marketplace needs to display GitHub release info
- [ ] Installer needs automatic update checking via GitHub
- [ ] Multiple packages need GitHub API access
- [ ] At least 2 packages need this functionality

### Plugin Converter (`4.3`)

- [ ] **Never** - This is workflow orchestration, not library code

---

## Implementation Checklist

**If and only if** triggering conditions are met, follow this process:

### Pre-Implementation

- [ ] Confirm at least 2 packages need the functionality
- [ ] Review the implementation guide for that item
- [ ] Create a design document for the specific move
- [ ] Get approval from team/stakeholders

### Implementation

- [ ] Create new module in `packages/shard-lib/src/`
- [ ] Extract and refactor code to be generic
- [ ] Add comprehensive tests to lib package
- [ ] Update CLI to import from lib
- [ ] Verify all existing tests still pass
- [ ] Test the new consumer that triggered the move

### Post-Implementation

- [ ] Update this document to mark item as complete
- [ ] Update main refactoring plan
- [ ] Document the decision in commit message
- [ ] Update package READMEs if needed

---

## Risks of Premature Abstraction

Moving these items **before** they're needed by a second consumer carries risks:

### 1. Over-Engineering

- Adding complexity without clear benefit
- Making lib package harder to understand
- Creating APIs that don't match actual use cases

### 2. Wrong Abstraction

- Designing for hypothetical use cases
- API doesn't fit when real second consumer appears
- Requires refactoring to fix the abstraction

### 3. Maintenance Burden

- More code in lib means more to maintain
- Tests in multiple places
- Changes require coordinating across packages

### 4. False Sense of Reusability

- Code looks reusable but is actually very specific
- Future consumers have to work around the abstraction
- "Reusable" code that's only used once

---

## Guiding Principles

When deciding whether to move code to lib in the future:

### The Rule of Three

Wait until **three** occurrences before abstracting:

1. First occurrence: Write in the specific location (CLI)
2. Second occurrence: Copy-paste and note the duplication
3. Third occurrence: Extract to shared library

**Currently**: We're at occurrence #1 for all Phase 4 items.

### YAGNI - You Aren't Gonna Need It

Don't build functionality until you need it. Speculative generality is a code smell.

### Separate Interface from Implementation

If you must prepare for future reuse:

- Keep the implementation in CLI
- Design the interface to be library-worthy
- Move when the second consumer appears

### Optimize for Change

The goal is to make future moves **easy**, not to move things **now**.

---

## Examples from Industry

### Good Abstraction Timing

```typescript
// After Phase 1: This was RIGHT to move
// - Used by CLI, installer, and generation script (3 consumers)
// - Clear abstraction boundary
// - Well-defined interface
export class MarketplaceClient {
  async fetchPlugins(): Promise<MarketplacePlugin[]> { ... }
}
```

### Premature Abstraction (Avoided)

```typescript
// This would be WRONG to move now
// - Only used by CLI convert command (1 consumer)
// - Workflow orchestration, not library function
// - No second consumer on the horizon
export class PluginConverter {
  async convert(options: ConvertOptions): Promise<void> { ... }
}
```

---

## Success Criteria for Future Moves

Before moving any Phase 4 item, ensure:

1. ✅ **Multiple Consumers**: At least 2 packages need it
2. ✅ **Clear Interface**: API is well-defined and generic
3. ✅ **Test Coverage**: Comprehensive tests in lib
4. ✅ **No Duplication**: Eliminates actual (not hypothetical) duplication
5. ✅ **Maintains Simplicity**: Doesn't over-complicate lib package
6. ✅ **Team Agreement**: Stakeholders approve the move

---

## Conclusion

Phase 4 is **intentionally deferred** to avoid premature abstraction. The current architecture with CLI-specific utilities in the CLI package is the correct design for the current use cases.

**Re-evaluate Phase 4 items only when**:

- A second consumer emerges with a real need
- The abstraction becomes obvious and beneficial
- The cost of duplication exceeds the cost of abstraction

Until then, **YAGNI** - keep it simple, keep it in CLI.

---

## Related Documents

- [Main Code Reduction Refactoring Plan](./2026-02-08-code-reduction-refactor.md)
- [SvelteKit Marketplace Migration](./2026-02-06-sveltekit-marketplace-migration-design.md)
- [Scoped Packages Design](./2026-02-06-scoped-packages-design.md)

---

## Revision History

| Date       | Version | Changes                             |
| ---------- | ------- | ----------------------------------- |
| 2026-02-08 | 1.0     | Initial document - Phase 4 deferred |
