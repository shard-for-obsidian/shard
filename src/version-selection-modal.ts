import { App, Modal } from "obsidian";
import { filterTags, getActionButtonText } from "./semver-utils";

export class VersionSelectionModal extends Modal {
  private tags: string[];
  private showAllTags: boolean;
  private currentTag: string | null;
  private repoUrl: string;
  private onSelect: (tag: string) => void;

  constructor(
    app: App,
    repoUrl: string,
    tags: string[],
    showAllTags: boolean,
    currentTag: string | null,
    onSelect: (tag: string) => void,
  ) {
    super(app);
    this.repoUrl = repoUrl;
    this.tags = tags;
    this.showAllTags = showAllTags;
    this.currentTag = currentTag;
    this.onSelect = onSelect;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: `Select version for ${this.repoUrl}` });

    // Filter tags
    const { semver, other } = filterTags(this.tags, this.showAllTags);

    // Create list of versions
    const listContainer = contentEl.createDiv("ghcr-version-list");

    if (semver.length > 0) {
      // Semantic versions section
      if (other.length > 0 && this.showAllTags) {
        listContainer.createEl("h3", { text: "Semantic Versions" });
      }

      semver.forEach((tag) => {
        this.createVersionItem(listContainer, tag);
      });
    }

    if (other.length > 0 && this.showAllTags) {
      // Other tags section
      listContainer.createEl("h3", { text: "Other Tags" });
      other.forEach((tag) => {
        this.createVersionItem(listContainer, tag);
      });
    }

    if (semver.length === 0 && other.length === 0) {
      contentEl.createDiv({
        text: "No versions available",
        cls: "ghcr-empty-state",
      });
    }
  }

  private createVersionItem(container: HTMLElement, tag: string): void {
    const item = container.createDiv("ghcr-version-item");

    // Make clickable
    item.addClass("clickable-item");
    if (tag === this.currentTag) {
      item.addClass("is-active");
    }

    const info = item.createDiv("ghcr-version-info");
    const tagName = info.createDiv("ghcr-version-tag");
    tagName.setText(tag);

    if (tag === this.currentTag) {
      tagName.createSpan({ text: " (current)", cls: "ghcr-version-current" });
    }

    // Action button text as hint
    const actionHint = info.createDiv("ghcr-version-hint");
    const actionText = getActionButtonText(tag, this.currentTag);
    actionHint.setText(actionText);
    actionHint.style.fontSize = "0.9em";
    actionHint.style.color = "var(--text-muted)";

    item.onclick = () => {
      this.onSelect(tag);
      this.close();
    };
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
