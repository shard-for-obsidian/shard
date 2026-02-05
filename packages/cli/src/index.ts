import { parseArgs } from "node:util";
import { pushCommand } from "./commands/push.js";
import { pullCommand } from "./commands/pull.js";
import { resolveAuthToken } from "./lib/auth.js";
import { Logger } from "./lib/logger.js";
import { NodeFetchAdapter } from "./adapters/node-fetch-adapter.js";

const USAGE = `
Usage: obsidian-plugin <command> [options]

Commands:
  push <directory> <repository>   Push a plugin to GHCR
  pull <repository>               Pull a plugin from GHCR

Push Options:
  <directory>                     Path to plugin build output (e.g., ./dist)
  <repository>                    GHCR repository (e.g., ghcr.io/user/plugin)
  --token <pat>                   GitHub Personal Access Token
  --json                          Output JSON result to stdout
  --help                          Show help

Pull Options:
  <repository>                    Full reference with tag (e.g., ghcr.io/user/plugin:1.0.0)
  --output <dir>                  Where to extract files (required)
  --token <pat>                   GitHub Personal Access Token
  --json                          Output JSON result to stdout
  --help                          Show help

Environment Variables:
  GITHUB_TOKEN                    GitHub token (alternative to --token)
  GH_TOKEN                        GitHub token (gh CLI compatibility)

Examples:
  obsidian-plugin push ./dist ghcr.io/user/my-plugin
  obsidian-plugin pull ghcr.io/user/my-plugin:1.0.0 --output ./plugin
`;

interface CliArgs {
  values: {
    token?: string;
    json?: boolean;
    help?: boolean;
    output?: string;
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
