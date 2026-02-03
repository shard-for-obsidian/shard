import type { App } from "obsidian";
import type { GHCRClient } from "../client/registry-client.mjs";
import type { ManifestOCIDescriptor } from "../client/types.mjs";

export interface InstallResult {
  pluginId: string;
  filesInstalled: number;
}

export class Installer {
  constructor(
    public app: App,
    public ghcr: GHCRClient,
  ) {}

  async install(repo: string, tag: string): Promise<InstallResult> {
    console.log(`[Installer] Starting installation for ${repo}:${tag}`);

    // 1. Fetch manifest
    console.log(`[Installer] Fetching manifest for tag: ${tag}`);
    const { manifest } = await this.ghcr.getManifest({ ref: tag });
    console.log(`[Installer] Manifest fetched:`, manifest);

    // 2. Validate manifest has layers
    if (!("layers" in manifest) || !manifest.layers?.length) {
      throw new Error("Invalid manifest: no layers found");
    }

    // 3. Extract file mappings from annotations
    const fileMap = new Map<string, string>(); // filename -> digest
    for (const layer of manifest.layers) {
      const filename = this.getFilenameFromAnnotations(layer);
      console.log(`[Installer] Found layer: ${filename} -> ${layer.digest}`);
      fileMap.set(filename, layer.digest);
    }

    // 4. Validate required files exist
    const required = ["main.js", "manifest.json", "styles.css"];
    for (const file of required) {
      if (!fileMap.has(file)) {
        throw new Error(`Missing required file: ${file}`);
      }
    }

    // 5. Determine installation path
    const pluginId = this.getPluginId(repo);
    const pluginDir = await this.ensurePluginDirectory(pluginId);
    console.log(`[Installer] Installing to: ${pluginDir}`);

    // 6. Download and write each file
    for (const [filename, digest] of fileMap) {
      console.log(`[Installer] Downloading ${filename}...`);
      console.log(`[Installer] Digest: ${digest}`);
      try {
        const { buffer } = await this.ghcr.downloadBlob({ digest });
        console.log(`[Installer] Downloaded ${filename}, size: ${buffer.byteLength} bytes`);
        const filePath = `${pluginDir}/${filename}`;
        await this.app.vault.adapter.writeBinary(filePath, buffer);
        console.log(`[Installer] Written ${filename} to ${filePath}`);
      } catch (error) {
        console.error(`[Installer] Error downloading ${filename}:`, error);
        throw new Error(`Failed to download ${filename}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return { pluginId, filesInstalled: fileMap.size };
  }

  private getPluginId(repo: string): string {
    // Convert "ghcr.io/owner/repo" to "ghcr.io.owner.repo"
    return repo.replace(/\//g, ".");
  }

  private getFilenameFromAnnotations(layer: ManifestOCIDescriptor): string {
    const annotation = layer.annotations?.["org.opencontainers.image.title"];
    if (!annotation) {
      throw new Error(`Layer ${layer.digest} missing filename annotation`);
    }
    return annotation;
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
