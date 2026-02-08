import { buildCommand } from "@stricli/core";
import type { AppContext } from "../../infrastructure/context.js";

/**
 * Flags for the completion script command
 */
export interface ScriptFlags {
  json?: boolean;
  verbose?: boolean;
}

/**
 * Generate shell completion script (placeholder)
 */
async function scriptCommand(
  this: AppContext,
  flags: ScriptFlags,
  shell: string,
): Promise<void> {
  const { logger } = this;

  logger.info(`Completion script for ${shell} coming soon!`);
  logger.info(`Supported shells will include: bash, zsh, fish`);
}

/**
 * Build the script command
 */
export const script = buildCommand({
  func: scriptCommand,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Shell type (bash/zsh/fish)",
          parse: String,
        },
      ],
    },
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
    aliases: {},
  },
  docs: {
    brief: "Generate completion script for shell (coming soon)",
    customUsage: [],
  },
});
