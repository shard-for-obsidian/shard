import { buildCommand } from "@stricli/core";
import type { AppContext } from "../../infrastructure/context.js";
import { queryOciTags, queryTagMetadata } from "../../lib/oci-tags.js";

/**
 * Flags for the versions command
 */
export interface VersionsFlags {
  token?: string;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Version information with metadata
 */
interface VersionInfo {
  tag: string;
  publishedAt: string;
  size: number;
  annotations: Record<string, string>;
}

/**
 * List all versions of a plugin in an OCI registry
 */
async function versionsCommandHandler(
  this: AppContext,
  flags: VersionsFlags,
  registryUrl: string,
): Promise<void> {
  const { logger, config, adapter } = this;

  try {
    // Token resolution: flag > env > config (optional for public repos)
    const token =
      flags.token ||
      process.env.GITHUB_TOKEN ||
      ((await config.get("token")) as string | undefined);

    logger.info(`Querying versions for ${registryUrl}...`);

    // Step 1: Get all tags
    const tags = await queryOciTags({
      registryUrl,
      adapter,
      token,
    });

    if (tags.length === 0) {
      logger.info("No versions found.");
      return;
    }

    // Step 2: Get metadata for each tag
    const versions: VersionInfo[] = [];

    for (const tag of tags) {
      try {
        const metadata = await queryTagMetadata({
          registryUrl,
          tag,
          adapter,
          token,
        });

        versions.push({
          tag,
          ...metadata,
        });
      } catch (error) {
        // Skip tags that fail to fetch metadata
        logger.warn(`Failed to fetch metadata for tag ${tag}`);
      }
    }

    // JSON output mode
    if (flags.json) {
      const output = JSON.stringify(versions, null, 2);
      process.stdout.write(output + "\n");
      return;
    }

    // Normal output mode
    logger.info(`\nFound ${versions.length} version(s):\n`);

    for (const version of versions) {
      logger.info(`Version: ${version.tag}`);
      logger.info(`  Published: ${version.publishedAt}`);
      logger.info(`  Size: ${version.size} bytes`);

      // Show annotations in verbose mode
      if (flags.verbose && Object.keys(version.annotations).length > 0) {
        logger.info("  Annotations:");
        for (const [key, value] of Object.entries(version.annotations)) {
          logger.info(`    ${key}: ${value}`);
        }
      }

      logger.info("");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to list versions: ${message}`);
    process.exit(1);
  }
}

/**
 * Build the versions command
 */
export const versions = buildCommand({
  func: versionsCommandHandler,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "OCI registry URL (e.g., ghcr.io/owner/repo)",
          parse: String,
          placeholder: "registry-url",
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
        default: false,
      },
      verbose: {
        kind: "boolean",
        brief: "Show additional version details including annotations",
        default: false,
      },
    },
    aliases: {},
  },
  docs: {
    brief: "List all versions of a plugin in an OCI registry",
    customUsage: [],
  },
});
