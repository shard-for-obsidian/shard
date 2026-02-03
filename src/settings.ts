import { App, PluginSettingTab, SecretComponent, Setting, Notice } from "obsidian";
import type GHCRTagBrowserPlugin from "./main";
import { TagCache } from "./tag-cache";
import { GHCRWrapper } from "./ghcr-wrapper";
import type { RepositoryConfig } from "./types";
import { filterTags, getActionButtonText } from "./semver-utils";
import { Installer } from "./lib/installer/installer.mjs";

export class GHCRSettingTab extends PluginSettingTab {
  plugin: GHCRTagBrowserPlugin;
  private tagCache: TagCache = new TagCache();
  private repositoryListContainer: HTMLElement | null = null;

  constructor(app: App, plugin: GHCRTagBrowserPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async display(): Promise<void> {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "GHCR Tag Browser Settings" });

    // Add Repository section
    this.renderAddRepositorySection(containerEl);

    // GitHub Token section
    this.renderTokenSection(containerEl);

    // Managed Repositories section
    containerEl.createEl("h3", { text: "Managed Repositories" });
    this.repositoryListContainer = containerEl.createDiv(
      "ghcr-repository-list",
    );

    // Fetch tags for all repositories and render
    await this.refreshAllRepositories();
  }

  private renderAddRepositorySection(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName("Add Repository")
      .setDesc("Enter repository URL (e.g., owner/repo or ghcr.io/owner/repo)")
      .addText((text) => {
        text.setPlaceholder("owner/repo or ghcr.io/owner/repo");
        text.inputEl.addEventListener("keypress", (e) => {
          if (e.key === "Enter") {
            this.addRepository(text.getValue());
            text.setValue("");
          }
        });
      })
      .addButton((button) => {
        button.setButtonText("Add").onClick(async () => {
          const input = button.buttonEl.parentElement?.querySelector("input");
          if (input) {
            await this.addRepository(input.value);
            input.value = "";
          }
        });
      });
  }

  private renderTokenSection(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName("GitHub Token")
      .setDesc("Optional personal access token for private repositories")
      .addComponent((el) =>
        new SecretComponent(this.app, el)
          .setValue(this.plugin.settings.githubToken)
          .onChange((value) => {
            this.plugin.settings.githubToken = value;
            this.plugin.saveSettings();
          }),
      );
  }

  private async addRepository(repoUrl: string): Promise<void> {
    const trimmed = repoUrl.trim();
    if (!trimmed) {
      new Notice("Please enter a repository URL");
      return;
    }

    // Normalize the URL
    let normalized = trimmed.replace(/^https?:\/\//, "");
    if (normalized.startsWith("ghcr.io/")) {
      normalized = normalized.substring(8); // Remove "ghcr.io/"
    }

    // Validate format (should be owner/repo)
    if (!normalized.match(/^[^\/]+\/[^\/]+$/)) {
      new Notice("Invalid repository format. Expected: owner/repo");
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
    this.plugin.settings.repositories = this.plugin.settings.repositories.filter(
      (r) => r.repoUrl !== repoUrl,
    );
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
      this.repositoryListContainer.createEl("p", {
        text: "No repositories added yet",
        cls: "ghcr-empty-state",
      });
      return;
    }

    // Render all repositories
    for (const repo of this.plugin.settings.repositories) {
      await this.renderRepositoryEntry(repo);
    }
  }

  private async renderRepositoryEntry(
    repo: RepositoryConfig,
  ): Promise<void> {
    if (!this.repositoryListContainer) return;

    const entryContainer = this.repositoryListContainer.createDiv(
      "ghcr-repo-entry",
    );

    // Check if we have cached tags
    const cached = this.tagCache.get(repo.repoUrl);

    if (cached?.error) {
      // Render error state
      this.renderRepositoryError(entryContainer, repo, cached.error);
    } else if (cached?.tags) {
      // Render with cached tags
      this.renderRepositoryWithTags(entryContainer, repo, cached.tags);
    } else {
      // Render loading state and fetch tags
      this.renderRepositoryLoading(entryContainer, repo);
      await this.fetchTagsForRepository(repo);
    }
  }

  private renderRepositoryLoading(
    container: HTMLElement,
    repo: RepositoryConfig,
  ): void {
    const header = container.createDiv("ghcr-repo-header");
    header.createEl("span", { text: repo.repoUrl, cls: "ghcr-repo-name" });

    const controls = header.createDiv("ghcr-repo-controls");
    this.addRefreshButton(controls, repo);
    this.addRemoveButton(controls, repo);

    const loading = container.createDiv("ghcr-repo-loading");
    loading.createEl("span", { text: "⟳ Loading tags...", cls: "ghcr-loading-text" });
  }

  private renderRepositoryError(
    container: HTMLElement,
    repo: RepositoryConfig,
    error: string,
  ): void {
    container.addClass("ghcr-repo-error");

    const header = container.createDiv("ghcr-repo-header");
    header.createEl("span", { text: repo.repoUrl, cls: "ghcr-repo-name" });

    const controls = header.createDiv("ghcr-repo-controls");
    this.addRefreshButton(controls, repo);
    this.addRemoveButton(controls, repo);

    const errorDiv = container.createDiv("ghcr-error-message");
    errorDiv.createEl("span", { text: `⚠ Failed to fetch tags: ${error}` });

    const retryButton = errorDiv.createEl("button", {
      text: "Retry",
      cls: "ghcr-retry-button",
    });
    retryButton.onclick = async () => {
      await this.fetchTagsForRepository(repo);
    };
  }

  private renderRepositoryWithTags(
    container: HTMLElement,
    repo: RepositoryConfig,
    tags: string[],
  ): void {
    // Header with repo name and controls
    const header = container.createDiv("ghcr-repo-header");
    header.createEl("span", { text: repo.repoUrl, cls: "ghcr-repo-name" });

    const controls = header.createDiv("ghcr-repo-controls");
    this.addRefreshButton(controls, repo);
    this.addRemoveButton(controls, repo);

    // Content area
    const content = container.createDiv("ghcr-repo-content");

    // Dropdown and checkbox row
    const dropdownRow = content.createDiv("ghcr-dropdown-row");

    const dropdown = dropdownRow.createEl("select", {
      cls: "ghcr-tag-dropdown dropdown",
    });
    dropdown.createEl("option", {
      text: "Select a version",
      value: "",
    });

    // Filter tags based on showAllTags setting
    const { semver, other } = this.filterTagsForRepo(tags, repo.showAllTags);

    // Add semver tags
    if (semver.length > 0) {
      if (other.length > 0 && repo.showAllTags) {
        const optgroup = dropdown.createEl("optgroup", {
          attr: { label: "Semantic Versions" },
        });
        semver.forEach((tag) => {
          optgroup.createEl("option", { text: tag, value: tag });
        });
      } else {
        semver.forEach((tag) => {
          dropdown.createEl("option", { text: tag, value: tag });
        });
      }
    }

    // Add other tags if showing all
    if (other.length > 0 && repo.showAllTags) {
      const optgroup = dropdown.createEl("optgroup", {
        attr: { label: "Other Tags" },
      });
      other.forEach((tag) => {
        optgroup.createEl("option", { text: tag, value: tag });
      });
    }

    // Pre-select installed tag if applicable
    const installedInfo = this.plugin.settings.installedPlugins[repo.repoUrl];
    if (installedInfo) {
      dropdown.value = installedInfo.tag;
    }

    // Show all tags checkbox
    const checkboxContainer = dropdownRow.createDiv("ghcr-checkbox-container");
    const checkbox = checkboxContainer.createEl("input", {
      type: "checkbox",
      cls: "ghcr-show-all-checkbox",
    });
    checkbox.checked = repo.showAllTags;
    checkbox.id = `show-all-${repo.repoUrl}`;

    const label = checkboxContainer.createEl("label", {
      text: "Show all tags",
      attr: { for: `show-all-${repo.repoUrl}` },
    });

    checkbox.onchange = async () => {
      repo.showAllTags = checkbox.checked;
      await this.plugin.saveSettings();
      await this.refreshAllRepositories();
    };

    // Installation status
    const statusRow = content.createDiv("ghcr-status-row");
    if (installedInfo) {
      const digestShort = installedInfo.digest.substring(0, 23) + "...";
      statusRow.createEl("span", {
        text: `Installed: ${installedInfo.tag} (${digestShort})`,
        cls: "ghcr-status-installed",
        attr: { title: installedInfo.digest },
      });
    } else {
      statusRow.createEl("span", {
        text: "Not installed",
        cls: "ghcr-status-not-installed",
      });
    }

    // Action button row
    const buttonRow = content.createDiv("ghcr-button-row");
    const actionButton = buttonRow.createEl("button", {
      cls: "ghcr-action-button",
    });

    // Update button text when dropdown changes
    const updateButton = () => {
      const selectedTag = dropdown.value;
      if (!selectedTag) {
        actionButton.textContent = "Select a version";
        actionButton.disabled = true;
      } else {
        actionButton.textContent = getActionButtonText(
          selectedTag,
          installedInfo?.tag || null,
        );
        actionButton.disabled = false;
      }
    };

    dropdown.onchange = updateButton;
    updateButton();

    // Button click handler (to be implemented in next task)
    actionButton.onclick = async () => {
      const selectedTag = dropdown.value;
      if (selectedTag) {
        await this.installPlugin(repo.repoUrl, selectedTag);
      }
    };
  }

  private filterTagsForRepo(
    tags: string[],
    showAllTags: boolean,
  ): { semver: string[]; other: string[] } {
    return filterTags(tags, showAllTags);
  }

  private async installPlugin(repoUrl: string, tag: string): Promise<void> {
    try {
      new Notice(`Installing ${repoUrl}@${tag}...`);

      // Get auth token
      const secretToken = this.plugin.settings.githubToken
        ? await this.app.secretStorage.getSecret(
            this.plugin.settings.githubToken,
          )
        : null;
      const token = secretToken || undefined;

      // Create GHCR client
      const ghcrClient = GHCRWrapper.createClient(repoUrl, token);

      // Fetch manifest to get digest
      const { resp, manifest } = await ghcrClient.getManifest({ ref: tag });
      const digest = resp.headers["docker-content-digest"] || "unknown";

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

  private async fetchTagsForRepository(
    repo: RepositoryConfig,
  ): Promise<void> {
    try {
      const secretToken = this.plugin.settings.githubToken
        ? await this.app.secretStorage.getSecret(
            this.plugin.settings.githubToken,
          )
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

  private addRefreshButton(container: HTMLElement, repo: RepositoryConfig): void {
    const refreshButton = container.createEl("button", {
      text: "↻",
      cls: "ghcr-refresh-button",
    });
    refreshButton.title = "Refresh tags";
    refreshButton.onclick = async () => {
      this.tagCache.delete(repo.repoUrl);
      await this.fetchTagsForRepository(repo);
    };
  }

  private addRemoveButton(container: HTMLElement, repo: RepositoryConfig): void {
    const removeButton = container.createEl("button", {
      text: "×",
      cls: "ghcr-remove-button",
    });
    removeButton.title = "Remove repository";

    // Check if installed
    const isInstalled = this.plugin.settings.installedPlugins[repo.repoUrl];
    if (isInstalled) {
      removeButton.disabled = true;
      removeButton.title = "Uninstall the plugin before removing";
    }

    removeButton.onclick = async () => {
      await this.removeRepository(repo.repoUrl);
    };
  }

  hide(): void {
    // Clear cache when settings tab closes
    this.tagCache.clear();
  }
}
