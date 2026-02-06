import { ItemView, WorkspaceLeaf, Notice, setIcon } from "obsidian";
import type GHCRTagBrowserPlugin from "../main";
import { MarketplaceClient } from "./marketplace-client";
import type { MarketplacePlugin } from "./types";
import { VersionSelectionModal } from "../version-selection-modal";
import { GHCRWrapper } from "../ghcr-wrapper";
import { Installer } from "../installer/installer.js";

export const MARKETPLACE_VIEW_TYPE = "shard-marketplace-view";

export class MarketplaceView extends ItemView {
  private plugin: GHCRTagBrowserPlugin;
  private client: MarketplaceClient;
  private plugins: MarketplacePlugin[] = [];
  private loading = false;

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
    await this.render();
  }

  async onClose(): Promise<void> {
    // Cleanup if needed
  }

  /**
   * Refresh the marketplace data and re-render.
   */
  async refresh(): Promise<void> {
    this.client.clearCache();
    await this.render();
  }

  /**
   * Update client configuration when settings change.
   */
  updateConfig(url: string, ttl: number): void {
    this.client.setMarketplaceUrl(url);
    this.client.setCacheTTL(ttl);
  }

  private async render(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();

    // Header
    const header = container.createDiv("marketplace-header");
    header.setCssProps({
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "16px",
      borderBottom: "1px solid var(--background-modifier-border)",
    });

    const title = header.createEl("h2");
    title.setText("Shard Marketplace");
    title.setCssProps({ margin: "0" });

    const refreshBtn = header.createDiv("clickable-icon");
    refreshBtn.setAttribute("aria-label", "Refresh marketplace");
    setIcon(refreshBtn, "refresh-cw");
    refreshBtn.onclick = () => {
      void this.refresh();
    };

    // Content area
    const content = container.createDiv("marketplace-content");
    content.setCssProps({
      padding: "16px",
      overflowY: "auto",
    });

    // Load and render plugins
    await this.loadPlugins(content);
  }

  private async loadPlugins(container: HTMLElement): Promise<void> {
    if (this.loading) return;

    this.loading = true;

    // Show loading state
    const loadingDiv = container.createDiv();
    loadingDiv.setText("Loading marketplace plugins...");
    loadingDiv.setCssProps({
      textAlign: "center",
      padding: "32px",
      color: "var(--text-muted)",
    });

    try {
      this.plugins = await this.client.fetchPlugins();
      loadingDiv.remove();

      if (this.plugins.length === 0) {
        this.renderEmptyState(container);
      } else {
        this.renderPluginList(container);
      }
    } catch (error) {
      loadingDiv.remove();
      this.renderError(
        container,
        error instanceof Error ? error.message : "Unknown error",
      );
    } finally {
      this.loading = false;
    }
  }

  private renderEmptyState(container: HTMLElement): void {
    const emptyState = container.createDiv();
    emptyState.setText("No plugins found in marketplace");
    emptyState.setCssProps({
      textAlign: "center",
      padding: "32px",
      color: "var(--text-muted)",
      fontStyle: "italic",
    });
  }

  private renderError(container: HTMLElement, error: string): void {
    const errorDiv = container.createDiv();
    errorDiv.setCssProps({
      padding: "16px",
      backgroundColor: "var(--background-modifier-error)",
      borderRadius: "4px",
      color: "var(--text-error)",
    });

    const errorTitle = errorDiv.createEl("strong");
    errorTitle.setText("Failed to load marketplace");
    errorDiv.createEl("br");

    const errorMsg = errorDiv.createDiv();
    errorMsg.setText(error);
    errorMsg.setCssProps({
      marginTop: "8px",
      fontSize: "0.9em",
    });
  }

  private renderPluginList(container: HTMLElement): void {
    const pluginList = container.createDiv("marketplace-plugin-list");

    for (const plugin of this.plugins) {
      this.renderPluginCard(pluginList, plugin);
    }
  }

  private renderPluginCard(container: HTMLElement, plugin: MarketplacePlugin): void {
    const card = container.createDiv("marketplace-plugin-card");
    card.setCssProps({
      padding: "16px",
      marginBottom: "12px",
      border: "1px solid var(--background-modifier-border)",
      borderRadius: "4px",
      backgroundColor: "var(--background-primary)",
    });

    // Header row with name and install button
    const headerRow = card.createDiv();
    headerRow.setCssProps({
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "8px",
    });

    const name = headerRow.createEl("h3");
    name.setText(plugin.name);
    name.setCssProps({ margin: "0" });

    const installBtn = headerRow.createEl("button");
    installBtn.setText("Browse Versions");
    installBtn.onclick = () => {
      void this.browseVersions(plugin);
    };

    // Author
    const author = card.createDiv();
    author.setText(`by ${plugin.author}`);
    author.setCssProps({
      fontSize: "0.9em",
      color: "var(--text-muted)",
      marginBottom: "8px",
    });

    // Description
    const description = card.createDiv();
    description.setText(plugin.description);
    description.setCssProps({
      marginBottom: "8px",
    });

    // Repository link (if available)
    if (plugin.repository) {
      const repoLink = card.createEl("a");
      repoLink.setText(plugin.repository);
      repoLink.href = plugin.repository;
      repoLink.setCssProps({
        fontSize: "0.85em",
        color: "var(--text-accent)",
      });
    }

    // Registry URL
    const registryDiv = card.createDiv();
    registryDiv.setText(plugin.registryUrl);
    registryDiv.setCssProps({
      fontSize: "0.85em",
      color: "var(--text-muted)",
      fontFamily: "monospace",
      marginTop: "4px",
    });

    // Installation status
    const installedInfo = this.getInstalledInfo(plugin.registryUrl);
    if (installedInfo) {
      const statusDiv = card.createDiv();
      statusDiv.setCssProps({
        marginTop: "8px",
        padding: "8px",
        backgroundColor: "var(--background-secondary)",
        borderRadius: "4px",
        fontSize: "0.9em",
      });

      const digestShort = installedInfo.digest.substring(0, 23) + "...";
      statusDiv.setText(
        `Installed: ${installedInfo.tag} (${digestShort})`,
      );
      statusDiv.title = installedInfo.digest;
    }
  }

  private async browseVersions(plugin: MarketplacePlugin): Promise<void> {
    try {
      new Notice(`Fetching versions for ${plugin.name}...`);

      // Use the registry URL directly
      const repoUrl = plugin.registryUrl;

      // Get auth token
      const secretToken = this.plugin.settings.githubToken
        ? this.app.secretStorage.getSecret(this.plugin.settings.githubToken)
        : null;
      const token = secretToken || undefined;

      // Fetch tags
      const tags = await GHCRWrapper.getTags(repoUrl, token);

      if (tags.length === 0) {
        new Notice(`No versions found for ${plugin.name}`);
        return;
      }

      // Get installed info
      const installedInfo = this.getInstalledInfo(plugin.registryUrl);

      // Show version selection modal
      new VersionSelectionModal(
        this.app,
        repoUrl,
        tags,
        false, // showAllTags
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

      // Get auth token
      const secretToken = this.plugin.settings.githubToken
        ? this.app.secretStorage.getSecret(this.plugin.settings.githubToken)
        : null;
      const token = secretToken || undefined;

      // Create GHCR client
      const ghcrClient = GHCRWrapper.createClient(repoUrl, token);

      // Fetch manifest to get digest
      const { resp } = await ghcrClient.getManifest({ ref: tag });
      const digest = resp.headers.get("docker-content-digest") || "unknown";

      // Create installer and perform installation
      const installer = new Installer(this.app, ghcrClient);
      const result = await installer.install(repoUrl, tag);

      // Update installed plugins settings
      this.plugin.settings.installedPlugins[repoUrl] = {
        tag,
        digest,
        installedAt: Date.now(),
        pluginId: result.pluginId,
      };
      await this.plugin.saveSettings();

      // Show success notice
      new Notice(
        `Successfully installed ${pluginName}@${tag} (${result.filesInstalled} files)`,
      );

      // Re-render to update status
      await this.render();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      new Notice(`Failed to install ${pluginName}@${tag}: ${errorMessage}`);
      console.error(`[MarketplaceView] Installation error:`, error);
    }
  }

  private convertGitHubUrlToGHCR(githubUrl: string): string {
    // Convert https://github.com/owner/repo to ghcr.io/owner/repo
    const match = githubUrl.match(
      /^https?:\/\/github\.com\/([^/]+)\/([^/]+)/,
    );
    if (match) {
      const owner = match[1];
      const repo = match[2];
      return `ghcr.io/${owner}/${repo}`;
    }

    // If already in ghcr.io format, return as-is
    if (githubUrl.startsWith("ghcr.io/")) {
      return githubUrl;
    }

    throw new Error(`Cannot convert repository URL: ${githubUrl}`);
  }

  private getInstalledInfo(registryUrl: string) {
    // Look up by registry URL
    return this.plugin.settings.installedPlugins[registryUrl] || null;
  }
}
