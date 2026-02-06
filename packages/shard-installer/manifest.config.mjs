import process from "node:process";
import packageJson from "./package.json" with { type: "json" };

// Extract Obsidian version from dependencies (removing ^ if present)
const obsidianVersion = (packageJson.dependencies?.obsidian || "").replace(/^\^/, "");

export const manifest = {
  id: packageJson.name,
  name: "Shard Installer",
  version: packageJson.version,
  description: packageJson.description,
  author: packageJson.author,
  minAppVersion: obsidianVersion,
};

// If this file is run directly, pretty-print manifest to stdout
if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(JSON.stringify(manifest, null, 2) + "\n");
}

