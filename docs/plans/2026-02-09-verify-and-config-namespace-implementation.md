# Verify Command and Config Namespace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `shard verify` command to validate plugin integrity and config namespace management with normalization.

**Architecture:** Build TDD with hash utilities, namespace validation, verify command, and config integration. Reuse existing `OciRegistryClient` and `ConfigService` infrastructure.

**Tech Stack:** TypeScript, Vitest, SubtleCrypto, @stricli/core, @shard-for-obsidian/lib

---

## Task 1: Namespace Utility with Tests

**Files:**

- Create: `packages/cli/src/lib/__tests__/namespace.test.ts`
- Create: `packages/cli/src/lib/namespace.ts`

**Step 1: Write failing tests for namespace normalization**

```typescript
import { describe, it, expect } from "vitest";
import { normalizeNamespace } from "../namespace.js";

describe("normalizeNamespace", () => {
  it("should trim whitespace", () => {
    expect(normalizeNamespace("  ghcr.io/owner/repo  ")).toBe(
      "ghcr.io/owner/repo",
    );
  });

  it("should remove trailing slash", () => {
    expect(normalizeNamespace("ghcr.io/owner/repo/")).toBe(
      "ghcr.io/owner/repo",
    );
  });

  it("should remove multiple trailing slashes", () => {
    expect(normalizeNamespace("ghcr.io/owner/repo///")).toBe(
      "ghcr.io/owner/repo",
    );
  });

  it("should handle both whitespace and trailing slashes", () => {
    expect(normalizeNamespace("  ghcr.io/owner/repo/  ")).toBe(
      "ghcr.io/owner/repo",
    );
  });

  it("should throw error if no slash present", () => {
    expect(() => normalizeNamespace("ghcr.io")).toThrow(
      'Namespace must contain at least one "/" (e.g., ghcr.io/owner/repo)',
    );
  });

  it("should throw error for consecutive slashes", () => {
    expect(() => normalizeNamespace("ghcr.io//owner/repo")).toThrow(
      "Namespace cannot contain consecutive slashes",
    );
  });

  it("should accept valid namespace unchanged", () => {
    expect(
      normalizeNamespace("ghcr.io/shard-for-obsidian/shard/community-plugins"),
    ).toBe("ghcr.io/shard-for-obsidian/shard/community-plugins");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test namespace.test.ts`
Expected: FAIL with "Cannot find module '../namespace.js'"

**Step 3: Implement namespace normalization**

Create `packages/cli/src/lib/namespace.ts`:

```typescript
/**
 * Default OCI namespace for community plugins
 */
export const DEFAULT_NAMESPACE =
  "ghcr.io/shard-for-obsidian/shard/community-plugins";

/**
 * Normalize and validate an OCI namespace string
 *
 * @param value - Raw namespace value to normalize
 * @returns Normalized namespace (trimmed, no trailing slash)
 * @throws Error if namespace format is invalid
 */
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

  return withoutTrailingSlash;
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test namespace.test.ts`
Expected: PASS (all 7 tests)

**Step 5: Commit**

```bash
git add packages/cli/src/lib/__tests__/namespace.test.ts packages/cli/src/lib/namespace.ts
git commit -m "feat: add namespace normalization and validation utility"
```

---

## Task 2: Hash Computation Utility with Tests

**Files:**

- Create: `packages/cli/src/lib/__tests__/hash.test.ts`
- Create: `packages/cli/src/lib/hash.ts`

**Step 1: Write failing tests for hash computation**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { computeFileHash } from "../hash.js";

describe("computeFileHash", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "shard-hash-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should compute SHA-256 hash of file content", async () => {
    const filePath = path.join(tmpDir, "test.txt");
    await fs.writeFile(filePath, "hello world", "utf-8");

    const hash = await computeFileHash(filePath);

    // Known SHA-256 hash of "hello world"
    expect(hash).toBe(
      "sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );
  });

  it("should compute different hashes for different content", async () => {
    const file1 = path.join(tmpDir, "file1.txt");
    const file2 = path.join(tmpDir, "file2.txt");
    await fs.writeFile(file1, "content1", "utf-8");
    await fs.writeFile(file2, "content2", "utf-8");

    const hash1 = await computeFileHash(file1);
    const hash2 = await computeFileHash(file2);

    expect(hash1).not.toBe(hash2);
    expect(hash1).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(hash2).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("should handle empty files", async () => {
    const filePath = path.join(tmpDir, "empty.txt");
    await fs.writeFile(filePath, "", "utf-8");

    const hash = await computeFileHash(filePath);

    // Known SHA-256 hash of empty string
    expect(hash).toBe(
      "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("should handle binary files", async () => {
    const filePath = path.join(tmpDir, "binary.dat");
    const buffer = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
    await fs.writeFile(filePath, buffer);

    const hash = await computeFileHash(filePath);

    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("should throw error if file does not exist", async () => {
    const filePath = path.join(tmpDir, "nonexistent.txt");

    await expect(computeFileHash(filePath)).rejects.toThrow();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test hash.test.ts`
Expected: FAIL with "Cannot find module '../hash.js'"

**Step 3: Implement hash computation**

Create `packages/cli/src/lib/hash.ts`:

```typescript
import * as fs from "node:fs/promises";

/**
 * Compute SHA-256 hash of a file using SubtleCrypto
 *
 * @param filePath - Absolute path to the file
 * @returns Hash in format "sha256:{hex}" matching OCI digest format
 * @throws Error if file cannot be read
 */
export async function computeFileHash(filePath: string): Promise<string> {
  // Read file content
  const content = await fs.readFile(filePath);

  // Compute SHA-256 hash using SubtleCrypto
  const hashBuffer = await crypto.subtle.digest("SHA-256", content);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `sha256:${hashHex}`;
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test hash.test.ts`
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add packages/cli/src/lib/__tests__/hash.test.ts packages/cli/src/lib/hash.ts
git commit -m "feat: add SHA-256 file hash computation using SubtleCrypto"
```

---

## Task 3: Update Config Service for Namespace

**Files:**

- Modify: `packages/cli/src/infrastructure/config.ts:6-12`

**Step 1: Write failing test for namespace in config**

Add to `packages/cli/src/infrastructure/__tests__/config.test.ts` at end, before closing `});`:

```typescript
it("should get and set namespace", async () => {
  await config.set(
    "namespace",
    "ghcr.io/shard-for-obsidian/shard/community-plugins",
  );
  const value = await config.get("namespace");
  expect(value).toBe("ghcr.io/shard-for-obsidian/shard/community-plugins");
});
```

**Step 2: Run test to verify it passes (already works)**

Run: `pnpm test config.test.ts`
Expected: PASS (config service already supports arbitrary keys)

**Step 3: Update Config interface to document namespace**

Modify `packages/cli/src/infrastructure/config.ts`:

```typescript
/**
 * Configuration structure stored in ~/.shard/config.json
 */
export interface Config {
  token?: string;
  namespace?: string;
  defaults?: {
    output?: string;
  };
  [key: string]: unknown;
}
```

**Step 4: Run tests to verify they still pass**

Run: `pnpm test config.test.ts`
Expected: PASS (all tests including new namespace test)

**Step 5: Commit**

```bash
git add packages/cli/src/infrastructure/__tests__/config.test.ts packages/cli/src/infrastructure/config.ts
git commit -m "feat: add namespace to config interface"
```

---

## Task 4: Update Config Set Command for Namespace Normalization

**Files:**

- Modify: `packages/cli/src/commands/config/set.ts:1-64`

**Step 1: Add normalization to set command**

Modify `packages/cli/src/commands/config/set.ts`:

```typescript
import { buildCommand } from "@stricli/core";
import type { AppContext } from "../../infrastructure/context.js";
import { normalizeNamespace } from "../../lib/namespace.js";

/**
 * Flags for the set command
 */
export interface SetFlags {
  json?: boolean;
  verbose?: boolean;
}

/**
 * Set a configuration value by key
 */
async function setCommandHandler(
  this: AppContext,
  flags: SetFlags,
  key: string,
  value: string,
): Promise<void> {
  const { logger, config } = this;

  try {
    // Try to parse value as JSON for complex types, otherwise use as string
    let parsedValue: unknown = value;

    // Attempt to parse as JSON for booleans, numbers, objects, arrays
    if (
      value === "true" ||
      value === "false" ||
      value === "null" ||
      /^-?\d+(\.\d+)?$/.test(value) ||
      value.startsWith("{") ||
      value.startsWith("[")
    ) {
      try {
        parsedValue = JSON.parse(value);
      } catch {
        // If JSON parsing fails, keep as string
        parsedValue = value;
      }
    }

    // Special handling for namespace: normalize and validate
    if (key === "namespace" && typeof parsedValue === "string") {
      parsedValue = normalizeNamespace(parsedValue);
    }

    await config.set(key, parsedValue);

    // JSON output mode
    if (flags.json) {
      const output = JSON.stringify({ key, value: parsedValue }, null, 2);
      this.process.stdout.write(output + "\n");
      return;
    }

    // Normal output mode
    logger.success(`Set ${key} = ${JSON.stringify(parsedValue)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to set configuration: ${message}`);
    this.process.exit(1);
  }
}

/**
 * Build the set command
 */
export const set = buildCommand({
  func: setCommandHandler,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief:
            "Configuration key (supports dot notation, e.g., defaults.output)",
          parse: String,
          placeholder: "key",
        },
        {
          brief: "Value to set (auto-parsed for booleans, numbers, JSON)",
          parse: String,
          placeholder: "value",
        },
      ],
    },
    flags: {
      json: {
        kind: "boolean",
        brief: "Output JSON instead of human-readable format",
        optional: true,
      },
      verbose: {
        kind: "boolean",
        brief: "Show detailed output",
        optional: true,
      },
    },
    aliases: {},
  },
  docs: {
    brief: "Set a configuration value",
    customUsage: [
      "shard config set namespace ghcr.io/owner/repo",
      "shard config set token ghp_xxxxx",
    ],
  },
});
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm ts-check`
Expected: No errors

**Step 3: Manual test (optional)**

Run: `pnpm start config set namespace "  ghcr.io/test/repo/  "`
Expected: Success message with normalized value

**Step 4: Commit**

```bash
git add packages/cli/src/commands/config/set.ts
git commit -m "feat: add namespace normalization in config set command"
```

---

## Task 5: Verify Command Implementation (Part 1 - Core Logic)

**Files:**

- Create: `packages/cli/src/lib/__tests__/verify.test.ts`
- Create: `packages/cli/src/lib/verify.ts`

**Step 1: Write failing tests for verify logic**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { FetchAdapter, ManifestOCI } from "@shard-for-obsidian/lib";
import { verifyPlugin, type VerifyPluginOptions } from "../verify.js";

describe("verifyPlugin", () => {
  let tmpDir: string;
  let pluginDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "shard-verify-test-"));
    pluginDir = path.join(tmpDir, "test-plugin");
    await fs.mkdir(pluginDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should verify plugin with matching hashes (without styles.css)", async () => {
    // Create local plugin files
    const manifest = { id: "test-plugin", version: "1.0.0", name: "Test" };
    await fs.writeFile(
      path.join(pluginDir, "manifest.json"),
      JSON.stringify(manifest),
    );
    await fs.writeFile(path.join(pluginDir, "main.js"), "console.log('test')");

    // Mock OCI manifest with matching hashes
    const mockManifest: ManifestOCI = {
      schemaVersion: 2,
      config: {
        mediaType: "application/vnd.obsidianmd.plugin-manifest.v1+json",
        size: 100,
        digest: "sha256:config",
      },
      layers: [
        {
          mediaType: "application/json",
          size: 56,
          digest:
            "sha256:96e02e7b1cbaded7fa8daf6c42f4ebf9c5e60f1a9e1c90d82330eb9f5cd3ca62",
          annotations: { "org.opencontainers.image.title": "manifest.json" },
        },
        {
          mediaType: "application/javascript",
          size: 19,
          digest:
            "sha256:c7f7cf70b9f5b2f2b1c6f8c0e8e6e8f8e8f8e8e8e8e8e8e8e8e8e8e8e8e8e8e8",
          annotations: { "org.opencontainers.image.title": "main.js" },
        },
      ],
    };

    const mockAdapter: FetchAdapter = {
      fetch: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockManifest,
      }),
    };

    const result = await verifyPlugin({
      pluginDirectory: pluginDir,
      namespace: "ghcr.io/test",
      adapter: mockAdapter,
      token: "test-token",
    });

    expect(result.verified).toBe(true);
    expect(result.pluginId).toBe("test-plugin");
    expect(result.version).toBe("1.0.0");
    expect(result.files).toHaveLength(2);
    expect(result.files[0].filename).toBe("manifest.json");
    expect(result.files[0].verified).toBe(true);
    expect(result.files[1].filename).toBe("main.js");
    expect(result.files[1].verified).toBe(true);
  });

  it("should fail verification with hash mismatch", async () => {
    // Create local plugin files
    const manifest = { id: "test-plugin", version: "1.0.0", name: "Test" };
    await fs.writeFile(
      path.join(pluginDir, "manifest.json"),
      JSON.stringify(manifest),
    );
    await fs.writeFile(
      path.join(pluginDir, "main.js"),
      "console.log('different')",
    );

    // Mock OCI manifest with different hash for main.js
    const mockManifest: ManifestOCI = {
      schemaVersion: 2,
      config: {
        mediaType: "application/vnd.obsidianmd.plugin-manifest.v1+json",
        size: 100,
        digest: "sha256:config",
      },
      layers: [
        {
          mediaType: "application/json",
          size: 56,
          digest:
            "sha256:96e02e7b1cbaded7fa8daf6c42f4ebf9c5e60f1a9e1c90d82330eb9f5cd3ca62",
          annotations: { "org.opencontainers.image.title": "manifest.json" },
        },
        {
          mediaType: "application/javascript",
          size: 19,
          digest: "sha256:wronghash",
          annotations: { "org.opencontainers.image.title": "main.js" },
        },
      ],
    };

    const mockAdapter: FetchAdapter = {
      fetch: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockManifest,
      }),
    };

    const result = await verifyPlugin({
      pluginDirectory: pluginDir,
      namespace: "ghcr.io/test",
      adapter: mockAdapter,
      token: "test-token",
    });

    expect(result.verified).toBe(false);
    expect(result.files[1].verified).toBe(false);
    expect(result.files[1].expectedHash).toBe("sha256:wronghash");
  });

  it("should throw error if manifest.json is missing", async () => {
    const mockAdapter: FetchAdapter = {
      fetch: vi.fn(),
    };

    await expect(
      verifyPlugin({
        pluginDirectory: pluginDir,
        namespace: "ghcr.io/test",
        adapter: mockAdapter,
        token: "test-token",
      }),
    ).rejects.toThrow("manifest.json not found");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test verify.test.ts`
Expected: FAIL with "Cannot find module '../verify.js'"

**Step 3: Implement verify logic**

Create `packages/cli/src/lib/verify.ts`:

```typescript
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  OciRegistryClient,
  type FetchAdapter,
  type ManifestOCI,
  type ObsidianManifest,
} from "@shard-for-obsidian/lib";
import { computeFileHash } from "./hash.js";

export interface VerifyPluginOptions {
  pluginDirectory: string;
  namespace: string;
  adapter: FetchAdapter;
  token: string;
}

export interface FileVerificationResult {
  filename: string;
  verified: boolean;
  localHash?: string;
  expectedHash?: string;
  error?: string;
}

export interface VerifyPluginResult {
  verified: boolean;
  pluginId: string;
  version: string;
  repository: string;
  files: FileVerificationResult[];
}

/**
 * Verify a locally installed plugin against its OCI registry source
 */
export async function verifyPlugin(
  options: VerifyPluginOptions,
): Promise<VerifyPluginResult> {
  const { pluginDirectory, namespace, adapter, token } = options;

  // Step 1: Read and parse local manifest.json
  const manifestPath = path.join(pluginDirectory, "manifest.json");
  let manifest: ObsidianManifest;
  try {
    const manifestContent = await fs.readFile(manifestPath, "utf-8");
    manifest = JSON.parse(manifestContent);
  } catch (error) {
    throw new Error(
      `manifest.json not found in ${pluginDirectory}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const { id: pluginId, version } = manifest;
  const repository = `${namespace}/${pluginId}`;

  // Step 2: Fetch OCI manifest
  const client = new OciRegistryClient({
    name: repository,
    token,
    adapter,
    acceptOCIManifests: true,
  });

  const { manifest: ociManifest } = await client.getManifest({
    ref: version,
    acceptOCIManifests: true,
  });

  if (!("layers" in ociManifest)) {
    throw new Error("OCI manifest does not contain layers");
  }

  const manifest_oci = ociManifest as ManifestOCI;

  // Step 3: Verify each file
  const files: FileVerificationResult[] = [];
  let allVerified = true;

  // Map of filenames to expected hashes from OCI layers
  const expectedHashes = new Map<string, string>();
  for (const layer of manifest_oci.layers) {
    const filename = layer.annotations?.["org.opencontainers.image.title"];
    if (filename) {
      expectedHashes.set(filename, layer.digest);
    }
  }

  // Verify manifest.json
  try {
    const localHash = await computeFileHash(manifestPath);
    const expectedHash = expectedHashes.get("manifest.json");
    const verified = !!expectedHash && localHash === expectedHash;
    files.push({
      filename: "manifest.json",
      verified,
      localHash,
      expectedHash,
    });
    if (!verified) allVerified = false;
  } catch (error) {
    files.push({
      filename: "manifest.json",
      verified: false,
      error: error instanceof Error ? error.message : String(error),
    });
    allVerified = false;
  }

  // Verify main.js
  const mainJsPath = path.join(pluginDirectory, "main.js");
  try {
    const localHash = await computeFileHash(mainJsPath);
    const expectedHash = expectedHashes.get("main.js");
    const verified = !!expectedHash && localHash === expectedHash;
    files.push({
      filename: "main.js",
      verified,
      localHash,
      expectedHash,
    });
    if (!verified) allVerified = false;
  } catch (error) {
    files.push({
      filename: "main.js",
      verified: false,
      error: error instanceof Error ? error.message : String(error),
    });
    allVerified = false;
  }

  // Verify styles.css (optional)
  const stylesCssPath = path.join(pluginDirectory, "styles.css");
  const stylesCssExists = await fs
    .access(stylesCssPath)
    .then(() => true)
    .catch(() => false);
  const stylesCssInOci = expectedHashes.has("styles.css");

  if (stylesCssExists || stylesCssInOci) {
    if (!stylesCssExists) {
      files.push({
        filename: "styles.css",
        verified: false,
        error: "File exists in OCI manifest but not locally",
      });
      allVerified = false;
    } else if (!stylesCssInOci) {
      files.push({
        filename: "styles.css",
        verified: false,
        error: "File exists locally but not in OCI manifest",
      });
      allVerified = false;
    } else {
      try {
        const localHash = await computeFileHash(stylesCssPath);
        const expectedHash = expectedHashes.get("styles.css");
        const verified = !!expectedHash && localHash === expectedHash;
        files.push({
          filename: "styles.css",
          verified,
          localHash,
          expectedHash,
        });
        if (!verified) allVerified = false;
      } catch (error) {
        files.push({
          filename: "styles.css",
          verified: false,
          error: error instanceof Error ? error.message : String(error),
        });
        allVerified = false;
      }
    }
  }

  return {
    verified: allVerified,
    pluginId,
    version,
    repository,
    files,
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test verify.test.ts`
Expected: FAIL (hash computation will not match mock - need to compute actual hashes)

**Step 5: Fix test with actual computed hashes**

Update the test to compute the actual hash:

```typescript
// In the first test, replace the mock manifest with actual computed hashes
const manifestHash = await computeFileHash(
  path.join(pluginDir, "manifest.json"),
);
const mainJsHash = await computeFileHash(path.join(pluginDir, "main.js"));

const mockManifest: ManifestOCI = {
  schemaVersion: 2,
  config: {
    mediaType: "application/vnd.obsidianmd.plugin-manifest.v1+json",
    size: 100,
    digest: "sha256:config",
  },
  layers: [
    {
      mediaType: "application/json",
      size: 56,
      digest: manifestHash,
      annotations: { "org.opencontainers.image.title": "manifest.json" },
    },
    {
      mediaType: "application/javascript",
      size: 19,
      digest: mainJsHash,
      annotations: { "org.opencontainers.image.title": "main.js" },
    },
  ],
};
```

Import computeFileHash at top:

```typescript
import { computeFileHash } from "../hash.js";
```

**Step 6: Run tests again**

Run: `pnpm test verify.test.ts`
Expected: PASS (all 3 tests)

**Step 7: Commit**

```bash
git add packages/cli/src/lib/__tests__/verify.test.ts packages/cli/src/lib/verify.ts
git commit -m "feat: implement plugin verification logic"
```

---

## Task 6: Verify Command CLI Interface

**Files:**

- Create: `packages/cli/src/commands/verify.ts`

**Step 1: Implement verify command**

```typescript
import { buildCommand } from "@stricli/core";
import type { AppContext } from "../infrastructure/context.js";
import { verifyPlugin } from "../lib/verify.js";
import { resolveAuthToken } from "../lib/auth.js";
import { DEFAULT_NAMESPACE } from "../lib/namespace.js";

/**
 * Flags for the verify command
 */
export interface VerifyFlags {
  namespace?: string;
  token?: string;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Verify a locally installed plugin against OCI registry
 */
async function verifyCommandHandler(
  this: AppContext,
  flags: VerifyFlags,
  pluginDirectory: string,
): Promise<void> {
  const { logger, adapter, config } = this;

  try {
    // Step 1: Resolve authentication token
    let token: string;
    try {
      if (flags.token) {
        token = flags.token;
      } else {
        try {
          token = resolveAuthToken();
        } catch {
          const configToken = await config.get("token");
          if (typeof configToken === "string" && configToken) {
            token = configToken;
          } else {
            throw new Error("No token found");
          }
        }
      }
    } catch {
      logger.error(
        "GitHub token required. Use --token flag, set GITHUB_TOKEN environment variable, or configure with: shard config set token <token>",
      );
      this.process.exit(1);
    }

    // Step 2: Resolve namespace
    const namespace =
      flags.namespace ??
      ((await config.get("namespace")) as string) ??
      DEFAULT_NAMESPACE;

    // Step 3: Verify plugin
    logger.info(`Verifying plugin in ${pluginDirectory}...`);
    const result = await verifyPlugin({
      pluginDirectory,
      namespace,
      adapter,
      token,
    });

    // Step 4: Output results
    if (flags.json) {
      this.process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      this.process.exit(result.verified ? 0 : 1);
    }

    // Human-readable output
    if (result.verified) {
      logger.success(`✓ Verified ${result.pluginId} v${result.version}`);
      for (const file of result.files) {
        logger.info(`  ✓ ${file.filename}`);
      }
      this.process.exit(0);
    } else {
      logger.error(
        `✗ Verification failed for ${result.pluginId} v${result.version}`,
      );
      for (const file of result.files) {
        if (file.verified) {
          logger.info(`  ✓ ${file.filename}`);
        } else if (file.error) {
          logger.error(`  ✗ ${file.filename} (${file.error})`);
        } else {
          logger.error(
            `  ✗ ${file.filename} (expected: ${file.expectedHash}, got: ${file.localHash})`,
          );
        }
      }
      this.process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to verify plugin: ${message}`);
    this.process.exit(1);
  }
}

/**
 * Build the verify command
 */
export const verify = buildCommand({
  func: verifyCommandHandler,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Path to plugin directory",
          parse: String,
          placeholder: "plugin-directory",
        },
      ],
    },
    flags: {
      namespace: {
        kind: "parsed",
        parse: String,
        brief: "OCI namespace (defaults to config or community-plugins)",
        optional: true,
      },
      token: {
        kind: "parsed",
        parse: String,
        brief: "GitHub token for authentication",
        optional: true,
      },
      json: {
        kind: "boolean",
        brief: "Output JSON instead of human-readable format",
        optional: true,
      },
      verbose: {
        kind: "boolean",
        brief: "Show detailed progress information",
        optional: true,
      },
    },
    aliases: {
      n: "namespace",
      t: "token",
    },
  },
  docs: {
    brief: "Verify plugin files match OCI registry source",
    customUsage: [
      "shard verify .obsidian/plugins/obsidian-git/",
      "shard verify .obsidian/plugins/calendar/ --namespace ghcr.io/custom/",
    ],
  },
});
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm ts-check`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/cli/src/commands/verify.ts
git commit -m "feat: add verify command CLI interface"
```

---

## Task 7: Register Verify Command in CLI

**Files:**

- Modify: `packages/cli/src/index.ts:1-85`

**Step 1: Import and register verify command**

Modify `packages/cli/src/index.ts`:

```typescript
import { buildApplication, buildRouteMap, run } from "@stricli/core";
import * as os from "node:os";
import * as path from "node:path";
import { CliLogger } from "./infrastructure/logger.js";
import type { LogMode } from "./infrastructure/logger.js";
import { ConfigService } from "./infrastructure/config.js";
import { createContext } from "./infrastructure/context.js";
import type { AppContext } from "./infrastructure/context.js";
import { NodeFetchAdapter } from "./adapters/node-fetch-adapter.js";
import { list } from "./commands/list.js";
import { search } from "./commands/search.js";
import { info } from "./commands/info.js";
import { install } from "./commands/install.js";
import { publish } from "./commands/publish.js";
import { convert } from "./commands/convert.js";
import { verify } from "./commands/verify.js";
import { registryRouteMap } from "./commands/registry/index.js";
import { configRouteMap } from "./commands/config/index.js";
import { completionRouteMap } from "./commands/completion/index.js";

/**
 * Build the application context with shared services
 */
function buildAppContext(mode: LogMode): AppContext {
  // Set up paths
  const homeDir = os.homedir();
  const shardDir = path.join(homeDir, ".shard");
  const configPath = path.join(shardDir, "config.json");
  const logFile = path.join(shardDir, "shard.log");

  // Create shared services
  const logger = new CliLogger({ mode, logFile });
  const config = new ConfigService(configPath);
  const adapter = new NodeFetchAdapter();

  return createContext({ logger, config, adapter });
}

/**
 * Determine log mode from argv
 * We need to do this before stricli parses args so we can initialize logger
 */
function determineLogMode(args: readonly string[]): LogMode {
  if (args.includes("--json")) {
    return "json";
  } else if (args.includes("--verbose")) {
    return "verbose";
  }
  return "normal";
}

/**
 * Shard CLI Application - Root command with subcommands
 */
const routes = buildRouteMap({
  routes: {
    list,
    search,
    info,
    install,
    publish,
    convert,
    verify,
    registry: registryRouteMap,
    config: configRouteMap,
    completion: completionRouteMap,
  },
  docs: {
    brief: "Shard CLI - Plugin distribution for Obsidian",
  },
});

const app = buildApplication(routes, {
  name: "shard",
  versionInfo: {
    currentVersion: "0.3.0",
  },
});

// Determine log mode from command line args
const logMode = determineLogMode(process.argv.slice(2));

// Build context - buildAppContext already includes process
const context = buildAppContext(logMode);

// Run the application
await run(app, process.argv.slice(2), context);
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm ts-check`
Expected: No errors

**Step 3: Build and test manually**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat: register verify command in CLI"
```

---

## Task 8: Update Convert Command for Optional Namespace

**Files:**

- Modify: `packages/cli/src/commands/convert.ts:9-35`

**Step 1: Import namespace utilities**

Add import at top of `packages/cli/src/commands/convert.ts`:

```typescript
import { DEFAULT_NAMESPACE } from "../lib/namespace.js";
```

**Step 2: Make namespace flag optional and add resolution**

Modify the `convertCommandHandler` function in `packages/cli/src/commands/convert.ts`:

Replace lines 36-74 with:

```typescript
async function convertCommandHandler(
  this: AppContext,
  flags: ConvertFlags,
  pluginId: string,
): Promise<void> {
  const { logger, adapter, config } = this;

  try {
    // Step 1: Resolve authentication token
    let token: string;
    try {
      if (flags.token) {
        token = flags.token;
      } else {
        try {
          token = resolveAuthToken();
        } catch {
          const configToken = await config.get("token");
          if (typeof configToken === "string" && configToken) {
            token = configToken;
          } else {
            throw new Error("No token found");
          }
        }
      }
    } catch {
      logger.error(
        "GitHub token required. Use --token flag, set GITHUB_TOKEN environment variable, or configure with: shard config set token <token>",
      );
      this.process.exit(1);
    }

    // Step 2: Resolve namespace
    const namespace =
      flags.namespace ??
      ((await config.get("namespace")) as string) ??
      DEFAULT_NAMESPACE;

    // Step 3: Create converter
    const converter = new PluginConverter(adapter);

    // Step 4: Convert plugin from GitHub releases (always uses latest version)
    logger.info(`Converting plugin "${pluginId}"...`);
    logger.info("Using latest version");

    const convertResult = await converter.convertPlugin({
      pluginId,
      namespace,
      token,
    });

    // ... rest of the function stays the same
```

**Step 3: Update namespace flag definition**

Modify the flags section in the `buildCommand` call:

```typescript
flags: {
  namespace: {
    kind: "parsed",
    parse: String,
    brief: "Target OCI namespace (defaults to config or community-plugins)",
    optional: true,
  },
  // ... rest of flags stay the same
```

**Step 4: Update docs custom usage**

```typescript
docs: {
  brief: "Convert a legacy plugin to OCI format",
  customUsage: [
    "shard convert obsidian-git",
    "shard convert calendar --namespace ghcr.io/custom/",
  ],
},
```

**Step 5: Verify TypeScript compiles**

Run: `pnpm ts-check`
Expected: No errors

**Step 6: Commit**

```bash
git add packages/cli/src/commands/convert.ts
git commit -m "feat: make namespace optional in convert command with config fallback"
```

---

## Task 9: Run All Tests

**Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests PASS

**Step 2: Run TypeScript check**

Run: `pnpm ts-check`
Expected: No errors

**Step 3: Run linter**

Run: `pnpm lint`
Expected: No errors (or fix any issues)

**Step 4: Build project**

Run: `pnpm build`
Expected: Build succeeds

**Step 5: Commit if any fixes were needed**

```bash
git add .
git commit -m "chore: fix lint and build issues"
```

---

## Task 10: Integration Testing and Documentation

**Step 1: Manual integration test - verify command**

Test the verify command manually (requires a real plugin):

```bash
# Assuming you have obsidian-git installed locally
pnpm start verify ~/.obsidian/plugins/obsidian-git/
```

Expected: Verification output (success or failure with details)

**Step 2: Manual integration test - config namespace**

```bash
pnpm start config set namespace "ghcr.io/test/repo/"
pnpm start config get namespace
```

Expected: Returns normalized value without trailing slash

**Step 3: Manual integration test - convert with config namespace**

```bash
pnpm start config set namespace "ghcr.io/shard-for-obsidian/shard/community-plugins"
pnpm start convert obsidian-git
```

Expected: Uses namespace from config (no --namespace flag needed)

**Step 4: Update README or docs if needed**

Add documentation for the new commands (optional - create if doesn't exist).

**Step 5: Final commit**

```bash
git add .
git commit -m "docs: add documentation for verify and config namespace features"
```

---

## Completion Checklist

- [ ] Task 1: Namespace utility with tests
- [ ] Task 2: Hash computation utility with tests
- [ ] Task 3: Update config service for namespace
- [ ] Task 4: Update config set command for namespace normalization
- [ ] Task 5: Verify command implementation (core logic)
- [ ] Task 6: Verify command CLI interface
- [ ] Task 7: Register verify command in CLI
- [ ] Task 8: Update convert command for optional namespace
- [ ] Task 9: Run all tests
- [ ] Task 10: Integration testing and documentation

## Notes

- All tests use vitest with describe/it/expect patterns
- Mock OCI registry responses using vi.fn()
- Use SubtleCrypto for hash computation (cross-platform)
- Reuse existing infrastructure (OciRegistryClient, ConfigService)
- Follow existing patterns from convert command for auth resolution
- Use TDD: write test first, verify it fails, implement, verify it passes
