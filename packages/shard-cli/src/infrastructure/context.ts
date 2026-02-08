import type { CliLogger } from "./logger.js";
import type { ConfigService } from "./config.js";

/**
 * Adapter interface for OCI operations
 * This will be implemented by the OCI adapter
 */
export interface Adapter {
  // Placeholder - actual adapter methods will be defined later
  // when implementing OCI operations
}

/**
 * Application context containing shared services and configuration
 * This is passed to all commands and provides access to:
 * - Logger: For output and logging
 * - Config: For persistent configuration
 * - Adapter: For OCI registry operations
 */
export interface AppContext {
  logger: CliLogger;
  config: ConfigService;
  adapter: Adapter;
}

/**
 * Factory function to create application context
 * This centralizes the creation of all shared services
 */
export function createContext(options: {
  logger: CliLogger;
  config: ConfigService;
  adapter: Adapter;
}): AppContext {
  return {
    logger: options.logger,
    config: options.config,
    adapter: options.adapter,
  };
}
