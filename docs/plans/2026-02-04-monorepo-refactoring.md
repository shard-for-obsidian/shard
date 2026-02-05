# Monorepo Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor repository into pnpm monorepo with three packages (plugin, cli, lib) for better dependency management.

**Architecture:** Create packages/ directory with @plugin-manager/lib (shared OCI client), @plugin-manager/plugin (Obsidian plugin), and @plugin-manager/cli (Node.js CLI). Use pnpm workspaces with workspace protocol for internal dependencies. Each package builds independently with esbuild.

**Tech Stack:** pnpm workspaces, esbuild, TypeScript, ESLint

---

## Phase 1: Setup Infrastructure

### Task 1: Install pnpm

**Files:**
- None (global installation)

**Step 1: Check if pnpm is already installed**

Run: `pnpm --version`
Expected: Either version number or "command not found"

**Step 2: Install pnpm if needed**

If not installed, run: `npm install -g pnpm`
Expected: pnpm installed globally

**Step 3: Verify pnpm installation**

Run: `pnpm --version`
Expected: Version 8.x or higher

---

### Task 2: Create packages directory structure

**Files:**
- Create: `packages/lib/`
- Create: `packages/plugin/`
- Create: `packages/cli/`

**Step 1: Create packages directory**

Run: `mkdir -p packages/{lib,plugin,cli}`
Expected: Three directories created

**Step 2: Verify structure**

Run: `ls -la packages/`
Expected: Shows lib/, plugin/, cli/ directories

**Step 3: Commit structure**

```bash
git add packages/
git commit -m "build: create packages directory structure for monorepo"
```

---

### Task 3: Create pnpm workspace configuration

**Files:**
- Create: `pnpm-workspace.yaml`

**Step 1: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
```

**Step 2: Verify syntax**

Run: `cat pnpm-workspace.yaml`
Expected: Valid YAML with packages array

**Step 3: Commit**

```bash
git add pnpm-workspace.yaml
git commit -m "build: add pnpm workspace configuration"
```

---

### Task 4: Create shared TypeScript base configuration

**Files:**
- Create: `tsconfig.base.json`

**Step 1: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**Step 2: Verify JSON syntax**

Run: `cat tsconfig.base.json | jq .`
Expected: Valid JSON parsed successfully

**Step 3: Commit**

```bash
git add tsconfig.base.json
git commit -m "build: add shared TypeScript base configuration"
```

---

### Task 5: Update root package.json for workspace

**Files:**
- Modify: `package.json`

**Step 1: Update package.json**

Replace entire contents:

```json
{
  "name": "obsidian-plugin-manager",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "pnpm -r build",
    "lint": "eslint .",
    "clean": "pnpm -r clean"
  },
  "devDependencies": {
    "@cyclonedx/cyclonedx-esbuild": "^1.0.0",
    "@eslint/js": "^9.39.2",
    "@types/node": "^25.2.0",
    "@typescript-eslint/parser": "^8.54.0",
    "esbuild": "^0.27.2",
    "esbuild-plugin-copy": "^2.1.1",
    "eslint": "^9.39.2",
    "eslint-plugin-obsidianmd": "^0.1.9",
    "jiti": "^2.6.1",
    "tslib": "^2.8.1",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3",
    "typescript-eslint": "^8.54.0"
  }
}
```

**Step 2: Verify JSON syntax**

Run: `cat package.json | jq .`
Expected: Valid JSON

**Step 3: Commit**

```bash
git add package.json
git commit -m "build: update root package.json for pnpm workspace"
```

---

### Task 6: Update ESLint configuration for monorepo

**Files:**
- Modify: `eslint.config.mjs`

**Step 1: Update eslint.config.mjs**

Replace entire contents:

```javascript
import js from "@eslint/js";
import typescript from "typescript-eslint";
import obsidianPlugin from "eslint-plugin-obsidianmd";

export default [
  js.configs.recommended,
  ...typescript.configs.recommended,
  {
    ignores: ["**/dist/**", "**/node_modules/**", ".worktrees/**"]
  },
  {
    // Plugin-specific rules
    files: ["packages/plugin/**/*.ts"],
    plugins: { obsidianmd: obsidianPlugin },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "args": "none" }],
      "@typescript-eslint/ban-ts-comment": "off",
      "no-prototype-builtins": "off",
      "@typescript-eslint/no-empty-function": "off"
    }
  },
  {
    // CLI and lib rules
    files: ["packages/{cli,lib}/**/*.ts"],
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "args": "none" }]
    }
  }
];
```

**Step 2: Verify syntax**

Run: `cat eslint.config.mjs`
Expected: Valid JavaScript module

**Step 3: Commit**

```bash
git add eslint.config.mjs
git commit -m "build: update ESLint config for monorepo structure"
```

---

## Phase 2: Create lib Package

### Task 7: Create lib package structure

**Files:**
- Create: `packages/lib/src/`
- Create: `packages/lib/src/util/`

**Step 1: Create directories**

Run: `mkdir -p packages/lib/src/util`
Expected: Directories created

**Step 2: Verify structure**

Run: `ls -la packages/lib/`
Expected: Shows src/ directory

**Step 3: Commit**

```bash
git add packages/lib/
git commit -m "build: create lib package directory structure"
```

---

### Task 8: Copy core client files to lib

**Files:**
- Create: `packages/lib/src/registry-client.ts`
- Create: `packages/lib/src/common.ts`
- Create: `packages/lib/src/types.ts`
- Create: `packages/lib/src/errors.ts`
- Create: `packages/lib/src/fetch-adapter.ts`
- Create: `packages/lib/src/ghcr.ts`
- Create: `packages/lib/src/util/link-header.ts`

**Step 1: Copy registry-client.ts**

Run: `cp src/lib/client/registry-client.ts packages/lib/src/`
Expected: File copied

**Step 2: Copy common.ts**

Run: `cp src/lib/client/common.ts packages/lib/src/`
Expected: File copied

**Step 3: Copy types.ts**

Run: `cp src/lib/client/types.ts packages/lib/src/`
Expected: File copied

**Step 4: Copy errors.ts**

Run: `cp src/lib/client/errors.ts packages/lib/src/`
Expected: File copied

**Step 5: Copy fetch-adapter.ts**

Run: `cp src/lib/client/fetch-adapter.ts packages/lib/src/`
Expected: File copied

**Step 6: Copy ghcr.ts**

Run: `cp src/lib/client/ghcr.ts packages/lib/src/`
Expected: File copied

**Step 7: Copy link-header utility**

Run: `cp src/lib/client/util/link-header.ts packages/lib/src/util/`
Expected: File copied

**Step 8: Verify all files copied**

Run: `find packages/lib/src -name "*.ts" | sort`
Expected: All 7 files listed

**Step 9: Commit**

```bash
git add packages/lib/src/
git commit -m "feat(lib): copy core OCI registry client files"
```

---

### Task 9: Update lib imports to be relative

**Files:**
- Modify: `packages/lib/src/registry-client.ts`

**Step 1: Update imports in registry-client.ts**

Change:
```typescript
import {
  parseRepo,
  urlFromIndex,
  DEFAULT_USERAGENT,
  splitIntoTwo,
  MEDIATYPE_MANIFEST_V2,
  MEDIATYPE_MANIFEST_LIST_V2,
  MEDIATYPE_OCI_MANIFEST_V1,
  MEDIATYPE_OCI_MANIFEST_INDEX_V1,
} from "./common.js";

import { REALM, SERVICE } from "./ghcr.js";

import type {
  Manifest,
  RegistryRepo,
  RegistryClientOpts,
  AuthInfo,
  TagList,
} from "./types.js";

import * as e from "./errors.js";

import { parseLinkHeader } from "./util/link-header.js";
```

These imports are already relative, so no changes needed.

**Step 2: Verify imports are relative**

Run: `grep "^import.*from" packages/lib/src/registry-client.ts`
Expected: All imports use relative paths (./...)

**Step 3: No commit needed (no changes)**

---

### Task 10: Create lib package.json

**Files:**
- Create: `packages/lib/package.json`

**Step 1: Create package.json**

```json
{
  "name": "@plugin-manager/lib",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "node esbuild.config.mjs",
    "clean": "rm -rf dist"
  },
  "keywords": [
    "oci",
    "registry",
    "ghcr",
    "container-registry"
  ],
  "license": "MPL-2.0"
}
```

**Step 2: Verify JSON**

Run: `cat packages/lib/package.json | jq .`
Expected: Valid JSON

**Step 3: Commit**

```bash
git add packages/lib/package.json
git commit -m "build(lib): add package.json"
```

---

### Task 11: Create lib tsconfig.json

**Files:**
- Create: `packages/lib/tsconfig.json`

**Step 1: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"]
}
```

**Step 2: Verify JSON**

Run: `cat packages/lib/tsconfig.json | jq .`
Expected: Valid JSON

**Step 3: Commit**

```bash
git add packages/lib/tsconfig.json
git commit -m "build(lib): add TypeScript configuration"
```

---

### Task 12: Create lib esbuild configuration

**Files:**
- Create: `packages/lib/esbuild.config.mjs`

**Step 1: Create esbuild.config.mjs**

```javascript
import esbuild from "esbuild";

const production = process.argv[2] === "production";

await esbuild.build({
  entryPoints: [
    "src/registry-client.ts",
    "src/common.ts",
    "src/types.ts",
    "src/errors.ts",
    "src/fetch-adapter.ts",
    "src/ghcr.ts",
    "src/util/link-header.ts",
  ],
  bundle: false,
  outdir: "dist",
  platform: "neutral",
  format: "esm",
  target: "es2022",
  sourcemap: !production,
  minify: production,
  treeShaking: true,
});

console.log("✓ @plugin-manager/lib built successfully");
```

**Step 2: Verify syntax**

Run: `cat packages/lib/esbuild.config.mjs`
Expected: Valid JavaScript

**Step 3: Commit**

```bash
git add packages/lib/esbuild.config.mjs
git commit -m "build(lib): add esbuild configuration"
```

---

### Task 13: Create lib index.ts for exports

**Files:**
- Create: `packages/lib/src/index.ts`

**Step 1: Create index.ts**

```typescript
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Main client
export { OciRegistryClient, digestFromManifestStr } from "./registry-client.js";

// Common utilities
export {
  parseRepo,
  parseRepoAndRef,
  urlFromIndex,
  splitIntoTwo,
  DEFAULT_USERAGENT,
  MEDIATYPE_MANIFEST_V2,
  MEDIATYPE_MANIFEST_LIST_V2,
  MEDIATYPE_OCI_MANIFEST_V1,
  MEDIATYPE_OCI_MANIFEST_INDEX_V1,
} from "./common.js";

// GHCR constants
export { REALM, SERVICE } from "./ghcr.js";

// Types
export type {
  Manifest,
  ManifestOCI,
  ManifestOCIDescriptor,
  RegistryRepo,
  RegistryClientOpts,
  AuthInfo,
  TagList,
} from "./types.js";

// Errors
export {
  BadDigestError,
  BlobReadError,
  TooManyRedirectsError,
} from "./errors.js";

// Fetch adapter
export type { FetchAdapter } from "./fetch-adapter.js";

// Utilities
export { parseLinkHeader } from "./util/link-header.js";
```

**Step 2: Verify syntax**

Run: `cat packages/lib/src/index.ts`
Expected: Valid TypeScript

**Step 3: Commit**

```bash
git add packages/lib/src/index.ts
git commit -m "feat(lib): add public API exports"
```

---

### Task 14: Build lib package

**Files:**
- None (build output)

**Step 1: Run pnpm install at root**

Run: `pnpm install`
Expected: Dependencies installed, workspace linked

**Step 2: Build lib package**

Run: `cd packages/lib && pnpm build`
Expected: Build successful, dist/ created

**Step 3: Verify build output**

Run: `ls -la packages/lib/dist/`
Expected: .js files for all source files

**Step 4: Commit (if needed)**

No commit - build artifacts not tracked

---

## Phase 3: Create plugin Package

### Task 15: Create plugin package structure

**Files:**
- Create: `packages/plugin/src/`
- Create: `packages/plugin/src/installer/`
- Create: `packages/plugin/src/adapters/`

**Step 1: Create directories**

Run: `mkdir -p packages/plugin/src/{installer,adapters}`
Expected: Directories created

**Step 2: Verify structure**

Run: `ls -la packages/plugin/src/`
Expected: Shows installer/ and adapters/ directories

**Step 3: Commit**

```bash
git add packages/plugin/
git commit -m "build(plugin): create package directory structure"
```

---

### Task 16: Copy plugin source files

**Files:**
- Create: `packages/plugin/src/main.ts`
- Create: `packages/plugin/src/settings.ts`
- Create: `packages/plugin/src/types.ts`
- Create: `packages/plugin/src/tag-cache.ts`
- Create: `packages/plugin/src/ghcr-wrapper.ts`
- Create: `packages/plugin/src/semver-utils.ts`
- Create: `packages/plugin/src/version-selection-modal.ts`

**Step 1: Copy all plugin files**

Run: `cp src/plugin/*.ts packages/plugin/src/`
Expected: All plugin .ts files copied

**Step 2: Verify files copied**

Run: `ls packages/plugin/src/*.ts`
Expected: All 7 files listed

**Step 3: Commit**

```bash
git add packages/plugin/src/*.ts
git commit -m "feat(plugin): copy plugin source files"
```

---

### Task 17: Move installer to plugin package

**Files:**
- Create: `packages/plugin/src/installer/installer.ts`

**Step 1: Copy installer**

Run: `cp src/lib/installer/installer.ts packages/plugin/src/installer/`
Expected: File copied

**Step 2: Verify file exists**

Run: `ls packages/plugin/src/installer/`
Expected: installer.ts listed

**Step 3: Commit**

```bash
git add packages/plugin/src/installer/
git commit -m "feat(plugin): move installer from lib to plugin package"
```

---

### Task 18: Move Obsidian fetch adapter to plugin package

**Files:**
- Create: `packages/plugin/src/adapters/obsidian-fetch-adapter.ts`

**Step 1: Copy adapter**

Run: `cp src/lib/client/obsidian-fetch-adapter.ts packages/plugin/src/adapters/`
Expected: File copied

**Step 2: Verify file exists**

Run: `ls packages/plugin/src/adapters/`
Expected: obsidian-fetch-adapter.ts listed

**Step 3: Commit**

```bash
git add packages/plugin/src/adapters/
git commit -m "feat(plugin): move Obsidian fetch adapter to plugin package"
```

---

### Task 19: Copy plugin manifest and styles

**Files:**
- Create: `packages/plugin/manifest.json`
- Create: `packages/plugin/styles.css` (if exists)

**Step 1: Copy manifest.json**

Run: `cp manifest.json packages/plugin/`
Expected: File copied

**Step 2: Check if styles.css exists and copy**

Run: `[ -f styles.css ] && cp styles.css packages/plugin/ || echo "No styles.css"`
Expected: File copied or message displayed

**Step 3: Copy manifest.config.mjs**

Run: `cp manifest.config.mjs packages/plugin/`
Expected: File copied

**Step 4: Commit**

```bash
git add packages/plugin/manifest.json packages/plugin/manifest.config.mjs
git commit -m "build(plugin): copy manifest configuration files"
```

---

### Task 20: Create plugin package.json

**Files:**
- Create: `packages/plugin/package.json`

**Step 1: Create package.json**

```json
{
  "name": "@plugin-manager/plugin",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "node esbuild.config.mjs production",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@plugin-manager/lib": "workspace:*",
    "obsidian": "^1.11.4"
  },
  "keywords": [
    "obsidian",
    "plugin",
    "ghcr"
  ],
  "license": "MPL-2.0"
}
```

**Step 2: Verify JSON**

Run: `cat packages/plugin/package.json | jq .`
Expected: Valid JSON

**Step 3: Commit**

```bash
git add packages/plugin/package.json
git commit -m "build(plugin): add package.json with workspace dependency"
```

---

### Task 21: Create plugin tsconfig.json

**Files:**
- Create: `packages/plugin/tsconfig.json`

**Step 1: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["node"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"]
}
```

**Step 2: Verify JSON**

Run: `cat packages/plugin/tsconfig.json | jq .`
Expected: Valid JSON

**Step 3: Commit**

```bash
git add packages/plugin/tsconfig.json
git commit -m "build(plugin): add TypeScript configuration"
```

---

### Task 22: Copy and update plugin esbuild config

**Files:**
- Create: `packages/plugin/esbuild.config.mjs`

**Step 1: Copy esbuild config**

Run: `cp esbuild.config.mjs packages/plugin/`
Expected: File copied

**Step 2: Update the config (no changes needed for now)**

The config should already work with the new structure.

**Step 3: Commit**

```bash
git add packages/plugin/esbuild.config.mjs
git commit -m "build(plugin): add esbuild configuration"
```

---

### Task 23: Update plugin imports to use @plugin-manager/lib

**Files:**
- Modify: `packages/plugin/src/ghcr-wrapper.ts`
- Modify: `packages/plugin/src/settings.ts`

**Step 1: Update ghcr-wrapper.ts imports**

Change from:
```typescript
import { parseRepoAndRef } from "@/lib/client/common.js";
import { OciRegistryClient } from "@/lib/client/registry-client.js";
import { ObsidianFetchAdapter } from "@/lib/client/obsidian-fetch-adapter.js";
import type {
  Manifest,
  ManifestOCI,
  TagList,
} from "@/lib/client/types.js";
```

To:
```typescript
import { parseRepoAndRef, OciRegistryClient } from "@plugin-manager/lib";
import type { Manifest, ManifestOCI, TagList } from "@plugin-manager/lib";
import { ObsidianFetchAdapter } from "./adapters/obsidian-fetch-adapter.js";
```

**Step 2: Update settings.ts imports**

Change from:
```typescript
import { Installer } from "@/lib/installer/installer";
```

To:
```typescript
import { Installer } from "./installer/installer.js";
```

**Step 3: Commit**

```bash
git add packages/plugin/src/ghcr-wrapper.ts packages/plugin/src/settings.ts
git commit -m "refactor(plugin): update imports to use @plugin-manager/lib"
```

---

### Task 24: Update installer.ts imports

**Files:**
- Modify: `packages/plugin/src/installer/installer.ts`

**Step 1: Update imports**

Change from:
```typescript
import type { OciRegistryClient } from "@/lib/client/registry-client.js";
```

To:
```typescript
import type { OciRegistryClient } from "@plugin-manager/lib";
```

**Step 2: Commit**

```bash
git add packages/plugin/src/installer/installer.ts
git commit -m "refactor(plugin): update installer imports to use @plugin-manager/lib"
```

---

### Task 25: Update obsidian-fetch-adapter.ts imports

**Files:**
- Modify: `packages/plugin/src/adapters/obsidian-fetch-adapter.ts`

**Step 1: Update imports**

Change from:
```typescript
import type { FetchAdapter } from "./fetch-adapter.js";
```

To:
```typescript
import type { FetchAdapter } from "@plugin-manager/lib";
```

**Step 2: Commit**

```bash
git add packages/plugin/src/adapters/obsidian-fetch-adapter.ts
git commit -m "refactor(plugin): update fetch adapter imports"
```

---

## Phase 4: Create cli Package

### Task 26: Create cli package structure

**Files:**
- Create: `packages/cli/src/`
- Create: `packages/cli/src/commands/`
- Create: `packages/cli/src/lib/`
- Create: `packages/cli/src/adapters/`

**Step 1: Create directories**

Run: `mkdir -p packages/cli/src/{commands,lib,adapters}`
Expected: Directories created

**Step 2: Verify structure**

Run: `ls -la packages/cli/src/`
Expected: Shows commands/, lib/, and adapters/ directories

**Step 3: Commit**

```bash
git add packages/cli/
git commit -m "build(cli): create package directory structure"
```

---

### Task 27: Copy CLI source files

**Files:**
- Create: `packages/cli/src/index.ts`
- Create: `packages/cli/src/commands/push.ts`
- Create: `packages/cli/src/commands/pull.ts`
- Create: `packages/cli/src/lib/plugin.ts`
- Create: `packages/cli/src/lib/logger.ts`
- Create: `packages/cli/src/lib/auth.ts`
- Create: `packages/cli/src/lib/digest.ts`

**Step 1: Copy index.ts**

Run: `cp src/cli/index.ts packages/cli/src/`
Expected: File copied

**Step 2: Copy commands**

Run: `cp src/cli/commands/*.ts packages/cli/src/commands/`
Expected: push.ts and pull.ts copied

**Step 3: Copy lib utilities**

Run: `cp src/cli/lib/*.ts packages/cli/src/lib/`
Expected: All utility files copied

**Step 4: Verify all files copied**

Run: `find packages/cli/src -name "*.ts" | sort`
Expected: All 7 files listed

**Step 5: Commit**

```bash
git add packages/cli/src/
git commit -m "feat(cli): copy CLI source files"
```

---

### Task 28: Move Node fetch adapter to CLI package

**Files:**
- Create: `packages/cli/src/adapters/node-fetch-adapter.ts`

**Step 1: Copy adapter**

Run: `cp src/cli/adapters/node-fetch.ts packages/cli/src/adapters/node-fetch-adapter.ts`
Expected: File copied

**Step 2: Verify file exists**

Run: `ls packages/cli/src/adapters/`
Expected: node-fetch-adapter.ts listed

**Step 3: Commit**

```bash
git add packages/cli/src/adapters/
git commit -m "feat(cli): move Node fetch adapter to CLI package"
```

---

### Task 29: Create CLI package.json

**Files:**
- Create: `packages/cli/package.json`

**Step 1: Create package.json**

```json
{
  "name": "@plugin-manager/cli",
  "version": "0.1.0",
  "description": "CLI tool to push and pull Obsidian plugins from GHCR",
  "type": "module",
  "bin": {
    "obsidian-plugin": "./dist/index.js"
  },
  "scripts": {
    "build": "node esbuild.config.mjs",
    "build:prod": "node esbuild.config.mjs production",
    "clean": "rm -rf dist"
  },
  "keywords": [
    "obsidian",
    "plugin",
    "ghcr",
    "oci",
    "registry",
    "cli"
  ],
  "license": "MPL-2.0",
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "@plugin-manager/lib": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^25.2.0"
  }
}
```

**Step 2: Verify JSON**

Run: `cat packages/cli/package.json | jq .`
Expected: Valid JSON

**Step 3: Commit**

```bash
git add packages/cli/package.json
git commit -m "build(cli): add package.json with workspace dependency"
```

---

### Task 30: Create CLI tsconfig.json

**Files:**
- Create: `packages/cli/tsconfig.json`

**Step 1: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["node"]
  },
  "include": ["src/**/*"]
}
```

**Step 2: Verify JSON**

Run: `cat packages/cli/tsconfig.json | jq .`
Expected: Valid JSON

**Step 3: Commit**

```bash
git add packages/cli/tsconfig.json
git commit -m "build(cli): add TypeScript configuration"
```

---

### Task 31: Create CLI esbuild configuration

**Files:**
- Create: `packages/cli/esbuild.config.mjs`

**Step 1: Create esbuild.config.mjs**

```javascript
import esbuild from "esbuild";

const production = process.argv[2] === "production";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/index.js",
  platform: "node",
  format: "esm",
  target: "node18",
  sourcemap: !production,
  minify: production,
  banner: {
    js: "#!/usr/bin/env node"
  },
  external: [],
});

console.log("✓ @plugin-manager/cli built successfully");
```

**Step 2: Verify syntax**

Run: `cat packages/cli/esbuild.config.mjs`
Expected: Valid JavaScript

**Step 3: Commit**

```bash
git add packages/cli/esbuild.config.mjs
git commit -m "build(cli): add esbuild configuration"
```

---

### Task 32: Update CLI command imports

**Files:**
- Modify: `packages/cli/src/commands/push.ts`
- Modify: `packages/cli/src/commands/pull.ts`

**Step 1: Update push.ts imports**

Change from:
```typescript
import { OciRegistryClient } from "../../lib/client/registry-client.js";
import type { ManifestOCI, ManifestOCIDescriptor } from "../../lib/client/types.js";
import { parseRepoAndRef } from "../../lib/client/common.js";
import { discoverPlugin } from "../lib/plugin.js";
import { Logger } from "../lib/logger.js";
import type { FetchAdapter } from "../../lib/client/fetch-adapter.js";
```

To:
```typescript
import { OciRegistryClient, parseRepoAndRef } from "@plugin-manager/lib";
import type { ManifestOCI, ManifestOCIDescriptor, FetchAdapter } from "@plugin-manager/lib";
import { discoverPlugin } from "../lib/plugin.js";
import { Logger } from "../lib/logger.js";
```

**Step 2: Update pull.ts imports**

Change from:
```typescript
import { OciRegistryClient } from "../../lib/client/registry-client.js";
import type { ManifestOCI } from "../../lib/client/types.js";
import { parseRepoAndRef } from "../../lib/client/common.js";
import { Logger } from "../lib/logger.js";
import type { FetchAdapter } from "../../lib/client/fetch-adapter.js";
```

To:
```typescript
import { OciRegistryClient, parseRepoAndRef } from "@plugin-manager/lib";
import type { ManifestOCI, FetchAdapter } from "@plugin-manager/lib";
import { Logger } from "../lib/logger.js";
```

**Step 3: Commit**

```bash
git add packages/cli/src/commands/
git commit -m "refactor(cli): update command imports to use @plugin-manager/lib"
```

---

### Task 33: Update CLI index.ts imports

**Files:**
- Modify: `packages/cli/src/index.ts`

**Step 1: Update imports**

Change adapter import from:
```typescript
import { NodeFetchAdapter } from "./adapters/node-fetch.js";
```

To:
```typescript
import { NodeFetchAdapter } from "./adapters/node-fetch-adapter.js";
```

**Step 2: Verify other imports are relative**

Check that commands and lib imports use relative paths.

**Step 3: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "refactor(cli): fix adapter import path"
```

---

### Task 34: Update node-fetch-adapter imports

**Files:**
- Modify: `packages/cli/src/adapters/node-fetch-adapter.ts`

**Step 1: Update imports**

Change from:
```typescript
import type { FetchAdapter } from "../../lib/client/fetch-adapter.js";
```

To:
```typescript
import type { FetchAdapter } from "@plugin-manager/lib";
```

**Step 2: Commit**

```bash
git add packages/cli/src/adapters/node-fetch-adapter.ts
git commit -m "refactor(cli): update adapter imports to use @plugin-manager/lib"
```

---

## Phase 5: Clean Up & Build

### Task 35: Update root .gitignore

**Files:**
- Modify: `.gitignore`

**Step 1: Add packages dist directories**

Append to .gitignore:
```
# Package build outputs
packages/*/dist/
packages/*/node_modules/
```

**Step 2: Verify contents**

Run: `cat .gitignore`
Expected: New entries present

**Step 3: Commit**

```bash
git add .gitignore
git commit -m "build: update gitignore for monorepo packages"
```

---

### Task 36: Delete old src directory

**Files:**
- Delete: `src/`

**Step 1: Remove old src directory**

Run: `git rm -r src/`
Expected: Directory removed from git

**Step 2: Verify removal**

Run: `ls -la | grep src`
Expected: No src/ directory

**Step 3: Commit**

```bash
git commit -m "refactor: remove old src directory after monorepo migration"
```

---

### Task 37: Delete old root build config files

**Files:**
- Delete: `esbuild.config.mjs`
- Delete: `tsconfig.json`
- Delete: `manifest.json`
- Delete: `manifest.config.mjs`

**Step 1: Remove files**

Run: `git rm esbuild.config.mjs tsconfig.json manifest.json manifest.config.mjs`
Expected: Files removed from git

**Step 2: Verify removal**

Run: `ls -la | grep -E "(esbuild|tsconfig|manifest)"`
Expected: Only tsconfig.base.json remains

**Step 3: Commit**

```bash
git commit -m "refactor: remove old root config files after monorepo migration"
```

---

### Task 38: Install dependencies with pnpm

**Files:**
- None (dependency installation)

**Step 1: Clean old node_modules**

Run: `rm -rf node_modules package-lock.json`
Expected: Old dependencies removed

**Step 2: Install with pnpm**

Run: `pnpm install`
Expected: Dependencies installed, workspaces linked

**Step 3: Verify workspace links**

Run: `ls -la packages/plugin/node_modules/.pnpm/node_modules/@plugin-manager/`
Expected: lib package linked

**Step 4: Commit lockfile**

```bash
git add pnpm-lock.yaml
git commit -m "build: add pnpm lockfile after workspace installation"
```

---

### Task 39: Build all packages

**Files:**
- None (build outputs)

**Step 1: Build lib package**

Run: `cd packages/lib && pnpm build`
Expected: Build successful

**Step 2: Build plugin package**

Run: `cd packages/plugin && pnpm build`
Expected: Build successful

**Step 3: Build CLI package**

Run: `cd packages/cli && pnpm build`
Expected: Build successful

**Step 4: Build from root**

Run: `pnpm build`
Expected: All packages build successfully

**Step 5: No commit (build artifacts)**

---

### Task 40: Fix any remaining import errors

**Files:**
- Various (as needed)

**Step 1: Check for build errors**

Run: `pnpm build 2>&1 | grep -i error`
Expected: No errors, or list of errors to fix

**Step 2: Fix imports as needed**

Review and fix any remaining import path issues.

**Step 3: Rebuild to verify**

Run: `pnpm build`
Expected: All builds successful

**Step 4: Commit any fixes**

```bash
git add <modified-files>
git commit -m "fix: resolve remaining import path issues"
```

---

## Phase 6: Verification

### Task 41: Verify plugin package structure

**Files:**
- None (verification)

**Step 1: Check plugin dist output**

Run: `ls -la packages/plugin/dist/`
Expected: main.js, manifest.json present

**Step 2: Check plugin manifest**

Run: `cat packages/plugin/dist/manifest.json | jq .`
Expected: Valid manifest with correct version

**Step 3: Verify main.js exists and has content**

Run: `wc -l packages/plugin/dist/main.js`
Expected: Significant number of lines (bundled code)

---

### Task 42: Verify CLI package structure

**Files:**
- None (verification)

**Step 1: Check CLI dist output**

Run: `ls -la packages/cli/dist/`
Expected: index.js present

**Step 2: Check shebang**

Run: `head -n 1 packages/cli/dist/index.js`
Expected: `#!/usr/bin/env node`

**Step 3: Verify CLI is executable**

Run: `test -x packages/cli/dist/index.js && echo "executable" || echo "not executable"`
Expected: Should be executable (or can be made so)

**Step 4: Make executable if needed**

Run: `chmod +x packages/cli/dist/index.js`
Expected: File made executable

---

### Task 43: Verify lib package exports

**Files:**
- None (verification)

**Step 1: Check lib dist output**

Run: `ls packages/lib/dist/`
Expected: All source .js files present

**Step 2: Check index.js exists**

Run: `test -f packages/lib/dist/index.js && echo "exists" || echo "missing"`
Expected: index.js exists

**Step 3: Verify exports are accessible**

Run: `node -e "import('@plugin-manager/lib').then(m => console.log(Object.keys(m)))"`
Expected: List of exported members

---

### Task 44: Run ESLint

**Files:**
- None (linting check)

**Step 1: Run ESLint on all packages**

Run: `pnpm lint`
Expected: No errors, possibly some warnings

**Step 2: Fix any errors if found**

Review and fix linting errors.

**Step 3: Commit fixes if any**

```bash
git add <modified-files>
git commit -m "fix: resolve linting issues"
```

---

### Task 45: Update README.md

**Files:**
- Modify: `README.md`

**Step 1: Update README with monorepo structure**

Add section:
```markdown
## Monorepo Structure

This repository is organized as a pnpm monorepo with three packages:

- **@plugin-manager/lib** (`packages/lib/`) - Core OCI registry client library
- **@plugin-manager/plugin** (`packages/plugin/`) - Obsidian plugin for installing GHCR-hosted plugins
- **@plugin-manager/cli** (`packages/cli/`) - CLI tool for pushing/pulling plugins to/from GHCR

### Development

Install dependencies:
```bash
pnpm install
```

Build all packages:
```bash
pnpm build
```

Build individual package:
```bash
cd packages/plugin && pnpm build
```

Lint:
```bash
pnpm lint
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README with monorepo structure"
```

---

### Task 46: Create final verification commit

**Files:**
- None (documentation)

**Step 1: Verify all builds pass**

Run: `pnpm clean && pnpm install && pnpm build`
Expected: All packages build successfully

**Step 2: Verify no uncommitted changes**

Run: `git status`
Expected: Clean working directory or only untracked files

**Step 3: Create summary of changes**

Run: `git log --oneline main..HEAD`
Expected: List of all commits from refactoring

**Step 4: Tag the completion (optional)**

Run: `git tag -a monorepo-refactor-complete -m "Complete monorepo refactoring"`
Expected: Tag created

---

## Summary

This plan refactors the repository into a pnpm monorepo with three packages:

1. **@plugin-manager/lib** - Platform-agnostic OCI registry client
2. **@plugin-manager/plugin** - Obsidian plugin with installer
3. **@plugin-manager/cli** - Node.js CLI for push/pull operations

Key changes:
- All packages use esbuild for building
- Shared TypeScript base configuration
- Workspace protocol for internal dependencies
- Clear separation of platform-specific code

The refactor improves dependency management by isolating Obsidian APIs in the plugin package, Node.js APIs in the CLI package, and keeping the core registry client platform-neutral.
