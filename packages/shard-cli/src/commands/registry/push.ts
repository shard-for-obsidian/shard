import { buildCommand } from "@stricli/core";
import type { AppContext } from "../../infrastructure/context.js";
import { pushCommand as pushLogic } from "../push-old.js";
import { Logger } from "../../lib/logger.js";

/**
 * Flags for the push command
 */
export interface PushFlags {
  token?: string;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Positional arguments for the push command
 */
export interface PushPositional {
  directory: string;
  repository: string;
}

/**
 * Push an Obsidian plugin to an OCI registry
 */
async function pushCommandHandler(
  this: AppContext,
  flags: PushFlags,
  positional: PushPositional,
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
    const legacyLogger = new Logger();

    // Call the existing push logic
    const result = await pushLogic({
      directory: positional.directory,
      repository: positional.repository,
      token,
      logger: legacyLogger,
      adapter,
    });

    // JSON output mode
    if (flags.json) {
      const output = JSON.stringify(result, null, 2);
      process.stdout.write(output + "\n");
      return;
    }

    // Normal output handled by pushLogic's logger
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to push plugin: ${message}`);
    process.exit(1);
  }
}

/**
 * Build the push command
 */
export const push = buildCommand({
  func: pushCommandHandler,
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
    aliases: {},
  },
  docs: {
    brief: "Push a plugin to an OCI registry",
    customUsage: [],
  },
});
