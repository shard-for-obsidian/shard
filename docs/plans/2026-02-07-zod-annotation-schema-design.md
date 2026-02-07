# Zod Integration & Annotation Schema Refactoring

**Date:** 2026-02-07
**Status:** Approved

## Overview

Refactor OCI manifest annotations and introduce Zod for schema validation and type generation. This simplifies the data model by using schemas as the single source of truth for TypeScript types while adding runtime validation at key system boundaries.

## Annotation Schema Changes

### Removed Fields

- `vnd.obsidianmd.plugin.original-repo` - no longer needed

### Renamed Fields

- `vnd.obsidianmd.plugin.repo` → `vnd.obsidianmd.plugin.source`

### Format Changes

The `source` field now uses VCS-style URLs:

- **Before:** `"johansan/notebook-navigator"`
- **After:** `"git+https://github.com/johansan/notebook-navigator.git"`

**Rationale:** Protocol-aware format enables future support for other VCS systems (Mercurial, SVN) or direct URLs while maintaining a standard parseable format.

## Zod Integration Strategy

### Schema Location

`packages/shard-lib/src/schemas/`

- `annotations.ts` - OCI annotation schemas
- `manifest.ts` - Obsidian manifest schema
- `marketplace.ts` - Marketplace types schema
- `transforms.ts` - Mapping functions between formats
- `index.ts` - Unified exports

### Core Schema Example

```typescript
// annotations.ts
const AnnotationSchema = z.object({
  "vnd.obsidianmd.plugin.id": z.string(),
  "vnd.obsidianmd.plugin.name": z.string(),
  "vnd.obsidianmd.plugin.version": z.string(),
  "vnd.obsidianmd.plugin.description": z.string(),
  "vnd.obsidianmd.plugin.author": z.string(),
  "vnd.obsidianmd.plugin.source": z.string().regex(/^git\+https:\/\//),
  "vnd.obsidianmd.plugin.published-at": z.string().datetime(),
  "vnd.obsidianmd.plugin.converted": z.string().optional(),
  "vnd.obsidianmd.plugin.author-url": z.string().url().optional(),
  "vnd.obsidianmd.plugin.min-app-version": z.string().optional(),
});
```

### Type Generation

Replace existing TypeScript interfaces with `z.infer<typeof SchemaName>` to derive types from schemas, ensuring schemas are the single source of truth.

### Validation Boundaries (Selective Approach)

Runtime validation with `.parse()` at key boundaries:

1. OCI registry responses (fetching manifests/tags)
2. Reading manifest.json files (disk/network)
3. Community plugins JSON parsing
4. CLI command inputs (push/convert commands)

Internal data flow uses trusted types without re-validation.

### Transform Utilities

Helper functions for format conversion:

- `repoToVcsUrl(repo: string): string` - converts "owner/repo" to git+https URL
- `vcsUrlToGitHubUrl(vcs: string): string` - extracts display URL
- `manifestToAnnotations(manifest, repo)` - creates annotations from manifest
- `annotationsToMarketplacePlugin(annotations)` - builds marketplace type

## Integration Points

### Files Requiring Changes

1. **packages/shard-lib/src/schemas/** (new)
   - Create schema files and exports

2. **packages/shard-lib/package.json**
   - Add `zod` dependency (regular, not dev)

3. **packages/shard-cli/src/lib/converter.ts** (lines 231-250)
   - Update annotation creation with new keys
   - Remove `original-repo` annotation
   - Transform `repo` to VCS URL format
   - Add schema validation for manifest input

4. **packages/shard-installer/src/marketplace/types.ts**
   - Replace interfaces with `z.infer<>` derived types
   - Keep file for re-exports

5. **packages/shard-lib/src/types/ManifestTypes.ts**
   - Replace `ObsidianManifest` with Zod schema
   - Keep OCI manifest types (stable specs)

6. **Test files**
   - Update fixtures with new annotation format
   - Add schema validation tests

## Migration Path

1. Add Zod schemas alongside existing types
2. Update one boundary at a time (start with converter.ts)
3. Gradually replace TypeScript interfaces with `z.infer<>` types
4. Maintain backwards compatibility using Zod transforms where needed

## Benefits

- Single source of truth for types and validation
- Runtime safety at system boundaries
- Easier data transformation between formats
- Self-documenting schema with validation rules
- Simplified data model with fewer redundant fields
