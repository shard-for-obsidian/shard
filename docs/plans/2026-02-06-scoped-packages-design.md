# Scoped Packages Migration Design

**Date:** 2026-02-06
**Status:** Approved

## Overview

Migrate Shard packages from unscoped names (`shard-lib`, `shard-cli`) to scoped packages under `@shard-for-obsidian` namespace.

## Motivation

- **Future-proofing:** Claim namespace before conflicts arise
- **Publishing reliability:** Avoid ambiguity with Trusted Publishers and provenance
- **Professionalism:** Scoped names signal official project organization
- **Monorepo alignment:** Better matches GitHub org structure

## Package Naming

| Current | New | Status |
|---------|-----|--------|
| `shard-lib` | `@shard-for-obsidian/lib` | Public, published |
| `shard-cli` | `@shard-for-obsidian/cli` | Public, published |
| `shard-installer` | `shard-installer` | Private, not published |

## Key Principles

### First Publish Requirement

Trusted Publishers only work for packages that already exist in the npm registry. New scoped packages require initial manual publish:

1. **First publish:** Use `npm login` + `npm publish` (creates package record)
2. **Configure Trusted Publisher:** Link GitHub Actions OIDC to package on npm
3. **Subsequent publishes:** GitHub Actions workflow handles automatically

### Mental Model

- First publish → authentication required (always)
- Subsequent publishes → Trusted Publisher eligible
- Provenance → integrity attestation, not permission mechanism
- 404 during publish → authentication failure, not missing package

## Package Configuration

### @shard-for-obsidian/lib

```json
{
  "name": "@shard-for-obsidian/lib",
  "version": "0.2.0",
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

### @shard-for-obsidian/cli

```json
{
  "name": "@shard-for-obsidian/cli",
  "version": "0.2.0",
  "bin": {
    "shard": "./dist/index.js"
  },
  "dependencies": {
    "@shard-for-obsidian/lib": "workspace:*"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

### shard-installer (private)

```json
{
  "name": "shard-installer",
  "private": true,
  "version": "0.1.0",
  "dependencies": {
    "@shard-for-obsidian/lib": "workspace:*",
    "obsidian": "^1.11.4"
  },
  "devDependencies": {
    "@shard-for-obsidian/cli": "workspace:*"
  }
}
```

## Code & Documentation Updates

### Code Changes

**No import statement changes required** - internal imports use relative paths, cross-package imports handled by workspace resolution.

### Documentation Updates

**Root README:**
- Installation: `npm install -g @shard-for-obsidian/cli`
- Package references updated to scoped names

**Package READMEs:**
- `packages/shard-lib/README.md`: Update installation instructions
- `packages/shard-cli/README.md`: Update installation instructions
- Update example code showing import statements

**Out of Scope:**
- GitHub workflow names (remain "Publish to NPM")
- Internal code comments referencing "shard" generically
- Git history or commit messages
- Issue/PR templates

## GitHub Actions Workflow

**No workflow changes needed** - existing configuration works with scoped packages:
- ✓ Has `id-token: write` permission
- ✓ Uses npm registry URL
- ✓ Runs on main branch
- ✓ Uses changesets for versioning

## Trusted Publisher Configuration

After first manual publish, configure on npm website for each package:

1. Visit https://www.npmjs.com/settings/shard-for-obsidian/packages
2. For each package (`lib`, `cli`):
   - Add Trusted Publisher
   - Provider: GitHub Actions
   - Repository: `shard-for-obsidian/shard`
   - Workflow: `publish.yml`
   - Environment: `npm`

## Migration Steps

### Phase 1: Local Changes

1. Update all `package.json` files with scoped names
2. Update workspace dependencies to use scoped names
3. Update README files with new package names
4. Update any other documentation mentioning package names
5. Run `pnpm install` to update lockfile
6. Run `pnpm build && pnpm ts-check && pnpm lint && pnpm test`
7. Commit: "refactor: migrate to @shard-for-obsidian scoped packages"

### Phase 2: First Publish (Manual)

1. Run `npm login`
2. Run `npm publish` in `packages/shard-lib/`
3. Run `npm publish` in `packages/shard-cli/`
4. Run `npm logout`
5. Verify packages at:
   - https://www.npmjs.com/package/@shard-for-obsidian/lib
   - https://www.npmjs.com/package/@shard-for-obsidian/cli

### Phase 3: Configure Trusted Publishers

1. Visit npm org settings for each package
2. Add GitHub Actions Trusted Publisher configuration
3. Test with changeset on main branch
4. Verify workflow publishes successfully

### Phase 4: Cleanup

1. Update external documentation (if any)
2. Consider deprecation notice on old packages (if published)

## Version Strategy

**Continue from 0.2.0** - maintain version continuity since code isn't changing, only package naming.

## Migration Approach

**Hard cutover** - publish under new names only. Old unscoped packages remain as-is without deprecation notices (early adoption phase).
