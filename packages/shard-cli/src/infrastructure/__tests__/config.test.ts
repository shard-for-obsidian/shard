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
    const exists = await fs.access(configPath).then(() => true).catch(() => false);
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
      defaults: { output: "./plugins" }
    });
  });

  it("should clear all config", async () => {
    await config.set("token", "test-token");
    await config.clear();
    const all = await config.list();
    expect(all).toEqual({});
  });
});
