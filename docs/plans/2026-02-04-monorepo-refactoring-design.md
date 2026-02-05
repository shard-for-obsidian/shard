# Monorepo Refactoring Design

**Date:** 2026-02-04
**Status:** Approved

## Overview

Refactor the repository into a pnpm monorepo with three main packages: plugin, cli, and lib. This refactoring aims to improve dependency management clarity, with better separation between platform-specific code and shared library code.

## Motivation

The primary driver is **better dependency management**:
- Plugin uses Obsidian APIs
- CLI uses Node.js APIs
- Shared library code should be platform-agnostic
- Clear boundaries prevent dependency leakage

## Package Structure

### Directory Layout


```
packages/
  shard-installer/   - shard-installer (Plugin installer for Obsidian)
  shard-cli/         - shard-cli (CLI tool)
  shard-lib/         - shard-lib (Shared library)
```

### Root-level Files

- `package.json` - Workspace config, hoisted devDependencies
- `pnpm-workspace.yaml` - pnpm workspace configuration
- `tsconfig.base.json` - Shared TypeScript base config
- `eslint.config.mjs` - Root ESLint config with package overrides
- `.gitignore`, `README.md`, `LICENSE`, etc.

### Package Names

- `shard-installer` - The plugin installer (Obsidian or other platforms)
- `shard-cli` - CLI for push/pull operations
- `shard-lib` - Shared OCI registry client

### Dependency Relationships

- `plugin` depends on `lib` (workspace protocol)
- `cli` depends on `lib` (workspace protocol)
- `lib` has no internal dependencies (only external like `tslib`)

## Package Contents & Responsibilities


### packages/shard-lib/ - shard-lib

Core OCI registry client library, platform-agnostic.

**Contents (moved from src/lib/client/):**
- `registry-client.ts` - OciRegistryClient class
- `common.ts` - parseRepo, parseRepoAndRef, etc.
- `types.ts` - All TypeScript interfaces/types
- `errors.ts` - Error classes
- `fetch-adapter.ts` - FetchAdapter interface
- `ghcr.ts` - GHCR constants (REALM, SERVICE)
- `util/link-header.ts` - Link header parsing
- `docker-json-client.ts` - If still needed (seems unused?)

**NOT included (stays in respective packages):**
- `node-fetch-adapter.ts` → moves to CLI
- `obsidian-fetch-adapter.ts` → moves to Plugin
- `installer.ts` → moves to Plugin (Obsidian-specific)


**Build:** Uses esbuild to output clean ESM modules for import by other packages.


### packages/shard-installer/ - shard-installer

The Obsidian plugin for installing GHCR-hosted plugins.

**Contents (from src/plugin/):**
- All current plugin files (main.ts, settings.ts, etc.)
- `installer.ts` (moved from src/lib/installer/)
- `obsidian-fetch-adapter.ts` (moved from src/lib/client/)
- esbuild config for bundling
- manifest.json, styles.css


**Build:** Uses esbuild for bundling into single main.js file (current setup).

**Imports from lib:** `import { OciRegistryClient } from "shard-lib"`


### packages/shard-cli/ - shard-cli

CLI tool for pushing/pulling plugins to/from GHCR.

**Contents (from src/cli/):**
- All current CLI files (index.ts, commands/, lib/)
- `node-fetch-adapter.ts` (moved from src/lib/client/)
- CLI-specific utilities (logger, plugin discovery, auth, digest)


**Build:** Uses esbuild for bundling/distribution as npm package with CLI entry point.

**Imports from lib:** `import { OciRegistryClient } from "shard-lib"`

## Configuration Files

### Root package.json

```json
{
  "name": "shard-plugin-system",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/shard-cli",
    "packages/shard-installer",
    "packages/shard-lib"
  ],
  "scripts": {
    "build": "pnpm -r build",
    "lint": "eslint .",
    "clean": "pnpm -r clean"
  },
  "devDependencies": {
    "@typescript-eslint/parser": "^8.54.0",
    "eslint": "^9.39.2",
    "eslint-plugin-obsidianmd": "^0.1.9",
    "typescript": "^5.9.3",
    "typescript-eslint": "^8.54.0",
    "esbuild": "^0.27.2",
    "tslib": "^2.8.1"
  }
}
```

### pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
```

### tsconfig.base.json

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

### packages/lib/package.json

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
  }
}
```

### packages/plugin/package.json

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
  }
}
```

### packages/cli/package.json

```json
{
  "name": "@plugin-manager/cli",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "obsidian-plugin": "./dist/index.js"
  },
  "scripts": {
    "build": "node esbuild.config.mjs",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@plugin-manager/lib": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^25.2.0"
  }
}
```

## Build Configuration

### packages/lib/esbuild.config.mjs

```javascript
import esbuild from "esbuild";

const production = process.argv[2] === "production";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: false, // Don't bundle - output individual modules
  outdir: "dist",
  platform: "neutral",
  format: "esm",
  target: "es2022",
  sourcemap: !production,
  minify: production,
  treeShaking: true,
});
```

### packages/plugin/esbuild.config.mjs

Keep current plugin build config:
- Bundle to single main.js
- External: obsidian
- Can import from @plugin-manager/lib after lib is built

### packages/cli/esbuild.config.mjs

```javascript
import esbuild from "esbuild";

const production = process.argv[2] === "production";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true, // Bundle for distribution
  outfile: "dist/index.js",
  platform: "node",
  format: "esm",
  target: "node18",
  sourcemap: !production,
  minify: production,
  banner: {
    js: "#!/usr/bin/env node"
  },
  external: [], // Bundle everything
});
```

**Key differences:**
- **lib**: Unbundled modules (bundle: false) for reusability
- **plugin**: Bundled single file with Obsidian external (current setup)
- **cli**: Bundled single file for CLI distribution with shebang

## TypeScript & ESLint Configuration

### packages/lib/tsconfig.json

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

### packages/plugin/tsconfig.json

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

### packages/cli/tsconfig.json

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

### Root eslint.config.mjs

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
      // Obsidian-specific rules here
    }
  },
  {
    // CLI and lib rules
    files: ["packages/{cli,lib}/**/*.ts"],
    rules: {
      // Standard rules
    }
  }
];
```

## Migration Steps

### Phase 1: Setup Infrastructure

1. Create git worktree for the refactor
2. Install pnpm if not already installed
3. Create `packages/` directory structure
4. Create root configuration files:
   - `pnpm-workspace.yaml`
   - `tsconfig.base.json`
   - Update root `package.json`
   - Update `eslint.config.mjs`

### Phase 2: Create lib Package

1. Create `packages/lib/` directory
2. Copy files from `src/lib/client/` to `packages/lib/src/`:
   - `registry-client.ts`
   - `common.ts`
   - `types.ts`
   - `errors.ts`
   - `fetch-adapter.ts`
   - `ghcr.ts`
   - `util/link-header.ts`
3. Create `packages/lib/src/index.ts` to export public API
4. Create `packages/lib/package.json`
5. Create `packages/lib/tsconfig.json`
6. Create `packages/lib/esbuild.config.mjs`
7. Build lib package (`pnpm build`)

### Phase 3: Create plugin Package

1. Create `packages/plugin/` directory
2. Move files from `src/plugin/` to `packages/plugin/src/`
3. Move `src/lib/installer/installer.ts` to `packages/plugin/src/installer/`
4. Move `src/lib/client/obsidian-fetch-adapter.ts` to `packages/plugin/src/adapters/`
5. Copy relevant root files (manifest.json, esbuild.config.mjs)
6. Create `packages/plugin/package.json`
7. Create `packages/plugin/tsconfig.json`
8. Update imports to use `@plugin-manager/lib`
9. Update esbuild config if needed

### Phase 4: Create cli Package

1. Create `packages/cli/` directory
2. Move files from `src/cli/` to `packages/cli/src/`
3. Move `src/lib/client/node-fetch-adapter.ts` to `packages/cli/src/adapters/`
4. Create `packages/cli/package.json`
5. Create `packages/cli/tsconfig.json`
6. Create `packages/cli/esbuild.config.mjs`
7. Update imports to use `@plugin-manager/lib`

### Phase 5: Clean Up & Build

1. Delete old `src/` directory
2. Run `pnpm install` at root
3. Run `pnpm build` at root
4. Fix any remaining import/build errors
5. Update `.gitignore` if needed
6. Update documentation (README.md)

### Phase 6: Verification

1. Test plugin builds correctly
2. Test CLI builds and runs
3. Run linting (`pnpm lint`)
4. Commit changes progressively

## Benefits

1. **Clear dependency boundaries** - Each package declares exactly what it needs
2. **Platform separation** - Obsidian vs Node.js code properly isolated
3. **Reusable core library** - Registry client can be used independently
4. **Better tooling** - pnpm workspace features for hoisting and linking
5. **Independent builds** - Each package has its own build configuration
6. **Easier testing** - Can test packages in isolation
7. **Future-proof** - Easy to add more packages or publish to npm

## Trade-offs

1. **More structure** - More package.json files and configs to maintain
2. **Build order matters** - lib must be built before plugin/cli
3. **Learning curve** - Team needs to understand monorepo workflows
4. **Initial migration effort** - Significant upfront work to restructure

## Open Questions

None - all design decisions have been validated.
