import type { CliLogger } from "./logger.js";
import type { ConfigService } from "./config.js";
import type { FetchAdapter } from "@shard-for-obsidian/lib";

/**
 * Application context containing shared services and configuration
 * This is passed to all commands and provides access to:
 * - Logger: For output and logging
 * - Config: For persistent configuration
 * - Adapter: For OCI registry operations
 * - Process: For process-level operations (exit codes, stdio)
 */
export interface AppContext {
  logger: CliLogger;
  config: ConfigService;
  adapter: FetchAdapter;
  process: NodeJS.Process;
}

/**
 * Factory function to create application context
 * This centralizes the creation of all shared services
 */
export function createContext(options: {
  logger: CliLogger;
  config: ConfigService;
  adapter: FetchAdapter;
}): AppContext {
  return {
    logger: options.logger,
    config: options.config,
    adapter: options.adapter,
    process,
  };
}
