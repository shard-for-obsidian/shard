import { OciRegistryClient, parseRepoAndRef } from "@shard-for-obsidian/lib";
import type { FetchAdapter } from "@shard-for-obsidian/lib";
import { Logger } from "../lib/logger.js";
import { MarketplaceClient } from "../lib/marketplace-client.js";
import type { MarketplacePlugin } from "../lib/marketplace-client.js";
import { queryOciTags, queryTagMetadata } from "../lib/oci-tags.js";
import type { TagMetadata } from "../lib/oci-tags.js";
import { pullCommand } from "./pull.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface MarketplaceRegisterOptions {
  repository: string;
  token: string;
  introduction?: string;
  logger: Logger;
  adapter: FetchAdapter;
}

export interface MarketplaceRegisterResult {
  pluginId: string;
  name: string;
  author: string;
  description: string;
  registryUrl: string;
  repository?: string;
  license?: string;
  minObsidianVersion?: string;
  authorUrl?: string;
  mdPath: string;
}

/**
 * Register a plugin to the Shard marketplace.
 * Pulls plugin metadata from OCI registry and creates a markdown file with frontmatter.
 *
 * @param opts - Marketplace register options
 * @returns Register result with plugin metadata
 */
export async function marketplaceRegisterCommand(
  opts: MarketplaceRegisterOptions,
): Promise<MarketplaceRegisterResult> {
  const { repository, token, introduction, logger, adapter } = opts;

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
  const minObsidianVersion = pluginManifest.minAppVersion;
  const authorUrl = pluginManifest.authorUrl;

  // Step 4: Get repository URL from annotations
  let gitHubRepoUrl: string | undefined;
  if (
    ociManifest.annotations &&
    ociManifest.annotations["org.opencontainers.image.source"]
  ) {
    const source = ociManifest.annotations["org.opencontainers.image.source"];
    // Ensure it's a full GitHub URL
    if (source.startsWith("http")) {
      gitHubRepoUrl = source;
    } else {
      // Convert short form to full URL
      gitHubRepoUrl = `https://github.com/${source}`;
    }
  }

  // Step 5: Build registry URL (use canonical name which includes registry host)
  const registryUrl = ref.canonicalName;

  logger.log(`Plugin ID: ${pluginId}`);
  logger.log(`Name: ${name}`);
  logger.log(`Author: ${author}`);
  logger.log(`Registry URL: ${registryUrl}`);
  if (gitHubRepoUrl) {
    logger.log(`Repository: ${gitHubRepoUrl}`);
  }

  // Step 6: Generate markdown with YAML frontmatter
  let frontmatter = `---
id: ${pluginId}
registryUrl: ${registryUrl}
name: ${name}
author: ${author}
description: ${description}
`;

  if (gitHubRepoUrl) {
    frontmatter += `repository: ${gitHubRepoUrl}\n`;
  }

  if (minObsidianVersion) {
    frontmatter += `minObsidianVersion: ${minObsidianVersion}\n`;
  }

  if (authorUrl) {
    frontmatter += `authorUrl: ${authorUrl}\n`;
  }

  frontmatter += `---\n`;

  // Add introduction content if provided
  let markdownContent = frontmatter;
  if (introduction) {
    markdownContent += `\n${introduction}\n`;
  }

  // Step 7: Find marketplace directory (walk up from cwd)
  const marketplacePath = await findMarketplaceDir();
  const pluginsDir = path.join(marketplacePath, "plugins");
  const mdPath = path.join(pluginsDir, `${pluginId}.md`);

  // Step 8: Ensure plugins directory exists
  await fs.mkdir(pluginsDir, { recursive: true });

  // Step 9: Write markdown file
  await fs.writeFile(mdPath, markdownContent, "utf-8");

  logger.success(`Successfully registered plugin to ${mdPath}`);
  logger.log(`\nNext steps:`);
  logger.log(`1. Review the generated markdown file`);
  logger.log(`2. Commit and push to the marketplace repository`);
  logger.log(`3. Submit a pull request to add your plugin to the marketplace`);

  return {
    pluginId,
    name,
    author,
    description,
    registryUrl,
    repository: gitHubRepoUrl,
    minObsidianVersion,
    authorUrl,
    mdPath,
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
 * Query and display all available versions for a plugin registry.
 */
export async function marketplaceVersionsCommand(opts: {
  registryUrl: string;
  token: string;
  logger: Logger;
  adapter: FetchAdapter;
}): Promise<Array<{ tag: string } & TagMetadata>> {
  const { registryUrl, token, logger, adapter } = opts;

  logger.log(`Querying versions for ${registryUrl}...`);

  // Query all tags
  const tags = await queryOciTags({ registryUrl, token, adapter });

  if (tags.length === 0) {
    logger.log("No versions found");
    return [];
  }

  logger.log(`\nFound ${tags.length} version(s):\n`);

  // Query metadata for each tag
  const versions: Array<{ tag: string } & TagMetadata> = [];

  for (const tag of tags) {
    const metadata = await queryTagMetadata({
      registryUrl,
      tag,
      token,
      adapter,
    });

    versions.push({ tag, ...metadata });

    // Format size
    const sizeKB = (metadata.size / 1024).toFixed(0);

    // Format date
    const date = new Date(metadata.publishedAt).toISOString().split("T")[0];

    logger.log(`- ${tag} (published ${date}, ${sizeKB} KB)`);

    // Show commit SHA if available
    if (metadata.annotations["org.opencontainers.image.revision"]) {
      const sha = metadata.annotations["org.opencontainers.image.revision"];
      logger.log(`  Commit: ${sha.substring(0, 7)}`);
    }
  }

  return versions;
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
    "Note: This will overwrite the existing markdown file with fresh metadata from GHCR\n",
  );

  // Just call the register command - it will overwrite the existing file
  return marketplaceRegisterCommand(opts);
}
