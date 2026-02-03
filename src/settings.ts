import { App, PluginSettingTab, SecretComponent, Setting } from "obsidian";
import type GHCRTagBrowserPlugin from "./main";

export class GHCRSettingTab extends PluginSettingTab {
  plugin: GHCRTagBrowserPlugin;

  constructor(app: App, plugin: GHCRTagBrowserPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

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
}
