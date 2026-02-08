import { buildCommand } from "@stricli/core";
import type { AppContext } from "../../infrastructure/context.js";

/**
 * Flags for the push command
 */
export interface PushFlags {
  token?: string;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Push an Obsidian plugin to an OCI registry (placeholder)
 */
async function pushCommandHandler(
  this: AppContext,
  flags: PushFlags,
  directory: string,
  repository: string,
): Promise<void> {
  const { logger } = this;

  logger.info("Push command implementation coming soon!");
  logger.info(`Would push from: ${directory}`);
  logger.info(`To repository: ${repository}`);
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
        optional: true,
      },
      verbose: {
        kind: "boolean",
        brief: "Show detailed output",
        optional: true,
      },
    },
    aliases: {},
  },
  docs: {
    brief: "Push a plugin to an OCI registry",
    customUsage: [],
  },
});
