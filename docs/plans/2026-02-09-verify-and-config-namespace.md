# Verify Command and Config Namespace Design

**Date:** 2026-02-09
**Status:** Approved

## Overview

Add two new features to the Shard CLI:

1. `shard verify` - Validate locally installed plugin files against OCI registry source
2. `shard config set namespace` - Configure default OCI namespace with normalization

## 1. Verify Command

### Purpose

Ensure integrity of locally installed plugins by verifying that local files match their OCI registry source. Detects tampering, corruption, or version mismatches.

### Command Signature

```bash
shard verify <plugin-directory> --namespace <namespace>
```

Example:

```bash
shard verify .obsidian/plugins/obsidian-git/ --namespace ghcr.io/shard-for-obsidian/shard/community-plugins
```

### Workflow

1. **Parse local manifest** - Read and parse `manifest.json` from plugin directory to extract `id` and `version`
2. **Construct OCI reference** - Build full OCI reference as `{namespace}/{id}:{version}`
3. **Fetch OCI manifest** - Use `OciRegistryClient` to fetch manifest from registry
4. **Compute local hashes** - Calculate SHA-256 digests using SubtleCrypto for:
   - `manifest.json` (required)
   - `main.js` (required)
   - `styles.css` (optional)
5. **Match against OCI layers** - Compare computed hashes against blob digests in OCI manifest layer descriptors
6. **Report results** - Exit 0 if all hashes match, exit 1 with detailed error showing which files failed

### Verification Rules (Strict Matching)

- All files present locally MUST exist in OCI manifest with matching hashes
- All files in OCI manifest MUST exist locally with matching hashes
- `manifest.json` and `main.js` are always required
- `styles.css` is optional but must match if present in either location

### Error Cases

- Plugin directory doesn't exist or is not readable
- `manifest.json` missing or invalid JSON
- Required files missing locally or in OCI manifest
- Hash mismatches for any file
- OCI manifest not found in registry
- Network errors fetching OCI manifest

### Output

Success:

```
✓ Verified obsidian-git v1.2.3
  ✓ manifest.json
  ✓ main.js
  ✓ styles.css
```

Failure:

```
✗ Verification failed for obsidian-git v1.2.3
  ✓ manifest.json
  ✗ main.js (hash mismatch)
  ✓ styles.css
```

## 2. Config Namespace Management

### Purpose

Allow users to set a default OCI namespace, making the `--namespace` flag optional across commands.

### Command Signature

```bash
shard config set namespace <value>
shard config get namespace
```

Example:

```bash
shard config set namespace ghcr.io/shard-for-obsidian/shard/community-plugins
```

### Default Value

`ghcr.io/shard-for-obsidian/shard/community-plugins`

### Normalization Rules

When setting namespace value:

1. **Trim whitespace** - Remove leading/trailing spaces
2. **Remove trailing slashes** - `ghcr.io/owner/repo/` → `ghcr.io/owner/repo`
3. **Validate format** - Ensure it contains at least one `/` and matches OCI registry path patterns

### Integration with Commands

Commands that accept `--namespace` flag will be updated to make it optional:

- `shard convert` (existing) - Make `--namespace` optional
- `shard verify` (new) - Make `--namespace` optional

Resolution order:

1. Command-line flag value (if provided)
2. Config file value (if set)
3. Default value

### Namespace Usage

When constructing full repository paths:

```typescript
const repository = `${namespace}/${pluginId}`;
// e.g., "ghcr.io/shard-for-obsidian/shard/community-plugins/obsidian-git"
```

Insert `/` between normalized namespace (no trailing slash) and plugin ID.

## 3. Implementation Details

### Files to Create

- `packages/cli/src/commands/verify.ts` - Verify command implementation
- `packages/cli/src/lib/hash.ts` - SHA-256 hashing utility using SubtleCrypto
- `packages/cli/src/lib/namespace.ts` - Namespace normalization and validation

### Files to Modify

- `packages/cli/src/index.ts` - Register verify command in route map
- `packages/cli/src/commands/convert.ts` - Make `--namespace` optional with config fallback
- `packages/cli/src/commands/config/set.ts` - Add normalization for namespace key
- `packages/cli/src/infrastructure/config.ts` - Add `namespace` to Config interface

### Hash Computation

Use SubtleCrypto API with SHA-256:

```typescript
async function computeFileHash(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  const hashBuffer = await crypto.subtle.digest("SHA-256", content);
  const hashHex = Buffer.from(hashBuffer).toString("hex");
  return `sha256:${hashHex}`;
}
```

### OCI Layer Matching

OCI manifest contains layers in order: manifest.json, main.js, styles.css (if present).

Match files to layers by:

1. Using layer annotations (filename metadata) if available
2. Falling back to positional matching based on known order

### Namespace Resolution Pattern

```typescript
const DEFAULT_NAMESPACE = "ghcr.io/shard-for-obsidian/shard/community-plugins";

async function resolveNamespace(
  flags: Flags,
  config: ConfigService,
): Promise<string> {
  return (
    flags.namespace ??
    ((await config.get("namespace")) as string) ??
    DEFAULT_NAMESPACE
  );
}
```

### Namespace Normalization

```typescript
function normalizeNamespace(value: string): string {
  const trimmed = value.trim();
  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");

  // Validate format
  if (!withoutTrailingSlash.includes("/")) {
    throw new Error(
      'Namespace must contain at least one "/" (e.g., ghcr.io/owner/repo)',
    );
  }

  if (withoutTrailingSlash.includes("//")) {
    throw new Error("Namespace cannot contain consecutive slashes");
  }

  return withoutTrailingSlash;
}
```

### Testing Strategy

- Unit tests for hash computation utility
- Unit tests for namespace normalization/validation
- Integration test for verify command with mocked OCI registry
- Test convert command with optional namespace flag
- Test config namespace setting and retrieval

## 4. Error Handling

### Verify Command

- Exit code 0: Verification successful
- Exit code 1: Verification failed, hash mismatches, or errors

Error messages should be specific and actionable:

- "manifest.json not found in directory"
- "main.js hash mismatch (expected: sha256:abc..., got: sha256:def...)"
- "styles.css exists locally but not in OCI manifest"
- "Failed to fetch OCI manifest: registry returned 404"

### Config Namespace

- Invalid format: Show clear validation error with example
- Network/filesystem errors: Standard error handling with exit code 1

## 5. Design Decisions

1. **Strict matching** - Verify command requires perfect integrity (all files match)
2. **No downloads** - Compute hashes locally, compare to manifest digests (efficient)
3. **SubtleCrypto** - Use Web Crypto API for cross-platform compatibility
4. **Default namespace** - Provide sensible default to reduce friction
5. **Optional flags** - Make namespace optional when config value exists
6. **Clear errors** - Specify which file(s) failed verification

## 6. Future Enhancements

- Auto-repair: `shard verify --fix` to re-download mismatched files
- Batch verification: verify all plugins in vault
- Verification on install: automatically verify after plugin installation
- Signature verification: verify plugin signatures when available
