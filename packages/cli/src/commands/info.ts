import { buildCommand } from "@stricli/core";
import type { AppContext } from "../infrastructure/context.js";
import { MarketplaceClient } from "../lib/marketplace-client.js";

/**
 * Flags for the info command
 */
export interface InfoFlags {
  json?: boolean;
  verbose?: boolean;
}

/**
 * Display detailed information about a plugin
 */
async function infoCommand(
  this: AppContext,
  flags: InfoFlags,
  pluginId: string,
): Promise<void> {
  const { logger, adapter } = this;

  try {
    const client = new MarketplaceClient({ adapter });

    logger.info(`Fetching plugin "${pluginId}"...`);
    const plugin = await client.findPluginById(pluginId);

    if (!plugin) {
      logger.error(`Plugin "${pluginId}" not found in marketplace`);
      this.process.exit(1);
    }

    // JSON output mode
    if (flags.json) {
      const output = JSON.stringify(plugin, null, 2);
      this.process.stdout.write(output + "\n");
      return;
    }

    // Normal output mode - rich formatted display
    logger.info("\n" + "=".repeat(60));
    logger.info(`Plugin: ${plugin.name}`);
    logger.info("=".repeat(60) + "\n");

    logger.info(`ID: ${plugin.id}`);
    logger.info(`Author: ${plugin.author}`);
    if (plugin.authorUrl) {
      logger.info(`Author URL: ${plugin.authorUrl}`);
    }
    logger.info(`Description: ${plugin.description}`);
    logger.info(`\nRegistry URL: ${plugin.registryUrl}`);
    if (plugin.repository) {
      logger.info(`Repository: ${plugin.repository}`);
    }
    if (plugin.license) {
      logger.info(`License: ${plugin.license}`);
    }
    if (plugin.minObsidianVersion) {
      logger.info(`Min Obsidian Version: ${plugin.minObsidianVersion}`);
    }
    if (plugin.tags && plugin.tags.length > 0) {
      logger.info(`Tags: ${plugin.tags.join(", ")}`);
    }

    // Display available versions
    if (plugin.versions && plugin.versions.length > 0) {
      logger.info(`\nAvailable Versions (${plugin.versions.length}):`);

      // Show more versions in verbose mode
      const displayCount = flags.verbose ? plugin.versions.length : 5;
      const versionsToShow = plugin.versions.slice(0, displayCount);

      for (const version of versionsToShow) {
        const date = new Date(version.publishedAt).toISOString().split("T")[0];
        logger.info(`  - ${version.canonicalTag} (${date})`);

        // In verbose mode, show additional version details
        if (flags.verbose) {
          const sizeKB = (version.size / 1024).toFixed(0);
          logger.info(`    Size: ${sizeKB} KB`);

          if (version.annotations["vnd.obsidianmd.plugin.commit"]) {
            const sha = version.annotations["vnd.obsidianmd.plugin.commit"];
            logger.info(`    Commit: ${sha.substring(0, 7)}`);
          }
        }
      }

      if (!flags.verbose && plugin.versions.length > 5) {
        logger.info(`  ... and ${plugin.versions.length - 5} more`);
      }
    }

    // Installation instructions
    logger.info("\n" + "=".repeat(60));
    logger.info("Installation:");
    logger.info("=".repeat(60) + "\n");
    const latestVersion =
      plugin.versions && plugin.versions.length > 0
        ? plugin.versions[0].canonicalTag
        : "latest";
    logger.info(
      `shard pull ${plugin.registryUrl}:${latestVersion} --output <path>`,
    );

    // Show introduction in verbose mode
    if (flags.verbose && plugin.introduction) {
      logger.info("\n" + "=".repeat(60));
      logger.info("Introduction:");
      logger.info("=".repeat(60) + "\n");
      logger.info(plugin.introduction);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to fetch plugin info: ${message}`);
    this.process.exit(1);
  }
}

/**
 * Build the info command
 */
export const info = buildCommand({
  func: infoCommand,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Plugin ID to display information for",
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
        brief: "Show all versions and additional details",
        optional: true,
      },
    },
    aliases: {},
  },
  docs: {
    brief: "Show detailed information about a plugin",
    customUsage: [
      "shard info shard-installer",
      "shard info nldates-obsidian --verbose",
      "shard info notebook-navigator --json",
    ],
  },
});
