import { buildCommand } from "@stricli/core";
import type { AppContext } from "../../infrastructure/context.js";

/**
 * Flags for the get command
 */
export interface GetFlags {
  json?: boolean;
  verbose?: boolean;
}

/**
 * Get a configuration value by key
 */
async function getCommandHandler(
  this: AppContext,
  flags: GetFlags,
  key: string,
): Promise<void> {
  const { logger, config } = this;

  try {
    const value = await config.get(key);

    if (value === undefined) {
      if (!flags.json) {
        logger.warn(`Configuration key "${key}" not found`);
      }
      this.process.exit(1);
    }

    // JSON output mode
    if (flags.json) {
      const output = JSON.stringify({ key, value }, null, 2);
      this.process.stdout.write(output + "\n");
      return;
    }

    // Normal output mode
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      logger.info(String(value));
    } else {
      // For complex values, pretty-print as JSON
      logger.info(JSON.stringify(value, null, 2));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to get configuration: ${message}`);
    this.process.exit(1);
  }
}

/**
 * Build the get command
 */
export const get = buildCommand({
  func: getCommandHandler,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Configuration key (supports dot notation, e.g., defaults.output)",
          parse: String,
          placeholder: "key",
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
        brief: "Show detailed output",
        optional: true,
      },
    },
    aliases: {},
  },
  docs: {
    brief: "Get a configuration value",
    customUsage: [],
  },
});
