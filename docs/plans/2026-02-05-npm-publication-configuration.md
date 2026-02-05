# NPM Publication Configuration Plan

**Date:** February 5, 2026  
**Status:** Planning  
**Packages:** shard-lib, shard-cli

## Overview

This document outlines the plan for configuring the `shard-lib` and `shard-cli` packages for publication to the npm registry. Both packages are part of the Shard plugin system monorepo and need to be published as public packages for use by the wider Obsidian plugin development community.

## Current State

### shard-lib (v0.1.0)
- ✅ Basic package.json with name, version, and license
- ✅ Build configuration with esbuild + TypeScript
- ✅ Entry point defined (`./dist/index.js`)
- ✅ TypeScript types defined (`./dist/index.d.ts`)
- ✅ Keywords for discoverability
- ❌ Missing npm-specific metadata (author, repository, bugs, homepage)
- ❌ No files field to control published content
- ❌ No .npmignore or explicit file inclusion strategy
- ❌ No prepublish validation scripts
- ❌ No README.md in package directory

### shard-cli (v0.1.0)
- ✅ Basic package.json with name, version, and description
- ✅ Build configuration with esbuild
- ✅ Binary entry point defined (`./dist/index.js`)
- ✅ Engine requirements (Node >= 20.19.2)
- ✅ Workspace dependency on shard-lib
- ❌ Missing npm-specific metadata (author, repository, bugs, homepage)
- ❌ No files field to control published content
- ❌ No shebang in CLI entry point (needs verification)
- ❌ No prepublish validation scripts
- ❌ No README.md in package directory

### Monorepo Root
- ✅ pnpm workspace configuration
- ✅ Build scripts for all packages
- ❌ No publishing scripts or workflows
- ❌ No version management strategy

## Goals

1. **Configure packages for npm publication** with proper metadata and file inclusion
2. **Establish a publishing workflow** that ensures quality and consistency
3. **Document the publication process** for maintainers
4. **Set up version management** in the monorepo context
5. **Ensure shard-cli properly depends on published shard-lib** rather than workspace version

## Implementation Plan

### Phase 1: Package Metadata Configuration

#### 1.1 shard-lib package.json Updates

Add the following fields:

```json
{
  "name": "shard-lib",
  "version": "0.1.0",
  "description": "Core library for interacting with GitHub Container Registry (GHCR) for Obsidian plugin management",
  "author": "Andrew Gillis <[email protected]>",
  "repository": {
    "type": "git",
    "url": "https://github.com/gillisandrew/shard",
    "directory": "packages/shard-lib"
  },
  "bugs": {
    "url": "https://github.com/gillisandrew/shard/issues"
  },
  "homepage": "https://github.com/gillisandrew/shard#readme",
  "files": [
    "dist/**/*",
    "README.md",
    "LICENSE"
  ],
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  }
}
```

**Additional considerations:**
- Add `"sideEffects": false` for better tree-shaking
- Ensure `exports` field covers all necessary entry points
- Add `"engines": { "node": ">=20.19.2" }` to specify minimum Node.js version (matches Obsidian's bundled Node)

#### 1.2 shard-cli package.json Updates

Add the following fields:

```json
{
  "name": "shard-cli",
  "version": "0.1.0",
  "description": "CLI tool for pushing and pulling Obsidian plugins to/from GitHub Container Registry (GHCR)",
  "author": "Andrew Gillis <[email protected]>",
  "repository": {
    "type": "git",
    "url": "https://github.com/gillisandrew/shard",
    "directory": "packages/shard-cli"
  },
  "bugs": {
    "url": "https://github.com/gillisandrew/shard/issues"
  },
  "homepage": "https://github.com/gillisandrew/shard#readme",
  "files": [
    "dist/**/*",
    "README.md",
    "LICENSE"
  ],
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  }
}
```

**Additional considerations:**
- Verify that `dist/index.js` has a proper shebang (`#!/usr/bin/env node`)
- Update dependency on shard-lib to use version range instead of `workspace:*` for publication

### Phase 2: Build Configuration

#### 2.1 Update shard-cli Build to Include Shebang

Modify `packages/shard-cli/esbuild.config.mjs`:

```javascript
import esbuild from "esbuild";

const production = process.argv[2] === "production";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/index.js",
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: !production,
  minify: production,
  treeShaking: true,
  banner: {
    js: "#!/usr/bin/env node"
  },
  external: ["shard-lib"], // Don't bundle workspace dependency
});

console.log("✓ shard-cli built successfully");
```

#### 2.2 Add Prepublish Scripts

Add to both `package.json` files:

```json
{
  "scripts": {
    "prepublishOnly": "pnpm run build && pnpm run ts-check",
    "postbuild": "chmod +x dist/index.js" // For shard-cli only
  }
}
```

### Phase 3: Documentation

#### 3.1 Create shard-lib/README.md

Include:
- Description of the library
- Installation instructions (`npm install shard-lib` or `pnpm add shard-lib`)
- Basic usage examples
- API documentation (or link to docs)
- Link to full repository
- License information

#### 3.2 Create shard-cli/README.md

Include:
- Description of the CLI tool
- Installation instructions (global: `npm install -g shard-cli`)
- Available commands (`shard push`, `shard pull`)
- Command examples and options
- Configuration guide
- Link to full repository
- License information

#### 3.3 Create/Copy LICENSE Files

Ensure both package directories have a LICENSE file (MIT license as specified in package.json).

### Phase 4: Publishing Workflow

#### 4.1 Manual Publishing Process

Document the manual publishing steps:

1. **Version Update**
   ```bash
   # In the package directory
   cd packages/shard-lib  # or shard-cli
   pnpm version [patch|minor|major]
   ```

2. **Build and Test**
   ```bash
   pnpm run clean
   pnpm run build
   pnpm run ts-check
   ```

3. **Publish to npm**
   ```bash
   npm publish
   ```

4. **Update Dependency References**
   - If shard-lib is published, update shard-cli's dependency to use the published version
   - Tag the release in git
   ```bash
   git tag shard-lib@0.1.0
   git push --tags
   ```

#### 4.2 Automated Publishing (Future)

Set up GitHub Actions workflow:

```yaml
# .github/workflows/publish.yml
name: Publish to npm

on:
  push:
    tags:
      - 'shard-lib@*'
      - 'shard-cli@*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: '20.19.2'
          registry-url: 'https://registry.npmjs.org'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Build packages
        run: pnpm run build
      
      - name: Publish shard-lib
        if: startsWith(github.ref, 'refs/tags/shard-lib@')
        run: |
          cd packages/shard-lib
          npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
      
      - name: Publish shard-cli
        if: startsWith(github.ref, 'refs/tags/shard-cli@')
        run: |
          cd packages/shard-cli
          npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Phase 5: Version Management Strategy

#### 5.1 Monorepo Versioning

Decision points:
- **Independent versioning**: Each package maintains its own version (current approach)
- **Synchronized versioning**: All packages share the same version

**Recommendation:** Use independent versioning since packages have different purposes and may evolve at different rates.

#### 5.2 Dependency Management

When publishing shard-cli, update its dependency on shard-lib:

**Before publication:**
```json
{
  "dependencies": {
    "shard-lib": "workspace:*"
  }
}
```

**For publication:** pnpm automatically converts this to the actual version range during publish:
```json
{
  "dependencies": {
    "shard-lib": "^0.1.0"
  }
}
```

#### 5.3 Release Process

1. Update and publish `shard-lib` first
2. Update `shard-cli` dependency reference if needed
3. Publish `shard-cli` second
4. Create GitHub release notes for both packages

### Phase 6: Pre-Publication Checklist

Before first publication:

- [ ] Verify GitHub repository is public (or configure private package pricing)
- [ ] Create npm account and verify email
- [ ] Generate npm access token with publish permissions
- [ ] Add npm token to CI/CD secrets (if using automation)
- [ ] Test build process in clean environment
- [ ] Test installation in separate project
- [ ] Verify CLI binary is executable after global install
- [ ] Review all metadata fields for accuracy
- [ ] Ensure README files are comprehensive
- [ ] Add LICENSE files to package directories
- [ ] Update root README with installation instructions for published packages

### Phase 7: Post-Publication Tasks

After successful publication:

- [ ] Test installing from npm: `npm install shard-lib` and `npm install -g shard-cli`
- [ ] Verify package pages on npmjs.com
- [ ] Update repository README with npm badges
- [ ] Create GitHub releases for tags
- [ ] Announce release (if applicable)
- [ ] Monitor for installation issues

## Package Interdependencies

### Publishing Order

1. **shard-lib** must be published first since shard-cli depends on it
2. **shard-cli** can be published after shard-lib is available on npm

### Workspace Development vs. Published Packages

During development:
- Use `workspace:*` protocol for local development
- pnpm automatically resolves to local packages

For consumers:
- Published packages reference actual npm versions
- pnpm converts `workspace:*` to version ranges during publish

## Testing Strategy

### Pre-Publish Testing

1. **Local Build Test**
   ```bash
   cd packages/shard-lib
   pnpm run clean && pnpm run build
   # Verify dist/ contains expected files
   ```

2. **Pack Test**
   ```bash
   npm pack
   # Extract and inspect the .tgz file
   tar -tzf shard-lib-0.1.0.tgz
   ```

3. **Local Install Test**
   ```bash
   # In a test project
   npm install ../path/to/shard-lib-0.1.0.tgz
   ```

### Post-Publish Testing

1. **Fresh Install**
   ```bash
   mkdir test-install && cd test-install
   npm init -y
   npm install shard-lib
   npm install -g shard-cli
   ```

2. **CLI Functionality**
   ```bash
   shard --version
   shard --help
   ```

3. **Import Test**
   ```javascript
   // test.js
   import { /* exported functions */ } from 'shard-lib';
   console.log('Import successful');
   ```

## Risks and Mitigation

### Risk 1: Breaking Changes in Dependencies
**Mitigation:** Pin major versions and test thoroughly before updates

### Risk 2: Workspace Protocol Not Converted
**Mitigation:** Verify pnpm version >= 7.0 which has automatic conversion

### Risk 3: CLI Binary Not Executable
**Mitigation:** Test installation and execution on multiple platforms (Linux, macOS, Windows)

### Risk 4: Missing Files in Published Package
**Mitigation:** Use `npm pack` to preview contents before publishing

### Risk 5: Version Conflicts
**Mitigation:** Maintain clear versioning policy and communicate breaking changes

## Success Criteria

- [ ] Both packages successfully published to npm registry
- [ ] Packages installable via `npm install` or `pnpm add`
- [ ] CLI tool installable globally and executable
- [ ] Package pages on npmjs.com display correct metadata
- [ ] Documentation is clear and helpful
- [ ] No critical issues reported in first week post-publication

## Timeline

1. **Week 1: Configuration** (Estimated: 2-4 hours)
   - Update package.json files
   - Create README files
   - Add LICENSE files

2. **Week 1: Testing** (Estimated: 2-3 hours)
   - Build and pack testing
   - Local installation testing
   - CLI execution testing

3. **Week 1: Publication** (Estimated: 1 hour)
   - Create npm account (if needed)
   - Publish shard-lib
   - Publish shard-cli
   - Verify installations

4. **Week 2: Automation** (Estimated: 3-4 hours)
   - Set up GitHub Actions workflow
   - Test automated publishing
   - Document process for maintainers

## References

- [pnpm Publishing Workspace Packages](https://pnpm.io/cli/publish)
- [npm Publishing Documentation](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [npm package.json Fields](https://docs.npmjs.com/cli/v10/configuring-npm/package-json)
- [Semantic Versioning](https://semver.org/)

## Appendix: Package.json Field Reference

### Essential Fields for npm Publication

| Field | Purpose | Required |
|-------|---------|----------|
| `name` | Package identifier on npm | Yes |
| `version` | Semantic version | Yes |
| `description` | Brief package description | Recommended |
| `author` | Package maintainer | Recommended |
| `license` | License identifier | Yes |
| `repository` | Source code location | Recommended |
| `bugs` | Issue tracker URL | Recommended |
| `homepage` | Project homepage | Recommended |
| `files` | Files to include in package | Recommended |
| `publishConfig` | Publishing configuration | Recommended |
| `keywords` | Searchability on npm | Recommended |
| `engines` | Runtime requirements | Recommended |

### CLI-Specific Fields

| Field | Purpose | Required for CLI |
|-------|---------|------------------|
| `bin` | Binary entry points | Yes |
| `engines.node` | Node version requirement | Recommended |

## Next Steps

1. Review this plan with team/maintainers
2. Gather feedback and make adjustments
3. Proceed with Phase 1: Package Metadata Configuration
4. Continue through phases sequentially
5. Document any deviations or learnings during implementation

---

**Document Version:** 1.0  
**Last Updated:** February 5, 2026  
**Author:** GitHub Copilot (Claude Sonnet 4.5)
