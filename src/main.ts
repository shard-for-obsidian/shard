import { Plugin } from "obsidian";
import { GHCRSettingTab } from "./settings";
import { DEFAULT_SETTINGS, type GHCRPluginSettings } from "./types";

export default class GHCRTagBrowserPlugin extends Plugin {
  settings!: GHCRPluginSettings;

  async onload() {
    await this.loadSettings();

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
