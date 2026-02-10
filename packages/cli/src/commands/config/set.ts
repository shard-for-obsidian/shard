import { buildCommand } from "@stricli/core";
import type { AppContext } from "../../infrastructure/context.js";
import { normalizeNamespace } from "../../lib/namespace.js";

/**
 * Flags for the set command
 */
export interface SetFlags {
  json?: boolean;
  verbose?: boolean;
}

/**
 * Set a configuration value by key
 */
async function setCommandHandler(
  this: AppContext,
  flags: SetFlags,
  key: string,
  value: string,
): Promise<void> {
  const { logger, config } = this;

  try {
    // Try to parse value as JSON for complex types, otherwise use as string
    let parsedValue: unknown = value;

    // Attempt to parse as JSON for booleans, numbers, objects, arrays
    if (
      value === "true" ||
      value === "false" ||
      value === "null" ||
      /^-?\d+(\.\d+)?$/.test(value) ||
      value.startsWith("{") ||
      value.startsWith("[")
    ) {
      try {
        parsedValue = JSON.parse(value);
      } catch {
        // If JSON parsing fails, keep as string
        parsedValue = value;
      }
    }

    // Special handling for namespace: normalize and validate
    if (key === "namespace" && typeof parsedValue === "string") {
      parsedValue = normalizeNamespace(parsedValue);
    }

    await config.set(key, parsedValue);

    // JSON output mode
    if (flags.json) {
      const output = JSON.stringify(
        { key, value: parsedValue },
        null,
        2,
      );
      this.process.stdout.write(output + "\n");
      return;
    }

    // Normal output mode
    logger.success(`Set ${key} = ${JSON.stringify(parsedValue)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to set configuration: ${message}`);
    this.process.exit(1);
  }
}

/**
 * Build the set command
 */
export const set = buildCommand({
  func: setCommandHandler,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Configuration key (supports dot notation, e.g., defaults.output)",
          parse: String,
          placeholder: "key",
        },
        {
          brief: "Value to set (auto-parsed for booleans, numbers, JSON)",
          parse: String,
          placeholder: "value",
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
    brief: "Set a configuration value",
    customUsage: [
      "shard config set namespace ghcr.io/owner/repo",
      "shard config set token ghp_xxxxx",
    ],
  },
});
