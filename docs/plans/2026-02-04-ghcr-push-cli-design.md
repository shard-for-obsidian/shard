# GHCR Push/Pull CLI Design

**Date:** 2026-02-04
**Status:** Design Complete

## Overview

Extend the `OciRegistryClient` class to support pushing Obsidian plugin artifacts to GitHub Container Registry (GHCR) as OCI artifacts compatible with ORAS. Create a Node.js CLI for pushing and pulling plugin manifests.

## Goals

- Push Obsidian plugins to GHCR as OCI artifacts (similar to ORAS)
- Pull plugins from GHCR for testing and distribution
- Support both local development (PAT) and CI/CD (GITHUB_TOKEN)
- Maintain backward compatibility with existing Obsidian plugin code
- Use ORAS-compatible manifest structure with filename annotations

## Architecture

### 1. Refactored OciRegistryClient

**Changes:**
- Refactor from Obsidian's `requestUrl` to standard `fetch` API
- Accept `FetchAdapter` in constructor for portability
- Add new methods: `pushBlob()`, `pushManifest()`
- Remove `DockerJsonClient` dependency, use fetch directly
- Keep existing auth logic unchanged

**New Methods:**

```typescript
async pushBlob(opts: {
  data: ArrayBuffer | Uint8Array;
  digest?: string;
}): Promise<{ digest: string; size: number }>

async pushManifest(opts: {
  ref: string;
  manifest: Manifest;
  mediaType?: string;
}): Promise<{ digest: string; size: number }>
```

### 2. HTTP Adapter Pattern

**Interface:**
```typescript
interface FetchAdapter {
  fetch(input: string | Request, init?: RequestInit): Promise<Response>;
}
```

**ObsidianFetchAdapter:**
- Wraps Obsidian's `requestUrl` function
- Converts Request → RequestUrlParam
- Converts RequestUrlResponse → Response
- Maintains backward compatibility

**NodeFetchAdapter:**
- Thin wrapper around Node.js native `fetch`
- Adds authentication header injection
- Normalizes error handling
- Simple pass-through for most cases

### 3. CLI Package Structure

```
src/cli/
  index.ts              # CLI entry point
  commands/
    push.ts             # Push command
    pull.ts             # Pull command
  lib/
    auth.ts             # GitHub auth resolution
    plugin.ts           # Plugin discovery and packaging
    logger.ts           # Stderr logging
    digest.ts           # Digest utilities
  adapters/
    node-fetch.ts       # NodeFetchAdapter
```

**Dependencies:**
- Minimal: TypeScript + native Node.js APIs only
- Argument parser: Node.js built-in `parseargs` or minimal library

## Manifest Structure

Following ORAS conventions with filename annotations:

```json
{
  "schemaVersion": 2,
  "mediaType": "application/vnd.oci.image.manifest.v1+json",
  "artifactType": "application/vnd.obsidian.plugin.v1+json",
  "config": {
    "mediaType": "application/vnd.oci.image.config.v1+json",
    "digest": "sha256:...",
    "size": 1064
  },
  "layers": [
    {
      "mediaType": "application/javascript",
      "digest": "sha256:...",
      "size": 208695,
      "annotations": {
        "org.opencontainers.image.title": "main.js"
      }
    },
    {
      "mediaType": "text/css",
      "digest": "sha256:...",
      "size": 3810,
      "annotations": {
        "org.opencontainers.image.title": "styles.css"
      }
    }
  ],
  "annotations": {
    "org.opencontainers.image.created": "2026-02-04T20:49:20Z"
  }
}
```

**Layer Structure:**
- Each file is a separate layer
- Config blob is minimal empty JSON `{}`
- Media types: `application/javascript`, `text/css`, `application/json`
- Filenames stored in `org.opencontainers.image.title` annotation

## CLI Commands

### Push Command

```bash
obsidian-plugin push <directory> <repository>
```

**Arguments:**
- `<directory>`: Path to plugin build output (e.g., `./dist`)
- `<repository>`: GHCR repository without tag (e.g., `ghcr.io/user/plugin-name`)

**Options:**
- `--token <pat>`: GitHub PAT (or use GITHUB_TOKEN env)
- `--json`: Output JSON result to stdout
- `--help`: Show help

**Behavior:**
- Auto-tags from manifest.json version field
- Discovers manifest.json (required), main.js (required), styles.css (optional)
- Logs progress to stderr
- Outputs JSON result to stdout if `--json` flag

**Workflow:**
1. Discover plugin files from directory
2. Resolve authentication (flag → GITHUB_TOKEN → GH_TOKEN → error)
3. Parse repository and add version tag from manifest
4. Create and push config blob (empty `{}`)
5. Calculate digest for each file
6. Push each file as blob with progress logging
7. Build manifest with annotations
8. Push manifest
9. Output result

### Pull Command

```bash
obsidian-plugin pull <repository> --output <directory>
```

**Arguments:**
- `<repository>`: Full reference with tag or digest (e.g., `ghcr.io/user/plugin:1.0.0`)

**Options:**
- `--output <dir>`: Required. Where to extract files
- `--token <pat>`: GitHub PAT (or use GITHUB_TOKEN env)
- `--json`: Output JSON result to stdout
- `--help`: Show help

**Workflow:**
1. Parse repository reference (must include tag/digest)
2. Resolve authentication
3. Validate output directory flag
4. Fetch manifest
5. Create output directory if needed
6. For each layer:
   - Download blob
   - Extract filename from `org.opencontainers.image.title` annotation
   - Write to output directory
7. Output result

## Authentication

**Resolution Order:**
1. `--token` CLI flag (highest priority)
2. `GITHUB_TOKEN` environment variable (CI/CD)
3. `GH_TOKEN` environment variable (gh CLI compatibility)
4. Error if no token found

**Required Scopes:**
- `read:packages` for pull
- `write:packages` for push

## File Discovery

**Push - Directory Scanning:**
- `manifest.json` - required, must contain valid JSON with `version` field
- `main.js` - required
- `styles.css` - optional

**Pull - Annotation Reading:**
- Extract filename from `org.opencontainers.image.title` annotation on each layer
- Error if annotation missing

## Validation

**Digest Verification:**
- Calculate SHA-256 locally before upload
- Compare with `Docker-Content-Digest` response header after upload
- Verify digests during download (existing behavior in `downloadBlob`)
- Throw `BadDigestError` on mismatch

**Manifest Validation:**
- Validate manifest.json is valid JSON
- Ensure `version` field exists
- Check required files exist before upload
- Verify layer annotations exist during pull

## Error Handling

### Push Errors

**File Validation:**
- Missing manifest.json → `Error: manifest.json not found in <directory>`
- Missing main.js → `Error: main.js not found in <directory>`
- Invalid manifest.json → `Error: Could not parse manifest.json: <details>`
- Missing version → `Error: manifest.json missing required "version" field`

**Authentication:**
- No token → `Error: GitHub token required. Use --token or set GITHUB_TOKEN`
- Invalid token → `Error: Registry auth failed: <message>`
- Insufficient permissions → `Error: Token lacks write:packages scope`

**Upload:**
- Network failure → Retry with exponential backoff (3 attempts)
- Digest mismatch → `Error: Digest verification failed for <file>`
- Repository not found → `Error: Repository not found or insufficient permissions`

### Pull Errors

**Reference Validation:**
- No tag/digest → `Error: Repository reference must include tag or digest`
- Invalid format → `Error: Invalid repository reference: <ref>`

**Download:**
- Manifest not found → `Error: Manifest not found: <ref>`
- Missing annotations → `Error: Layer <digest> missing required filename annotation`
- Digest mismatch → Handled by existing `downloadBlob()`
- Output not writable → `Error: Cannot write to <dir>: <details>`

## Output Format

**Logging (stderr):**
- Progress messages for each step
- File sizes and names
- Success/error indicators

**JSON Output (stdout when --json):**

Push:
```json
{
  "digest": "sha256:df0b6931cf48a5f73323f930b7099694bece2f781d66073e7e0ca48ea99775dd",
  "tag": "1.2.3",
  "size": 756,
  "repository": "ghcr.io/user/plugin:1.2.3"
}
```

Pull:
```json
{
  "files": ["manifest.json", "main.js", "styles.css"],
  "output": "./plugin",
  "digest": "sha256:..."
}
```

## Implementation Phases

1. **Refactor OciRegistryClient** - Add fetch adapter pattern and push methods
2. **Create adapters** - Implement ObsidianFetchAdapter and NodeFetchAdapter
3. **CLI foundation** - Argument parsing, auth resolution, logging
4. **Push command** - File discovery, blob upload, manifest creation
5. **Pull command** - Manifest fetch, blob download, file extraction
6. **Testing** - Integration tests with GHCR
7. **Documentation** - CLI usage guide and examples

## Type Updates

Add to `ManifestOCI`:
```typescript
export interface ManifestOCI {
  schemaVersion: 2;
  mediaType?: "application/vnd.oci.image.manifest.v1+json";
  artifactType?: string; // NEW: e.g., "application/vnd.obsidian.plugin.v1+json"
  config: ManifestOCIDescriptor;
  layers: Array<ManifestOCIDescriptor>;
  annotations?: Record<string, string>;
}
```

## ORAS Compatibility

The design follows ORAS conventions:
- Minimal config blob (empty JSON)
- Filenames in layer annotations
- Custom `artifactType` for Obsidian plugins
- Standard OCI media types where applicable
- Compatible with `oras pull` and `oras push`

## Non-Goals

- Multi-platform manifest support (not needed for plugins)
- Streaming uploads (files are small enough for single PUT)
- Advanced CLI features (colors, spinners) - keeping minimal
- Support for other registries (focused on GHCR)
