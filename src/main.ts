import { Plugin } from "obsidian";
import { GHCRSettingTab } from "./settings";
import { TagBrowserModal } from "./tag-browser-modal";
import { DEFAULT_SETTINGS, type GHCRPluginSettings } from "./types";

export default class GHCRTagBrowserPlugin extends Plugin {
  settings: GHCRPluginSettings;

  async onload() {
    await this.loadSettings();

    // Register command
    this.addCommand({
      id: "browse-ghcr-tags",
      name: "Browse GHCR Tags",
      callback: () => {
        new TagBrowserModal(this.app, this.settings).open();
      },
    });

    // Add settings tab
    this.addSettingTab(new GHCRSettingTab(this.app, this));
  }

  onunload() {
    // Cleanup if needed
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
