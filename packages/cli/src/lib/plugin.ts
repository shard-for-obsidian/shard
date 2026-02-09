import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ObsidianManifest } from "@shard-for-obsidian/lib";

export interface DiscoveredPlugin {
  directory: string;
  manifest: {
    path: string;
    content: ArrayBuffer;
    parsed: ObsidianManifest;
  };
  mainJs: {
    path: string;
    content: ArrayBuffer;
  };
  stylesCss?: {
    path: string;
    content: ArrayBuffer;
  };
}

/**
 * Discover plugin files in a directory.
 * Finds manifest.json (required), main.js (required), and styles.css (optional).
 *
 * @param directory - Directory to scan for plugin files
 * @returns Discovered plugin information
 * @throws Error if required files are missing or invalid
 */
export async function discoverPlugin(
  directory: string,
): Promise<DiscoveredPlugin> {
  // Resolve absolute path
  const absDirectory = path.resolve(directory);

  // Check directory exists
  try {
    const stat = await fs.stat(absDirectory);
    if (!stat.isDirectory()) {
      throw new Error(`Not a directory: ${directory}`);
    }
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "ENOENT"
    ) {
      throw new Error(`Directory not found: ${directory}`);
    }
    throw err;
  }

  // Find manifest.json (required)
  const manifestPath = path.join(absDirectory, "manifest.json");
  let manifestContent: ArrayBuffer;
  let manifestParsed: ObsidianManifest;

  try {
    const buffer = await fs.readFile(manifestPath);
    manifestContent = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );

    // Parse and validate manifest
    const text = new TextDecoder().decode(manifestContent);
    const parsed = JSON.parse(text) as Record<string, unknown>;

    // Validate required fields
    if (!parsed.version || typeof parsed.version !== "string") {
      throw new Error('manifest.json missing required "version" field');
    }
    if (!parsed.id || typeof parsed.id !== "string") {
      throw new Error('manifest.json missing required "id" field');
    }
    if (!parsed.name || typeof parsed.name !== "string") {
      throw new Error('manifest.json missing required "name" field');
    }
    if (!parsed.minAppVersion || typeof parsed.minAppVersion !== "string") {
      throw new Error('manifest.json missing required "minAppVersion" field');
    }
    if (!parsed.description || typeof parsed.description !== "string") {
      throw new Error('manifest.json missing required "description" field');
    }
    if (!parsed.author || typeof parsed.author !== "string") {
      throw new Error('manifest.json missing required "author" field');
    }

    manifestParsed = parsed as unknown as ObsidianManifest;
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "ENOENT"
    ) {
      throw new Error(`manifest.json not found in ${directory}`);
    }
    if (err instanceof SyntaxError) {
      throw new Error(`Could not parse manifest.json: ${err.message}`);
    }
    throw err;
  }

  // Find main.js (required)
  const mainJsPath = path.join(absDirectory, "main.js");
  let mainJsContent: ArrayBuffer;

  try {
    const buffer = await fs.readFile(mainJsPath);
    mainJsContent = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "ENOENT"
    ) {
      throw new Error(`main.js not found in ${directory}`);
    }
    throw err;
  }

  // Find styles.css (optional)
  const stylesCssPath = path.join(absDirectory, "styles.css");
  let stylesCssContent: ArrayBuffer | undefined;

  try {
    const buffer = await fs.readFile(stylesCssPath);
    stylesCssContent = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "ENOENT"
    ) {
      // styles.css is optional, ignore error
      stylesCssContent = undefined;
    } else {
      throw err;
    }
  }

  return {
    directory: absDirectory,
    manifest: {
      path: manifestPath,
      content: manifestContent,
      parsed: manifestParsed,
    },
    mainJs: {
      path: mainJsPath,
      content: mainJsContent,
    },
    ...(stylesCssContent && {
      stylesCss: {
        path: stylesCssPath,
        content: stylesCssContent,
      },
    }),
  };
}
