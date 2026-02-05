import { OciRegistryClient, parseRepoAndRef } from "shard-lib";
import type {
  ManifestOCIDescriptor,
  FetchAdapter,
  ObsidianManifest,
} from "shard-lib";
import { discoverPlugin } from "../lib/plugin.js";
import { Logger } from "../lib/logger.js";

export interface PushOptions {
  directory: string;
  repository: string;
  token: string;
  logger: Logger;
  adapter: FetchAdapter;
}

export interface PushResult {
  digest: string;
  tag: string;
  size: number;
  repository: string;
}

/**
 * Push an Obsidian plugin to GHCR.
 *
 * @param opts - Push options
 * @returns Push result with digest and tag
 */
export async function pushCommand(opts: PushOptions): Promise<PushResult> {
  const { directory, repository, token, logger, adapter } = opts;

  // Step 1: Discover plugin files
  logger.log(`Discovering plugin files in ${directory}...`);
  const plugin = await discoverPlugin(directory);
  const version = plugin.manifest.parsed.version;
  logger.log(`Found plugin version ${version}`);

  // Step 2: Parse repository and add version tag
  const fullRef = repository.includes(":")
    ? repository
    : `${repository}:${version}`;
  logger.log(`Pushing to ${fullRef}...`);

  const ref = parseRepoAndRef(fullRef);
  const client = new OciRegistryClient({
    repo: ref,
    username: "github",
    password: token,
    adapter,
    scopes: ["push", "pull"],
  });

  // Step 3: Push each file as a blob
  const layers: ManifestOCIDescriptor[] = [];

  // No longer need to push manifest.json as a layer - it's now in the config

  // Push main.js
  logger.log("Pushing main.js...");
  const mainJsResult = await client.pushBlob({
    data: plugin.mainJs.content,
  });
  layers.push({
    mediaType: "application/javascript",
    digest: mainJsResult.digest,
    size: mainJsResult.size,
    annotations: {
      "org.opencontainers.image.title": "main.js",
    },
  });
  logger.log(
    `Pushed main.js: ${mainJsResult.digest.slice(0, 19)}... (${mainJsResult.size} bytes)`,
  );

  // Push styles.css if present
  if (plugin.stylesCss) {
    logger.log("Pushing styles.css...");
    const stylesCssResult = await client.pushBlob({
      data: plugin.stylesCss.content,
    });
    layers.push({
      mediaType: "text/css",
      digest: stylesCssResult.digest,
      size: stylesCssResult.size,
      annotations: {
        "org.opencontainers.image.title": "styles.css",
      },
    });
    logger.log(
      `Pushed styles.css: ${stylesCssResult.digest.slice(0, 19)}... (${stylesCssResult.size} bytes)`,
    );
  }

  // Step 4: Push plugin manifest using new method
  logger.log("Pushing plugin manifest...");
  const manifestPushResult = await client.pushPluginManifest({
    ref: ref.tag || version,
    pluginManifest: plugin.manifest.parsed as unknown as ObsidianManifest,
    layers,
    annotations: {
      "org.opencontainers.image.created": new Date().toISOString(),
    },
  });

  logger.success(`Successfully pushed ${fullRef}`);
  logger.log(`Manifest digest: ${manifestPushResult.digest}`);

  // Calculate total size from manifest
  const totalSize = manifestPushResult.manifest.layers.reduce(
    (sum, layer) => sum + layer.size,
    0,
  );

  return {
    digest: manifestPushResult.digest,
    tag: ref.tag || version,
    size: totalSize,
    repository: fullRef,
  };
}
