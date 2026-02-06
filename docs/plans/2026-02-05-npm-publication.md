# NPM Publication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up automated npm publication for shard-cli and shard-lib using changesets and GitHub Actions with OIDC authentication.

**Architecture:** Changesets manages versioning and changelogs. Two GitHub Actions workflows: one creates version PRs, another publishes to npm using OIDC trusted publishing. Only shard-cli and shard-lib are published; shard-installer stays private.

**Tech Stack:** changesets, GitHub Actions, npm OIDC trusted publishing, pnpm workspaces

---

## Task 1: Update shard-cli package.json

**Files:**

- Modify: `packages/shard-cli/package.json`

**Step 1: Read current package.json**

Read: `packages/shard-cli/package.json`

**Step 2: Add publication metadata**

Add these fields to `packages/shard-cli/package.json`:

```json
{
  "name": "shard-cli",
  "version": "0.1.0",
  "description": "Shard CLI tool to push and pull plugins from GHCR",
  "type": "module",
  "author": "Andrew Gillis",
  "repository": {
    "type": "git",
    "url": "https://github.com/shard-for-obsidian/shard.git",
    "directory": "packages/shard-cli"
  },
  "homepage": "https://github.com/shard-for-obsidian/shard#readme",
  "bugs": "https://github.com/shard-for-obsidian/shard/issues",
  "bin": {
    "shard": "./dist/index.js"
  },
  "files": ["dist"],
  "publishConfig": {
    "access": "public"
  },
  "scripts": {
    "build": "node esbuild.config.mjs",
    "build:prod": "node esbuild.config.mjs production",
    "clean": "rimraf dist",
    "ts-check": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui"
  },
  "keywords": ["shard", "plugin", "ghcr", "oci", "registry", "cli"],
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "shard-lib": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^25.2.0",
    "@vitest/ui": "^4.0.18",
    "vitest": "^4.0.18"
  }
}
```

**Step 3: Verify with dry-run**

Run: `cd packages/shard-cli && pnpm pack --dry-run`
Expected: Should show only `dist/` contents would be included

**Step 4: Commit**

```bash
git add packages/shard-cli/package.json
git commit -m "feat: add npm publication metadata to shard-cli"
```

---

## Task 2: Update shard-lib package.json

**Files:**

- Modify: `packages/shard-lib/package.json`

**Step 1: Read current package.json**

Read: `packages/shard-lib/package.json`

**Step 2: Add publication metadata**

Add these fields to `packages/shard-lib/package.json`:

```json
{
  "name": "shard-lib",
  "version": "0.1.0",
  "type": "module",
  "description": "Core library for Shard plugin management",
  "author": "Andrew Gillis",
  "repository": {
    "type": "git",
    "url": "https://github.com/shard-for-obsidian/shard.git",
    "directory": "packages/shard-lib"
  },
  "homepage": "https://github.com/shard-for-obsidian/shard#readme",
  "bugs": "https://github.com/shard-for-obsidian/shard/issues",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "files": ["dist"],
  "publishConfig": {
    "access": "public"
  },
  "scripts": {
    "build": "node esbuild.config.mjs && tsc",
    "clean": "rimraf dist",
    "ts-check": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui"
  },
  "keywords": ["shard", "lib", "oci", "registry", "ghcr", "container-registry"],
  "license": "MIT",
  "devDependencies": {
    "@vitest/ui": "^4.0.18",
    "vitest": "^4.0.18"
  }
}
```

**Step 3: Verify with dry-run**

Run: `cd packages/shard-lib && pnpm pack --dry-run`
Expected: Should show only `dist/` contents would be included

**Step 4: Commit**

```bash
git add packages/shard-lib/package.json
git commit -m "feat: add npm publication metadata to shard-lib"
```

---

## Task 3: Mark shard-installer as private

**Files:**

- Modify: `packages/shard-installer/package.json`

**Step 1: Read current package.json**

Read: `packages/shard-installer/package.json`

**Step 2: Add private field**

Add `"private": true` to the root level of the JSON object (right after the opening brace):

```json
{
  "name": "shard-installer",
  "private": true,
  "version": "0.1.0",
  ...
}
```

**Step 3: Commit**

```bash
git add packages/shard-installer/package.json
git commit -m "feat: mark shard-installer as private"
```

---

## Task 4: Install changesets

**Files:**

- Modify: `package.json` (root)

**Step 1: Install changesets as dev dependency**

Run: `pnpm add -D -w @changesets/cli`
Expected: Package installed at workspace root

**Step 2: Initialize changesets**

Run: `pnpm changeset init`
Expected: Creates `.changeset/` directory with config.json and README.md

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml .changeset
git commit -m "feat: install and initialize changesets"
```

---

## Task 5: Configure changesets

**Files:**

- Modify: `.changeset/config.json`

**Step 1: Read default config**

Read: `.changeset/config.json`

**Step 2: Update configuration**

Replace contents with:

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

**Step 3: Commit**

```bash
git add .changeset/config.json
git commit -m "feat: configure changesets for shard packages"
```

---

## Task 6: Add changeset helper scripts

**Files:**

- Modify: `package.json` (root)

**Step 1: Read current root package.json**

Read: `package.json`

**Step 2: Add changeset scripts**

Add these scripts to the `scripts` section:

```json
{
  "scripts": {
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "clean": "pnpm -r clean",
    "ts-check": "pnpm -r ts-check",
    "test": "pnpm -r test",
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "pnpm build && changeset publish"
  }
}
```

**Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add changeset helper scripts"
```

---

## Task 7: Create GitHub Actions workflows directory

**Files:**

- Create: `.github/workflows/` (directory)

**Step 1: Create directory structure**

Run: `mkdir -p .github/workflows`
Expected: Directory created

**Step 2: Verify directory exists**

Run: `ls -la .github/`
Expected: Should show `workflows/` directory

---

## Task 8: Create version workflow

**Files:**

- Create: `.github/workflows/version.yml`

**Step 1: Create version workflow file**

Create `.github/workflows/version.yml`:

```yaml
name: Version Packages

on:
  workflow_dispatch:
  push:
    branches:
      - main
    paths:
      - ".changeset/**"
      - "!.changeset/README.md"

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  version:
    name: Create Version PR
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "18"

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Create Version PR
        uses: changesets/action@v1
        with:
          version: pnpm version-packages
          commit: "chore: version packages"
          title: "chore: version packages"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Step 2: Commit**

```bash
git add .github/workflows/version.yml
git commit -m "feat: add version packages workflow"
```

---

## Task 9: Create publish workflow

**Files:**

- Create: `.github/workflows/publish.yml`

**Step 1: Create publish workflow file**

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to NPM

on:
  push:
    branches:
      - main
    paths:
      - "packages/*/package.json"

permissions:
  id-token: write
  contents: read

jobs:
  publish:
    name: Publish to NPM
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "18"
          registry-url: "https://registry.npmjs.org"

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build packages
        run: pnpm build

      - name: Type check
        run: pnpm ts-check

      - name: Lint
        run: pnpm lint

      - name: Test
        run: pnpm test

      - name: Publish to NPM
        run: pnpm changeset publish --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Step 2: Commit**

```bash
git add .github/workflows/publish.yml
git commit -m "feat: add npm publish workflow"
```

---

## Task 10: Create documentation for OIDC setup

**Files:**

- Create: `docs/NPM_PUBLICATION.md`

**Step 1: Create documentation file**

Create `docs/NPM_PUBLICATION.md`:

````markdown
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
````

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

````

**Step 2: Commit**

```bash
git add docs/NPM_PUBLICATION.md
git commit -m "docs: add npm publication guide"
````

---

## Task 11: Update main README with publication info

**Files:**

- Modify: `README.md` (if exists, otherwise skip)

**Step 1: Check if README exists**

Run: `ls README.md`
Expected: File exists or "No such file"

**Step 2: Add publication section (if README exists)**

Add a section to README.md:

```markdown
## NPM Packages

This monorepo publishes two packages to npm:

- **[shard-cli](https://www.npmjs.com/package/shard-cli)**: CLI tool for managing Obsidian plugins via GHCR
- **[shard-lib](https://www.npmjs.com/package/shard-lib)**: Core library for OCI registry operations

See [NPM_PUBLICATION.md](docs/NPM_PUBLICATION.md) for details on versioning and releasing.
```

**Step 3: Commit (if changed)**

```bash
git add README.md
git commit -m "docs: add npm packages section to README"
```

---

## Task 12: Test changeset workflow locally

**Files:**

- None (testing only)

**Step 1: Create a test changeset**

Run: `pnpm changeset`
When prompted:

- Select: shard-lib (spacebar to select)
- Choose: patch
- Description: "test changeset workflow"

Expected: Creates `.changeset/some-random-words.md`

**Step 2: View the changeset file**

Run: `ls .changeset/*.md`
Expected: Shows the new changeset file

**Step 3: Test version command**

Run: `pnpm version-packages`
Expected:

- Shows version bumps that would occur
- Updates package.json versions
- Removes changeset file

**Step 4: Revert test changes**

Run: `git restore .changeset packages/*/package.json`
Expected: All test changes reverted

**Step 5: Verify clean state**

Run: `git status`
Expected: Working directory clean (or only our committed changes)

---

## Task 13: Final verification

**Files:**

- None (verification only)

**Step 1: Verify all tests pass**

Run: `pnpm test`
Expected: All tests pass (70+ tests)

**Step 2: Verify build succeeds**

Run: `pnpm build`
Expected: All packages build successfully

**Step 3: Verify type checking**

Run: `pnpm ts-check`
Expected: No type errors

**Step 4: Verify linting**

Run: `pnpm lint`
Expected: No lint errors

**Step 5: Check git status**

Run: `git status`
Expected: All changes committed to feature branch

**Step 6: Push branch**

Run: `git push -u origin feature/npm-publication`
Expected: Branch pushed to remote

---

## Post-Implementation: OIDC Configuration

After merging this PR, you must configure OIDC trusted publishing on npmjs.com:

### For shard-cli:

1. Go to https://www.npmjs.com/package/shard-cli (create package if needed)
2. Settings → Publishing → Trusted Publishers
3. Add GitHub trusted publisher:
   - Repository owner: `shard-for-obsidian`
   - Repository name: `shard`
   - Workflow: `publish.yml`

### For shard-lib:

1. Go to https://www.npmjs.com/package/shard-lib (create package if needed)
2. Settings → Publishing → Trusted Publishers
3. Add GitHub trusted publisher:
   - Repository owner: `shard-for-obsidian`
   - Repository name: `shard`
   - Workflow: `publish.yml`

### First Publication

After OIDC is configured:

1. Create a changeset: `pnpm changeset`
2. Commit and merge to main
3. Manually trigger "Version Packages" workflow
4. Review and merge the Version Packages PR
5. "Publish" workflow auto-runs and publishes to npm

---

## Rollback Plan

If issues arise after merging:

1. **Revert the PR**: `git revert <merge-commit>`
2. **Disable workflows**: Rename workflow files or delete them
3. **Unpublish packages**: `npm unpublish <package>@<version>` (within 72 hours)

---

## Success Criteria

- ✅ shard-cli package.json has publication metadata
- ✅ shard-lib package.json has publication metadata
- ✅ shard-installer is marked private
- ✅ Changesets installed and configured
- ✅ Version workflow created
- ✅ Publish workflow created
- ✅ Documentation complete
- ✅ All tests pass
- ✅ All builds succeed
- ✅ Changeset workflow tested locally
