import { buildCommand } from "@stricli/core";
import type { AppContext } from "../infrastructure/context.js";
import { createSpinner } from "../infrastructure/progress.js";
import { MarketplaceClient } from "../lib/marketplace-client.js";
import { resolveAuthToken } from "../lib/auth.js";
import { pullCommand } from "./pull.js";

/**
 * Flags for the install command
 */
export interface InstallFlags {
  output: string;
  version?: string;
  token?: string;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Result returned by the install command
 */
export interface InstallResult {
  pluginId: string;
  pluginName: string;
  version: string;
  files: string[];
  output: string;
  digest: string;
}

/**
 * Install a plugin from the marketplace
 */
async function installCommand(
  this: AppContext,
  flags: InstallFlags,
  pluginId: string,
): Promise<void> {
  const { logger, adapter, config } = this;

  try {
    // Step 1: Create spinner and look up plugin in marketplace
    const spinner = createSpinner(
      "Looking up plugin in marketplace...",
      !flags.json,
    );
    spinner?.start();

    const client = new MarketplaceClient({ adapter });
    const plugin = await client.findPluginById(pluginId);

    if (!plugin) {
      spinner?.fail();
      logger.error(`Plugin "${pluginId}" not found in marketplace`);
      this.process.exit(1);
    }

    // Step 2: Determine version to install
    const versionToInstall = flags.version || plugin.versions?.[0]?.canonicalTag;

    if (!versionToInstall) {
      spinner?.fail();
      logger.error(`No versions available for plugin "${pluginId}"`);
      this.process.exit(1);
    }

    spinner?.succeed(`Found ${plugin.name} (version: ${versionToInstall})`);

    // Step 3: Resolve authentication token
    // Priority: flag → resolveAuthToken() → config
    let token: string;
    try {
      if (flags.token) {
        token = flags.token;
      } else {
        // Try resolveAuthToken first (checks env vars)
        try {
          token = resolveAuthToken();
        } catch {
          // If env vars fail, try config
          const configToken = await config.get("token");
          if (typeof configToken === "string" && configToken) {
            token = configToken;
          } else {
            throw new Error("No token found");
          }
        }
      }
    } catch {
      logger.error(
        "GitHub token required. Use --token flag, set GITHUB_TOKEN environment variable, or configure with: shard config set token <token>",
      );
      this.process.exit(1);
    }

    // Step 4: Download plugin using pullCommand
    logger.info(`Installing ${plugin.name} to ${flags.output}...`);

    const repository = `${plugin.registryUrl}:${versionToInstall}`;

    // Use CliLogger from context
    const pullResult = await pullCommand({
      repository,
      output: flags.output,
      token,
      logger,
      adapter,
    });

    // Step 5: Log success
    logger.success(
      `Successfully installed ${plugin.name} (${versionToInstall})`,
    );
    logger.info(`Files extracted to: ${pullResult.output}`);

    // Step 6: JSON output if requested
    if (flags.json) {
      const result: InstallResult = {
        pluginId,
        pluginName: plugin.name,
        version: versionToInstall,
        files: pullResult.files,
        output: pullResult.output,
        digest: pullResult.digest,
      };
      this.process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to install plugin: ${message}`);
    this.process.exit(1);
  }
}

/**
 * Build the install command
 */
export const install = buildCommand({
  func: installCommand,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Plugin ID to install",
          parse: String,
        },
      ],
    },
    flags: {
      output: {
        kind: "parsed",
        parse: String,
        brief: "Output directory for plugin files",
      },
      version: {
        kind: "parsed",
        parse: String,
        brief: "Specific version to install (default: latest)",
        optional: true,
      },
      token: {
        kind: "parsed",
        parse: String,
        brief: "GitHub token for authentication",
        optional: true,
      },
      json: {
        kind: "boolean",
        brief: "Output JSON instead of human-readable format",
        optional: true,
      },
      verbose: {
        kind: "boolean",
        brief: "Show detailed progress information",
        optional: true,
      },
    },
    aliases: {
      o: "output",
      v: "version",
      t: "token",
    },
  },
  docs: {
    brief: "Install a plugin from the marketplace",
    customUsage: [
      "shard install shard-installer --output ./plugins",
      "shard install nldates-obsidian --output ./plugins --version 0.6.1",
      "shard install notebook-navigator --output ./test --token ghp_xxx",
    ],
  },
});
