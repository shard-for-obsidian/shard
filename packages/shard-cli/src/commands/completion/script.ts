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
 * Positional arguments for completion script
 */
export interface ScriptPositionals {
  shell: string;
}

/**
 * Generate shell completion script (placeholder)
 */
async function scriptCommand(
  this: AppContext,
  flags: ScriptFlags,
  { shell }: ScriptPositionals,
): Promise<void> {
  const { logger } = this;

  logger.info(`Completion script for ${shell} coming soon!`);
  logger.info(`Supported shells will include: bash, zsh, fish`);
}

/**
 * Build the script command
 */
export const script = buildCommand({
  loader: async () => scriptCommand,
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
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Shell type (bash/zsh/fish)",
          parse: String,
        },
      ],
    },
  },
  docs: {
    brief: "Generate completion script for shell (coming soon)",
  },
});
