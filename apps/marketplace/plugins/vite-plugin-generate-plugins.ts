import type { Plugin } from "vite";
import { generatePluginsJson } from "../scripts/generate-plugins-json.js";
import { buildSearchIndex } from "../scripts/build-search-index.js";

export function generatePluginsPlugin(): Plugin {
  return {
    name: "generate-plugins-json",
    async buildStart() {
      await generatePluginsJson();
      await buildSearchIndex();
    },
    configureServer(server) {
      server.watcher.add("content/plugins");
      server.watcher.on("change", async (changedPath) => {
        if (changedPath.includes("content/plugins")) {
          await generatePluginsJson();
          await buildSearchIndex();
        }
      });
    },
  };
}
