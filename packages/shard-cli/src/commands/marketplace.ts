/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { OciRegistryClient, parseRepoAndRef } from "shard-lib";
import type { FetchAdapter } from "shard-lib";
import { Logger } from "../lib/logger.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface MarketplaceRegisterOptions {
  repository: string;
  token: string;
  logger: Logger;
  adapter: FetchAdapter;
}

export interface MarketplaceRegisterResult {
  pluginId: string;
  name: string;
  author: string;
  description: string;
  repo: string;
  yamlPath: string;
}

/**
 * Register a plugin to the Shard marketplace.
 * Pulls plugin metadata from OCI registry and creates a YAML file.
 *
 * @param opts - Marketplace register options
 * @returns Register result with plugin metadata
 */
export async function marketplaceRegisterCommand(
  opts: MarketplaceRegisterOptions,
): Promise<MarketplaceRegisterResult> {
  const { repository, token, logger, adapter } = opts;

  // Step 1: Parse repository reference
  logger.log(`Fetching plugin metadata from ${repository}...`);
  const ref = parseRepoAndRef(repository);
  const client = new OciRegistryClient({
    repo: ref,
    username: "github",
    password: token,
    adapter,
    scopes: ["pull"],
  });

  // Step 2: Pull plugin manifest
  const manifestResult = await client.pullPluginManifest({
    ref: ref.tag || "latest",
  });

  const pluginManifest = manifestResult.pluginManifest;
  const ociManifest = manifestResult.manifest;

  // Step 3: Extract metadata
  const pluginId = pluginManifest.id;
  const name = pluginManifest.name;
  const author = pluginManifest.author;
  const description = pluginManifest.description || "";

  // Step 4: Get repository URL from annotations or derive from OCI reference
  let repoUrl: string;
  if (
    ociManifest.annotations &&
    ociManifest.annotations["org.opencontainers.image.source"]
  ) {
    repoUrl = ociManifest.annotations["org.opencontainers.image.source"];
  } else {
    // Derive from OCI registry path: ghcr.io/user/repo -> https://github.com/user/repo
    const registryPath = ref.remoteName;
    // Extract owner/repo from ghcr.io/owner/repo
    const match = registryPath.match(/^ghcr\.io\/([^/]+)\/(.+)$/);
    if (match) {
      const owner = match[1];
      const repo = match[2];
      repoUrl = `https://github.com/${owner}/${repo}`;
    } else {
      throw new Error(
        `Cannot derive repository URL from ${registryPath}. ` +
          `Please add org.opencontainers.image.source annotation to your manifest.`,
      );
    }
  }

  logger.log(`Plugin ID: ${pluginId}`);
  logger.log(`Name: ${name}`);
  logger.log(`Author: ${author}`);
  logger.log(`Repository: ${repoUrl}`);

  // Step 5: Generate YAML content
  const yamlContent = `id: ${pluginId}
name: ${name}
author: ${author}
description: ${description}
repo: ${repoUrl}
`;

  // Step 6: Find marketplace directory (walk up from cwd)
  const marketplacePath = await findMarketplaceDir();
  const pluginsDir = path.join(marketplacePath, "plugins");
  const yamlPath = path.join(pluginsDir, `${pluginId}.yml`);

  // Step 7: Ensure plugins directory exists
  await fs.mkdir(pluginsDir, { recursive: true });

  // Step 8: Write YAML file
  await fs.writeFile(yamlPath, yamlContent, "utf-8");

  logger.success(`Successfully registered plugin to ${yamlPath}`);
  logger.log(`\nNext steps:`);
  logger.log(`1. Review the generated YAML file`);
  logger.log(`2. Commit and push to the marketplace repository`);
  logger.log(
    `3. Submit a pull request to add your plugin to the marketplace`,
  );

  return {
    pluginId,
    name,
    author,
    description,
    repo: repoUrl,
    yamlPath,
  };
}

/**
 * Find the marketplace directory by walking up from cwd.
 * Looks for a directory containing marketplace/plugins/.
 */
async function findMarketplaceDir(): Promise<string> {
  let currentDir = process.cwd();
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const marketplacePath = path.join(currentDir, "marketplace");
    try {
      const stat = await fs.stat(marketplacePath);
      if (stat.isDirectory()) {
        return marketplacePath;
      }
    } catch {
      // Directory doesn't exist, continue searching
    }

    // Move up one directory
    currentDir = path.dirname(currentDir);
  }

  throw new Error(
    "Could not find marketplace directory. " +
      "Please run this command from within the marketplace repository.",
  );
}
