import { buildCommand } from "@stricli/core";
import type { AppContext } from "../../infrastructure/context.js";

/**
 * Flags for the completion install command
 */
export interface InstallFlags {
  json?: boolean;
  verbose?: boolean;
}

/**
 * Install shell completion (placeholder)
 */
async function installCommand(
  this: AppContext,
  flags: InstallFlags,
): Promise<void> {
  const { logger } = this;

  logger.info("Shell completion installation coming soon!");
  logger.info("For now, you can use: shard completion script <shell>");
}

/**
 * Build the install command
 */
export const install = buildCommand({
  loader: async () => installCommand,
  parameters: {
    flags: {
      json: {
        kind: "boolean",
        brief: "Output JSON format",
        optional: true,
      },
      verbose: {
        kind: "boolean",
        brief: "Enable verbose output",
        optional: true,
      },
    },
  },
  docs: {
    brief: "Install shell completion (coming soon)",
  },
});
