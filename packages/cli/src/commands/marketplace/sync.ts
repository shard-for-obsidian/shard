import { buildCommand } from "@stricli/core";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import type { AppContext } from "../../infrastructure/context.js";
import { resolveAuthToken } from "../../lib/auth.js";
import { queryTagMetadata, NodeFetchAdapter } from "@shard-for-obsidian/lib";

/**
 * Flags for the sync command
 */
export interface SyncFlags {
  overwrite?: boolean;
  token?: string;
}

/**
 * Prompt user for y/n confirmation
 */
async function confirmOverwrite(filePath: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await rl.question(
      `File ${filePath} already exists. Overwrite? [y/N] `,
    );
    return answer.toLowerCase() === "y";
  } finally {
    rl.close();
  }
}

/**
 * Extract plugin ID from OCI reference path.
 * e.g. "ghcr.io/user/repo/community-plugins/notebook-navigator" -> "notebook-navigator"
 * e.g. "ghcr.io/user/repo/community-plugins/notebook-navigator:latest" -> "notebook-navigator"
 */
function extractPluginId(reference: string): string {
  // Remove tag if present
  const refWithoutTag = reference.split(":")[0];
  const segments = refWithoutTag.split("/");
  return segments[segments.length - 1];
}

/**
 * Extract registry URL (without tag) from reference
 */
function extractRegistryUrl(reference: string): string {
  return reference.split(":")[0];
}

/**
 * Sync a plugin from OCI registry to a local markdown file
 */
async function syncCommandHandler(
  this: AppContext,
  flags: SyncFlags,
  reference: string,
  outdir: string,
): Promise<void> {
  const { logger, config } = this;

  try {
    // Step 1: Resolve token
    let token = "";
    if (flags.token) {
      token = flags.token;
    } else {
      try {
        token = resolveAuthToken();
      } catch {
        const configToken = await config.get("token");
        if (typeof configToken === "string" && configToken) {
          token = configToken;
        }
        // Token is optional — public registries may not need it
      }
    }

    // Step 2: Parse reference
    const registryUrl = extractRegistryUrl(reference);
    const pluginId = extractPluginId(reference);
    const tag = reference.includes(":") ? reference.split(":")[1] : "latest";

    logger.info(`Fetching manifest for ${registryUrl}:${tag}...`);

    // Step 3: Fetch manifest metadata
    const adapter = new NodeFetchAdapter();
    const metadata = await queryTagMetadata({
      registryUrl,
      tag,
      adapter,
      token,
    });

    const annotations = metadata.annotations;

    // Step 4: Extract annotation values
    const name = annotations["vnd.obsidianmd.plugin.name"] ?? pluginId;
    const introduction = annotations["vnd.obsidianmd.plugin.introduction"] ?? "";
    const repository = annotations["vnd.obsidianmd.plugin.source"] ?? "";
    const description = annotations["vnd.obsidianmd.plugin.description"] ?? "";

    // Step 5: Build markdown content
    const markdown = [
      "---",
      `url: ${registryUrl}`,
      `name: ${JSON.stringify(name)}`,
      `introduction: ${JSON.stringify(introduction)}`,
      `repository: ${repository}`,
      "---",
      description,
      "",
    ].join("\n");

    // Step 6: Write file
    const outPath = path.resolve(outdir, `${pluginId}.md`);

    // Ensure output directory exists
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    // Check if file exists
    if (fs.existsSync(outPath) && !flags.overwrite) {
      const confirmed = await confirmOverwrite(outPath);
      if (!confirmed) {
        logger.info("Skipped.");
        return;
      }
    }

    fs.writeFileSync(outPath, markdown, "utf-8");
    logger.success(`Wrote ${outPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to sync plugin: ${message}`);
    this.process.exit(1);
  }
}

/**
 * Build the sync command
 */
export const sync = buildCommand({
  func: syncCommandHandler,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "OCI reference (e.g., ghcr.io/user/repo/plugin-id)",
          parse: String,
          placeholder: "reference",
        },
        {
          brief: "Output directory for markdown files",
          parse: String,
          placeholder: "outdir",
        },
      ],
    },
    flags: {
      overwrite: {
        kind: "boolean",
        brief: "Overwrite existing files without prompting",
        optional: true,
      },
      token: {
        kind: "parsed",
        parse: String,
        brief: "GitHub token for authentication",
        optional: true,
      },
    },
    aliases: {
      t: "token",
    },
  },
  docs: {
    brief: "Sync a plugin from OCI registry to a local markdown file",
    customUsage: [
      "shard marketplace sync ghcr.io/user/repo/community/my-plugin content/plugins",
      "shard marketplace sync ghcr.io/user/repo/community/my-plugin content/plugins --overwrite",
    ],
  },
});
