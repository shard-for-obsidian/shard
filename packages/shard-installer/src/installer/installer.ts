import type { App } from "obsidian";
import type { OciRegistryClient } from "shard-lib";

export interface InstallResult {
  pluginId: string;
  filesInstalled: number;
}

interface ObsidianManifest {
  id: string;
  name: string;
  version: string;
  minAppVersion: string;
  description: string;
  author: string;
  authorUrl?: string;
  isDesktopOnly?: boolean;
}

interface ImageConfig {
  config?: {
    Labels?: Record<string, string>;
  };
}

export class Installer {
  constructor(
    public app: App,
    public ghcr: OciRegistryClient,
  ) {}

  async install(repo: string, tag: string): Promise<InstallResult> {
    console.log(`[Installer] Starting installation for ${repo}:${tag}`);

    // 1. Fetch manifest
    console.log(`[Installer] Fetching manifest for tag: ${tag}`);
    const { manifest } = await this.ghcr.getManifest({ ref: tag });
    console.log(`[Installer] Manifest fetched`);

    // 2. Validate manifest has layers and config
    if (!("layers" in manifest) || !manifest.layers?.length) {
      throw new Error("Invalid manifest: no layers found");
    }

    if (!manifest.config) {
      throw new Error("Invalid manifest: no config found");
    }

    // 3. Fetch and parse config to get labels
    console.log(`[Installer] Fetching config blob: ${manifest.config.digest}`);
    const { buffer: configBuffer } = await this.ghcr.downloadBlob({
      digest: manifest.config.digest,
    });
    const configText = new TextDecoder().decode(configBuffer);
    const config = JSON.parse(configText) as ImageConfig;
    console.log(`[Installer] Config fetched, labels:`, config.config?.Labels);

    // 4. Extract plugin metadata from config labels
    const obsidianManifest = this.extractObsidianManifest(config);
    console.log(`[Installer] Extracted plugin manifest:`, obsidianManifest);

    // 5. Map layers by media type to filenames
    const fileMap = new Map<string, string>(); // filename -> digest
    for (const layer of manifest.layers) {
      // Skip empty layers
      if (layer.mediaType === "application/vnd.oci.empty.v1+json") {
        console.log(`[Installer] Skipping empty layer: ${layer.digest}`);
        continue;
      }

      const filename = this.getFilenameFromMediaType(layer.mediaType);
      if (filename) {
        console.log(
          `[Installer] Found layer: ${filename} (${layer.mediaType}) -> ${layer.digest}`,
        );
        fileMap.set(filename, layer.digest);
      } else {
        console.warn(
          `[Installer] Unknown media type: ${layer.mediaType}, skipping`,
        );
      }
    }

    // 6. Validate required files exist
    const required = ["main.js", "styles.css"];
    for (const file of required) {
      if (!fileMap.has(file)) {
        throw new Error(`Missing required file: ${file}`);
      }
    }

    // 7. Use plugin ID from config labels or fall back to computed ID
    const pluginId = obsidianManifest.id || this.getPluginId(repo);
    const pluginDir = await this.ensurePluginDirectory(pluginId);
    console.log(`[Installer] Installing to: ${pluginDir}`);

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

    // 9. Generate and write manifest.json
    const manifestJson = JSON.stringify(obsidianManifest, null, 2);
    const manifestPath = `${pluginDir}/manifest.json`;
    await this.app.vault.adapter.write(manifestPath, manifestJson);
    console.log(`[Installer] Written manifest.json to ${manifestPath}`);

    return { pluginId, filesInstalled: fileMap.size + 1 }; // +1 for manifest.json
  }

  private extractObsidianManifest(config: ImageConfig): ObsidianManifest {
    const labels = config.config?.Labels || {};

    // Extract Obsidian plugin metadata from config labels
    const id = labels["md.obsidian.plugin.v1.id"] || "";
    const name =
      labels["md.obsidian.plugin.v1.name"] ||
      labels["org.opencontainers.image.title"] ||
      "";
    const version =
      labels["md.obsidian.plugin.v1.version"] ||
      labels["org.opencontainers.image.version"] ||
      "0.0.0";
    const minAppVersion =
      labels["md.obsidian.plugin.v1.minAppVersion"] || "0.0.0";
    const description =
      labels["md.obsidian.plugin.v1.description"] ||
      labels["org.opencontainers.image.description"] ||
      "";
    const author =
      labels["md.obsidian.plugin.v1.author"] ||
      labels["org.opencontainers.image.authors"] ||
      "";
    const authorUrl =
      labels["md.obsidian.plugin.v1.authorUrl"] ||
      labels["org.opencontainers.image.url"];
    const isDesktopOnly =
      labels["md.obsidian.plugin.v1.isDesktopOnly"] === "true";

    // Validate required fields
    if (!id) {
      throw new Error(
        "Missing required config label: md.obsidian.plugin.v1.id",
      );
    }
    if (!name) {
      throw new Error(
        "Missing required config label: md.obsidian.plugin.v1.name",
      );
    }
    if (!version) {
      throw new Error(
        "Missing required config label: md.obsidian.plugin.v1.version",
      );
    }

    const obsidianManifest: ObsidianManifest = {
      id,
      name,
      version,
      minAppVersion,
      description,
      author,
    };

    if (authorUrl) {
      obsidianManifest.authorUrl = authorUrl;
    }

    if (isDesktopOnly) {
      obsidianManifest.isDesktopOnly = isDesktopOnly;
    }

    return obsidianManifest;
  }

  private getFilenameFromMediaType(mediaType: string): string | null {
    const mediaTypeMap: Record<string, string> = {
      "application/javascript": "main.js",
      "text/javascript": "main.js",
      "text/css": "styles.css",
      "application/json": "manifest.json", // In case someone still includes it
    };

    return mediaTypeMap[mediaType] || null;
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
