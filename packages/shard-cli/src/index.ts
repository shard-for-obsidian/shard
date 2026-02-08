#!/usr/bin/env node
import { buildApplication, buildRouteMap, run } from "@stricli/core";
import * as os from "node:os";
import * as path from "node:path";
import { CliLogger } from "./infrastructure/logger.js";
import type { LogMode } from "./infrastructure/logger.js";
import { ConfigService } from "./infrastructure/config.js";
import { createContext } from "./infrastructure/context.js";
import type { AppContext } from "./infrastructure/context.js";
import { NodeFetchAdapter } from "./adapters/node-fetch-adapter.js";
import { list } from "./commands/list.js";

/**
 * Build the application context with shared services
 */
function buildAppContext(mode: LogMode): AppContext {
  // Set up paths
  const homeDir = os.homedir();
  const shardDir = path.join(homeDir, ".shard");
  const configPath = path.join(shardDir, "config.json");
  const logFile = path.join(shardDir, "shard.log");

  // Create shared services
  const logger = new CliLogger({ mode, logFile });
  const config = new ConfigService(configPath);
  const adapter = new NodeFetchAdapter();

  return createContext({ logger, config, adapter });
}

/**
 * Determine log mode from argv
 * We need to do this before stricli parses args so we can initialize logger
 */
function determineLogMode(args: readonly string[]): LogMode {
  if (args.includes("--json")) {
    return "json";
  } else if (args.includes("--verbose")) {
    return "verbose";
  }
  return "normal";
}

/**
 * Shard CLI Application - Root command with subcommands
 */
const routes = buildRouteMap({
  routes: {
    list,
  },
  docs: {
    brief: "Shard CLI - Plugin distribution for Obsidian",
  },
});

const app = buildApplication(routes, {
  name: "shard",
  versionInfo: {
    currentVersion: "0.3.0",
  },
});

// Determine log mode from command line args
const logMode = determineLogMode(process.argv.slice(2));

// Build context with process and our app context
const context = {
  process,
  ...buildAppContext(logMode),
};

// Run the application
await run(app, process.argv.slice(2), context);
