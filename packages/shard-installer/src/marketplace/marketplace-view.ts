import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import type GHCRTagBrowserPlugin from "../main";
import { MarketplaceClient } from "./marketplace-client";
import type { MarketplacePlugin } from "./types";
import { VersionSelectionModal } from "../version-selection-modal";
import { GHCRWrapper } from "../ghcr-wrapper";
import { Installer } from "../installer/installer.js";
import {
  LoadingSpinner,
  ErrorBanner,
  EmptyState,
  List,
} from "../ui";
import {
  MarketplaceHeader,
  PluginCard,
} from "./components";

export const MARKETPLACE_VIEW_TYPE = "shard-marketplace-view";

interface ViewState {
  plugins: MarketplacePlugin[];
  loading: boolean;
  error: string | null;
}

export class MarketplaceView extends ItemView {
  private plugin: GHCRTagBrowserPlugin;
  private client: MarketplaceClient;
  private state: ViewState = {
    plugins: [],
    loading: false,
    error: null,
  };

  constructor(leaf: WorkspaceLeaf, plugin: GHCRTagBrowserPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.client = new MarketplaceClient(
      this.plugin.settings.marketplaceUrl,
      this.plugin.settings.marketplaceCacheTTL,
    );
  }

  getViewType(): string {
    return MARKETPLACE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Shard Marketplace";
  }

  getIcon(): string {
    return "store";
  }

  async onOpen(): Promise<void> {
    await this.loadPlugins();
    this.render();
  }

  async onClose(): Promise<void> {
    // Cleanup if needed
  }

  updateConfig(url: string, ttl: number): void {
    this.client.setMarketplaceUrl(url);
    this.client.setCacheTTL(ttl);
  }

  private updateState(updates: Partial<ViewState>): void {
    this.state = { ...this.state, ...updates };
    this.render();
  }

  private async refresh(): Promise<void> {
    this.client.clearCache();
    await this.loadPlugins();
  }

  private async loadPlugins(): Promise<void> {
    if (this.state.loading) return;

    this.updateState({ loading: true, error: null });

    try {
      const plugins = await this.client.fetchPlugins();
      this.updateState({ plugins, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.updateState({ loading: false, error: message });
    }
  }

  private render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("shard-view");

    // Header
    MarketplaceHeader(container, {
      onRefresh: () => this.refresh(),
    });

    // Content
    const content = container.createDiv("shard-view__content");

    // Loading state
    if (this.state.loading) {
      LoadingSpinner(content, { text: "Loading marketplace plugins..." });
      return;
    }

    // Error state
    if (this.state.error) {
      ErrorBanner(content, {
        title: "Failed to load marketplace",
        message: this.state.error,
        onRetry: () => this.refresh(),
      });
      return;
    }

    // Empty state
    if (this.state.plugins.length === 0) {
      EmptyState(content, {
        icon: "package",
        message: "No plugins found in marketplace",
      });
      return;
    }

    // Plugin list
    const pluginList = List(content);
    for (const plugin of this.state.plugins) {
      const installedInfo = this.getInstalledInfo(plugin.registryUrl);
      PluginCard(pluginList, {
        plugin,
        installedInfo,
        onBrowseVersions: (plugin) => this.browseVersions(plugin),
      });
    }
  }

  private async browseVersions(plugin: MarketplacePlugin): Promise<void> {
    try {
      new Notice(`Fetching versions for ${plugin.name}...`);

      const repoUrl = plugin.registryUrl;
      const secretToken = this.plugin.settings.githubToken
        ? this.app.secretStorage.getSecret(this.plugin.settings.githubToken)
        : null;
      const token = secretToken || undefined;

      const tags = await GHCRWrapper.getTags(repoUrl, token);

      if (tags.length === 0) {
        new Notice(`No versions found for ${plugin.name}`);
        return;
      }

      const installedInfo = this.getInstalledInfo(plugin.registryUrl);

      new VersionSelectionModal(
        this.app,
        repoUrl,
        tags,
        false,
        installedInfo?.tag || null,
        (selectedTag: string) => {
          void this.installPlugin(repoUrl, selectedTag, plugin.name);
        },
      ).open();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      new Notice(`Failed to fetch versions: ${errorMessage}`);
      console.error(`[MarketplaceView] Error fetching versions:`, error);
    }
  }

  private async installPlugin(
    repoUrl: string,
    tag: string,
    pluginName: string,
  ): Promise<void> {
    try {
      new Notice(`Installing ${pluginName}@${tag}...`);

      const secretToken = this.plugin.settings.githubToken
        ? this.app.secretStorage.getSecret(this.plugin.settings.githubToken)
        : null;
      const token = secretToken || undefined;

      const ghcrClient = GHCRWrapper.createClient(repoUrl, token);
      const { resp } = await ghcrClient.getManifest({ ref: tag });
      const digest = resp.headers.get("docker-content-digest") || "unknown";

      const installer = new Installer(this.app, ghcrClient);
      const result = await installer.install(repoUrl, tag);

      this.plugin.settings.installedPlugins[repoUrl] = {
        tag,
        digest,
        installedAt: Date.now(),
        pluginId: result.pluginId,
      };
      await this.plugin.saveSettings();

      new Notice(
        `Successfully installed ${pluginName}@${tag} (${result.filesInstalled} files)`,
      );

      this.render();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      new Notice(`Failed to install ${pluginName}@${tag}: ${errorMessage}`);
      console.error(`[MarketplaceView] Installation error:`, error);
    }
  }

  private getInstalledInfo(registryUrl: string) {
    return this.plugin.settings.installedPlugins[registryUrl] || null;
  }
}
