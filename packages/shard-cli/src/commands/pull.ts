import * as fs from "node:fs/promises";
import * as path from "node:path";
import { OciRegistryClient, parseRepoAndRef } from "shard-lib";
import type { FetchAdapter } from "shard-lib";
import { Logger } from "../lib/logger.js";

export interface PullOptions {
  repository: string;
  output: string;
  token: string;
  logger: Logger;
  adapter: FetchAdapter;
}

export interface PullResult {
  files: string[];
  output: string;
  digest: string;
}

/**
 * Pull an Obsidian plugin from GHCR.
 *
 * @param opts - Pull options
 * @returns Pull result with extracted files
 */
export async function pullCommand(opts: PullOptions): Promise<PullResult> {
  const { repository, output, token, logger, adapter } = opts;

  // Step 1: Parse repository reference
  logger.log(`Pulling ${repository}...`);
  const ref = parseRepoAndRef(repository);

  if (!ref.tag && !ref.digest) {
    throw new Error("Repository reference must include tag or digest");
  }

  const client = new OciRegistryClient({
    repo: ref,
    username: "github",
    password: token,
    adapter,
  });

  // Step 2: Fetch manifest and extract plugin manifest from config
  logger.log("Fetching manifest...");
  const refString = ref.tag || ref.digest || "";
  const pullResult = await client.pullPluginManifest({ ref: refString });
  const manifest = pullResult.manifest;

  logger.log(`Manifest digest: ${pullResult.manifestDigest}`);

  // Step 3: Create output directory if needed
  const absOutput = path.resolve(output);
  logger.log(`Creating output directory: ${absOutput}`);
  await fs.mkdir(absOutput, { recursive: true });

  // Step 4: Write manifest.json from config
  const manifestPath = path.join(absOutput, "manifest.json");
  const manifestJson = JSON.stringify(pullResult.pluginManifest, null, 2);
  await fs.writeFile(manifestPath, manifestJson, "utf-8");
  logger.log(`Wrote manifest.json (${manifestJson.length} bytes)`);

  const files: string[] = ["manifest.json"];

  // Step 5: Download and extract each layer
  for (const layer of manifest.layers) {
    // Extract filename from annotation
    const filename = layer.annotations?.["org.opencontainers.image.title"];
    if (!filename) {
      throw new Error(
        `Layer ${layer.digest} missing required filename annotation`,
      );
    }

    logger.log(`Downloading ${filename}...`);

    // Download blob
    const blobResult = await client.downloadBlob({
      digest: layer.digest,
    });

    // Write to output directory
    const filePath = path.join(absOutput, filename);
    const buffer = Buffer.from(blobResult.buffer);
    await fs.writeFile(filePath, buffer);

    logger.log(`Wrote ${filename} (${buffer.length} bytes)`);
    files.push(filename);
  }

  logger.success(`Successfully pulled ${repository}`);
  logger.log(`Files extracted to: ${absOutput}`);

  return {
    files,
    output: absOutput,
    digest: pullResult.manifestDigest,
  };
}
