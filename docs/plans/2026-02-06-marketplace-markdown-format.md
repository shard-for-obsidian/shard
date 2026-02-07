# Marketplace Markdown Format Migration

**Date**: 2026-02-06
**Status**: Approved

## Overview

Migrate the Shard marketplace from YAML plugin definitions with hardcoded versions to Markdown files with YAML frontmatter. Version information will be dynamically queried from OCI registries at site generation time. Add per-plugin pages with version history and installation commands.

## Goals

1. Remove hardcoded version information from plugin metadata files
2. Query available versions dynamically from OCI registries
3. Provide rich plugin pages with markdown introductions
4. Display comprehensive version information (date, size, annotations)
5. Update CLI to support the new format

## Design

### 1. Markdown File Format

**Location**: `marketplace/plugins/*.md`

**Structure**:

```markdown
---
id: shard-installer
registryUrl: ghcr.io/shard-for-obsidian/shard/shard-installer-plugin
name: Shard Installer
author: Andrew Gillis
description: Browse and install Obsidian plugins from GitHub Container Registry
repository: https://github.com/shard-for-obsidian/shard
minObsidianVersion: 1.11.4
authorUrl: https://example.com
---

# Shard Installer

The Shard Installer brings GitHub Container Registry support to Obsidian, allowing you to discover and install plugins from GHCR repositories. Unlike the official plugin system, Shard provides enhanced security through OCI image signing and private plugin hosting.
```

**Changes from YAML format**:

- File extension: `.yml` → `.md`
- Remove `version` field (queried from OCI)
- Remove `updatedAt` field (derived from OCI manifest)
- Add markdown body with 1-2 paragraph introduction
- Frontmatter structure otherwise unchanged

### 2. GitHub Actions Workflow

**File**: `.github/workflows/build-marketplace.yml`

**Trigger**: Push to `marketplace/plugins/*.md` or manual dispatch

**Steps**:

1. Parse all `.md` files in `marketplace/plugins/`
2. For each plugin's `registryUrl`:
   - Query OCI registry tags API to get all available versions
   - For each tag, fetch manifest to extract:
     - Published date (from manifest `created` timestamp)
     - Size (sum of layer blob sizes)
     - OCI annotations (commit SHA, release notes URL, etc.)
3. Generate `marketplace/data/plugins.json`:

```json
{
  "plugins": [
    {
      "id": "shard-installer",
      "registryUrl": "ghcr.io/shard-for-obsidian/shard/shard-installer-plugin",
      "name": "Shard Installer",
      "author": "Andrew Gillis",
      "description": "Browse and install...",
      "repository": "https://github.com/...",
      "minObsidianVersion": "1.11.4",
      "introduction": "# Shard Installer\n\nThe Shard...",
      "versions": [
        {
          "tag": "0.3.0",
          "publishedAt": "2026-02-06T01:25:08Z",
          "size": 245678,
          "annotations": {
            "vnd.obsidianmd.plugin.commit": "abc123",
            "vnd.obsidianmd.plugin.author-url": "https://..."
          }
        },
        {
          "tag": "0.2.1",
          "publishedAt": "2026-01-20T10:30:00Z",
          "size": 243210,
          "annotations": {}
        }
      ]
    }
  ],
  "generatedAt": "2026-02-06T12:00:00Z"
}
```

4. Generate `content/plugins/<id>.md` files from plugin markdown sources
5. Build Hugo site with `hugo`
6. Deploy to GitHub Pages

**Authentication**: Use `GITHUB_TOKEN` with `packages: read` permission for GHCR access

### 3. CLI Updates

**`shard marketplace register` command changes**:

Current behavior:

- Accepts specific OCI tag (e.g., `ghcr.io/owner/repo:1.0.0`)
- Writes YAML file with hardcoded `version` field

New behavior:

- Accepts OCI repository URL (no specific tag required)
- Writes Markdown file with YAML frontmatter
- No `version` field in frontmatter
- Prompts user for introduction text (or accepts via `--intro` flag)
- Validates registryUrl accessibility before writing

Example:

```bash
shard marketplace register ghcr.io/owner/repo --intro "Brief intro text"
```

**New command: `shard marketplace versions`**:

Query and display all available tags for a registry URL.

```bash
shard marketplace versions ghcr.io/owner/repo
```

Output:

```
Available versions for ghcr.io/owner/repo:
- 0.3.0 (published 2026-02-05, 256 KB)
- 0.2.1 (published 2026-01-20, 248 KB)
- 0.2.0 (published 2026-01-15, 245 KB)
```

**Type changes**:

Update `packages/shard-cli/src/lib/marketplace-client.ts` and `packages/shard-installer/src/marketplace/types.ts`:

```typescript
export interface MarketplacePlugin {
  id: string;
  registryUrl: string;
  name: string;
  author: string;
  description: string;
  repository?: string;
  minObsidianVersion?: string;
  authorUrl?: string;
  introduction: string; // NEW: markdown content
  versions: PluginVersion[]; // NEW: version list
}

export interface PluginVersion {
  tag: string;
  publishedAt: string; // ISO 8601
  size: number; // bytes
  annotations: Record<string, string>;
}

export interface MarketplaceIndex {
  plugins: MarketplacePlugin[];
  generatedAt: string; // ISO 8601
}
```

### 4. Hugo Site Structure

**Per-plugin page layout**: `marketplace/layouts/plugins/single.html`

**URL structure**: `/plugins/<plugin-id>/`

**Page layout** (card-style with sidebar):

```
┌─────────────────────────────────────────────────────────┐
│                     Site Header                         │
├─────────────────┬───────────────────────────────────────┤
│                 │  # Plugin Name                        │
│   Metadata      │  by Author                            │
│   Sidebar       │                                       │
│                 │  [Markdown Introduction]              │
│  • ID           │  (1-2 paragraphs from file)           │
│  • Registry URL │                                       │
│  • Repository   │  ## Available Versions                │
│  • Min Version  │                                       │
│                 │  ┌─────────────────────────────────┐  │
│  [Install       │  │ v0.3.0                          │  │
│   Latest]       │  │ Published: 2026-02-05           │  │
│                 │  │ Size: 256 KB                    │  │
│                 │  │ Commit: abc123                  │  │
│                 │  │ [Copy install command]          │  │
│                 │  └─────────────────────────────────┘  │
│                 │                                       │
│                 │  ┌─────────────────────────────────┐  │
│                 │  │ v0.2.1 ...                      │  │
│                 │  └─────────────────────────────────┘  │
└─────────────────┴───────────────────────────────────────┘
```

**Data flow**:

1. Hugo reads plugin metadata from `data/plugins.json`
2. Hugo reads markdown content from `content/plugins/<id>.md`
3. Template injects version list and metadata into layout
4. Each version card displays tag, date, size, annotations, and install command

**Home page** (`layouts/index.html`):

- Grid of plugin cards
- Each card links to `/plugins/<id>/`
- Shows plugin name, author, description snippet

**Content generation**:

- GitHub Actions copies `marketplace/plugins/*.md` → `marketplace/content/plugins/*.md`
- Preserves frontmatter and markdown body
- Hugo processes these as page content

## Implementation Tasks

1. **Update file format**:
   - Migrate existing `.yml` files to `.md` format
   - Remove `version` and `updatedAt` fields
   - Add introduction content to each plugin

2. **Create GitHub Actions workflow**:
   - Write OCI registry client for tag listing and manifest fetching
   - Parse markdown files and query registries
   - Generate `data/plugins.json` and `content/plugins/*.md`
   - Handle authentication with GITHUB_TOKEN

3. **Update CLI**:
   - Modify `marketplace register` to generate `.md` files
   - Add `--intro` flag for introduction text
   - Create `marketplace versions` command
   - Update TypeScript types for new JSON structure

4. **Create Hugo layouts**:
   - Design `layouts/plugins/single.html` template
   - Update `layouts/index.html` for plugin grid
   - Add CSS for card-style layout with sidebar
   - Implement copy-to-clipboard for install commands

5. **Update documentation**:
   - Update `marketplace/README.md` with new format
   - Document new CLI commands
   - Add examples of markdown plugin files

## Benefits

- **No version staleness**: Versions always reflect current OCI registry state
- **Richer plugin pages**: Markdown introductions provide better context
- **Version transparency**: Users see all available versions with metadata
- **Better UX**: Per-plugin pages with install commands and version history
- **Automated updates**: GitHub Actions keeps marketplace in sync with registries

## Migration Path

1. Create new `.md` files alongside existing `.yml` files
2. Deploy new GitHub Actions workflow (reads `.md` files only)
3. Update CLI to generate `.md` format
4. After validation, remove old `.yml` files
5. Update marketplace README with new submission process
