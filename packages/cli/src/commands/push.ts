/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { OciRegistryClient } from "../../lib/client/registry-client.js";
import type { ManifestOCI, ManifestOCIDescriptor } from "../../lib/client/types.js";
import { parseRepoAndRef } from "../../lib/client/common.js";
import { discoverPlugin } from "../lib/plugin.js";
import { Logger } from "../lib/logger.js";
import type { FetchAdapter } from "../../lib/client/fetch-adapter.js";

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
  const fullRef = repository.includes(":") ? repository : `${repository}:${version}`;
  logger.log(`Pushing to ${fullRef}...`);

  const ref = parseRepoAndRef(fullRef);
  const client = new OciRegistryClient({
    repo: ref,
    token,
    adapter,
  });

  // Step 3: Create and push config blob (empty JSON)
  logger.log("Creating config blob...");
  const configContent = new TextEncoder().encode("{}");
  const configResult = await client.pushBlob({
    data: configContent,
  });
  logger.log(`Pushed config blob: ${configResult.digest.slice(0, 19)}... (${configResult.size} bytes)`);

  // Step 4: Push each file as a blob
  const layers: ManifestOCIDescriptor[] = [];

  // Push manifest.json
  logger.log("Pushing manifest.json...");
  const manifestResult = await client.pushBlob({
    data: plugin.manifest.content,
  });
  layers.push({
    mediaType: "application/json",
    digest: manifestResult.digest,
    size: manifestResult.size,
    annotations: {
      "org.opencontainers.image.title": "manifest.json",
    },
  });
  logger.log(`Pushed manifest.json: ${manifestResult.digest.slice(0, 19)}... (${manifestResult.size} bytes)`);

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
  logger.log(`Pushed main.js: ${mainJsResult.digest.slice(0, 19)}... (${mainJsResult.size} bytes)`);

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
    logger.log(`Pushed styles.css: ${stylesCssResult.digest.slice(0, 19)}... (${stylesCssResult.size} bytes)`);
  }

  // Step 5: Build manifest
  logger.log("Building manifest...");
  const manifest: ManifestOCI = {
    schemaVersion: 2,
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    artifactType: "application/vnd.obsidian.plugin.v1+json",
    config: {
      mediaType: "application/vnd.oci.image.config.v1+json",
      digest: configResult.digest,
      size: configResult.size,
    },
    layers,
    annotations: {
      "org.opencontainers.image.created": new Date().toISOString(),
    },
  };

  // Step 6: Push manifest
  logger.log("Pushing manifest...");
  const manifestPushResult = await client.pushManifest({
    ref: ref.tag || version,
    manifest,
    mediaType: "application/vnd.oci.image.manifest.v1+json",
  });

  logger.success(`Successfully pushed ${fullRef}`);
  logger.log(`Manifest digest: ${manifestPushResult.digest}`);

  return {
    digest: manifestPushResult.digest,
    tag: ref.tag || version,
    size: manifestPushResult.size,
    repository: fullRef,
  };
}
