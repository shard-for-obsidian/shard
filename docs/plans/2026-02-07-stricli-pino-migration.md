# Stricli and Pino Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate CLI from manual parseArgs to stricli framework and replace console logging with pino structured logging for v0.3.0.

**Architecture:** Four-layer architecture (entry point, commands, services, infrastructure). Commands use stricli's buildCommand with type-safe definitions. Logger wraps pino with three modes (normal/json/verbose). Config service manages ~/.shard/config.json.

**Tech Stack:** @stricli/core, pino, pino-pretty, ora (spinners), cli-progress (progress bars)

---

## Phase 1: Foundation

### Task 1: Install Dependencies and Configure TypeScript

**Files:**

- Modify: `packages/shard-cli/package.json`
- Modify: `packages/shard-cli/tsconfig.json`

**Step 1: Add dependencies to package.json**

```bash
cd packages/shard-cli
pnpm add @stricli/core pino
pnpm add -D pino-pretty ora cli-progress @types/cli-progress
```

**Step 2: Enable TypeScript strict mode**

Edit `packages/shard-cli/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "rootDir": "src",
    "outDir": "dist",
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Verify build still works**

Run: `pnpm build`
Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json
git commit -m "build: add stricli, pino, ora, cli-progress dependencies and enable strict mode"
```

---

### Task 2: Create Infrastructure Directory Structure

**Files:**

- Create: `packages/shard-cli/src/infrastructure/logger.ts`
- Create: `packages/shard-cli/src/infrastructure/config.ts`
- Create: `packages/shard-cli/src/infrastructure/context.ts`
- Create: `packages/shard-cli/src/infrastructure/progress.ts`

**Step 1: Create infrastructure directory**

```bash
mkdir -p packages/shard-cli/src/infrastructure
```

**Step 2: Create empty infrastructure files**

```bash
touch packages/shard-cli/src/infrastructure/logger.ts
touch packages/shard-cli/src/infrastructure/config.ts
touch packages/shard-cli/src/infrastructure/context.ts
touch packages/shard-cli/src/infrastructure/progress.ts
```

**Step 3: Verify build still works**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/infrastructure/
git commit -m "chore: create infrastructure directory structure"
```

---

### Task 3: Implement Config Service

**Files:**

- Create: `packages/shard-cli/src/infrastructure/__tests__/config.test.ts`
- Modify: `packages/shard-cli/src/infrastructure/config.ts`

**Step 1: Write failing test for config service**

Create `packages/shard-cli/src/infrastructure/__tests__/config.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { ConfigService } from "../config.js";

describe("ConfigService", () => {
  let tmpDir: string;
  let configPath: string;
  let config: ConfigService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "shard-config-test-"));
    configPath = path.join(tmpDir, "config.json");
    config = new ConfigService(configPath);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should create config file on first write", async () => {
    await config.set("token", "test-token");
    const exists = await fs
      .access(configPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it("should get and set values", async () => {
    await config.set("token", "test-token");
    const value = await config.get("token");
    expect(value).toBe("test-token");
  });

  it("should return undefined for missing keys", async () => {
    const value = await config.get("nonexistent");
    expect(value).toBeUndefined();
  });

  it("should support nested keys with dot notation", async () => {
    await config.set("defaults.output", "./plugins");
    const value = await config.get("defaults.output");
    expect(value).toBe("./plugins");
  });

  it("should list all config", async () => {
    await config.set("token", "test-token");
    await config.set("defaults.output", "./plugins");
    const all = await config.list();
    expect(all).toEqual({
      token: "test-token",
      defaults: { output: "./plugins" },
    });
  });

  it("should clear all config", async () => {
    await config.set("token", "test-token");
    await config.clear();
    const all = await config.list();
    expect(all).toEqual({});
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- config.test.ts`
Expected: FAIL with "Cannot find module '../config.js'"

**Step 3: Implement ConfigService**

Edit `packages/shard-cli/src/infrastructure/config.ts`:

```typescript
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

export interface Config {
  token?: string;
  defaults?: {
    output?: string;
    marketplaceUrl?: string;
  };
  registry?: {
    defaultRegistry?: string;
  };
  logging?: {
    level?: string;
    file?: string;
  };
}

export class ConfigService {
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath =
      configPath ?? path.join(os.homedir(), ".shard", "config.json");
  }

  async get(key: string): Promise<string | undefined> {
    const config = await this.load();
    return this.getNestedValue(config, key);
  }

  async set(key: string, value: string): Promise<void> {
    const config = await this.load();
    this.setNestedValue(config, key, value);
    await this.save(config);
  }

  async list(): Promise<Config> {
    return await this.load();
  }

  async clear(): Promise<void> {
    await this.save({});
  }

  private async load(): Promise<Config> {
    try {
      const content = await fs.readFile(this.configPath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {};
      }
      throw error;
    }
  }

  private async save(config: Config): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.configPath,
      JSON.stringify(config, null, 2),
      "utf-8",
    );
  }

  private getNestedValue(obj: any, key: string): string | undefined {
    const keys = key.split(".");
    let current = obj;
    for (const k of keys) {
      if (current && typeof current === "object" && k in current) {
        current = current[k];
      } else {
        return undefined;
      }
    }
    return current;
  }

  private setNestedValue(obj: any, key: string, value: string): void {
    const keys = key.split(".");
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== "object") {
        current[k] = {};
      }
      current = current[k];
    }
    current[keys[keys.length - 1]] = value;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- config.test.ts`
Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add src/infrastructure/config.ts src/infrastructure/__tests__/config.test.ts
git commit -m "feat(infrastructure): implement ConfigService with tests"
```

---

### Task 4: Implement Logger Service

**Files:**

- Create: `packages/shard-cli/src/infrastructure/__tests__/logger.test.ts`
- Modify: `packages/shard-cli/src/infrastructure/logger.ts`

**Step 1: Write failing test for logger service**

Create `packages/shard-cli/src/infrastructure/__tests__/logger.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CliLogger } from "../logger.js";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

describe("CliLogger", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let tmpLogFile: string;

  beforeEach(async () => {
    stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    tmpLogFile = path.join(os.tmpdir(), `shard-test-${Date.now()}.log`);
  });

  afterEach(async () => {
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
    await fs.rm(tmpLogFile, { force: true });
  });

  describe("normal mode", () => {
    it("should output to stderr", () => {
      const logger = new CliLogger({ mode: "normal", logFile: tmpLogFile });
      logger.info("test message");
      expect(stderrSpy).toHaveBeenCalled();
    });

    it("should format success messages", () => {
      const logger = new CliLogger({ mode: "normal", logFile: tmpLogFile });
      logger.success("operation complete");
      const output = stderrSpy.mock.calls[0][0] as string;
      expect(output).toContain("✓");
      expect(output).toContain("operation complete");
    });

    it("should format error messages", () => {
      const logger = new CliLogger({ mode: "normal", logFile: tmpLogFile });
      logger.error("something failed");
      const output = stderrSpy.mock.calls[0][0] as string;
      expect(output).toContain("✗");
      expect(output).toContain("something failed");
    });
  });

  describe("json mode", () => {
    it("should suppress stderr output", () => {
      const logger = new CliLogger({ mode: "json", logFile: tmpLogFile });
      logger.info("test message");
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("should not create spinners", () => {
      const logger = new CliLogger({ mode: "json", logFile: tmpLogFile });
      const spinner = logger.spinner("loading");
      expect(spinner).toBeNull();
    });
  });

  describe("verbose mode", () => {
    it("should output debug logs", () => {
      const logger = new CliLogger({ mode: "verbose", logFile: tmpLogFile });
      logger.debug("debug info", { context: "test" });
      expect(stderrSpy).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- logger.test.ts`
Expected: FAIL with "Cannot find module '../logger.js'"

**Step 3: Implement CliLogger**

Edit `packages/shard-cli/src/infrastructure/logger.ts`:

```typescript
import pino from "pino";
import type { Logger as PinoLogger } from "pino";
import * as fs from "node:fs";
import * as path from "node:path";

export type LogMode = "normal" | "json" | "verbose";

export interface CliLoggerOptions {
  mode: LogMode;
  logFile?: string;
}

export interface Spinner {
  text: string;
  succeed(text?: string): void;
  fail(text?: string): void;
  stop(): void;
}

export class CliLogger {
  private pino: PinoLogger;
  private mode: LogMode;

  constructor(options: CliLoggerOptions) {
    this.mode = options.mode;

    const logFile =
      options.logFile ??
      path.join(process.env.HOME ?? "/tmp", ".shard", "logs", "shard.log");

    // Ensure log directory exists
    const logDir = path.dirname(logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Create pino logger that writes to file
    const streams: pino.StreamEntry[] = [
      { stream: fs.createWriteStream(logFile, { flags: "a" }) },
    ];

    // In verbose mode, also log to stderr with pretty print
    if (this.mode === "verbose") {
      streams.push({
        stream: pino.transport({
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
          },
        }),
      });
    }

    this.pino = pino(
      {
        level: this.mode === "verbose" ? "debug" : "info",
      },
      pino.multistream(streams),
    );
  }

  info(message: string): void {
    this.pino.info(message);
    if (this.mode === "normal") {
      process.stderr.write(message + "\n");
    }
  }

  success(message: string): void {
    this.pino.info({ type: "success" }, message);
    if (this.mode === "normal") {
      process.stderr.write(`✓ ${message}\n`);
    }
  }

  warn(message: string): void {
    this.pino.warn(message);
    if (this.mode === "normal") {
      process.stderr.write(`⚠ ${message}\n`);
    }
  }

  error(message: string, error?: Error): void {
    if (error) {
      this.pino.error({ err: error }, message);
    } else {
      this.pino.error(message);
    }
    if (this.mode === "normal") {
      process.stderr.write(`✗ ${message}\n`);
      if (error && this.mode === "verbose") {
        process.stderr.write(`  ${error.stack}\n`);
      }
    }
  }

  debug(message: string, context?: object): void {
    this.pino.debug(context ?? {}, message);
  }

  trace(message: string, context?: object): void {
    this.pino.trace(context ?? {}, message);
  }

  spinner(text: string): Spinner | null {
    if (this.mode === "json") {
      return null;
    }

    // Import ora dynamically to avoid issues in tests
    return {
      text,
      succeed: (finalText?: string) => {
        this.success(finalText ?? text);
      },
      fail: (finalText?: string) => {
        this.error(finalText ?? text);
      },
      stop: () => {},
    };
  }

  progress(
    total: number,
  ): { increment: (value: number) => void; stop: () => void } | null {
    if (this.mode === "json") {
      return null;
    }

    // Stub for now - will implement with cli-progress in later task
    return {
      increment: () => {},
      stop: () => {},
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- logger.test.ts`
Expected: PASS (7 tests)

**Step 5: Commit**

```bash
git add src/infrastructure/logger.ts src/infrastructure/__tests__/logger.test.ts
git commit -m "feat(infrastructure): implement CliLogger with pino"
```

---

### Task 5: Implement Context and Progress Utilities

**Files:**

- Modify: `packages/shard-cli/src/infrastructure/context.ts`
- Modify: `packages/shard-cli/src/infrastructure/progress.ts`

**Step 1: Implement AppContext type**

Edit `packages/shard-cli/src/infrastructure/context.ts`:

```typescript
import type { CliLogger } from "./logger.js";
import type { ConfigService } from "./config.js";
import type { FetchAdapter } from "@shard-for-obsidian/lib";

export interface AppContext {
  logger: CliLogger;
  config: ConfigService;
  adapter: FetchAdapter;
}

export function createContext(
  logger: CliLogger,
  config: ConfigService,
  adapter: FetchAdapter,
): AppContext {
  return { logger, config, adapter };
}
```

**Step 2: Implement progress utilities**

Edit `packages/shard-cli/src/infrastructure/progress.ts`:

```typescript
import ora from "ora";
import cliProgress from "cli-progress";
import type { SingleBar } from "cli-progress";

export interface Spinner {
  text: string;
  succeed(text?: string): void;
  fail(text?: string): void;
  stop(): void;
}

export interface ProgressBar {
  increment(value: number): void;
  update(value: number): void;
  stop(): void;
}

export function createSpinner(text: string, enabled: boolean): Spinner | null {
  if (!enabled) {
    return null;
  }

  const spinner = ora(text).start();
  return {
    text: spinner.text,
    succeed: (finalText?: string) => {
      spinner.succeed(finalText);
    },
    fail: (finalText?: string) => {
      spinner.fail(finalText);
    },
    stop: () => {
      spinner.stop();
    },
  };
}

export function createProgressBar(
  total: number,
  enabled: boolean,
): ProgressBar | null {
  if (!enabled) {
    return null;
  }

  const bar: SingleBar = new cliProgress.SingleBar({
    format: "Progress |{bar}| {percentage}% | {value}/{total} bytes",
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
  });

  bar.start(total, 0);

  return {
    increment: (value: number) => bar.increment(value),
    update: (value: number) => bar.update(value),
    stop: () => bar.stop(),
  };
}
```

**Step 3: Verify build works**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/infrastructure/context.ts src/infrastructure/progress.ts
git commit -m "feat(infrastructure): add AppContext and progress utilities"
```

---

## Phase 2: Core Commands

### Task 6: Create Basic Stricli Application with List Command

**Files:**

- Create: `packages/shard-cli/src/commands/list.ts`
- Modify: `packages/shard-cli/src/index.ts`

**Step 1: Write test for list command**

Create `packages/shard-cli/src/__tests__/commands-list.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildApplication, buildCommand } from "@stricli/core";

describe("list command", () => {
  it("should be defined", () => {
    const { listCommand } = require("../commands/list");
    expect(listCommand).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- commands-list.test.ts`
Expected: FAIL

**Step 3: Implement list command with stricli**

Create `packages/shard-cli/src/commands/list.ts`:

```typescript
import { buildCommand, numberParser, stringParser } from "@stricli/core";
import type { AppContext } from "../infrastructure/context.js";
import { MarketplaceClient } from "../lib/marketplace-client.js";

interface ListFlags {
  json?: boolean;
  verbose?: boolean;
}

async function listCommand(this: AppContext, flags: ListFlags) {
  const { logger, adapter } = this;

  logger.debug("Fetching marketplace plugins...");

  const client = new MarketplaceClient(adapter);
  const plugins = await client.fetchPlugins();

  if (flags.json) {
    console.log(JSON.stringify(plugins, null, 2));
    return;
  }

  logger.info(`\nFound ${plugins.length} plugins:\n`);

  for (const plugin of plugins) {
    logger.info(`${plugin.name} (${plugin.id})`);
    logger.info(`  Author: ${plugin.author}`);
    if (plugin.versions && plugin.versions.length > 0) {
      logger.info(`  Latest: ${plugin.versions[0].tag}`);
    }
    logger.info(`  Registry: ${plugin.registryUrl}`);
    if (plugin.description) {
      logger.info(`  ${plugin.description}`);
    }
    logger.info("");
  }
}

export const listCommand = buildCommand({
  loader: async () => ({ default: listCommand }),
  parameters: {
    flags: {
      json: {
        kind: "boolean",
        brief: "Output as JSON",
        optional: true,
      },
      verbose: {
        kind: "boolean",
        brief: "Show detailed logs",
        optional: true,
      },
    },
  },
  docs: {
    brief: "List all marketplace plugins",
    fullDescription:
      "Fetches and displays all available plugins from the Shard marketplace.",
  },
});
```

**Step 4: Create new stricli app entry point**

Backup old index: `mv src/index.ts src/index.old.ts`

Create new `packages/shard-cli/src/index.ts`:

```typescript
#!/usr/bin/env node
import { buildApplication, buildRouteMap } from "@stricli/core";
import { listCommand } from "./commands/list.js";
import { CliLogger } from "./infrastructure/logger.js";
import { ConfigService } from "./infrastructure/config.js";
import { createContext } from "./infrastructure/context.js";
import { NodeFetchAdapter } from "./adapters/node-fetch-adapter.js";

const app = buildApplication({
  name: "shard",
  versionInfo: {
    currentVersion: "0.3.0",
  },
  documentation: {
    brief: "Shard CLI for Obsidian plugin management",
    fullDescription:
      "A CLI tool for managing Obsidian plugins via OCI registries and marketplace.",
  },
  async buildContext(flags) {
    const mode = flags.json ? "json" : flags.verbose ? "verbose" : "normal";
    const logger = new CliLogger({ mode });
    const config = new ConfigService();
    const adapter = new NodeFetchAdapter();
    return createContext(logger, config, adapter);
  },
  commands: {
    list: listCommand,
  },
});

app.run(process.argv.slice(2), process);
```

**Step 5: Test the command manually**

Run: `pnpm start list`
Expected: Lists marketplace plugins

**Step 6: Run unit tests**

Run: `pnpm test`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/index.ts src/commands/list.ts src/__tests__/commands-list.test.ts
git commit -m "feat: create stricli app with list command"
```

---

### Task 7: Implement Search Command

**Files:**

- Create: `packages/shard-cli/src/commands/search.ts`
- Modify: `packages/shard-cli/src/index.ts`

**Step 1: Implement search command**

Create `packages/shard-cli/src/commands/search.ts`:

```typescript
import { buildCommand } from "@stricli/core";
import type { AppContext } from "../infrastructure/context.js";
import { MarketplaceClient } from "../lib/marketplace-client.js";

interface SearchFlags {
  json?: boolean;
  verbose?: boolean;
}

async function searchCommand(
  this: AppContext,
  flags: SearchFlags,
  keyword: string,
) {
  const { logger, adapter } = this;

  logger.debug(`Searching for "${keyword}"...`);

  const client = new MarketplaceClient(adapter);
  const plugins = await client.searchPlugins(keyword);

  if (flags.json) {
    console.log(JSON.stringify(plugins, null, 2));
    return;
  }

  if (plugins.length === 0) {
    logger.info(`\nNo plugins found matching "${keyword}"`);
    return;
  }

  logger.info(`\nFound ${plugins.length} matching plugin(s):\n`);

  for (const plugin of plugins) {
    logger.info(`${plugin.name} (${plugin.id})`);
    logger.info(`  Author: ${plugin.author}`);
    if (plugin.versions && plugin.versions.length > 0) {
      logger.info(`  Latest: ${plugin.versions[0].tag}`);
    }
    logger.info(`  Registry: ${plugin.registryUrl}`);
    if (plugin.description) {
      logger.info(`  ${plugin.description}`);
    }
    logger.info("");
  }
}

export const searchCommand = buildCommand({
  loader: async () => ({ default: searchCommand }),
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Search keyword",
          parse: String,
        },
      ],
    },
    flags: {
      json: {
        kind: "boolean",
        brief: "Output as JSON",
        optional: true,
      },
      verbose: {
        kind: "boolean",
        brief: "Show detailed logs",
        optional: true,
      },
    },
  },
  docs: {
    brief: "Search for plugins in the marketplace",
    fullDescription:
      "Search the Shard marketplace for plugins matching a keyword.",
    examples: [
      {
        example: "shard search calendar",
        description: "Search for plugins containing 'calendar'",
      },
    ],
  },
});
```

**Step 2: Add search command to app**

Edit `packages/shard-cli/src/index.ts`, add import and command:

```typescript
import { searchCommand } from "./commands/search.js";

// In buildApplication:
commands: {
  list: listCommand,
  search: searchCommand
}
```

**Step 3: Test manually**

Run: `pnpm start search calendar`
Expected: Shows search results

**Step 4: Commit**

```bash
git add src/commands/search.ts src/index.ts
git commit -m "feat: add search command"
```

---

### Task 8: Implement Info Command

**Files:**

- Create: `packages/shard-cli/src/commands/info.ts`
- Modify: `packages/shard-cli/src/index.ts`

**Step 1: Implement info command**

Create `packages/shard-cli/src/commands/info.ts`:

```typescript
import { buildCommand } from "@stricli/core";
import type { AppContext } from "../infrastructure/context.js";
import { MarketplaceClient } from "../lib/marketplace-client.js";

interface InfoFlags {
  json?: boolean;
  verbose?: boolean;
}

async function infoCommand(
  this: AppContext,
  flags: InfoFlags,
  pluginId: string,
) {
  const { logger, adapter } = this;

  logger.debug(`Fetching plugin "${pluginId}"...`);

  const client = new MarketplaceClient(adapter);
  const plugin = await client.findPluginById(pluginId);

  if (!plugin) {
    logger.error(`Plugin "${pluginId}" not found in marketplace`);
    process.exit(1);
  }

  if (flags.json) {
    console.log(JSON.stringify(plugin, null, 2));
    return;
  }

  logger.info("\n" + "=".repeat(60));
  logger.info(`Plugin: ${plugin.name}`);
  logger.info("=".repeat(60) + "\n");

  logger.info(`ID: ${plugin.id}`);
  logger.info(`Author: ${plugin.author}`);
  if (plugin.authorUrl) {
    logger.info(`Author URL: ${plugin.authorUrl}`);
  }
  logger.info(`Description: ${plugin.description}`);
  logger.info(`\nRegistry URL: ${plugin.registryUrl}`);
  if (plugin.repository) {
    logger.info(`Repository: ${plugin.repository}`);
  }
  if (plugin.license) {
    logger.info(`License: ${plugin.license}`);
  }
  if (plugin.minObsidianVersion) {
    logger.info(`Min Obsidian Version: ${plugin.minObsidianVersion}`);
  }
  if (plugin.tags && plugin.tags.length > 0) {
    logger.info(`Tags: ${plugin.tags.join(", ")}`);
  }

  if (plugin.versions && plugin.versions.length > 0) {
    logger.info(`\nAvailable Versions (${plugin.versions.length}):`);
    for (const version of plugin.versions.slice(0, 5)) {
      const date = new Date(version.publishedAt).toISOString().split("T")[0];
      logger.info(`  - ${version.tag} (${date})`);
    }
    if (plugin.versions.length > 5) {
      logger.info(`  ... and ${plugin.versions.length - 5} more`);
    }
  }

  logger.info("\n" + "=".repeat(60));
  logger.info("Installation:");
  logger.info("=".repeat(60) + "\n");
  logger.info(`shard install ${plugin.id} --output ./plugins`);
}

export const infoCommand = buildCommand({
  loader: async () => ({ default: infoCommand }),
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Plugin ID",
          parse: String,
        },
      ],
    },
    flags: {
      json: {
        kind: "boolean",
        brief: "Output as JSON",
        optional: true,
      },
      verbose: {
        kind: "boolean",
        brief: "Show detailed logs",
        optional: true,
      },
    },
  },
  docs: {
    brief: "Show detailed information about a plugin",
    fullDescription:
      "Display comprehensive information about a plugin including versions, author, and installation instructions.",
    examples: [
      {
        example: "shard info obsidian-git",
        description: "Show details for obsidian-git plugin",
      },
    ],
  },
});
```

**Step 2: Add to app**

Edit `packages/shard-cli/src/index.ts`:

```typescript
import { infoCommand } from "./commands/info.js";

commands: {
  list: listCommand,
  search: searchCommand,
  info: infoCommand
}
```

**Step 3: Test manually**

Run: `pnpm start info obsidian-git`
Expected: Shows plugin details

**Step 4: Commit**

```bash
git add src/commands/info.ts src/index.ts
git commit -m "feat: add info command"
```

---

### Task 9: Implement Install Command with Progress

**Files:**

- Create: `packages/shard-cli/src/commands/install.ts`
- Modify: `packages/shard-cli/src/index.ts`

**Step 1: Implement install command**

Create `packages/shard-cli/src/commands/install.ts`:

```typescript
import { buildCommand } from "@stricli/core";
import type { AppContext } from "../infrastructure/context.js";
import { MarketplaceClient } from "../lib/marketplace-client.js";
import { pullCommand as pullPlugin } from "./pull.js";
import { resolveAuthToken } from "../lib/auth.js";
import { createSpinner } from "../infrastructure/progress.js";

interface InstallFlags {
  output: string;
  version?: string;
  token?: string;
  json?: boolean;
  verbose?: boolean;
}

async function installCommand(
  this: AppContext,
  flags: InstallFlags,
  pluginId: string,
) {
  const { logger, adapter, config } = this;

  const spinner = createSpinner(
    `Looking up plugin "${pluginId}" in marketplace...`,
    !flags.json,
  );

  try {
    const client = new MarketplaceClient(adapter);
    const plugin = await client.findPluginById(pluginId);

    if (!plugin) {
      spinner?.fail();
      throw new Error(`Plugin "${pluginId}" not found in marketplace`);
    }

    const latestVersion =
      plugin.versions && plugin.versions.length > 0
        ? plugin.versions[0].tag
        : "latest";

    spinner?.succeed(
      `Found: ${plugin.name} v${latestVersion} by ${plugin.author}`,
    );

    const versionToInstall = flags.version ?? latestVersion;
    const repository = `${plugin.registryUrl}:${versionToInstall}`;

    const token =
      flags.token ?? resolveAuthToken(undefined) ?? (await config.get("token"));

    if (!token) {
      throw new Error(
        "GitHub token required. Set via --token, GITHUB_TOKEN env var, or config file.",
      );
    }

    logger.info(`Installing from ${repository}...`);

    // Reuse existing pull logic
    await pullPlugin({
      repository,
      output: flags.output,
      token,
      logger,
      adapter,
    });

    logger.success(
      `Successfully installed ${plugin.name} v${versionToInstall} to ${flags.output}`,
    );

    if (flags.json) {
      console.log(
        JSON.stringify({ plugin, version: versionToInstall }, null, 2),
      );
    }
  } catch (error) {
    spinner?.fail();
    throw error;
  }
}

export const installCommand = buildCommand({
  loader: async () => ({ default: installCommand }),
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Plugin ID",
          parse: String,
        },
      ],
    },
    flags: {
      output: {
        kind: "parsed",
        parse: String,
        brief: "Output directory",
      },
      version: {
        kind: "parsed",
        parse: String,
        brief: "Specific version to install",
        optional: true,
      },
      token: {
        kind: "parsed",
        parse: String,
        brief: "GitHub Personal Access Token",
        optional: true,
      },
      json: {
        kind: "boolean",
        brief: "Output as JSON",
        optional: true,
      },
      verbose: {
        kind: "boolean",
        brief: "Show detailed logs",
        optional: true,
      },
    },
  },
  docs: {
    brief: "Install a plugin from the marketplace",
    fullDescription:
      "Downloads and installs an Obsidian plugin by ID from the Shard marketplace.",
    examples: [
      {
        example: "shard install obsidian-git --output ./plugins",
        description: "Install latest version",
      },
      {
        example: "shard install calendar --version 1.5.3 --output ./plugins",
        description: "Install specific version",
      },
    ],
  },
});
```

**Step 2: Create pull helper (extract from old pull command)**

Create `packages/shard-cli/src/commands/pull.ts` (will be moved to registry/ later):

```typescript
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { OciRegistryClient, parseRepoAndRef } from "@shard-for-obsidian/lib";
import type { FetchAdapter } from "@shard-for-obsidian/lib";
import type { CliLogger } from "../infrastructure/logger.js";

export interface PullOptions {
  repository: string;
  output: string;
  token: string;
  logger: CliLogger;
  adapter: FetchAdapter;
}

export async function pullCommand(opts: PullOptions): Promise<void> {
  const { repository, output, token, logger, adapter } = opts;

  logger.debug(`Pulling ${repository}...`);
  const ref = parseRepoAndRef(repository);

  if (!ref.tag && !ref.digest) {
    throw new Error("Repository reference must include tag or digest");
  }

  const client = new OciRegistryClient({
    repo: ref,
    username: "github",
    password: token,
    adapter,
  });

  logger.debug("Fetching manifest...");
  const refString = ref.tag || ref.digest || "";
  const pullResult = await client.pullPluginManifest({ ref: refString });

  const absOutput = path.resolve(output);
  await fs.mkdir(absOutput, { recursive: true });

  // Write manifest.json
  const manifestPath = path.join(absOutput, "manifest.json");
  const manifestJson = JSON.stringify(pullResult.pluginManifest, null, 2);
  await fs.writeFile(manifestPath, manifestJson, "utf-8");
  logger.debug(`Wrote manifest.json (${manifestJson.length} bytes)`);

  // Download layers
  for (const layer of pullResult.manifest.layers) {
    const filename = layer.annotations?.["vnd.obsidianmd.layer.filename"];
    if (!filename) {
      throw new Error(`Layer ${layer.digest} missing filename annotation`);
    }

    logger.debug(`Downloading ${filename}...`);
    const blobResult = await client.downloadBlob({ digest: layer.digest });
    const filePath = path.join(absOutput, filename);
    await fs.writeFile(filePath, Buffer.from(blobResult.buffer));
    logger.debug(`Wrote ${filename} (${blobResult.buffer.byteLength} bytes)`);
  }
}
```

**Step 3: Add to app**

Edit `packages/shard-cli/src/index.ts`:

```typescript
import { installCommand } from "./commands/install.js";

commands: {
  list: listCommand,
  search: searchCommand,
  info: infoCommand,
  install: installCommand
}
```

**Step 4: Test manually**

Run: `pnpm start install test-plugin --output ./test-output`
Expected: Installs plugin with spinner feedback

**Step 5: Commit**

```bash
git add src/commands/install.ts src/commands/pull.ts src/index.ts
git commit -m "feat: add install command with progress indicators"
```

---

## Phase 3: Publishing & Registry Commands

### Task 10: Implement Registry Route Map

**Files:**

- Create: `packages/shard-cli/src/commands/registry/index.ts`
- Create: `packages/shard-cli/src/commands/registry/push.ts`
- Create: `packages/shard-cli/src/commands/registry/pull.ts`
- Create: `packages/shard-cli/src/commands/registry/versions.ts`
- Modify: `packages/shard-cli/src/index.ts`

**Step 1: Create registry directory**

```bash
mkdir -p packages/shard-cli/src/commands/registry
```

**Step 2: Implement registry push command**

Create `packages/shard-cli/src/commands/registry/push.ts`:

```typescript
import { buildCommand } from "@stricli/core";
import type { AppContext } from "../../infrastructure/context.js";
import { pushCommand as pushPlugin } from "../../commands/push-old.js";
import { resolveAuthToken } from "../../lib/auth.js";

interface PushFlags {
  token?: string;
  json?: boolean;
  verbose?: boolean;
}

async function pushCommand(
  this: AppContext,
  flags: PushFlags,
  directory: string,
  repository: string,
) {
  const { logger, adapter, config } = this;

  const token =
    flags.token ?? resolveAuthToken(undefined) ?? (await config.get("token"));

  if (!token) {
    throw new Error(
      "GitHub token required. Set via --token, GITHUB_TOKEN env var, or config file.",
    );
  }

  const result = await pushPlugin({
    directory,
    repository,
    token,
    logger,
    adapter,
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
  }
}

export const pushCommand = buildCommand({
  loader: async () => ({ default: pushCommand }),
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        { brief: "Plugin directory", parse: String },
        { brief: "Registry repository", parse: String },
      ],
    },
    flags: {
      token: {
        kind: "parsed",
        parse: String,
        brief: "GitHub Personal Access Token",
        optional: true,
      },
      json: {
        kind: "boolean",
        brief: "Output as JSON",
        optional: true,
      },
      verbose: {
        kind: "boolean",
        brief: "Show detailed logs",
        optional: true,
      },
    },
  },
  docs: {
    brief: "Push plugin to OCI registry",
    fullDescription: "Push an Obsidian plugin to an OCI registry (GHCR).",
    examples: [
      {
        example: "shard registry push ./dist ghcr.io/user/plugin",
        description: "Push plugin to GHCR",
      },
    ],
  },
});
```

**Step 3: Move old push command**

```bash
mv packages/shard-cli/src/commands/push.ts packages/shard-cli/src/commands/push-old.ts
```

**Step 4: Implement registry pull command**

Create `packages/shard-cli/src/commands/registry/pull.ts`:

```typescript
import { buildCommand } from "@stricli/core";
import type { AppContext } from "../../infrastructure/context.js";
import { pullCommand as pullPlugin } from "../pull.js";
import { resolveAuthToken } from "../../lib/auth.js";

interface PullFlags {
  output: string;
  token?: string;
  json?: boolean;
  verbose?: boolean;
}

async function pullCommand(
  this: AppContext,
  flags: PullFlags,
  repository: string,
) {
  const { logger, adapter, config } = this;

  const token =
    flags.token ?? resolveAuthToken(undefined) ?? (await config.get("token"));

  if (!token) {
    throw new Error(
      "GitHub token required. Set via --token, GITHUB_TOKEN env var, or config file.",
    );
  }

  await pullPlugin({
    repository,
    output: flags.output,
    token,
    logger,
    adapter,
  });

  logger.success(`Successfully pulled ${repository} to ${flags.output}`);

  if (flags.json) {
    console.log(JSON.stringify({ repository, output: flags.output }, null, 2));
  }
}

export const pullCommand = buildCommand({
  loader: async () => ({ default: pullCommand }),
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [{ brief: "Registry repository with tag", parse: String }],
    },
    flags: {
      output: {
        kind: "parsed",
        parse: String,
        brief: "Output directory",
      },
      token: {
        kind: "parsed",
        parse: String,
        brief: "GitHub Personal Access Token",
        optional: true,
      },
      json: {
        kind: "boolean",
        brief: "Output as JSON",
        optional: true,
      },
      verbose: {
        kind: "boolean",
        brief: "Show detailed logs",
        optional: true,
      },
    },
  },
  docs: {
    brief: "Pull plugin from OCI registry",
    fullDescription: "Pull an Obsidian plugin from an OCI registry (GHCR).",
    examples: [
      {
        example:
          "shard registry pull ghcr.io/user/plugin:1.0.0 --output ./plugins",
        description: "Pull specific version",
      },
    ],
  },
});
```

**Step 5: Implement registry versions command**

Create `packages/shard-cli/src/commands/registry/versions.ts`:

```typescript
import { buildCommand } from "@stricli/core";
import type { AppContext } from "../../infrastructure/context.js";
import { queryOciTags, queryTagMetadata } from "../../lib/oci-tags.js";
import { resolveAuthToken } from "../../lib/auth.js";

interface VersionsFlags {
  token?: string;
  json?: boolean;
  verbose?: boolean;
}

async function versionsCommand(
  this: AppContext,
  flags: VersionsFlags,
  registryUrl: string,
) {
  const { logger, adapter, config } = this;

  const token =
    flags.token ?? resolveAuthToken(undefined) ?? (await config.get("token"));

  if (!token) {
    throw new Error(
      "GitHub token required. Set via --token, GITHUB_TOKEN env var, or config file.",
    );
  }

  logger.debug(`Querying versions for ${registryUrl}...`);

  const tags = await queryOciTags({ registryUrl, token, adapter });

  if (tags.length === 0) {
    logger.info("No versions found");
    if (flags.json) {
      console.log("[]");
    }
    return;
  }

  const versions = [];

  for (const tag of tags) {
    const metadata = await queryTagMetadata({
      registryUrl,
      tag,
      token,
      adapter,
    });
    versions.push({ tag, ...metadata });
  }

  if (flags.json) {
    console.log(JSON.stringify(versions, null, 2));
    return;
  }

  logger.info(`\nFound ${tags.length} version(s):\n`);

  for (const version of versions) {
    const sizeKB = (version.size / 1024).toFixed(0);
    const date = new Date(version.publishedAt).toISOString().split("T")[0];
    logger.info(`- ${version.tag} (published ${date}, ${sizeKB} KB)`);
  }
}

export const versionsCommand = buildCommand({
  loader: async () => ({ default: versionsCommand }),
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [{ brief: "Registry URL", parse: String }],
    },
    flags: {
      token: {
        kind: "parsed",
        parse: String,
        brief: "GitHub Personal Access Token",
        optional: true,
      },
      json: {
        kind: "boolean",
        brief: "Output as JSON",
        optional: true,
      },
      verbose: {
        kind: "boolean",
        brief: "Show detailed logs",
        optional: true,
      },
    },
  },
  docs: {
    brief: "List all versions for a registry",
    fullDescription:
      "Query and display all available versions for a plugin in an OCI registry.",
    examples: [
      {
        example: "shard registry versions ghcr.io/user/plugin",
        description: "List all versions",
      },
    ],
  },
});
```

**Step 6: Create registry route map**

Create `packages/shard-cli/src/commands/registry/index.ts`:

```typescript
import { buildRouteMap } from "@stricli/core";
import { pushCommand } from "./push.js";
import { pullCommand } from "./pull.js";
import { versionsCommand } from "./versions.js";

export const registryRouteMap = buildRouteMap({
  routes: {
    push: pushCommand,
    pull: pullCommand,
    versions: versionsCommand,
  },
  docs: {
    brief: "Direct OCI registry operations",
    fullDescription:
      "Low-level commands for interacting directly with OCI registries (GHCR).",
  },
});
```

**Step 7: Add registry to main app**

Edit `packages/shard-cli/src/index.ts`:

```typescript
import { registryRouteMap } from "./commands/registry/index.js";

const app = buildApplication({
  // ... existing config
  commands: {
    list: listCommand,
    search: searchCommand,
    info: infoCommand,
    install: installCommand,
  },
  routes: {
    registry: registryRouteMap,
  },
});
```

**Step 8: Test manually**

Run: `pnpm start registry --help`
Expected: Shows registry subcommands

**Step 9: Commit**

```bash
git add src/commands/registry/ src/index.ts src/commands/push-old.ts
git commit -m "feat: add registry route map with push/pull/versions"
```

---

### Task 11: Implement Config Route Map

**Files:**

- Create: `packages/shard-cli/src/commands/config/index.ts`
- Create: `packages/shard-cli/src/commands/config/get.ts`
- Create: `packages/shard-cli/src/commands/config/set.ts`
- Create: `packages/shard-cli/src/commands/config/list.ts`
- Create: `packages/shard-cli/src/commands/config/clear.ts`
- Modify: `packages/shard-cli/src/index.ts`

**Step 1: Create config directory**

```bash
mkdir -p packages/shard-cli/src/commands/config
```

**Step 2: Implement config commands**

Create all four config command files following similar pattern:

`packages/shard-cli/src/commands/config/get.ts`:

```typescript
import { buildCommand } from "@stricli/core";
import type { AppContext } from "../../infrastructure/context.js";

async function getCommand(this: AppContext, _flags: {}, key: string) {
  const { logger, config } = this;
  const value = await config.get(key);

  if (value === undefined) {
    logger.error(`Config key "${key}" not found`);
    process.exit(1);
  }

  console.log(value);
}

export const getCommand = buildCommand({
  loader: async () => ({ default: getCommand }),
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [{ brief: "Config key", parse: String }],
    },
  },
  docs: {
    brief: "Get a config value",
    examples: [{ example: "shard config get token", description: "Get token" }],
  },
});
```

`packages/shard-cli/src/commands/config/set.ts`:

```typescript
import { buildCommand } from "@stricli/core";
import type { AppContext } from "../../infrastructure/context.js";

async function setCommand(
  this: AppContext,
  _flags: {},
  key: string,
  value: string,
) {
  const { logger, config } = this;
  await config.set(key, value);
  logger.success(`Set ${key} = ${value}`);
}

export const setCommand = buildCommand({
  loader: async () => ({ default: setCommand }),
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        { brief: "Config key", parse: String },
        { brief: "Config value", parse: String },
      ],
    },
  },
  docs: {
    brief: "Set a config value",
    examples: [
      { example: "shard config set token ghp_xxx", description: "Set token" },
    ],
  },
});
```

`packages/shard-cli/src/commands/config/list.ts`:

```typescript
import { buildCommand } from "@stricli/core";
import type { AppContext } from "../../infrastructure/context.js";

interface ListFlags {
  json?: boolean;
}

async function listCommand(this: AppContext, flags: ListFlags) {
  const { config } = this;
  const allConfig = await config.list();

  if (flags.json) {
    console.log(JSON.stringify(allConfig, null, 2));
  } else {
    console.log(JSON.stringify(allConfig, null, 2));
  }
}

export const listCommand = buildCommand({
  loader: async () => ({ default: listCommand }),
  parameters: {
    flags: {
      json: {
        kind: "boolean",
        brief: "Output as JSON",
        optional: true,
      },
    },
  },
  docs: {
    brief: "List all config values",
  },
});
```

`packages/shard-cli/src/commands/config/clear.ts`:

```typescript
import { buildCommand } from "@stricli/core";
import type { AppContext } from "../../infrastructure/context.js";

async function clearCommand(this: AppContext, _flags: {}) {
  const { logger, config } = this;
  await config.clear();
  logger.success("Config cleared");
}

export const clearCommand = buildCommand({
  loader: async () => ({ default: clearCommand }),
  parameters: {},
  docs: {
    brief: "Clear all config values",
  },
});
```

**Step 3: Create config route map**

Create `packages/shard-cli/src/commands/config/index.ts`:

```typescript
import { buildRouteMap } from "@stricli/core";
import { getCommand } from "./get.js";
import { setCommand } from "./set.js";
import { listCommand } from "./list.js";
import { clearCommand } from "./clear.js";

export const configRouteMap = buildRouteMap({
  routes: {
    get: getCommand,
    set: setCommand,
    list: listCommand,
    clear: clearCommand,
  },
  docs: {
    brief: "Manage CLI configuration",
    fullDescription:
      "Get, set, list, or clear configuration values stored in ~/.shard/config.json",
  },
});
```

**Step 4: Add to main app**

Edit `packages/shard-cli/src/index.ts`:

```typescript
import { configRouteMap } from "./commands/config/index.js";

routes: {
  registry: registryRouteMap,
  config: configRouteMap
}
```

**Step 5: Test manually**

```bash
pnpm start config set token test123
pnpm start config get token
pnpm start config list
pnpm start config clear
```

**Step 6: Commit**

```bash
git add src/commands/config/ src/index.ts
git commit -m "feat: add config route map with get/set/list/clear"
```

---

### Task 12: Implement Publish and Convert Commands

**Files:**

- Create: `packages/shard-cli/src/commands/publish.ts`
- Create: `packages/shard-cli/src/commands/convert.ts`
- Modify: `packages/shard-cli/src/index.ts`

**Step 1: Implement publish command (combines old register/update)**

Create `packages/shard-cli/src/commands/publish.ts`:

```typescript
import { buildCommand } from "@stricli/core";
import type { AppContext } from "../infrastructure/context.js";
import { pushCommand as pushPlugin } from "./push-old.js";
import { resolveAuthToken } from "../lib/auth.js";

interface PublishFlags {
  token?: string;
  json?: boolean;
  verbose?: boolean;
}

async function publishCommand(
  this: AppContext,
  flags: PublishFlags,
  directory: string,
  repository: string,
) {
  const { logger, adapter, config } = this;

  const token =
    flags.token ?? resolveAuthToken(undefined) ?? (await config.get("token"));

  if (!token) {
    throw new Error(
      "GitHub token required. Set via --token, GITHUB_TOKEN env var, or config file.",
    );
  }

  logger.info(`Publishing plugin from ${directory} to ${repository}...`);

  const result = await pushPlugin({
    directory,
    repository,
    token,
    logger,
    adapter,
  });

  logger.success(`Successfully published to ${repository}`);
  logger.info(`Version: ${result.tag}`);
  logger.info(`Digest: ${result.digest}`);

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
  }
}

export const publishCommand = buildCommand({
  loader: async () => ({ default: publishCommand }),
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        { brief: "Plugin directory", parse: String },
        { brief: "Registry repository", parse: String },
      ],
    },
    flags: {
      token: {
        kind: "parsed",
        parse: String,
        brief: "GitHub Personal Access Token",
        optional: true,
      },
      json: {
        kind: "boolean",
        brief: "Output as JSON",
        optional: true,
      },
      verbose: {
        kind: "boolean",
        brief: "Show detailed logs",
        optional: true,
      },
    },
  },
  docs: {
    brief: "Publish plugin to registry",
    fullDescription:
      "Publish an Obsidian plugin to an OCI registry. Replaces the old register/update commands.",
    examples: [
      {
        example: "shard publish ./dist ghcr.io/user/my-plugin",
        description: "Publish plugin to GHCR",
      },
    ],
  },
});
```

**Step 2: Implement convert command**

Create `packages/shard-cli/src/commands/convert.ts`:

```typescript
import { buildCommand } from "@stricli/core";
import type { AppContext } from "../infrastructure/context.js";
import { PluginConverter } from "../lib/converter.js";
import { resolveAuthToken } from "../lib/auth.js";

interface ConvertFlags {
  version?: string;
  token?: string;
  json?: boolean;
  verbose?: boolean;
}

async function convertCommand(
  this: AppContext,
  flags: ConvertFlags,
  pluginId: string,
  repository: string,
) {
  const { logger, adapter, config } = this;

  const token =
    flags.token ?? resolveAuthToken(undefined) ?? (await config.get("token"));

  if (!token) {
    throw new Error(
      "GitHub token required. Set via --token, GITHUB_TOKEN env var, or config file.",
    );
  }

  const converter = new PluginConverter(adapter);

  logger.info(`Converting plugin "${pluginId}"...`);
  if (flags.version) {
    logger.info(`Using specific version: ${flags.version}`);
  } else {
    logger.info("Using latest version");
  }

  const convertResult = await converter.convertPlugin({
    pluginId,
    version: flags.version,
    repository,
    token,
  });

  logger.info(
    `Downloaded plugin ${convertResult.pluginId} v${convertResult.version}`,
  );
  logger.info(`  - manifest.json: ${convertResult.manifest.name}`);
  logger.info(`  - main.js: ${convertResult.mainJs.length} bytes`);
  if (convertResult.stylesCss) {
    logger.info(`  - styles.css: ${convertResult.stylesCss.length} bytes`);
  }

  logger.info(`\nPushing to ${convertResult.repository}...`);
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

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          pluginId: convertResult.pluginId,
          version: convertResult.version,
          repository: pushResult.repository,
          digest: pushResult.digest,
        },
        null,
        2,
      ),
    );
  }
}

export const convertCommand = buildCommand({
  loader: async () => ({ default: convertCommand }),
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        { brief: "Plugin ID from community list", parse: String },
        { brief: "Target registry repository", parse: String },
      ],
    },
    flags: {
      version: {
        kind: "parsed",
        parse: String,
        brief: "Specific version to convert",
        optional: true,
      },
      token: {
        kind: "parsed",
        parse: String,
        brief: "GitHub Personal Access Token",
        optional: true,
      },
      json: {
        kind: "boolean",
        brief: "Output as JSON",
        optional: true,
      },
      verbose: {
        kind: "boolean",
        brief: "Show detailed logs",
        optional: true,
      },
    },
  },
  docs: {
    brief: "Convert legacy plugin to OCI format",
    fullDescription:
      "Convert a legacy Obsidian plugin from GitHub releases to OCI format and push to registry.",
    examples: [
      {
        example: "shard convert obsidian-git ghcr.io/user/obsidian-git",
        description: "Convert latest version",
      },
      {
        example: "shard convert calendar ghcr.io/user/calendar --version 1.5.3",
        description: "Convert specific version",
      },
    ],
  },
});
```

**Step 3: Add to main app**

Edit `packages/shard-cli/src/index.ts`:

```typescript
import { publishCommand } from "./commands/publish.js";
import { convertCommand } from "./commands/convert.js";

commands: {
  list: listCommand,
  search: searchCommand,
  info: infoCommand,
  install: installCommand,
  publish: publishCommand,
  convert: convertCommand
}
```

**Step 4: Test manually**

```bash
pnpm start publish --help
pnpm start convert --help
```

**Step 5: Commit**

```bash
git add src/commands/publish.ts src/commands/convert.ts src/index.ts
git commit -m "feat: add publish and convert commands"
```

---

## Phase 4: Polish and Cleanup

### Task 13: Add Shell Completion Support

**Files:**

- Create: `packages/shard-cli/src/commands/completion/index.ts`
- Create: `packages/shard-cli/src/commands/completion/install.ts`
- Create: `packages/shard-cli/src/commands/completion/script.ts`
- Modify: `packages/shard-cli/src/index.ts`

**Step 1: Create completion commands**

Create `packages/shard-cli/src/commands/completion/install.ts`:

```typescript
import { buildCommand } from "@stricli/core";
import type { AppContext } from "../../infrastructure/context.js";

async function installCommand(this: AppContext, _flags: {}) {
  const { logger } = this;

  logger.info("Shell completion installation coming soon!");
  logger.info("For now, use: shard completion script <shell>");
}

export const installCommand = buildCommand({
  loader: async () => ({ default: installCommand }),
  parameters: {},
  docs: {
    brief: "Install shell completion (auto-detect shell)",
  },
});
```

Create `packages/shard-cli/src/commands/completion/script.ts`:

```typescript
import { buildCommand } from "@stricli/core";
import type { AppContext } from "../../infrastructure/context.js";

async function scriptCommand(this: AppContext, _flags: {}, shell: string) {
  const { logger } = this;

  logger.info(`Completion script for ${shell} coming soon!`);
}

export const scriptCommand = buildCommand({
  loader: async () => ({ default: scriptCommand }),
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [{ brief: "Shell type (bash/zsh/fish)", parse: String }],
    },
  },
  docs: {
    brief: "Output completion script for shell",
    examples: [
      {
        example: "shard completion script bash > ~/.shard-completion.bash",
        description: "Generate bash completion",
      },
    ],
  },
});
```

Create `packages/shard-cli/src/commands/completion/index.ts`:

```typescript
import { buildRouteMap } from "@stricli/core";
import { installCommand } from "./install.js";
import { scriptCommand } from "./script.js";

export const completionRouteMap = buildRouteMap({
  routes: {
    install: installCommand,
    script: scriptCommand,
  },
  docs: {
    brief: "Shell completion utilities",
    fullDescription:
      "Generate and install shell completion scripts for bash, zsh, and fish.",
  },
});
```

**Step 2: Add to main app**

Edit `packages/shard-cli/src/index.ts`:

```typescript
import { completionRouteMap } from "./commands/completion/index.js";

routes: {
  registry: registryRouteMap,
  config: configRouteMap,
  completion: completionRouteMap
}
```

**Step 3: Commit**

```bash
git add src/commands/completion/ src/index.ts
git commit -m "feat: add completion route map (placeholder)"
```

---

### Task 14: Remove Old Files and Update Tests

**Files:**

- Delete: `packages/shard-cli/src/index.old.ts`
- Delete: `packages/shard-cli/src/commands/push-old.ts`
- Delete: `packages/shard-cli/src/commands/marketplace.ts` (if exists)
- Modify: Test files to use new commands

**Step 1: Remove old files**

```bash
rm -f packages/shard-cli/src/index.old.ts
rm -f packages/shard-cli/src/commands/push-old.ts
rm -f packages/shard-cli/src/commands/marketplace.ts
```

**Step 2: Update lib/logger.ts if still exists**

```bash
rm -f packages/shard-cli/src/lib/logger.ts
```

**Step 3: Run all tests**

Run: `pnpm test`
Expected: All tests pass

**Step 4: Fix any failing tests**

If tests reference old command structure, update them to use new stricli commands.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove old command files and update tests"
```

---

### Task 15: Update Documentation

**Files:**

- Modify: `packages/shard-cli/README.md`
- Modify: `CHANGELOG.md` (root)

**Step 1: Update CLI README**

Edit `packages/shard-cli/README.md` to document new command structure:

````markdown
# Shard CLI

CLI tool for managing Obsidian plugins via OCI registries.

## Installation

```bash
npm install -g @shard-for-obsidian/cli
```
````

## Commands

### User Commands

```bash
# List all plugins
shard list

# Search for plugins
shard search calendar

# Show plugin details
shard info obsidian-git

# Install plugin
shard install obsidian-git --output ./plugins
```

### Publishing

```bash
# Publish plugin to registry
shard publish ./dist ghcr.io/user/my-plugin
```

### Registry Operations

```bash
# Push to registry
shard registry push ./dist ghcr.io/user/plugin

# Pull from registry
shard registry pull ghcr.io/user/plugin:1.0.0 --output ./plugins

# List versions
shard registry versions ghcr.io/user/plugin
```

### Configuration

```bash
# Set token
shard config set token ghp_xxxxx

# Get value
shard config get token

# List all config
shard config list

# Clear config
shard config clear
```

### Utilities

```bash
# Convert legacy plugin
shard convert obsidian-git ghcr.io/user/obsidian-git
```

## Configuration File

Config is stored in `~/.shard/config.json`:

```json
{
  "token": "ghp_xxxxx",
  "defaults": {
    "output": "./plugins"
  }
}
```

## Migration from v0.2.x

See [Migration Guide](../../docs/plans/2026-02-07-stricli-pino-migration-design.md#migration-from-v02x-to-v03)

````

**Step 2: Update CHANGELOG**

Add entry to root `CHANGELOG.md`:

```markdown
## [0.3.0] - 2026-02-07

### Breaking Changes

- Removed `marketplace` subcommand prefix (use top-level commands)
- Removed separate `register` and `update` commands (use `publish`)
- Moved `push` and `pull` to `registry` subcommand
- Requires TypeScript `strict: true`

### Added

- Stricli framework for type-safe CLI
- Pino structured logging
- Progress indicators for uploads/downloads
- Configuration file support (`~/.shard/config.json`)
- `--verbose` flag for detailed debugging
- Shell completion support (coming soon)
- New `publish` command (replaces register/update)
- `config` subcommands for managing configuration

### Changed

- Improved error messages with suggestions
- Better help text with examples
- Logger outputs to both stderr (user-friendly) and file (structured)

### Migration Guide

| Old Command | New Command |
|-------------|-------------|
| `shard marketplace list` | `shard list` |
| `shard marketplace install <id>` | `shard install <id>` |
| `shard marketplace register <repo>` | `shard publish <dir> <repo>` |
| `shard push <dir> <repo>` | `shard registry push <dir> <repo>` |
````

**Step 3: Commit**

```bash
git add packages/shard-cli/README.md CHANGELOG.md
git commit -m "docs: update README and CHANGELOG for v0.3.0"
```

---

### Task 16: Final Testing and Version Bump

**Files:**

- Modify: `packages/shard-cli/package.json`

**Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 2: Run lint**

Run: `pnpm lint`
Expected: No errors

**Step 3: Build project**

Run: `pnpm build`
Expected: Clean build

**Step 4: Test commands manually**

```bash
# Test each major command
pnpm start list
pnpm start search git
pnpm start info obsidian-git
pnpm start config set token test
pnpm start config get token
pnpm start registry --help
pnpm start --help
```

**Step 5: Update version**

Edit `packages/shard-cli/package.json`:

```json
{
  "version": "0.3.0"
}
```

**Step 6: Commit**

```bash
git add packages/shard-cli/package.json
git commit -m "chore: bump version to 0.3.0"
```

---

## Completion

At this point:

- ✅ All core commands implemented with stricli
- ✅ Pino logger with three modes (normal/json/verbose)
- ✅ Config system with file storage
- ✅ Progress indicators (basic implementation)
- ✅ Route maps for registry and config
- ✅ Tests passing
- ✅ Documentation updated

**Next steps:**

1. Use @superpowers:finishing-a-development-branch to merge to main
2. Test in production environment
3. Gather user feedback
4. Consider future enhancements (interactive prompts, better autocomplete)
