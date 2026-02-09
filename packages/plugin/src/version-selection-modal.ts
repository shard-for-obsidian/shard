import { App, Modal } from "obsidian";
import { filterTags, getActionButtonText } from "./semver-utils";
import { EmptyState, List } from "./ui";
import { VersionListItem } from "./marketplace/components";

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

    const { semver, other } = filterTags(this.tags, this.showAllTags);

    if (semver.length === 0 && other.length === 0) {
      EmptyState(contentEl, {
        icon: "package-x",
        message: "No versions available",
      });
      return;
    }

    // Semantic versions section
    if (semver.length > 0) {
      if (other.length > 0 && this.showAllTags) {
        contentEl.createEl("h3", { text: "Semantic versions" });
      }

      const semverList = List(contentEl, { gap: "sm" });
      semver.forEach((tag) => {
        this.createVersionItem(semverList, tag);
      });
    }

    // Other tags section
    if (other.length > 0 && this.showAllTags) {
      contentEl.createEl("h3", { text: "Other tags" });
      const otherList = List(contentEl, { gap: "sm" });
      other.forEach((tag) => {
        this.createVersionItem(otherList, tag);
      });
    }
  }

  private createVersionItem(container: HTMLElement, tag: string): void {
    const isCurrent = tag === this.currentTag;
    const actionText = getActionButtonText(tag, this.currentTag);

    VersionListItem(container, {
      tag,
      isCurrent,
      actionText,
      onSelect: (tag) => {
        this.onSelect(tag);
        this.close();
      },
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
