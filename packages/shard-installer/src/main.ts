import { Plugin } from "obsidian";
import { GHCRSettingTab } from "./settings";
import { DEFAULT_SETTINGS, type GHCRPluginSettings } from "./types";
import {
  MarketplaceView,
  MARKETPLACE_VIEW_TYPE,
} from "./marketplace/marketplace-view";

export default class GHCRTagBrowserPlugin extends Plugin {
  settings!: GHCRPluginSettings;

  async onload() {
    await this.loadSettings();

    // Register marketplace view
    this.registerView(
      MARKETPLACE_VIEW_TYPE,
      (leaf) => new MarketplaceView(leaf, this),
    );

    // Add command to open marketplace
    this.addCommand({
      id: "open-marketplace",
      name: "Open Shard Marketplace",
      callback: () => {
        this.activateMarketplaceView();
      },
    });

    // Add settings tab
    this.addSettingTab(new GHCRSettingTab(this.app, this));
  }

  onunload() {
    // Cleanup if needed
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as GHCRPluginSettings;
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateMarketplaceView() {
    const { workspace } = this.app;

    // Check if view is already open
    let leaf = workspace.getLeavesOfType(MARKETPLACE_VIEW_TYPE)[0];

    if (!leaf) {
      // Create new leaf in right sidebar
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: MARKETPLACE_VIEW_TYPE,
          active: true,
        });
        leaf = rightLeaf;
      }
    }

    // Reveal the leaf
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
}
