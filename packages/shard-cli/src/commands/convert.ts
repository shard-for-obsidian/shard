import type { FetchAdapter } from "shard-lib";
import { PluginConverter } from "../lib/converter.js";
import { Logger } from "../lib/logger.js";

export interface ConvertOptions {
  pluginId: string;
  repository: string;
  version?: string;
  token: string;
  logger: Logger;
  adapter: FetchAdapter;
}

export interface ConvertResult {
  pluginId: string;
  version: string;
  repository: string;
  digest: string;
  size: number;
}

/**
 * Convert a legacy Obsidian plugin from GitHub releases to OCI format.
 *
 * @param opts - Convert options
 * @returns Convert result with digest and repository
 */
export async function convertCommand(
  opts: ConvertOptions,
): Promise<ConvertResult> {
  const { pluginId, repository, version, token, logger, adapter } = opts;

  // Step 1: Create converter
  const converter = new PluginConverter(adapter);

  // Step 2: Convert plugin from GitHub releases
  logger.log(`Converting plugin "${pluginId}"...`);
  if (version) {
    logger.log(`Using specific version: ${version}`);
  } else {
    logger.log("Using latest version");
  }

  const convertResult = await converter.convertPlugin({
    pluginId,
    version,
    repository,
    token,
  });

  logger.log(
    `Downloaded plugin ${convertResult.pluginId} v${convertResult.version}`,
  );
  logger.log(`  - manifest.json: ${convertResult.manifest.name}`);
  logger.log(`  - main.js: ${convertResult.mainJs.length} bytes`);
  if (convertResult.stylesCss) {
    logger.log(`  - styles.css: ${convertResult.stylesCss.length} bytes`);
  }

  // Step 3: Push to OCI registry
  logger.log(`\nPushing to ${convertResult.repository}...`);
  const pushResult = await converter.pushToRegistry({
    repository: convertResult.repository,
    githubRepo: convertResult.githubRepo,
    token,
    pluginData: {
      manifest: convertResult.manifest,
      mainJs: convertResult.mainJs,
      stylesCss: convertResult.stylesCss,
    },
  });

  logger.success(
    `Successfully converted and pushed ${convertResult.pluginId} v${convertResult.version}`,
  );
  logger.log(`Manifest digest: ${pushResult.digest}`);
  logger.log(`Repository: ${pushResult.repository}`);

  return {
    pluginId: convertResult.pluginId,
    version: convertResult.version,
    repository: pushResult.repository,
    digest: pushResult.digest,
    size: pushResult.size,
  };
}
