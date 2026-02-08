import { buildCommand } from "@stricli/core";
import type { AppContext } from "../infrastructure/context.js";
import { pushCommand } from "./push-old.js";
import { Logger } from "../lib/logger.js";

/**
 * Flags for the publish command
 */
export interface PublishFlags {
  token?: string;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Result returned by the publish command
 */
export interface PublishResult {
  digest: string;
  version: string;
  repository: string;
  size: number;
}

/**
 * Publish an Obsidian plugin to an OCI registry.
 * Combines the old register/update commands.
 */
async function publishCommandHandler(
  this: AppContext,
  flags: PublishFlags,
  directory: string,
  repository: string,
): Promise<void> {
  const { logger, config, adapter } = this;

  try {
    // Token resolution: flag > env > config
    const token =
      flags.token ||
      process.env.GITHUB_TOKEN ||
      ((await config.get("token")) as string | undefined);

    if (!token) {
      logger.error(
        "GitHub token is required. Provide via --token flag, GITHUB_TOKEN env var, or config.",
      );
      process.exit(1);
    }

    // Create a Logger instance for the push logic
    const legacyLogger = new Logger(flags.json);

    // Call the existing push logic
    const result = await pushCommand({
      directory,
      repository,
      token,
      logger: legacyLogger,
      adapter,
    });

    // JSON output mode
    if (flags.json) {
      const output: PublishResult = {
        digest: result.digest,
        version: result.tag,
        repository: result.repository,
        size: result.size,
      };
      process.stdout.write(JSON.stringify(output, null, 2) + "\n");
      return;
    }

    // Normal output: show summary
    logger.success(
      `Published ${repository} version ${result.tag}`,
    );
    logger.info(`Digest: ${result.digest}`);
    logger.info(`Size: ${result.size} bytes`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to publish plugin: ${message}`);
    process.exit(1);
  }
}

/**
 * Build the publish command
 */
export const publish = buildCommand({
  func: publishCommandHandler,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Directory containing the plugin files",
          parse: String,
          placeholder: "directory",
        },
        {
          brief: "OCI repository (e.g., ghcr.io/owner/repo)",
          parse: String,
          placeholder: "repository",
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
        default: false,
      },
      verbose: {
        kind: "boolean",
        brief: "Show detailed output",
        default: false,
      },
    },
    aliases: {
      t: "token",
    },
  },
  docs: {
    brief: "Publish plugin to registry",
    description:
      "Publish an Obsidian plugin to an OCI registry. Replaces the old register/update commands.",
    customUsage: [
      "shard publish ./dist ghcr.io/user/my-plugin",
      "shard publish ./build ghcr.io/user/my-plugin:1.0.0",
      "shard publish ./dist ghcr.io/user/my-plugin --token ghp_xxx",
    ],
  },
});
