import { buildCommand } from "@stricli/core";
import * as path from "node:path";
import type { AppContext } from "../infrastructure/context.js";
import { verifyPlugin } from "../lib/verify.js";
import { DEFAULT_NAMESPACE } from "../lib/namespace.js";

/**
 * Flags for the verify command
 */
export interface VerifyFlags {
  namespace?: string;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Verify a locally installed plugin against its OCI registry source
 */
async function verifyCommand(
  this: AppContext,
  flags: VerifyFlags,
  pluginDirectory: string,
): Promise<void> {
  const { logger, config, adapter } = this;

  try {
    // Resolve the plugin directory to an absolute path
    const absolutePluginDir = path.resolve(pluginDirectory);

    // Use provided namespace or fall back to default
    const namespace = flags.namespace ?? DEFAULT_NAMESPACE;

    // Get token from config
    const token = await config.get("token");
    if (!token || typeof token !== "string") {
      logger.error("No authentication token found. Please run 'shard login'");
      this.process.exit(1);
    }

    // Perform verification
    logger.info(`Verifying plugin in ${absolutePluginDir}...`);
    const result = await verifyPlugin({
      pluginDirectory: absolutePluginDir,
      namespace,
      adapter,
      token,
    });

    // JSON output mode
    if (flags.json) {
      const output = JSON.stringify(result, null, 2);
      this.process.stdout.write(output + "\n");
      return;
    }

    // Normal output mode - rich formatted display
    logger.info("\n" + "=".repeat(60));
    logger.info("Verification Results");
    logger.info("=".repeat(60) + "\n");

    logger.info(`Plugin ID: ${result.pluginId}`);
    logger.info(`Version: ${result.version}`);
    logger.info(`Repository: ${result.repository}`);
    logger.info(
      `Overall Status: ${result.verified ? "VERIFIED ✓" : "FAILED ✗"}`,
    );

    logger.info("\n" + "=".repeat(60));
    logger.info("File Verification Details");
    logger.info("=".repeat(60) + "\n");

    for (const file of result.files) {
      const status = file.verified ? "✓ PASS" : "✗ FAIL";
      logger.info(`${status} ${file.filename}`);

      if (flags.verbose || !file.verified) {
        if (file.error) {
          logger.error(`  Error: ${file.error}`);
        } else {
          if (file.localHash) {
            logger.info(`  Local:    ${file.localHash}`);
          }
          if (file.expectedHash) {
            logger.info(`  Expected: ${file.expectedHash}`);
          }
        }
      }
    }

    logger.info("\n" + "=".repeat(60));

    if (result.verified) {
      logger.info(
        "All files verified successfully. Plugin integrity confirmed.",
      );
    } else {
      logger.error(
        "Verification failed. One or more files do not match the registry.",
      );
      logger.error(
        "This may indicate file corruption or tampering. Consider reinstalling the plugin.",
      );
      this.process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Verification failed: ${message}`);

    if (flags.verbose && error instanceof Error && error.stack) {
      logger.error(`Stack trace:\n${error.stack}`);
    }

    this.process.exit(1);
  }
}

/**
 * Build the verify command
 */
export const verify = buildCommand({
  func: verifyCommand,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Path to the plugin directory to verify",
          parse: String,
        },
      ],
    },
    flags: {
      namespace: {
        kind: "parsed",
        parse: String,
        brief: "OCI registry namespace (e.g., ghcr.io/user)",
        optional: true,
      },
      json: {
        kind: "boolean",
        brief: "Output JSON instead of human-readable format",
        optional: true,
      },
      verbose: {
        kind: "boolean",
        brief: "Show detailed hash information for all files",
        optional: true,
      },
    },
    aliases: {},
  },
  docs: {
    brief: "Verify a locally installed plugin against its OCI registry source",
    customUsage: [
      "shard verify ~/.obsidian/plugins/my-plugin",
      "shard verify ./plugin-dir --namespace ghcr.io/myorg",
      "shard verify ./plugin-dir --verbose",
      "shard verify ./plugin-dir --json",
    ],
  },
});
