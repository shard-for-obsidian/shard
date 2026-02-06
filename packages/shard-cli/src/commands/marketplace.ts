import { OciRegistryClient, parseRepoAndRef } from "shard-lib";
import type { FetchAdapter } from "shard-lib";
import { Logger } from "../lib/logger.js";
import { MarketplaceClient } from "../lib/marketplace-client.js";
import type { MarketplacePlugin } from "../lib/marketplace-client.js";
import { pullCommand } from "./pull.js";
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
  version: string;
  registryUrl: string;
  repository?: string;
  license?: string;
  minObsidianVersion?: string;
  authorUrl?: string;
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

  // Step 3: Extract metadata from plugin manifest
  const pluginId = pluginManifest.id;
  const name = pluginManifest.name;
  const author = pluginManifest.author;
  const description = pluginManifest.description || "";
  const version = pluginManifest.version;
  const minObsidianVersion = pluginManifest.minAppVersion;
  const authorUrl = pluginManifest.authorUrl;

  // Step 4: Get repository URL from annotations
  let gitHubRepoUrl: string | undefined;
  if (
    ociManifest.annotations &&
    ociManifest.annotations["org.opencontainers.image.source"]
  ) {
    gitHubRepoUrl = ociManifest.annotations["org.opencontainers.image.source"];
  }

  // Step 5: Build registry URL (remove tag/digest, keep base URL)
  const registryUrl = ref.remoteName;

  logger.log(`Plugin ID: ${pluginId}`);
  logger.log(`Name: ${name}`);
  logger.log(`Author: ${author}`);
  logger.log(`Version: ${version}`);
  logger.log(`Registry URL: ${registryUrl}`);
  if (gitHubRepoUrl) {
    logger.log(`Repository: ${gitHubRepoUrl}`);
  }

  // Step 6: Generate enhanced YAML content
  let yamlContent = `id: ${pluginId}
registryUrl: ${registryUrl}
name: ${name}
author: ${author}
description: ${description}
version: ${version}
`;

  if (gitHubRepoUrl) {
    yamlContent += `repository: ${gitHubRepoUrl}\n`;
  }

  if (minObsidianVersion) {
    yamlContent += `minObsidianVersion: ${minObsidianVersion}\n`;
  }

  if (authorUrl) {
    yamlContent += `authorUrl: ${authorUrl}\n`;
  }

  // Add timestamp
  yamlContent += `updatedAt: ${new Date().toISOString()}\n`;

  // Step 7: Find marketplace directory (walk up from cwd)
  const marketplacePath = await findMarketplaceDir();
  const pluginsDir = path.join(marketplacePath, "plugins");
  const yamlPath = path.join(pluginsDir, `${pluginId}.yml`);

  // Step 8: Ensure plugins directory exists
  await fs.mkdir(pluginsDir, { recursive: true });

  // Step 9: Write YAML file
  await fs.writeFile(yamlPath, yamlContent, "utf-8");

  logger.success(`Successfully registered plugin to ${yamlPath}`);
  logger.log(`\nNext steps:`);
  logger.log(`1. Review the generated YAML file`);
  logger.log(`2. Commit and push to the marketplace repository`);
  logger.log(`3. Submit a pull request to add your plugin to the marketplace`);

  return {
    pluginId,
    name,
    author,
    description,
    version,
    registryUrl,
    repository: gitHubRepoUrl,
    minObsidianVersion,
    authorUrl,
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

/**
 * List all plugins in the marketplace.
 */
export async function marketplaceListCommand(opts: {
  logger: Logger;
  adapter: FetchAdapter;
  marketplaceUrl?: string;
}): Promise<MarketplacePlugin[]> {
  const { logger, adapter, marketplaceUrl } = opts;

  const client = new MarketplaceClient(adapter, marketplaceUrl);

  logger.log("Fetching marketplace plugins...");
  const plugins = await client.fetchPlugins();

  logger.log(`\nFound ${plugins.length} plugins:\n`);

  for (const plugin of plugins) {
    logger.log(`${plugin.name} (${plugin.id})`);
    logger.log(`  Author: ${plugin.author}`);
    logger.log(`  Version: ${plugin.version}`);
    logger.log(`  Registry: ${plugin.registryUrl}`);
    if (plugin.description) {
      logger.log(`  Description: ${plugin.description}`);
    }
    logger.log("");
  }

  return plugins;
}

/**
 * Search for plugins in the marketplace.
 */
export async function marketplaceSearchCommand(opts: {
  keyword: string;
  logger: Logger;
  adapter: FetchAdapter;
  marketplaceUrl?: string;
}): Promise<MarketplacePlugin[]> {
  const { keyword, logger, adapter, marketplaceUrl } = opts;

  const client = new MarketplaceClient(adapter, marketplaceUrl);

  logger.log(`Searching for "${keyword}"...`);
  const plugins = await client.searchPlugins(keyword);

  if (plugins.length === 0) {
    logger.log(`\nNo plugins found matching "${keyword}"`);
    return [];
  }

  logger.log(`\nFound ${plugins.length} matching plugin(s):\n`);

  for (const plugin of plugins) {
    logger.log(`${plugin.name} (${plugin.id})`);
    logger.log(`  Author: ${plugin.author}`);
    logger.log(`  Version: ${plugin.version}`);
    logger.log(`  Registry: ${plugin.registryUrl}`);
    if (plugin.description) {
      logger.log(`  Description: ${plugin.description}`);
    }
    logger.log("");
  }

  return plugins;
}

/**
 * Display detailed information about a plugin.
 */
export async function marketplaceInfoCommand(opts: {
  pluginId: string;
  logger: Logger;
  adapter: FetchAdapter;
  marketplaceUrl?: string;
}): Promise<MarketplacePlugin | null> {
  const { pluginId, logger, adapter, marketplaceUrl } = opts;

  const client = new MarketplaceClient(adapter, marketplaceUrl);

  logger.log(`Fetching plugin "${pluginId}"...`);
  const plugin = await client.findPluginById(pluginId);

  if (!plugin) {
    logger.error(`Plugin "${pluginId}" not found in marketplace`);
    return null;
  }

  logger.log("\n" + "=".repeat(60));
  logger.log(`Plugin: ${plugin.name}`);
  logger.log("=".repeat(60) + "\n");

  logger.log(`ID: ${plugin.id}`);
  logger.log(`Version: ${plugin.version}`);
  logger.log(`Author: ${plugin.author}`);
  if (plugin.authorUrl) {
    logger.log(`Author URL: ${plugin.authorUrl}`);
  }
  logger.log(`Description: ${plugin.description}`);
  logger.log(`\nRegistry URL: ${plugin.registryUrl}`);
  if (plugin.repository) {
    logger.log(`Repository: ${plugin.repository}`);
  }
  if (plugin.license) {
    logger.log(`License: ${plugin.license}`);
  }
  if (plugin.minObsidianVersion) {
    logger.log(`Min Obsidian Version: ${plugin.minObsidianVersion}`);
  }
  if (plugin.tags && plugin.tags.length > 0) {
    logger.log(`Tags: ${plugin.tags.join(", ")}`);
  }
  logger.log(`Last Updated: ${plugin.updatedAt}`);

  logger.log("\n" + "=".repeat(60));
  logger.log("Installation:");
  logger.log("=".repeat(60) + "\n");
  logger.log(`shard pull ${plugin.registryUrl}:${plugin.version} --output <path>`);
  logger.log(
    `shard marketplace install ${plugin.id}  # (coming soon)`,
  );

  return plugin;
}

/**
 * Install a plugin from the marketplace by ID.
 */
export async function marketplaceInstallCommand(opts: {
  pluginId: string;
  output: string;
  version?: string;
  token: string;
  logger: Logger;
  adapter: FetchAdapter;
  marketplaceUrl?: string;
}): Promise<{ plugin: MarketplacePlugin; pullResult: unknown }> {
  const { pluginId, output, version, token, logger, adapter, marketplaceUrl } =
    opts;

  const client = new MarketplaceClient(adapter, marketplaceUrl);

  // Step 1: Find plugin in marketplace
  logger.log(`Looking up plugin "${pluginId}" in marketplace...`);
  const plugin = await client.findPluginById(pluginId);

  if (!plugin) {
    throw new Error(`Plugin "${pluginId}" not found in marketplace`);
  }

  logger.log(`Found: ${plugin.name} v${plugin.version} by ${plugin.author}`);

  // Step 2: Determine version to install
  const versionToInstall = version || plugin.version;
  const repository = `${plugin.registryUrl}:${versionToInstall}`;

  logger.log(`Installing from ${repository}...`);

  // Step 3: Use pull command to install
  const pullResult = await pullCommand({
    repository,
    output,
    token,
    logger,
    adapter,
  });

  logger.success(
    `Successfully installed ${plugin.name} v${versionToInstall} to ${output}`,
  );

  return { plugin, pullResult };
}

/**
 * Update a marketplace entry by re-registering from GHCR.
 */
export async function marketplaceUpdateCommand(opts: {
  repository: string;
  token: string;
  logger: Logger;
  adapter: FetchAdapter;
}): Promise<MarketplaceRegisterResult> {
  const { logger } = opts;

  logger.log("Updating marketplace entry...");
  logger.log(
    "Note: This will overwrite the existing YAML file with fresh metadata from GHCR\n",
  );

  // Just call the register command - it will overwrite the existing file
  return marketplaceRegisterCommand(opts);
}
