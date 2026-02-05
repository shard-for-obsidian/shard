import {
  App,
  PluginSettingTab,
  SecretComponent,
  Setting,
  Notice,
  setIcon,
} from "obsidian";
import type GHCRTagBrowserPlugin from "./main";
import { TagCache } from "./tag-cache";
import { GHCRWrapper } from "./ghcr-wrapper";
import type { RepositoryConfig } from "./types";
import { Installer } from "./installer/installer.js";
import { VersionSelectionModal } from "./version-selection-modal";
import { parseRepoAndRef } from "shard-lib";

export class GHCRSettingTab extends PluginSettingTab {
  plugin: GHCRTagBrowserPlugin;
  private tagCache: TagCache = new TagCache();
  private repositoryListContainer: HTMLElement | null = null;

  constructor(app: App, plugin: GHCRTagBrowserPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // GitHub Token section
    this.renderTokenSection(containerEl);

    // Add Repository section
    this.renderAddRepositorySection(containerEl);

    // Managed Repositories section
    void this.renderRepositoriesSection(containerEl);
  }

  private renderTokenSection(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName("GitHub token")
      .setDesc("Optional personal access token for private repositories")
      .addComponent((el) =>
        new SecretComponent(this.app, el)
          .setValue(this.plugin.settings.githubToken)
          .onChange((value) => {
            this.plugin.settings.githubToken = value;
            void this.plugin.saveSettings();
          }),
      );
  }

  private renderAddRepositorySection(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName("Add repository")
      .setDesc(
        "Enter repository URL (e.g., owner/repo or ghcr.io/owner/repo/subrepo)",
      )
      .addText((text) => {
        text.setPlaceholder("owner/repo or ghcr.io/owner/repo/path");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        text.inputEl.addEventListener("keypress", (e: any) => {
          if (e.key === "Enter") {
            void this.addRepository(text.getValue());
            text.setValue("");
          }
        });
      })
      .addButton((button) => {
        button.setButtonText("Add").onClick(() => {
          const input = button.buttonEl.parentElement?.querySelector("input");
          if (input) {
            void this.addRepository(input.value);
            input.value = "";
          }
        });
      });
  }

  private async renderRepositoriesSection(
    containerEl: HTMLElement,
  ): Promise<void> {
    // Create setting group container
    const settingGroup = containerEl.createDiv("setting-group");
    settingGroup.addClass("ghcr-repositories-container");

    // Header
    const header = settingGroup.createDiv("setting-item");
    header.addClass("setting-item-heading");

    const headerName = header.createDiv("setting-item-name");
    headerName.setText("Managed repositories");

    const headerControl = header.createDiv("setting-item-control");

    // Refresh all button
    const refreshAllBtn = headerControl.createDiv("clickable-icon");
    refreshAllBtn.addClass("extra-setting-button");
    refreshAllBtn.setAttribute("aria-label", "Refresh all repositories");
    setIcon(refreshAllBtn, "refresh-cw");
    refreshAllBtn.onclick = async () => {
      this.tagCache.clear();
      await this.refreshAllRepositories();
    };

    // Items container
    this.repositoryListContainer = settingGroup.createDiv("setting-items");

    // Fetch tags for all repositories and render
    await this.refreshAllRepositories();
  }

  private async addRepository(repoUrl: string): Promise<void> {
    const trimmed = repoUrl.trim();
    if (!trimmed) {
      new Notice("Please enter a repository URL");
      return;
    }

    // Normalize the URL - always ensure ghcr.io prefix
    let normalized = trimmed.replace(/^https?:\/\//, "");

    // Add ghcr.io prefix if not present
    if (!normalized.startsWith("ghcr.io/")) {
      normalized = `ghcr.io/${normalized}`;
    }

    // Validate format using shard-lib parser (supports nested repos)
    try {
      parseRepoAndRef(normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid format";
      new Notice(`Invalid repository format: ${message}`);
      return;
    }

    // Check for duplicates
    if (
      this.plugin.settings.repositories.some((r) => r.repoUrl === normalized)
    ) {
      new Notice("Repository already in your list");
      return;
    }

    // Add to settings
    this.plugin.settings.repositories.push({
      repoUrl: normalized,
      showAllTags: false,
    });
    await this.plugin.saveSettings();

    // Refresh display
    await this.refreshAllRepositories();
  }

  private async removeRepository(repoUrl: string): Promise<void> {
    // Check if plugin is installed
    const installedInfo = this.plugin.settings.installedPlugins[repoUrl];
    if (installedInfo) {
      new Notice(
        "Cannot remove repository while plugin is installed. Uninstall the plugin first.",
      );
      return;
    }

    // Remove from settings
    this.plugin.settings.repositories =
      this.plugin.settings.repositories.filter((r) => r.repoUrl !== repoUrl);
    await this.plugin.saveSettings();

    // Clear from cache
    this.tagCache.delete(repoUrl);

    // Refresh display
    await this.refreshAllRepositories();
  }

  private async refreshAllRepositories(): Promise<void> {
    if (!this.repositoryListContainer) return;

    this.repositoryListContainer.empty();

    if (this.plugin.settings.repositories.length === 0) {
      const emptyState = this.repositoryListContainer.createDiv("setting-item");
      const emptyInfo = emptyState.createDiv("setting-item-info");
      emptyInfo.createDiv({ text: "No repositories added yet" }).setCssProps({
        fontStyle: "italic",
        color: "var(--text-muted)",
      });
      return;
    }

    // Render all repositories
    for (const repo of this.plugin.settings.repositories) {
      await this.renderRepositoryEntry(repo);
    }
  }

  private async renderRepositoryEntry(repo: RepositoryConfig): Promise<void> {
    if (!this.repositoryListContainer) return;

    // Check if we have cached tags
    const cached = this.tagCache.get(repo.repoUrl);

    if (!cached?.tags && !cached?.error) {
      // Need to fetch tags
      this.renderRepositoryLoading(repo);
      await this.fetchTagsForRepository(repo);
      return;
    }

    if (cached?.error) {
      this.renderRepositoryError(repo, cached.error);
      return;
    }

    if (cached?.tags) {
      this.renderRepositoryWithTags(repo, cached.tags);
    }
  }

  private renderRepositoryLoading(repo: RepositoryConfig): void {
    if (!this.repositoryListContainer) return;

    const settingItem = this.repositoryListContainer.createDiv("setting-item");

    const settingInfo = settingItem.createDiv("setting-item-info");
    settingInfo.createDiv("setting-item-name").setText(repo.repoUrl);
    const description = settingInfo.createDiv("setting-item-description");
    description.createDiv().setText("Loading tags...");

    const settingControl = settingItem.createDiv("setting-item-control");
    this.addRefreshButton(settingControl, repo);
    this.addRemoveButton(settingControl, repo);
  }

  private renderRepositoryError(repo: RepositoryConfig, error: string): void {
    if (!this.repositoryListContainer) return;

    const settingItem = this.repositoryListContainer.createDiv("setting-item");

    settingItem.setCssProps({
      borderLeft: "3px solid var(--text-error)",
    });

    const settingInfo = settingItem.createDiv("setting-item-info");
    settingInfo.createDiv("setting-item-name").setText(repo.repoUrl);
    const description = settingInfo.createDiv("setting-item-description");
    const errorDiv = description.createDiv();
    errorDiv.setText(`Failed to fetch tags: ${error}`);
    errorDiv.setCssProps({
      color: "var(--text-error)",
    });

    const settingControl = settingItem.createDiv("setting-item-control");

    // Retry button
    const retryBtn = settingControl.createDiv("clickable-icon");
    retryBtn.addClass("extra-setting-button");
    retryBtn.setAttribute("aria-label", "Retry");
    setIcon(retryBtn, "refresh-cw");
    retryBtn.onclick = async () => {
      this.tagCache.delete(repo.repoUrl);
      await this.fetchTagsForRepository(repo);
    };

    this.addRefreshButton(settingControl, repo);
    this.addRemoveButton(settingControl, repo);
  }

  private renderRepositoryWithTags(
    repo: RepositoryConfig,
    tags: string[],
  ): void {
    if (!this.repositoryListContainer) return;

    const settingItem = this.repositoryListContainer.createDiv("setting-item");

    // Get installed info
    let installedInfo = this.plugin.settings.installedPlugins[repo.repoUrl];
    if (!installedInfo && !repo.repoUrl.startsWith("ghcr.io/")) {
      installedInfo =
        this.plugin.settings.installedPlugins[`ghcr.io/${repo.repoUrl}`];
    }

    const settingInfo = settingItem.createDiv("setting-item-info");
    settingInfo.setCssProps({
      cursor: "auto",
    });

    // Repository name
    settingInfo.createDiv("setting-item-name").setText(repo.repoUrl);

    // Description area with button and status
    const description = settingInfo.createDiv("setting-item-description");

    // Version selection row
    const versionRow = description.createDiv();
    versionRow.setCssProps({
      display: "flex",
      gap: "8px",
      alignItems: "center",
      marginBottom: "8px",
    });

    // Select version button
    const selectVersionButton = versionRow.createEl("button");
    selectVersionButton.setText("Select version");
    selectVersionButton.onclick = () => {
      new VersionSelectionModal(
        this.app,
        repo.repoUrl,
        tags,
        repo.showAllTags,
        installedInfo?.tag || null,
        (selectedTag: string) => {
          void this.installPlugin(repo.repoUrl, selectedTag);
        },
      ).open();
    };

    // Show all tags checkbox
    const checkboxLabel = versionRow.createEl("label");
    checkboxLabel.setCssProps({
      display: "flex",
      alignItems: "center",
      gap: "4px",
      cursor: "pointer",
      whiteSpace: "nowrap",
    });

    const checkbox = checkboxLabel.createEl("input", { type: "checkbox" });
    checkbox.checked = repo.showAllTags;
    checkbox.onchange = async () => {
      repo.showAllTags = checkbox.checked;
      await this.plugin.saveSettings();
      await this.refreshAllRepositories();
    };

    checkboxLabel.createSpan({ text: "Show all tags" });

    // Status row
    if (installedInfo) {
      const statusDiv = description.createDiv();
      statusDiv.setCssProps({
        fontSize: "0.9em",
        color: "var(--text-muted)",
      });
      const digestShort = installedInfo.digest.substring(0, 23) + "...";
      statusDiv.setText(`Installed: ${installedInfo.tag} (${digestShort})`);
      statusDiv.title = installedInfo.digest;
    }

    // Control buttons
    const settingControl = settingItem.createDiv("setting-item-control");

    // Uninstall button (if installed)
    if (installedInfo) {
      const uninstallBtn = settingControl.createDiv("clickable-icon");
      uninstallBtn.addClass("extra-setting-button");
      uninstallBtn.setAttribute("aria-label", "Uninstall");
      setIcon(uninstallBtn, "trash-2");
      uninstallBtn.onclick = async () => {
        await this.uninstallPlugin(repo.repoUrl);
      };
    }

    this.addRefreshButton(settingControl, repo);
    this.addRemoveButton(settingControl, repo);
  }

  private addRefreshButton(
    container: HTMLElement,
    repo: RepositoryConfig,
  ): void {
    const refreshBtn = container.createDiv("clickable-icon");
    refreshBtn.addClass("extra-setting-button");
    refreshBtn.setAttribute("aria-label", "Refresh tags");
    setIcon(refreshBtn, "refresh-cw");
    refreshBtn.onclick = async () => {
      this.tagCache.delete(repo.repoUrl);
      await this.fetchTagsForRepository(repo);
    };
  }

  private addRemoveButton(
    container: HTMLElement,
    repo: RepositoryConfig,
  ): void {
    const removeBtn = container.createDiv("clickable-icon");
    removeBtn.addClass("extra-setting-button");
    removeBtn.setAttribute("aria-label", "Remove repository");
    setIcon(removeBtn, "x");

    // Check if installed
    const isInstalled = this.plugin.settings.installedPlugins[repo.repoUrl];
    if (isInstalled) {
      removeBtn.setCssProps({
        opacity: "0.5",
        cursor: "not-allowed",
      });
      removeBtn.setAttribute(
        "aria-label",
        "Uninstall the plugin before removing",
      );
    } else {
      removeBtn.onclick = () => {
        void this.removeRepository(repo.repoUrl);
      };
    }
  }

  private async fetchTagsForRepository(repo: RepositoryConfig): Promise<void> {
    try {
      const secretToken = this.plugin.settings.githubToken
        ? this.app.secretStorage.getSecret(this.plugin.settings.githubToken)
        : null;
      const token = secretToken || undefined;

      const tags = await GHCRWrapper.getTags(repo.repoUrl, token);
      this.tagCache.set(repo.repoUrl, tags);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.tagCache.setError(repo.repoUrl, errorMessage);
    }

    // Re-render this repository
    await this.refreshAllRepositories();
  }

  private async installPlugin(repoUrl: string, tag: string): Promise<void> {
    try {
      new Notice(`Installing ${repoUrl}@${tag}...`);

      // Normalize repo URL to ensure it has ghcr.io prefix
      let normalizedRepoUrl = repoUrl;
      if (!normalizedRepoUrl.startsWith("ghcr.io/")) {
        normalizedRepoUrl = `ghcr.io/${normalizedRepoUrl}`;
      }

      // Get auth token
      const secretToken = this.plugin.settings.githubToken
        ? this.app.secretStorage.getSecret(this.plugin.settings.githubToken)
        : null;
      const token = secretToken || undefined;

      // Create GHCR client
      const ghcrClient = GHCRWrapper.createClient(normalizedRepoUrl, token);

      // Fetch manifest to get digest
      const { resp } = await ghcrClient.getManifest({ ref: tag });
      const digest = resp.headers.get("docker-content-digest") || "unknown";

      // Create installer and perform installation
      const installer = new Installer(this.app, ghcrClient);
      const result = await installer.install(normalizedRepoUrl, tag);

      // Update installed plugins settings (use normalized URL as key)
      this.plugin.settings.installedPlugins[normalizedRepoUrl] = {
        tag,
        digest,
        installedAt: Date.now(),
        pluginId: result.pluginId,
      };
      await this.plugin.saveSettings();

      // Also update the repository config to use normalized URL if it wasn't already
      const repoConfig = this.plugin.settings.repositories.find(
        (r) => r.repoUrl === repoUrl,
      );
      if (repoConfig && repoConfig.repoUrl !== normalizedRepoUrl) {
        repoConfig.repoUrl = normalizedRepoUrl;
        await this.plugin.saveSettings();
      }

      // Show success notice
      new Notice(
        `Successfully installed ${repoUrl}@${tag} (${result.filesInstalled} files)`,
      );

      // Refresh UI to update status
      await this.refreshAllRepositories();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      new Notice(`Failed to install ${repoUrl}@${tag}: ${errorMessage}`);
      console.error(`[Settings] Installation error:`, error);
    }
  }

  private async uninstallPlugin(repoUrl: string): Promise<void> {
    try {
      const installedInfo = this.plugin.settings.installedPlugins[repoUrl];
      if (!installedInfo) {
        new Notice("Plugin not installed");
        return;
      }

      // Delete plugin directory
      const pluginDir = `.obsidian/plugins/${installedInfo.pluginId}`;
      const exists = await this.app.vault.adapter.exists(pluginDir);
      if (exists) {
        await this.app.vault.adapter.rmdir(pluginDir, true);
      }

      // Remove from settings
      delete this.plugin.settings.installedPlugins[repoUrl];
      await this.plugin.saveSettings();

      new Notice(`Successfully uninstalled ${repoUrl}`);

      // Refresh UI
      await this.refreshAllRepositories();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      new Notice(`Failed to uninstall ${repoUrl}: ${errorMessage}`);
      console.error(`[Settings] Uninstall error:`, error);
    }
  }

  hide(): void {
    // Clear cache when settings tab closes
    this.tagCache.clear();
  }
}
