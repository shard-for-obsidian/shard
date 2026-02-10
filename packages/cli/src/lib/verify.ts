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
