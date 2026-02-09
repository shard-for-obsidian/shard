import { buildCommand } from "@stricli/core";
import type { AppContext } from "../infrastructure/context.js";
import { PluginConverter } from "../lib/converter.js";
import { resolveAuthToken } from "../lib/auth.js";

/**
 * Flags for the convert command
 */
export interface ConvertFlags {
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
  tags: string[];
  size: number;
}

/**
 * Convert a legacy Obsidian plugin from GitHub releases to OCI format
 */
async function convertCommandHandler(
  this: AppContext,
  flags: ConvertFlags,
  pluginId: string,
  namespace: string,
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

    // Step 3: Convert plugin from GitHub releases (always uses latest version)
    logger.info(`Converting plugin "${pluginId}"...`);
    logger.info("Using latest version");

    const convertResult = await converter.convertPlugin({
      pluginId,
      namespace,
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
      token,
      communityPlugin: convertResult.communityPlugin,
      publishedAt: convertResult.publishedAt,
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
    logger.info(`Tags: ${pushResult.tags.join(", ")}`);

    // Step 5: JSON output if requested
    if (flags.json) {
      const result: ConvertResult = {
        pluginId: convertResult.pluginId,
        version: convertResult.version,
        repository: pushResult.repository,
        digest: pushResult.digest,
        tags: pushResult.tags,
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
          brief: "Target OCI namespace (e.g., ghcr.io/owner/)",
          parse: String,
          placeholder: "namespace",
        },
      ],
    },
    flags: {
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
      t: "token",
    },
  },
  docs: {
    brief: "Convert a legacy plugin to OCI format",
    customUsage: [
      "shard convert obsidian-git ghcr.io/owner/",
      "shard convert calendar ghcr.io/owner/",
    ],
  },
});
