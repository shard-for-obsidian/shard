import { buildCommand } from "@stricli/core";
import type { AppContext } from "../../infrastructure/context.js";
import { pullCommand as pullLogic } from "../pull.js";
import { Logger } from "../../lib/logger.js";

/**
 * Flags for the pull command
 */
export interface PullFlags {
  output?: string;
  token?: string;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Pull an Obsidian plugin from an OCI registry
 */
async function pullCommandHandler(
  this: AppContext,
  flags: PullFlags,
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

    // Output directory resolution: flag > config default > current directory
    const output =
      flags.output ||
      ((await config.get("defaults.output")) as string | undefined) ||
      ".";

    // Create a Logger instance for the pull logic
    const legacyLogger = new Logger();

    // Call the existing pull logic
    const result = await pullLogic({
      repository,
      output,
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

    // Normal output handled by pullLogic's logger
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to pull plugin: ${message}`);
    process.exit(1);
  }
}

/**
 * Build the pull command
 */
export const pull = buildCommand({
  func: pullCommandHandler,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "OCI repository with tag or digest (e.g., ghcr.io/owner/repo:tag)",
          parse: String,
          placeholder: "repository",
        },
      ],
    },
    flags: {
      output: {
        kind: "parsed",
        parse: String,
        brief: "Output directory for extracted plugin files",
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
    brief: "Pull a plugin from an OCI registry",
    customUsage: [],
  },
});
