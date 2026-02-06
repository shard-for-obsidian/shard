# Scoped Packages Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate Shard packages from unscoped names to `@shard-for-obsidian` scoped packages

**Architecture:** Update package.json files with scoped names, update internal dependencies to reference scoped packages, update documentation to reflect new package names, verify everything builds and tests pass

**Tech Stack:** pnpm workspaces, npm scoped packages, TypeScript, changesets

---

## Task 1: Update shard-lib package.json

**Files:**

- Modify: `packages/shard-lib/package.json:2`

**Step 1: Update package name to scoped**

Change line 2 from:

```json
  "name": "shard-lib",
```

To:

```json
  "name": "@shard-for-obsidian/lib",
```

**Step 2: Verify package.json is valid JSON**

Run: `cat packages/shard-lib/package.json | jq .name`
Expected: `"@shard-for-obsidian/lib"`

**Step 3: Commit**

```bash
git add packages/shard-lib/package.json
git commit -m "refactor: rename shard-lib to @shard-for-obsidian/lib"
```

---

## Task 2: Update shard-cli package.json

**Files:**

- Modify: `packages/shard-cli/package.json:2,47`

**Step 1: Update package name to scoped**

Change line 2 from:

```json
  "name": "shard-cli",
```

To:

```json
  "name": "@shard-for-obsidian/cli",
```

**Step 2: Update dependency on shard-lib**

Change line 47 from:

```json
    "shard-lib": "workspace:*"
```

To:

```json
    "@shard-for-obsidian/lib": "workspace:*"
```

**Step 3: Verify package.json is valid JSON**

Run: `cat packages/shard-cli/package.json | jq '{name, dependencies}'`
Expected: Shows `@shard-for-obsidian/cli` and dependency on `@shard-for-obsidian/lib`

**Step 4: Commit**

```bash
git add packages/shard-cli/package.json
git commit -m "refactor: rename shard-cli to @shard-for-obsidian/cli"
```

---

## Task 3: Update shard-installer package.json

**Files:**

- Modify: `packages/shard-installer/package.json:2,17,21`

**Step 1: Update dependency on shard-lib**

Change line 17 from:

```json
    "shard-lib": "workspace:*",
```

To:

```json
    "@shard-for-obsidian/lib": "workspace:*",
```

**Step 2: Update devDependency on shard-cli**

Change line 21 from:

```json
    "shard-cli": "workspace:*"
```

To:

```json
    "@shard-for-obsidian/cli": "workspace:*"
```

**Step 3: Verify package.json is valid JSON**

Run: `cat packages/shard-installer/package.json | jq '{name, dependencies, devDependencies}'`
Expected: Shows dependencies on scoped packages

**Step 4: Commit**

```bash
git add packages/shard-installer/package.json
git commit -m "refactor: update shard-installer deps to scoped packages"
```

---

## Task 4: Update workspace configuration

**Files:**

- Modify: `package.json:6-8`

**Step 1: Verify workspace paths still correct**

Note: Workspace paths reference directories, not package names, so no changes needed.
However, verify current configuration:

Run: `cat package.json | jq .workspaces`
Expected:

```json
["packages/shard-cli", "packages/shard-installer", "packages/shard-lib"]
```

**Step 2: Update lockfile**

Run: `pnpm install`
Expected: Lockfile updates to reference new scoped package names

**Step 3: Verify workspace structure**

Run: `pnpm list --depth 0`
Expected: Shows `@shard-for-obsidian/lib` and `@shard-for-obsidian/cli`

**Step 4: Commit lockfile changes**

```bash
git add pnpm-lock.yaml
git commit -m "chore: update lockfile for scoped packages"
```

---

## Task 5: Update root README

**Files:**

- Modify: `README.md:48,50,56,57`

**Step 1: Update monorepo structure section**

Change lines 48-50 from:

```markdown
- **shard-lib** (`packages/shard-lib/`) - Core OCI registry client library
- **shard-installer** (`packages/shard-installer/`) - Plugin installer for Obsidian
- **shard-cli** (`packages/shard-cli/`) - CLI tool for pushing/pulling plugins to/from GHCR
```

To:

```markdown
- **@shard-for-obsidian/lib** (`packages/shard-lib/`) - Core OCI registry client library
- **shard-installer** (`packages/shard-installer/`) - Plugin installer for Obsidian (private)
- **@shard-for-obsidian/cli** (`packages/shard-cli/`) - CLI tool for pushing/pulling plugins to/from GHCR
```

**Step 2: Update NPM packages section**

Change lines 56-57 from:

```markdown
- **[shard-cli](https://www.npmjs.com/package/shard-cli)**: CLI tool for managing Obsidian plugins via GHCR
- **[shard-lib](https://www.npmjs.com/package/shard-lib)**: Core library for OCI registry operations
```

To:

```markdown
- **[@shard-for-obsidian/cli](https://www.npmjs.com/package/@shard-for-obsidian/cli)**: CLI tool for managing Obsidian plugins via GHCR
- **[@shard-for-obsidian/lib](https://www.npmjs.com/package/@shard-for-obsidian/lib)**: Core library for OCI registry operations
```

**Step 3: Add installation instructions**

After line 59 (after "See [NPM_PUBLICATION.md]..."), add:

````markdown
### Installation

Install the CLI globally:

```bash
npm install -g @shard-for-obsidian/cli
```
````

Or use the library in your project:

```bash
npm install @shard-for-obsidian/lib
```

````

**Step 4: Verify markdown renders correctly**

Run: `head -n 70 README.md`
Expected: New package names and installation instructions visible

**Step 5: Commit**

```bash
git add README.md
git commit -m "docs: update README with scoped package names"
````

---

## Task 6: Verify build

**Files:**

- None (verification task)

**Step 1: Clean all build artifacts**

Run: `pnpm clean`
Expected: All `dist/` directories removed

**Step 2: Build all packages**

Run: `pnpm build`
Expected: All packages build successfully

**Step 3: Verify build outputs exist**

Run: `ls packages/shard-lib/dist/index.js packages/shard-cli/dist/index.js packages/shard-installer/dist/main.js`
Expected: All three files exist

**Step 4: Document successful build**

No commit needed (verification only)

---

## Task 7: Verify type checking

**Files:**

- None (verification task)

**Step 1: Run TypeScript type checker**

Run: `pnpm ts-check`
Expected: No type errors

**Step 2: Document successful type check**

No commit needed (verification only)

---

## Task 8: Verify linting

**Files:**

- None (verification task)

**Step 1: Run ESLint**

Run: `pnpm lint`
Expected: No linting errors

**Step 2: Document successful lint**

No commit needed (verification only)

---

## Task 9: Verify tests

**Files:**

- None (verification task)

**Step 1: Run all tests**

Run: `pnpm test`
Expected: All 70 tests pass (42 in shard-lib, 28 in shard-cli)

**Step 2: Document successful test run**

No commit needed (verification only)

---

## Task 10: Final verification commit

**Files:**

- None (meta task)

**Step 1: Check git status**

Run: `git status`
Expected: Working tree clean (all changes committed)

**Step 2: Review commit history**

Run: `git log --oneline -5`
Expected: Shows 5 commits for the migration

**Step 3: Verify all changes are logical**

Run: `git diff main...HEAD`
Expected: Only package.json and README changes, no code changes

**Step 4: Document completion**

Migration complete. Ready for Phase 2 (first manual publish).

---

## Post-Implementation Notes

After completing this plan:

1. **First Publish (Manual):**
   - Run `npm login`
   - Run `npm publish` in `packages/shard-lib/`
   - Run `npm publish` in `packages/shard-cli/`
   - Run `npm logout`

2. **Configure Trusted Publishers:**
   - Visit npm org settings for each package
   - Add GitHub Actions Trusted Publisher
   - Repository: `shard-for-obsidian/shard`
   - Workflow: `publish.yml`
   - Environment: `npm`

3. **Test Automated Publishing:**
   - Create a changeset
   - Push to main branch
   - Verify GitHub Actions workflow publishes successfully
