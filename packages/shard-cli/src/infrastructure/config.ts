import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * Configuration structure stored in ~/.shard/config.json
 */
export interface Config {
  token?: string;
  defaults?: {
    output?: string;
  };
  [key: string]: unknown;
}

/**
 * Service for managing persistent configuration in ~/.shard/config.json
 */
export class ConfigService {
  constructor(private readonly configPath: string) {}

  /**
   * Get a configuration value by key (supports dot notation for nested keys)
   */
  async get(key: string): Promise<unknown> {
    const config = await this.load();
    return this.getNestedValue(config, key);
  }

  /**
   * Set a configuration value by key (supports dot notation for nested keys)
   */
  async set(key: string, value: unknown): Promise<void> {
    const config = await this.load();
    this.setNestedValue(config, key, value);
    await this.save(config);
  }

  /**
   * List all configuration values
   */
  async list(): Promise<Config> {
    return await this.load();
  }

  /**
   * Clear all configuration values
   */
  async clear(): Promise<void> {
    await this.save({});
  }

  /**
   * Load configuration from file, returns empty object if file doesn't exist
   */
  private async load(): Promise<Config> {
    try {
      const content = await fs.readFile(this.configPath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      // If file doesn't exist or is empty, return empty config
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {};
      }
      throw error;
    }
  }

  /**
   * Save configuration to file, creating directories as needed
   */
  private async save(config: Config): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), "utf-8");
  }

  /**
   * Get a nested value using dot notation (e.g., "defaults.output")
   */
  private getNestedValue(obj: Config, key: string): unknown {
    const keys = key.split(".");
    let current: unknown = obj;

    for (const k of keys) {
      if (current === null || current === undefined || typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[k];
    }

    return current;
  }

  /**
   * Set a nested value using dot notation (e.g., "defaults.output")
   */
  private setNestedValue(obj: Config, key: string, value: unknown): void {
    const keys = key.split(".");
    const lastKey = keys[keys.length - 1];
    let current: Record<string, unknown> = obj;

    // Navigate to the parent of the target key, creating objects as needed
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== "object" || current[k] === null) {
        current[k] = {};
      }
      current = current[k] as Record<string, unknown>;
    }

    // Set the value
    current[lastKey] = value;
  }
}
