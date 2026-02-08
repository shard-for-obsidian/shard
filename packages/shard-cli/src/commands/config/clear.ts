import { buildCommand } from "@stricli/core";
import type { AppContext } from "../../infrastructure/context.js";

/**
 * Flags for the clear command
 */
export interface ClearFlags {
  json?: boolean;
  verbose?: boolean;
}

/**
 * Clear all configuration values
 */
async function clearCommandHandler(
  this: AppContext,
  flags: ClearFlags,
): Promise<void> {
  const { logger, config } = this;

  try {
    await config.clear();

    // JSON output mode
    if (flags.json) {
      const output = JSON.stringify({ success: true, message: "Configuration cleared" }, null, 2);
      process.stdout.write(output + "\n");
      return;
    }

    // Normal output mode
    logger.success("Configuration cleared successfully.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to clear configuration: ${message}`);
    process.exit(1);
  }
}

/**
 * Build the clear command
 */
export const clear = buildCommand({
  func: clearCommandHandler,
  parameters: {
    positional: { kind: "tuple", parameters: [] },
    flags: {
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
    brief: "Clear all configuration values",
    customUsage: [],
  },
});
