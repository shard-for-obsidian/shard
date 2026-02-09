# Convert Command Enhancement

**Date:** 2026-02-09
**Status:** Approved

## Overview

Update the `shard convert` command to automatically fetch plugin metadata from community-plugins.json and GitHub releases, generate comprehensive OCI annotations, and support multi-tag publishing.

## Command Interface

### Current

```bash
shard convert <plugin-id> <repository> [--version] [--token] [--json] [--verbose]
```

### New

```bash
shard convert <plugin-id> --namespace <namespace> [--token] [--json] [--verbose]
```

### Changes

- Remove positional `repository` argument
- Add required `--namespace` flag (e.g., `ghcr.io/owner/repo/community-plugins/`)
- Remove `--version` flag - always convert latest release
- Keep `--token`, `--json`, `--verbose` flags

### Repository Resolution

- Normalize plugin ID to lowercase
- Append normalized ID to namespace
- Example: `obsidian-git` + `ghcr.io/owner/repo/community-plugins/` → `ghcr.io/owner/repo/community-plugins/obsidian-git`

### Tagging Strategy

For version `2.36.1`, create 4 tags:

- `2.36.1` (full version)
- `2.36` (major.minor)
- `2` (major only)
- `latest`

## Data Collection

### Data Sources

1. **community-plugins.json** - plugin metadata from Obsidian releases repo
2. **GitHub Releases API** - latest release information
3. **Release assets** - manifest.json, main.js, styles.css

## Annotations

### Manifest-Level Annotations

```typescript
{
  // From manifest.json
  "vnd.obsidianmd.plugin.id": manifest.id,
  "vnd.obsidianmd.plugin.name": manifest.name,
  "vnd.obsidianmd.plugin.version": manifest.version,
  "vnd.obsidianmd.plugin.description": manifest.description,
  "vnd.obsidianmd.plugin.author": manifest.author,
  "vnd.obsidianmd.plugin.min-app-version": manifest.minAppVersion, // required
  "vnd.obsidianmd.plugin.author-url": manifest.authorUrl, // optional
  "vnd.obsidianmd.plugin.is-desktop-only": String(manifest.isDesktopOnly ?? false),
  "vnd.obsidianmd.plugin.funding-url": JSON.stringify(manifest.fundingUrl), // optional, JSON if object

  // From community-plugins.json
  "vnd.obsidianmd.plugin.introduction": communityPlugin.description,

  // From GitHub repo (community-plugins.json)
  "vnd.obsidianmd.plugin.source": `https://github.com/${communityPlugin.repo}`,

  // From GitHub release (converted to RFC 3339)
  "vnd.obsidianmd.plugin.published-at": new Date(release.published_at).toISOString(),

  // Conversion flag
  "vnd.obsidianmd.plugin.converted": "true",

  // OCI standard annotations
  "org.opencontainers.image.source": "https://github.com/shard-for-obsidian/shard",
  "org.opencontainers.image.title": manifest.name,
  "org.opencontainers.image.created": new Date().toISOString(), // RFC 3339
}
```

### Layer Annotations

Each layer (main.js, styles.css, manifest.json config) gets:

```typescript
{
  "vnd.obsidianmd.layer.filename": filename, // existing
  "org.opencontainers.image.title": filename, // new for ORAS compatibility
}
```

## Implementation

### Files to Modify

1. **`packages/cli/src/commands/convert.ts`**
   - Change command signature: remove `repository` positional, add `--namespace` flag
   - Remove `--version` flag
   - Update repository construction: `${namespace}${pluginId.toLowerCase()}`
   - Pass community plugin data to converter

2. **`packages/cli/src/lib/converter.ts`**
   - Update `ConvertPluginOptions`: replace `repository` with `namespace`
   - Remove `version` field (always use latest)
   - Add `communityPlugin` to `ConvertPluginResult`
   - Update `convertPlugin()`: pass community plugin data through
   - Update `pushToRegistry()`: accept community plugin data, generate all annotations
   - Add multi-tag support: generate version tags (full, major.minor, major, latest)

3. **`packages/lib/src/schemas/annotations.ts`**
   - Add new annotation fields:
     - `vnd.obsidianmd.plugin.introduction` (required)
     - `vnd.obsidianmd.plugin.funding-url` (optional)
     - `vnd.obsidianmd.plugin.is-desktop-only` (required)
     - `org.opencontainers.image.title` (required)
     - `org.opencontainers.image.created` (required)

4. **`packages/lib/src/schemas/transforms.ts`**
   - Update `manifestToAnnotations()`: accept community plugin data, add new annotations

5. **`packages/lib/src/client/OciRegistryClient.ts`**
   - Update layer push methods to include `org.opencontainers.image.title` annotation
   - Add support for pushing multiple tags in single operation

## Conversion Workflow

1. **Fetch community plugins list**
   - Download `community-plugins.json` from obsidian-releases
   - Find plugin entry by ID
   - Extract: `name`, `author`, `description` (for introduction), `repo`

2. **Fetch latest GitHub release**
   - Call GitHub API: `/repos/{owner}/{repo}/releases/latest`
   - Extract: `tag_name` (version), `published_at`, `assets[]`

3. **Download release assets**
   - Find and download: `manifest.json`, `main.js`, `styles.css` (optional)
   - Parse manifest.json and validate schema

4. **Validate manifest**
   - Verify manifest.id matches requested plugin ID
   - Ensure all required fields are present

5. **Generate version tags**
   - Parse version string (e.g., "2.36.1")
   - Generate: `2.36.1`, `2.36`, `2`, `latest`

6. **Build annotations**
   - Combine data from community-plugins.json, manifest.json, and release
   - Handle optional fields (funding-url, author-url)
   - Serialize funding-url as JSON if object

7. **Push to registry with all tags**
   - Push blobs (main.js, styles.css) with layer annotations
   - Push manifest with all annotations
   - Tag manifest with all 4 version tags

## Error Handling

- Plugin not found in community-plugins.json → clear error message
- No releases found → error with link to repo
- Missing required assets (manifest.json, main.js) → error
- Manifest ID mismatch → error
- Invalid version format → error

## Example Usage

```bash
shard convert obsidian-git --namespace ghcr.io/shard-for-obsidian/shard/community-plugins/
```

**Result:**

- Repository: `ghcr.io/shard-for-obsidian/shard/community-plugins/obsidian-git`
- Tags: `2.36.1`, `2.36`, `2`, `latest`
- Full annotations from community-plugins.json + manifest.json + release metadata
