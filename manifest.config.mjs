import packageJson from "./package.json" assert { type: "json" };

export const manifest = {
  id: packageJson.name,
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
  author: packageJson.author
}
