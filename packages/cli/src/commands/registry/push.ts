import { buildCommand } from "@stricli/core";
import type { AppContext } from "../../infrastructure/context.js";
import { resolveAuthToken } from "../../lib/auth.js";
import { OciRegistryClient, parseRepoAndRef } from "@shard-for-obsidian/lib";
import type {
  ManifestOCIDescriptor,
  ObsidianManifest,
} from "@shard-for-obsidian/lib";
import { manifestToAnnotationsLegacy } from "@shard-for-obsidian/lib/schemas";
import { discoverPlugin } from "../../lib/plugin.js";

/**
 * Flags for the push command
 */
export interface PushFlags {
  token?: string;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Result returned by the push command
 */
export interface PushResult {
  digest: string;
  tag: string;
  size: number;
  repository: string;
}

/**
 * Derive GitHub repository URL from registry remote name.
 * Takes the first two path components to form owner/repo.
 */
function deriveGitHubUrl(remoteName: string): string {
  const parts = remoteName.split("/");
  if (parts.length < 2) {
    throw new Error(
      `Cannot derive GitHub URL from ${remoteName}. Need at least owner/repo format.`,
    );
  }

  const owner = parts[0];
  const repo = parts[1];
  return `https://github.com/${owner}/${repo}`;
}

/**
 * Push an Obsidian plugin to an OCI registry
 */
async function pushCommandHandler(
  this: AppContext,
  flags: PushFlags,
  directory: string,
  repository: string,
): Promise<void> {
  const { logger, adapter, config } = this;

  try {
    // Step 1: Resolve authentication token
    let token: string;
    try {
      if (flags.token) {
        token = flags.token;
      } else {
        try {
          token = resolveAuthToken();
        } catch {
          const configToken = await config.get("token");
          if (typeof configToken === "string" && configToken) {
            token = configToken;
          } else {
            throw new Error("No token found");
          }
        }
      }
    } catch {
      logger.error(
        "GitHub token required. Use --token flag, set GITHUB_TOKEN environment variable, or configure with: shard config set token <token>",
      );
      this.process.exit(1);
    }

    // Step 2: Discover plugin files
    logger.info(`Discovering plugin files in ${directory}...`);
    const plugin = await discoverPlugin(directory);
    const version = plugin.manifest.parsed.version;
    logger.info(`Found plugin version ${version}`);

    // Step 3: Parse repository and add version tag
    const fullRef = repository.includes(":") ? repository : `${repository}:${version}`;
    logger.info(`Pushing to ${fullRef}...`);

    const ref = parseRepoAndRef(fullRef);
    const client = new OciRegistryClient({
      repo: ref,
      username: "github",
      password: token,
      adapter,
      scopes: ["push", "pull"],
    });

    // Step 4: Push each file as a blob
    const layers: ManifestOCIDescriptor[] = [];

    // Push main.js
    logger.info("Pushing main.js...");
    const mainJsResult = await client.pushBlob({
      data: plugin.mainJs.content,
    });
    layers.push({
      mediaType: "application/javascript",
      digest: mainJsResult.digest,
      size: mainJsResult.size,
      annotations: {
        "vnd.obsidianmd.layer.filename": "main.js",
      },
    });
    logger.debug(
      `Pushed main.js: ${mainJsResult.digest.slice(0, 19)}... (${mainJsResult.size} bytes)`,
    );

    // Push styles.css if present
    if (plugin.stylesCss) {
      logger.info("Pushing styles.css...");
      const stylesCssResult = await client.pushBlob({
        data: plugin.stylesCss.content,
      });
      layers.push({
        mediaType: "text/css",
        digest: stylesCssResult.digest,
        size: stylesCssResult.size,
        annotations: {
          "vnd.obsidianmd.layer.filename": "styles.css",
        },
      });
      logger.debug(
        `Pushed styles.css: ${stylesCssResult.digest.slice(0, 19)}... (${stylesCssResult.size} bytes)`,
      );
    }

    // Step 5: Derive GitHub URL and prepare annotations
    const githubUrl = deriveGitHubUrl(ref.remoteName);
    const manifest = plugin.manifest.parsed;

    // Extract owner/repo from remoteName
    const repoParts = ref.remoteName.split("/");
    const ownerRepo = `${repoParts[0]}/${repoParts[1]}`;

    // Use manifestToAnnotationsLegacy to create annotations with VCS URL format
    const annotations = manifestToAnnotationsLegacy(manifest, ownerRepo, repository);

    // Step 6: Push plugin manifest
    logger.info("Pushing plugin manifest...");
    const manifestPushResult = await client.pushPluginManifest({
      ref: ref.tag || version,
      pluginManifest: manifest as unknown as ObsidianManifest,
      layers,
      annotations,
    });

    logger.success(`Successfully pushed ${fullRef}`);
    logger.info(`Manifest digest: ${manifestPushResult.digest}`);
    logger.info(`GitHub repository: ${githubUrl}`);

    // Calculate total size
    const totalSize = manifestPushResult.manifest.layers.reduce(
      (sum, layer) => sum + layer.size,
      0,
    );

    // Step 7: JSON output if requested
    if (flags.json) {
      const result: PushResult = {
        digest: manifestPushResult.digest,
        tag: ref.tag || version,
        size: totalSize,
        repository: fullRef,
      };
      this.process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to push plugin: ${message}`);
    this.process.exit(1);
  }
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
    aliases: {
      t: "token",
    },
  },
  docs: {
    brief: "Push a plugin to an OCI registry",
    customUsage: [
      "shard registry push ./dist ghcr.io/user/my-plugin",
      "shard registry push ./dist ghcr.io/user/my-plugin:1.0.0",
    ],
  },
});
