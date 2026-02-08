import { buildCommand } from "@stricli/core";
import type { AppContext } from "../../infrastructure/context.js";

/**
 * Flags for the list command
 */
export interface ListFlags {
  json?: boolean;
  verbose?: boolean;
}

/**
 * List all configuration values
 */
async function listCommandHandler(
  this: AppContext,
  flags: ListFlags,
): Promise<void> {
  const { logger, config } = this;

  try {
    const allConfig = await config.list();

    // JSON output mode
    if (flags.json) {
      const output = JSON.stringify(allConfig, null, 2);
      process.stdout.write(output + "\n");
      return;
    }

    // Normal output mode
    const keys = Object.keys(allConfig);

    if (keys.length === 0) {
      logger.info("No configuration values set.");
      return;
    }

    logger.info("Configuration:\n");

    // Helper to display nested objects with indentation
    const displayValue = (key: string, value: unknown, indent = "") => {
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        logger.info(`${indent}${key}:`);
        for (const [k, v] of Object.entries(value)) {
          displayValue(k, v, indent + "  ");
        }
      } else {
        const displayVal = typeof value === "string" ? value : JSON.stringify(value);
        logger.info(`${indent}${key} = ${displayVal}`);
      }
    };

    for (const key of keys) {
      displayValue(key, allConfig[key]);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to list configuration: ${message}`);
    process.exit(1);
  }
}

/**
 * Build the list command
 */
export const list = buildCommand({
  func: listCommandHandler,
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
    brief: "List all configuration values",
    customUsage: [],
  },
});
