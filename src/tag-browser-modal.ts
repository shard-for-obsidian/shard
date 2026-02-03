import { App, Modal } from "obsidian";
import type { GHCRPluginSettings, TagMetadata } from "./types";
import { GHCRWrapper } from "./ghcr-wrapper";

export class TagBrowserModal extends Modal {
  settings: GHCRPluginSettings;

  private repoInput: HTMLInputElement;
  private tokenInput: HTMLInputElement;
  private fetchButton: HTMLButtonElement;
  private leftPane: HTMLDivElement;
  private rightPane: HTMLDivElement;
  private errorContainer: HTMLDivElement;

  private currentRepo: string = "";
  private selectedTag: string | null = null;

  constructor(app: App, settings: GHCRPluginSettings) {
    super(app);
    this.settings = settings;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ghcr-tag-browser-modal");

    // Header section
    const header = contentEl.createDiv("ghcr-header");

    this.repoInput = header.createEl("input", {
      type: "text",
      placeholder: "Enter repository (e.g., owner/repo or ghcr.io/owner/repo)",
      cls: "ghcr-repo-input",
    });

    this.fetchButton = header.createEl("button", {
      text: "Fetch Tags",
      cls: "ghcr-fetch-button",
    });

    // Optional token override
    const tokenToggle = header.createDiv("ghcr-token-toggle");
    const toggleButton = tokenToggle.createEl("button", {
      text: "Use different token",
      cls: "ghcr-toggle-token-button",
    });

    const tokenContainer = header.createDiv("ghcr-token-container");
    tokenContainer.style.display = "none";

    this.tokenInput = tokenContainer.createEl("input", {
      type: "password",
      placeholder: "GitHub token (optional)",
      cls: "ghcr-token-input",
    });

    toggleButton.addEventListener("click", () => {
      const isHidden = tokenContainer.style.display === "none";
      tokenContainer.style.display = isHidden ? "block" : "none";
    });

    // Error container
    this.errorContainer = contentEl.createDiv("ghcr-error-container");
    this.errorContainer.style.display = "none";

    // Two-pane layout
    const panesContainer = contentEl.createDiv("ghcr-panes-container");

    this.leftPane = panesContainer.createDiv("ghcr-left-pane");
    this.leftPane.createEl("p", {
      text: "Enter a repository to browse tags",
      cls: "ghcr-empty-state",
    });

    this.rightPane = panesContainer.createDiv("ghcr-right-pane");
    this.rightPane.createEl("p", {
      text: "Select a tag to view details",
      cls: "ghcr-empty-state",
    });

    // Event listeners
    this.fetchButton.addEventListener("click", () => this.fetchTags());
    this.repoInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.fetchTags();
    });
  }

  private async fetchTags() {
    const repo = this.repoInput.value.trim();
    if (!repo) {
      this.showError("Please enter a repository URL");
      return;
    }

    this.currentRepo = repo;
    this.selectedTag = null;
    this.hideError();
    this.showLoading(this.leftPane, "Fetching tags...");
    this.clearPane(this.rightPane);
    this.rightPane.createEl("p", {
      text: "Select a tag to view details",
      cls: "ghcr-empty-state",
    });

    try {
      const token = this.tokenInput.value.trim() || this.settings.githubToken;
      const tags = await GHCRWrapper.getTags(repo, token);

      if (tags.length === 0) {
        this.showEmptyTags();
      } else {
        this.renderTagList(tags);
      }
    } catch (error) {
      this.showError(this.formatError(error));
    }
  }

  private async selectTag(tag: string) {
    this.selectedTag = tag;
    this.showLoading(this.rightPane, "Loading tag details...");

    try {
      const token = this.tokenInput.value.trim() || this.settings.githubToken;
      const metadata = await GHCRWrapper.getTagMetadata(
        this.currentRepo,
        tag,
        token,
      );
      this.renderTagDetails(metadata);
    } catch (error) {
      this.showErrorInPane(this.rightPane, this.formatError(error));
    }
  }

  private renderTagList(tags: string[]) {
    this.clearPane(this.leftPane);

    const list = this.leftPane.createDiv("ghcr-tag-list");

    tags.forEach((tag) => {
      const item = list.createDiv("ghcr-tag-item");
      item.textContent = tag;
      item.addEventListener("click", () => {
        // Remove previous selection
        list.querySelectorAll(".ghcr-tag-item-selected").forEach((el) => {
          el.removeClass("ghcr-tag-item-selected");
        });
        // Add selection to clicked item
        item.addClass("ghcr-tag-item-selected");
        this.selectTag(tag);
      });
    });
  }

  private renderTagDetails(metadata: TagMetadata) {
    this.clearPane(this.rightPane);

    this.rightPane.createEl("h3", { text: `Tag: ${metadata.tag}` });

    const details = this.rightPane.createDiv("ghcr-tag-details");

    // Digest
    const digestRow = details.createDiv("ghcr-detail-row");
    digestRow.createEl("strong", { text: "Digest: " });
    const digestValue = digestRow.createEl("code", { text: metadata.digest });
    digestValue.title = metadata.digest; // Tooltip with full digest

    // Size
    const sizeRow = details.createDiv("ghcr-detail-row");
    sizeRow.createEl("strong", { text: "Size: " });
    sizeRow.createEl("span", { text: this.formatSize(metadata.size) });
  }

  private showLoading(pane: HTMLElement, message: string) {
    this.clearPane(pane);
    const loading = pane.createDiv("ghcr-loading");
    loading.createEl("div", { cls: "ghcr-spinner" });
    loading.createEl("p", { text: message });
  }

  private showEmptyTags() {
    this.clearPane(this.leftPane);
    this.leftPane.createEl("p", {
      text: "No tags found for this repository",
      cls: "ghcr-empty-state",
    });
  }

  private showError(message: string) {
    this.errorContainer.style.display = "block";
    this.errorContainer.textContent = message;
    this.errorContainer.addClass("ghcr-error");
  }

  private hideError() {
    this.errorContainer.style.display = "none";
    this.errorContainer.textContent = "";
  }

  private showErrorInPane(pane: HTMLElement, message: string) {
    this.clearPane(pane);
    pane.createEl("p", { text: message, cls: "ghcr-error" });
  }

  private clearPane(pane: HTMLElement) {
    pane.empty();
  }

  private formatSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Check for specific error types
      if (message.includes("401") || message.includes("unauthorized")) {
        return "Authentication failed. Check your GitHub token in settings.";
      }
      if (message.includes("404") || message.includes("not found")) {
        return `Repository not found: ${this.currentRepo}`;
      }
      if (message.includes("network") || message.includes("fetch")) {
        return "Failed to connect to ghcr.io. Check your connection.";
      }
      if (message.includes("rate limit")) {
        return "Rate limited by registry. Try again later.";
      }

      return `Error: ${error.message}`;
    }
    return "An unknown error occurred";
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
