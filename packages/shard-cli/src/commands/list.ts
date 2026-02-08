import { buildCommand } from "@stricli/core";
import type { AppContext } from "../infrastructure/context.js";
import { MarketplaceClient } from "../lib/marketplace-client.js";

/**
 * Flags for the list command
 */
export interface ListFlags {
  json?: boolean;
  verbose?: boolean;
}

/**
 * List all plugins in the marketplace
 */
async function listCommand(
  this: AppContext,
  flags: ListFlags,
): Promise<void> {
  const { logger, adapter } = this;

  try {
    const client = new MarketplaceClient(adapter);

    logger.info("Fetching marketplace plugins...");
    const plugins = await client.fetchPlugins();

    // JSON output mode
    if (flags.json) {
      const output = JSON.stringify(plugins, null, 2);
      process.stdout.write(output + "\n");
      return;
    }

    // Normal output mode
    logger.info(`\nFound ${plugins.length} plugins:\n`);

    for (const plugin of plugins) {
      logger.info(`${plugin.name} (${plugin.id})`);
      logger.info(`  Author: ${plugin.author}`);

      // Display latest version if available
      if (plugin.versions && plugin.versions.length > 0) {
        logger.info(`  Latest Version: ${plugin.versions[0].tag}`);
      }

      logger.info(`  Registry: ${plugin.registryUrl}`);

      if (plugin.description) {
        logger.info(`  Description: ${plugin.description}`);
      }

      // Show additional details in verbose mode
      if (flags.verbose) {
        if (plugin.repository) {
          logger.info(`  Repository: ${plugin.repository}`);
        }
        if (plugin.license) {
          logger.info(`  License: ${plugin.license}`);
        }
        if (plugin.minObsidianVersion) {
          logger.info(`  Min Obsidian Version: ${plugin.minObsidianVersion}`);
        }
        if (plugin.tags && plugin.tags.length > 0) {
          logger.info(`  Tags: ${plugin.tags.join(", ")}`);
        }
      }

      logger.info("");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to list plugins: ${message}`);
    process.exit(1);
  }
}

/**
 * Build the list command
 */
export const list = buildCommand({
  func: listCommand,
  parameters: {
    positional: { kind: "tuple", parameters: [] },
    flags: {
      json: {
        kind: "boolean",
        brief: "Output JSON instead of human-readable format",
        optional: true,
      },
      verbose: {
        kind: "boolean",
        brief: "Show additional plugin details",
        optional: true,
      },
    },
    aliases: {},
  },
  docs: {
    brief: "List all plugins in the marketplace",
    customUsage: [],
  },
});
