# NPM Publication Design for shard-cli and shard-lib

**Date:** 2026-02-05
**Status:** Approved

## Overview

This design establishes automated NPM publication for `shard-cli` and `shard-lib` packages using changesets for version management and GitHub Actions for CI/CD publishing with OIDC trusted publishing.

## Requirements

- Publish `shard-cli` and `shard-lib` as unscoped packages
- Keep `shard-installer` internal (not published)
- Use changesets for automated versioning and changelog generation
- Publish via GitHub Actions CI with OIDC authentication
- No long-lived secrets or tokens

## Package Configuration

### shard-cli/package.json

Add publication metadata:

```json
{
  "name": "shard-cli",
  "author": "Andrew Gillis",
  "repository": {
    "type": "git",
    "url": "https://github.com/shard-for-obsidian/shard.git",
    "directory": "packages/shard-cli"
  },
  "homepage": "https://github.com/shard-for-obsidian/shard#readme",
  "bugs": "https://github.com/shard-for-obsidian/shard/issues",
  "files": ["dist"],
  "publishConfig": {
    "access": "public"
  }
}
```

### shard-lib/package.json

Add publication metadata:

```json
{
  "name": "shard-lib",
  "author": "Andrew Gillis",
  "repository": {
    "type": "git",
    "url": "https://github.com/shard-for-obsidian/shard.git",
    "directory": "packages/shard-lib"
  },
  "homepage": "https://github.com/shard-for-obsidian/shard#readme",
  "bugs": "https://github.com/shard-for-obsidian/shard/issues",
  "files": ["dist"],
  "publishConfig": {
    "access": "public"
  }
}
```

### shard-installer/package.json

Prevent accidental publication:

```json
{
  "private": true
}
```

## Changesets Setup

### Installation

```bash
pnpm add -D -w @changesets/cli
pnpm changeset init
```

### Configuration (.changeset/config.json)

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.3/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["shard-installer"]
}
```

Key settings:
- `ignore: ["shard-installer"]` - Never version shard-installer
- `updateInternalDependencies: "patch"` - Auto-bump shard-cli when shard-lib updates
- `linked: []` - Independent versioning (not lockstep)

### Developer Workflow

1. Make code changes
2. Run `pnpm changeset` to document the change
3. Select affected packages and bump type (major/minor/patch)
4. Commit changeset file with code changes

## GitHub Actions Workflows

### Workflow 1: Version Packages (.github/workflows/version.yml)

Manually triggered or auto-triggered when changesets exist on main.

Creates a "Version Packages" PR that:
- Runs `changeset version` to bump package.json versions
- Updates CHANGELOG.md files
- Removes consumed changeset files

This PR is reviewable before merging.

### Workflow 2: Publish to NPM (.github/workflows/publish.yml)

Triggered when version changes are detected on main branch.

Steps:
1. Install dependencies (`pnpm install --frozen-lockfile`)
2. Build all packages (`pnpm build`)
3. Run type checks (`pnpm ts-check`)
4. Run linting (`pnpm lint`)
5. Run tests (`pnpm test`)
6. Publish changed packages (`changeset publish`)

Workflow only runs if all validation passes.

## Authentication: OIDC Trusted Publishing

### Why OIDC?

- No long-lived tokens to manage
- Automatic token rotation
- Tokens scoped to specific workflows and repositories
- Better security posture

### Setup (One-time per package)

On npmjs.com:
1. Go to package settings (create placeholder if first publish)
2. Navigate to Publishing → Trusted Publishers
3. Add GitHub trusted publisher:
   - Provider: GitHub
   - Repository owner: `shard-for-obsidian`
   - Repository name: `shard`
   - Workflow: `publish.yml`
   - Environment: `npm` (optional but recommended)

Repeat for both `shard-cli` and `shard-lib`.

### GitHub Actions Configuration

```yaml
permissions:
  id-token: write  # Required for OIDC
  contents: read

- uses: actions/setup-node@v4
  with:
    node-version: '18'
    registry-url: 'https://registry.npmjs.org'
```

No `NODE_AUTH_TOKEN` needed - npm CLI automatically uses OIDC.

## Build Process

### Current Build Scripts

- **shard-cli**: `node esbuild.config.mjs` → `dist/index.js`
- **shard-lib**: `node esbuild.config.mjs && tsc` → `dist/` + type definitions

### Pre-Publish Validation

All checks must pass before publishing:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm ts-check
pnpm lint
pnpm test
```

### Package Contents

Only `dist/` directory is published (via `files: ["dist"]`).

Excluded from publication:
- Source files (`src/`)
- Config files (esbuild, tsconfig, etc.)
- Tests
- node_modules

Verify locally: `pnpm pack --dry-run`

## Publication Flow

### Making Changes

1. Developer makes code changes
2. Run `pnpm changeset` to document the change
3. Commit code + changeset file
4. Push to feature branch, create PR to main
5. Merge PR

### Releasing Versions

1. Merge PRs with changesets to main
2. Manually trigger "Version Packages" workflow (or auto-trigger)
3. Review the generated "Version Packages" PR
4. Merge the Version Packages PR
5. "Publish" workflow auto-detects version changes and publishes to npm

## Error Handling

### If Publish Fails

- Workflow fails without blocking main branch
- View logs in GitHub Actions for diagnostics
- Common issues: OIDC misconfiguration, build failures, test failures
- Re-run workflow after fixing issues

### If Package Names Are Taken

Verified available as of 2026-02-05:
- ✅ `shard-cli` - available
- ✅ `shard-lib` - available

Fallback if needed: Use scoped names like `@shard-for-obsidian/shard-cli`

## Package Name Verification

As of 2026-02-05, both package names are available on npm registry:
- `shard-cli` - 404 (available)
- `shard-lib` - 404 (available)

No namespace conflicts detected.

## Implementation Checklist

1. Update package.json files for shard-cli, shard-lib, shard-installer
2. Install and configure changesets
3. Create version.yml workflow
4. Create publish.yml workflow
5. Configure OIDC trusted publishers on npmjs.com
6. Test workflow with dry-run
7. Perform first publication
