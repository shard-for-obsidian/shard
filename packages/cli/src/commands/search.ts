import { buildCommand } from "@stricli/core";
import type { AppContext } from "../infrastructure/context.js";
import { MarketplaceClient } from "../lib/marketplace-client.js";

/**
 * Flags for the search command
 */
export interface SearchFlags {
  json?: boolean;
  verbose?: boolean;
}

/**
 * Search for plugins in the marketplace by keyword
 */
async function searchCommand(
  this: AppContext,
  flags: SearchFlags,
  keyword: string,
): Promise<void> {
  const { logger, adapter } = this;

  try {
    const client = new MarketplaceClient({ adapter });

    logger.info(`Searching for "${keyword}"...`);
    const plugins = await client.searchPlugins(keyword);

    // JSON output mode
    if (flags.json) {
      const output = JSON.stringify(plugins, null, 2);
      this.process.stdout.write(output + "\n");
      return;
    }

    // No results
    if (plugins.length === 0) {
      logger.info(`\nNo plugins found matching "${keyword}"`);
      return;
    }

    // Normal output mode
    logger.info(`\nFound ${plugins.length} matching plugin(s):\n`);

    for (const plugin of plugins) {
      logger.info(`${plugin.name} (${plugin.id})`);
      logger.info(`  Author: ${plugin.author}`);

      // Display latest version if available
      if (plugin.versions && plugin.versions.length > 0) {
        logger.info(`  Latest Version: ${plugin.versions[0].canonicalTag}`);
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
    logger.error(`Failed to search plugins: ${message}`);
    this.process.exit(1);
  }
}

/**
 * Build the search command
 */
export const search = buildCommand({
  func: searchCommand,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Search keyword to match against plugin name, description, author, or tags",
          parse: String,
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
        brief: "Show additional plugin details",
        optional: true,
      },
    },
    aliases: {},
  },
  docs: {
    brief: "Search for plugins in the marketplace",
    customUsage: [
      "shard search calendar",
      "shard search git --verbose",
      "shard search editor --json",
    ],
  },
});
