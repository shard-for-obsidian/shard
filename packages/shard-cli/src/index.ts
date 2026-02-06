import { parseArgs } from "node:util";
import { pushCommand } from "./commands/push.js";
import { pullCommand } from "./commands/pull.js";
import { convertCommand } from "./commands/convert.js";
import {
  marketplaceRegisterCommand,
  marketplaceListCommand,
  marketplaceSearchCommand,
  marketplaceInfoCommand,
  marketplaceInstallCommand,
  marketplaceUpdateCommand,
  marketplaceVersionsCommand,
} from "./commands/marketplace.js";
import { resolveAuthToken } from "./lib/auth.js";
import { Logger } from "./lib/logger.js";
import { NodeFetchAdapter } from "./adapters/node-fetch-adapter.js";

const USAGE = `
Usage: shard <command> [options]

Commands:
  push <directory> <repository>     Push a plugin to GHCR
  pull <repository>                 Pull a plugin from GHCR
  convert <plugin-id> <repository>  Convert legacy plugin to OCI format
  marketplace <subcommand>          Manage marketplace plugins

Marketplace Subcommands:
  list                              List all marketplace plugins
  search <keyword>                  Search for plugins
  info <plugin-id>                  Show detailed plugin information
  install <plugin-id>               Install a plugin by ID
  register <repository>             Register plugin to marketplace
  update <repository>               Update marketplace entry
  versions <registryUrl>            List all available versions for a plugin

Push Options:
  <directory>                       Path to plugin build output (e.g., ./dist)
  <repository>                      GHCR repository (e.g., ghcr.io/user/plugin)
  --token <pat>                     GitHub Personal Access Token
  --json                            Output JSON result to stdout
  --help                            Show help

Pull Options:
  <repository>                      Full reference with tag (e.g., ghcr.io/user/plugin:1.0.0)
  --output <dir>                    Where to extract files (required)
  --token <pat>                     GitHub Personal Access Token
  --json                            Output JSON result to stdout
  --help                            Show help

Convert Options:
  <plugin-id>                       Plugin ID from community list (e.g., obsidian-git)
  <repository>                      GHCR repository (e.g., ghcr.io/user/plugin)
  --version <version>               Specific version to convert (defaults to latest)
  --token <pat>                     GitHub Personal Access Token
  --json                            Output JSON result to stdout
  --help                            Show help

Marketplace Options:
  --output <dir>                    Output directory for install command
  --version <version>               Specific version to install (defaults to latest)
  --token <pat>                     GitHub Personal Access Token
  --json                            Output JSON result to stdout
  --help                            Show help

Environment Variables:
  GITHUB_TOKEN                      GitHub token (alternative to --token)
  GH_TOKEN                          GitHub token (gh CLI compatibility)

Examples:
  shard push ./dist ghcr.io/user/my-plugin
  shard pull ghcr.io/user/my-plugin:1.0.0 --output ./plugin
  shard convert obsidian-git ghcr.io/user/obsidian-git
  shard convert calendar ghcr.io/user/calendar --version 1.5.3
  shard marketplace list
  shard marketplace search "calendar"
  shard marketplace info obsidian-git
  shard marketplace install obsidian-git --output ./plugins/obsidian-git
  shard marketplace register ghcr.io/user/my-plugin:1.0.0
  shard marketplace update ghcr.io/user/my-plugin:1.0.1
  shard marketplace versions ghcr.io/user/my-plugin
`;

interface CliArgs {
  values: {
    token?: string;
    json?: boolean;
    help?: boolean;
    output?: string;
    version?: string;
  };
  positionals: string[];
}

async function main() {
  // Parse command line arguments
  let args: CliArgs;
  try {
    args = parseArgs({
      options: {
        token: { type: "string" },
        json: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
        output: { type: "string" },
        version: { type: "string" },
      },
      allowPositionals: true,
    }) as CliArgs;
  } catch (err) {
    console.error(
      `Error parsing arguments: ${err instanceof Error ? err.message : String(err)}`,
    );
    console.error(USAGE);
    process.exit(1);
  }

  // Show help
  if (args.values.help || args.positionals.length === 0) {
    console.log(USAGE);
    process.exit(0);
  }

  // Get command
  const command = args.positionals[0];
  const logger = new Logger(args.values.json);
  const adapter = new NodeFetchAdapter();

  try {
    if (command === "push") {
      // Parse push arguments
      if (args.positionals.length < 3) {
        throw new Error("Push command requires <directory> and <repository>");
      }

      const directory = args.positionals[1];
      const repository = args.positionals[2];
      const token = resolveAuthToken(args.values.token);

      // Execute push
      const result = await pushCommand({
        directory,
        repository,
        token,
        logger,
        adapter,
      });

      // Output result
      if (args.values.json) {
        console.log(JSON.stringify(result, null, 2));
      }
      process.exit(0);
    } else if (command === "pull") {
      // Parse pull arguments
      if (args.positionals.length < 2) {
        throw new Error("Pull command requires <repository>");
      }

      if (!args.values.output) {
        throw new Error("Pull command requires --output flag");
      }

      const repository = args.positionals[1];
      const output = args.values.output;
      const token = resolveAuthToken(args.values.token);

      // Execute pull
      const result = await pullCommand({
        repository,
        output,
        token,
        logger,
        adapter,
      });

      // Output result
      if (args.values.json) {
        console.log(JSON.stringify(result, null, 2));
      }
      process.exit(0);
    } else if (command === "convert") {
      // Parse convert arguments
      if (args.positionals.length < 3) {
        throw new Error(
          "Convert command requires <plugin-id> and <repository>",
        );
      }

      const pluginId = args.positionals[1];
      const repository = args.positionals[2];
      const version = args.values.version;
      const token = resolveAuthToken(args.values.token);

      // Execute convert
      const result = await convertCommand({
        pluginId,
        repository,
        version,
        token,
        logger,
        adapter,
      });

      // Output result
      if (args.values.json) {
        console.log(JSON.stringify(result, null, 2));
      }
      process.exit(0);
    } else if (command === "marketplace") {
      // Parse marketplace subcommand
      const subcommand = args.positionals[1];

      if (!subcommand) {
        throw new Error(
          "Marketplace command requires a subcommand. Available: list, search, info, install, register, update, versions",
        );
      }

      const token = resolveAuthToken(args.values.token);

      if (subcommand === "list") {
        // List all plugins
        const result = await marketplaceListCommand({
          logger,
          adapter,
        });

        if (args.values.json) {
          console.log(JSON.stringify(result, null, 2));
        }
        process.exit(0);
      } else if (subcommand === "search") {
        // Search for plugins
        if (args.positionals.length < 3) {
          throw new Error("Marketplace search command requires <keyword>");
        }

        const keyword = args.positionals[2];
        const result = await marketplaceSearchCommand({
          keyword,
          logger,
          adapter,
        });

        if (args.values.json) {
          console.log(JSON.stringify(result, null, 2));
        }
        process.exit(0);
      } else if (subcommand === "info") {
        // Show plugin info
        if (args.positionals.length < 3) {
          throw new Error("Marketplace info command requires <plugin-id>");
        }

        const pluginId = args.positionals[2];
        const result = await marketplaceInfoCommand({
          pluginId,
          logger,
          adapter,
        });

        if (args.values.json) {
          console.log(JSON.stringify(result, null, 2));
        }
        process.exit(0);
      } else if (subcommand === "install") {
        // Install plugin by ID
        if (args.positionals.length < 3) {
          throw new Error("Marketplace install command requires <plugin-id>");
        }

        if (!args.values.output) {
          throw new Error("Marketplace install command requires --output flag");
        }

        const pluginId = args.positionals[2];
        const output = args.values.output;
        const version = args.values.version;

        const result = await marketplaceInstallCommand({
          pluginId,
          output,
          version,
          token,
          logger,
          adapter,
        });

        if (args.values.json) {
          console.log(JSON.stringify(result, null, 2));
        }
        process.exit(0);
      } else if (subcommand === "register") {
        // Register plugin to marketplace
        if (args.positionals.length < 3) {
          throw new Error("Marketplace register command requires <repository>");
        }

        const repository = args.positionals[2];
        const result = await marketplaceRegisterCommand({
          repository,
          token,
          logger,
          adapter,
        });

        if (args.values.json) {
          console.log(JSON.stringify(result, null, 2));
        }
        process.exit(0);
      } else if (subcommand === "update") {
        // Update marketplace entry
        if (args.positionals.length < 3) {
          throw new Error("Marketplace update command requires <repository>");
        }

        const repository = args.positionals[2];
        const result = await marketplaceUpdateCommand({
          repository,
          token,
          logger,
          adapter,
        });

        if (args.values.json) {
          console.log(JSON.stringify(result, null, 2));
        }
        process.exit(0);
      } else if (subcommand === "versions") {
        // List all available versions for a registry URL
        if (args.positionals.length < 3) {
          throw new Error(
            "Marketplace versions command requires <registryUrl>",
          );
        }

        const registryUrl = args.positionals[2];
        const result = await marketplaceVersionsCommand({
          registryUrl,
          token,
          logger,
          adapter,
        });

        if (args.values.json) {
          console.log(JSON.stringify(result, null, 2));
        }
        process.exit(0);
      } else {
        throw new Error(
          `Unknown marketplace subcommand: ${subcommand}. Available: list, search, info, install, register, update, versions`,
        );
      }
    } else {
      throw new Error(`Unknown command: ${command}`);
    }
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    if (args.values.json) {
      console.log(
        JSON.stringify(
          {
            error: err instanceof Error ? err.message : String(err),
          },
          null,
          2,
        ),
      );
    }
    process.exit(1);
  }
}

void main();
