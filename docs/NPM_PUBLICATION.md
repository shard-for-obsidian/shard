# NPM Publication

This document describes how npm publication works for shard-cli and shard-lib.

## Published Packages

- **shard-cli**: CLI tool for managing Obsidian plugins via GHCR
- **shard-lib**: Core library for OCI registry operations

**Not published**: shard-installer (marked as `private: true`)

## Versioning with Changesets

We use [changesets](https://github.com/changesets/changesets) for version management.

### Creating a Changeset

When you make changes that should be released:

```bash
pnpm changeset
```

This will:

1. Ask which packages changed
2. Ask what type of change (major/minor/patch)
3. Prompt for a description
4. Create a changeset file in `.changeset/`

Commit the changeset file with your changes.

### Releasing a Version

1. Changesets accumulate in `.changeset/` as PRs are merged
2. The "Version Packages" workflow can be triggered manually or auto-triggers
3. It creates a PR that:
   - Bumps package versions
   - Updates CHANGELOG.md files
   - Removes consumed changeset files
4. Review and merge the Version Packages PR
5. The "Publish" workflow auto-detects version changes and publishes to npm

## NPM Authentication: OIDC Setup

We use NPM's OIDC trusted publishing for secure, token-free authentication.

### Initial Setup (One-time per package)

For each package (`shard-cli` and `shard-lib`):

1. Go to [npmjs.com](https://www.npmjs.com) and sign in
2. Navigate to the package (or create a placeholder)
3. Go to Settings → Publishing → Trusted Publishers
4. Click "Add trusted publisher"
5. Fill in:
   - **Provider**: GitHub
   - **Repository owner**: `shard-for-obsidian`
   - **Repository name**: `shard`
   - **Workflow**: `publish.yml`
   - **Environment**: `npm` (optional but recommended)
6. Save

Repeat for both packages.

### How OIDC Works

When the publish workflow runs:

1. GitHub generates a short-lived OIDC token
2. NPM verifies the token matches the trusted publisher config
3. Publication proceeds without long-lived secrets
4. Token expires automatically after use

No `NPM_TOKEN` secret needed!

## Workflows

### Version Packages (.github/workflows/version.yml)

**Triggers:**

- Manual via workflow_dispatch
- Auto when changesets are pushed to main

**What it does:**

- Runs `changeset version`
- Creates "Version Packages" PR
- Updates versions and CHANGELOGs

### Publish to NPM (.github/workflows/publish.yml)

**Triggers:**

- When package.json files change on main (after version PR merge)

**What it does:**

1. Install dependencies
2. Build all packages
3. Run type checks, linting, tests
4. Publish changed packages via `changeset publish`

**Safety:**

- Only runs on main branch
- Requires all tests to pass
- Only publishes packages with version changes

## Manual Publishing (Local)

If you need to publish manually:

```bash
# Make sure you're on main and up to date
git checkout main
git pull

# Build packages
pnpm build

# Run all checks
pnpm ts-check
pnpm lint
pnpm test

# Publish (requires npm authentication)
pnpm release
```

**Note:** Manual publishing requires `npm login` and appropriate npm permissions.

## Package Contents

Only the `dist/` directory is published for each package:

**shard-cli:**

- `dist/index.js` (bundled CLI)

**shard-lib:**

- `dist/index.js` (bundled library)
- `dist/index.d.ts` (type definitions)
- `dist/**/*.d.ts` (supporting type definitions)

Verify what would be published:

```bash
cd packages/shard-cli
pnpm pack --dry-run
```

## Troubleshooting

### Publication Fails

1. Check GitHub Actions logs for specific error
2. Common issues:
   - OIDC misconfiguration on npmjs.com
   - Build failures
   - Test failures
   - Package name already taken

### OIDC Not Working

Verify trusted publisher settings on npmjs.com:

- Correct repository owner: `shard-for-obsidian`
- Correct repository name: `shard`
- Correct workflow file: `publish.yml`

### Package Name Conflicts

If names are taken, update package.json names to use scoped packages:

- `@shard-for-obsidian/shard-cli`
- `@shard-for-obsidian/shard-lib`

Then re-configure OIDC for the new package names.
