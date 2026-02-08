import { buildCommand } from "@stricli/core";
import type { AppContext } from "../infrastructure/context.js";
import { PluginConverter } from "../lib/converter.js";
import { resolveAuthToken } from "../lib/auth.js";

/**
 * Flags for the convert command
 */
export interface ConvertFlags {
  version?: string;
  token?: string;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Result returned by the convert command
 */
export interface ConvertResult {
  pluginId: string;
  version: string;
  repository: string;
  digest: string;
  size: number;
}

/**
 * Convert a legacy Obsidian plugin from GitHub releases to OCI format
 */
async function convertCommandHandler(
  this: AppContext,
  flags: ConvertFlags,
  pluginId: string,
  repository: string,
): Promise<void> {
  const { logger, adapter, config } = this;

  try {
    // Step 1: Resolve authentication token
    let token: string;
    try {
      if (flags.token) {
        token = flags.token;
      } else {
        try {
          token = resolveAuthToken();
        } catch {
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

    // Step 2: Create converter
    const converter = new PluginConverter(adapter);

    // Step 3: Convert plugin from GitHub releases
    logger.info(`Converting plugin "${pluginId}"...`);
    if (flags.version) {
      logger.info(`Using specific version: ${flags.version}`);
    } else {
      logger.info("Using latest version");
    }

    const convertResult = await converter.convertPlugin({
      pluginId,
      version: flags.version,
      repository,
      token,
    });

    logger.info(
      `Downloaded plugin ${convertResult.pluginId} v${convertResult.version}`,
    );
    logger.info(`  - manifest.json: ${convertResult.manifest.name}`);
    logger.info(`  - main.js: ${convertResult.mainJs.length} bytes`);
    if (convertResult.stylesCss) {
      logger.info(`  - styles.css: ${convertResult.stylesCss.length} bytes`);
    }

    // Step 4: Push to OCI registry
    logger.info(`\nPushing to ${convertResult.repository}...`);
    const pushResult = await converter.pushToRegistry({
      repository: convertResult.repository,
      githubRepo: convertResult.githubRepo,
      token,
      pluginData: {
        manifest: convertResult.manifest,
        mainJs: convertResult.mainJs,
        stylesCss: convertResult.stylesCss,
      },
    });

    logger.success(
      `Successfully converted and pushed ${convertResult.pluginId} v${convertResult.version}`,
    );
    logger.info(`Repository: ${pushResult.repository}`);
    logger.info(`Digest: ${pushResult.digest}`);

    // Step 5: JSON output if requested
    if (flags.json) {
      const result: ConvertResult = {
        pluginId: convertResult.pluginId,
        version: convertResult.version,
        repository: pushResult.repository,
        digest: pushResult.digest,
        size: pushResult.size,
      };
      this.process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to convert plugin: ${message}`);
    this.process.exit(1);
  }
}

/**
 * Build the convert command
 */
export const convert = buildCommand({
  func: convertCommandHandler,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Plugin ID from community plugins list",
          parse: String,
          placeholder: "plugin-id",
        },
        {
          brief: "Target OCI repository (e.g., ghcr.io/owner/repo)",
          parse: String,
          placeholder: "repository",
        },
      ],
    },
    flags: {
      version: {
        kind: "parsed",
        parse: String,
        brief: "Specific version to convert (default: latest)",
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
      v: "version",
      t: "token",
    },
  },
  docs: {
    brief: "Convert a legacy plugin to OCI format",
    customUsage: [
      "shard convert obsidian-git ghcr.io/user/obsidian-git",
      "shard convert calendar ghcr.io/user/calendar --version 1.5.3",
    ],
  },
});
