# Verify Command and Config Namespace - Improvement Recommendations

**Date:** 2026-02-09
**Based on:** Code review of verify command and config namespace implementation
**Status:** Future enhancements

## Overview

This document captures recommendations for future improvements to the verify command and config namespace features. The current implementation is **production-ready** and **approved** (9.5/10 quality score). These recommendations are for incremental enhancements.

## Priority: Medium

### 1. Add Missing Test Cases

**Area:** Test Coverage
**Files:** `packages/cli/src/lib/__tests__/verify.test.ts`

**Current Gap:** Missing test cases for styles.css edge cases and error scenarios.

**Recommended Tests:**

```typescript
describe("verifyPlugin - styles.css scenarios", () => {
  it("should verify plugin with styles.css present", async () => {
    // Create all 3 files: manifest.json, main.js, styles.css
    // Mock OCI manifest with all 3 layers
    // Expect all files verified successfully
  });

  it("should fail if styles.css exists locally but not in OCI", async () => {
    // Create manifest.json, main.js, styles.css locally
    // Mock OCI manifest with only manifest.json and main.js layers
    // Expect verification to fail with error: "File exists locally but not in OCI manifest"
  });

  it("should fail if styles.css exists in OCI but not locally", async () => {
    // Create only manifest.json and main.js locally
    // Mock OCI manifest with styles.css layer included
    // Expect verification to fail with error: "File exists in OCI manifest but not locally"
  });
});

describe("verifyPlugin - error handling", () => {
  it("should handle OCI registry network errors gracefully", async () => {
    // Mock adapter.fetch to reject with network error
    // Expect clear error message about registry connectivity
  });

  it("should handle OCI manifest without layers field", async () => {
    // Mock OCI manifest response without 'layers' property
    // Expect error: "OCI manifest does not contain layers"
  });

  it("should handle corrupted local manifest.json", async () => {
    // Write invalid JSON to manifest.json
    // Expect clear parsing error message
  });
});
```

**Impact:** Increases test coverage from ~85% to ~95% for verify logic.

---

### 2. Add End-to-End Integration Test

**Area:** Testing
**New File:** `packages/cli/src/__tests__/verify-e2e.test.ts`

**Purpose:** Test verify command against actual OCI registry with real plugin.

**Implementation:**

```typescript
describe("verify command E2E", () => {
  it("should verify a real plugin from GHCR", async () => {
    // Use a known stable plugin from community registry
    // Pull plugin to temporary directory
    // Run verify command
    // Expect successful verification
    // This test requires GITHUB_TOKEN in CI environment
  });
});
```

**Benefits:**

- Catches integration issues not visible in unit tests
- Validates against real OCI registry behavior
- Tests authentication flow end-to-end

---

## Priority: Low

### 3. Path Traversal Validation

**Area:** Security
**File:** `packages/cli/src/lib/verify.ts`

**Current:** CLI command resolves paths to absolute, but core logic doesn't validate.

**Recommendation:**

```typescript
export async function verifyPlugin(
  options: VerifyPluginOptions,
): Promise<VerifyPluginResult> {
  const { pluginDirectory, namespace, adapter, token } = options;

  // Add explicit validation
  const resolvedDir = path.resolve(pluginDirectory);
  if (!path.isAbsolute(resolvedDir)) {
    throw new Error("Plugin directory must be an absolute path");
  }

  // Continue with existing logic...
}
```

**Impact:** Defense-in-depth security improvement.

---

### 4. OCI Namespace Regex Validation

**Area:** Validation
**File:** `packages/cli/src/lib/namespace.ts`

**Current:** Basic validation (slash presence, no consecutive slashes).

**Enhancement:**

```typescript
export function normalizeNamespace(value: string): string {
  const trimmed = value.trim();
  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");

  // Validate: must contain at least one '/'
  if (!withoutTrailingSlash.includes("/")) {
    throw new Error(
      'Namespace must contain at least one "/" (e.g., ghcr.io/owner/repo)',
    );
  }

  // Validate: no consecutive slashes
  if (withoutTrailingSlash.includes("//")) {
    throw new Error("Namespace cannot contain consecutive slashes");
  }

  // NEW: Validate OCI registry format
  const OCI_NAMESPACE_PATTERN =
    /^[a-z0-9]+([\._-][a-z0-9]+)*(\/[a-z0-9]+([\._-][a-z0-9]+)*)+$/i;
  if (!OCI_NAMESPACE_PATTERN.test(withoutTrailingSlash)) {
    throw new Error(
      "Invalid namespace format. Must match OCI registry naming conventions.",
    );
  }

  return withoutTrailingSlash;
}
```

**Note:** Current validation is sufficient since `OciRegistryClient` validates downstream. This is an optional hardening improvement.

---

### 5. Streaming Hash Computation

**Area:** Performance
**File:** `packages/cli/src/lib/hash.ts`

**Current:** Loads entire file into memory for hashing.

**Context:** Obsidian plugins are typically small (<10MB), so current approach is fine.

**Future Enhancement (for large file support):**

```typescript
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";

/**
 * Compute SHA-256 hash using streaming (for large files)
 *
 * @param filePath - Absolute path to the file
 * @returns Hash in format "sha256:{hex}"
 */
export async function computeFileHashStreaming(
  filePath: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(`sha256:${hash.digest("hex")}`));
    stream.on("error", reject);
  });
}
```

**When to use:** If plugin size limits increase or verify command is extended to other file types.

---

### 6. Add JSDoc to CLI Command Handlers

**Area:** Documentation
**Files:** `packages/cli/src/commands/*.ts`

**Current:** Core utilities have JSDoc, but CLI handlers don't.

**Recommendation:**

````typescript
/**
 * Verify a locally installed plugin against its OCI registry source
 *
 * @param flags - Command flags (namespace, token, json)
 * @param pluginDirectory - Path to plugin directory containing manifest.json
 * @returns Exits with code 0 on success, 1 on failure
 *
 * @example
 * ```bash
 * shard verify ~/.obsidian/plugins/obsidian-git
 * shard verify ./plugin-dir --namespace ghcr.io/custom/
 * ```
 */
async function verifyCommandHandler(
  this: AppContext,
  flags: VerifyFlags,
  pluginDirectory: string,
): Promise<void> {
  // ...
}
````

**Impact:** Improves code documentation consistency.

---

### 7. Concurrent File Verification

**Area:** Performance
**File:** `packages/cli/src/lib/verify.ts`

**Current:** Files verified sequentially (~30ms total for 3 files).

**Enhancement:**

```typescript
async function verifyFile(
  filePath: string,
  expectedHash: string | undefined,
): Promise<FileVerificationResult> {
  const filename = path.basename(filePath);

  try {
    const exists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);
    if (!exists) {
      return {
        filename,
        verified: false,
        error: "File does not exist",
      };
    }

    const localHash = await computeFileHash(filePath);
    const verified = !!expectedHash && localHash === expectedHash;

    return {
      filename,
      verified,
      localHash,
      expectedHash,
    };
  } catch (error) {
    return {
      filename,
      verified: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// In verifyPlugin function:
const [manifestResult, mainJsResult, stylesCssResult] = await Promise.all([
  verifyFile(manifestPath, expectedHashes.get("manifest.json")),
  verifyFile(mainJsPath, expectedHashes.get("main.js")),
  stylesCssExists
    ? verifyFile(stylesCssPath, expectedHashes.get("styles.css"))
    : null,
]);
```

**Impact:** Reduces verification time from ~30ms to ~10ms (minor improvement, low priority).

---

## Short-term Improvements (Next Sprint)

1. **Add missing test cases** for styles.css scenarios (Priority: MEDIUM)
2. **Add E2E integration test** with real OCI registry (Priority: MEDIUM)
3. **Document verification exit codes** in CLI help and README (Priority: LOW)

---

## Long-term Enhancements (Future Releases)

### 1. Auto-Repair Flag

**Feature:** `shard verify --fix`

**Behavior:**

- Verify plugin files against OCI registry
- If mismatches found, automatically re-download from registry
- Preserve user data/settings

**Design considerations:**

- Only repair plugin files (manifest.json, main.js, styles.css)
- Don't touch data.json or other user files
- Prompt for confirmation before repair
- Show diff of what will be replaced

---

### 2. Batch Verification

**Feature:** `shard verify --all`

**Behavior:**

- Verify all plugins in `.obsidian/plugins/` directory
- Show summary table with verification status for each plugin
- Exit code indicates number of failed verifications

**Example output:**

```
Verifying 15 plugins...
✓ obsidian-git v2.36.1
✓ calendar v1.5.10
✗ dataview v0.5.64 (main.js hash mismatch)
✓ templater v1.18.0
...

Summary: 14/15 passed, 1 failed
```

---

### 3. Signature Verification

**Feature:** Verify cryptographic signatures when available

**Depends on:** OCI artifact signature standard adoption

**Behavior:**

- Check for signature annotations in OCI manifest
- Verify signature against trusted keys
- Report signature status alongside hash verification

---

### 4. Verification on Install

**Feature:** Automatic verification after plugin installation

**Behavior:**

- When `shard install <plugin>` completes
- Automatically run verification
- Warn if verification fails

**Implementation:**

```typescript
// In install command, after download:
const verifyResult = await verifyPlugin({
  pluginDirectory,
  namespace,
  adapter,
  token,
});

if (!verifyResult.verified) {
  logger.warn("Plugin installed but verification failed");
  // Show verification details
}
```

---

## Documentation Improvements

### Exit Code Documentation

**File:** `packages/cli/README.md` or CLI help text

**Add section:**

```markdown
### Exit Codes

The `verify` command uses the following exit codes:

- `0` - Verification successful (all files match)
- `1` - Verification failed (hash mismatch, missing files, or errors)

Exit codes can be used in scripts:

\`\`\`bash
if shard verify ~/.obsidian/plugins/my-plugin; then
echo "Plugin verified successfully"
else
echo "Plugin verification failed"
exit 1
fi
\`\`\`
```

---

### Troubleshooting Guide

**Add to documentation:**

```markdown
## Troubleshooting

### "manifest.json not found"

- Ensure the path points to the plugin directory (not the `.obsidian/plugins` folder)
- Correct: `shard verify ~/.obsidian/plugins/obsidian-git/`
- Incorrect: `shard verify ~/.obsidian/plugins/`

### "Hash mismatch"

- Plugin files have been modified locally
- Use `--fix` flag to restore from registry (future feature)
- Or reinstall the plugin

### "Failed to fetch OCI manifest"

- Check internet connectivity
- Verify GitHub token has correct permissions
- Check if plugin exists in registry namespace
```

---

## Notes

- **No critical issues** were found in code review
- Current implementation is **production-ready**
- All recommendations are **optional enhancements**
- Prioritize based on user feedback and usage patterns

## References

- Design document: `docs/plans/2026-02-09-verify-and-config-namespace.md`
- Implementation plan: `docs/plans/2026-02-09-verify-and-config-namespace-implementation.md`
- Code review: Completed 2026-02-09 (Score: 9.5/10)
