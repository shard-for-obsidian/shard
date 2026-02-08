import type { App } from "obsidian";
import type { OciRegistryClient } from "@shard-for-obsidian/lib";

export interface InstallResult {
  pluginId: string;
  filesInstalled: number;
}

export class Installer {
  constructor(
    public app: App,
    public ghcr: OciRegistryClient,
  ) {}

  async install(repo: string, tag: string): Promise<InstallResult> {
    console.log(`[Installer] Starting installation for ${repo}:${tag}`);

    // 1. Fetch manifest and extract plugin manifest from config
    console.log(`[Installer] Fetching manifest for tag: ${tag}`);
    const pullResult = await this.ghcr.pullPluginManifest({ ref: tag });
    console.log(`[Installer] Manifest fetched`);

    // 2. Extract plugin manifest from config
    const obsidianManifest = pullResult.pluginManifest;
    console.log(`[Installer] Extracted plugin manifest:`, obsidianManifest);

    // 3. Validate manifest has layers
    if (!pullResult.manifest.layers?.length) {
      throw new Error("Invalid manifest: no layers found");
    }

    // 4. Map layers by annotation to filenames
    const fileMap = new Map<string, string>(); // filename -> digest
    for (const layer of pullResult.manifest.layers) {
      // Extract filename from annotation
      const filename = layer.annotations?.["vnd.obsidianmd.layer.filename"];
      if (filename) {
        console.log(
          `[Installer] Found layer: ${filename} (${layer.mediaType}) -> ${layer.digest}`,
        );
        fileMap.set(filename, layer.digest);
      } else {
        console.warn(
          `[Installer] Layer ${layer.digest} missing filename annotation, skipping`,
        );
      }
    }

    // 5. Validate required files exist
    const required = ["main.js"];
    for (const file of required) {
      if (!fileMap.has(file)) {
        throw new Error(`Missing required file: ${file}`);
      }
    }

    // 6. Use plugin ID from manifest
    const pluginId = obsidianManifest.id;
    const pluginDir = await this.ensurePluginDirectory(pluginId);
    console.log(`[Installer] Installing to: ${pluginDir}`);

    // 7. Write manifest.json from plugin manifest
    const manifestJson = JSON.stringify(obsidianManifest, null, 2);
    const manifestPath = `${pluginDir}/manifest.json`;
    await this.app.vault.adapter.write(manifestPath, manifestJson);
    console.log(`[Installer] Written manifest.json to ${manifestPath}`);

    // 8. Download and write each file
    for (const [filename, digest] of fileMap) {
      console.log(`[Installer] Downloading ${filename}...`);
      console.log(`[Installer] Digest: ${digest}`);
      try {
        const { buffer } = await this.ghcr.downloadBlob({ digest });
        console.log(
          `[Installer] Downloaded ${filename}, size: ${buffer.byteLength} bytes`,
        );
        const filePath = `${pluginDir}/${filename}`;
        await this.app.vault.adapter.writeBinary(filePath, buffer);
        console.log(`[Installer] Written ${filename} to ${filePath}`);
      } catch (error) {
        console.error(`[Installer] Error downloading ${filename}:`, error);
        throw new Error(
          `Failed to download ${filename}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return { pluginId, filesInstalled: fileMap.size + 1 }; // +1 for manifest.json
  }

  private getPluginId(repo: string): string {
    // Convert repo path to reverse domain notation
    // e.g., "ghcr.io/owner/repo/subrepo" -> "io.ghcr.owner.repo.subrepo"
    const parts = repo.split("/");

    // Reverse the domain part (ghcr.io → io.ghcr)
    const domain = parts[0].split(".").reverse().join(".");

    // Join with remaining path parts
    return [domain, ...parts.slice(1)].join(".");
  }

  private async ensurePluginDirectory(pluginId: string): Promise<string> {
    const pluginDir = `.obsidian/plugins/${pluginId}`;

    // Check if directory exists
    const exists = await this.app.vault.adapter.exists(pluginDir);
    if (!exists) {
      await this.app.vault.adapter.mkdir(pluginDir);
    }

    return pluginDir;
  }
}
