import packageJson from "./package.json" assert { type: "json" };

// Extract Obsidian version from dependencies (removing ^ if present)
const obsidianVersion = (packageJson.dependencies?.obsidian || "").replace(/^\^/, "");

export const manifest = {
  id: packageJson.name,
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
  author: packageJson.author,
  minAppVersion: obsidianVersion,
};
