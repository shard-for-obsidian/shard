import { App, PluginSettingTab, Setting } from 'obsidian';
import type GHCRTagBrowserPlugin from './main';

export class GHCRSettingTab extends PluginSettingTab {
	plugin: GHCRTagBrowserPlugin;

	constructor(app: App, plugin: GHCRTagBrowserPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'GHCR Tag Browser Settings' });

		new Setting(containerEl)
			.setName('GitHub Token')
			.setDesc('Optional personal access token for private repositories')
			.addText(text => text
				.setPlaceholder('ghp_...')
				.setValue(this.plugin.settings.githubToken)
				.onChange(async (value) => {
					this.plugin.settings.githubToken = value;
					await this.plugin.saveSettings();
				}));

		// Make the input a password field
		const tokenInput = containerEl.querySelector('input[type="text"]');
		if (tokenInput) {
			tokenInput.setAttribute('type', 'password');
		}
	}
}
