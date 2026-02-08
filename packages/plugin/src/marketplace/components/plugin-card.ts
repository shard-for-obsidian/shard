import { Card, Button } from "../../ui";
import type { MarketplacePlugin } from "../types";
import type { InstalledPluginInfo } from "../../types";

export interface PluginCardOptions {
  plugin: MarketplacePlugin;
  installedInfo?: InstalledPluginInfo | null;
  onBrowseVersions: (plugin: MarketplacePlugin) => void;
}

export function PluginCard(
  container: HTMLElement,
  options: PluginCardOptions,
): HTMLDivElement {
  const { plugin, installedInfo, onBrowseVersions } = options;

  const card = Card(container);
  card.addClass("shard-plugin-card");

  // Header: Name and install button
  const headerRow = card.header.createDiv("shard-plugin-card__header-row");

  headerRow.createEl("h3", {
    text: plugin.name,
    cls: "shard-plugin-card__name",
  });

  const actions = headerRow.createDiv("shard-plugin-card__actions");
  Button(actions, {
    text: "Browse Versions",
    variant: "secondary",
    onClick: () => onBrowseVersions(plugin),
  });

  // Author
  card.body.createDiv({
    text: `by ${plugin.author}`,
    cls: "shard-plugin-card__author",
  });

  // Description
  card.body.createDiv({
    text: plugin.description,
    cls: "shard-plugin-card__description",
  });

  // Repository link
  if (plugin.repository) {
    const repoLink = card.body.createEl("a", {
      text: plugin.repository,
      cls: "shard-plugin-card__repo-link",
    });
    repoLink.href = plugin.repository;
  }

  // Registry URL
  card.body.createDiv({
    text: plugin.registryUrl,
    cls: "shard-plugin-card__registry",
  });

  // Installation status
  if (installedInfo) {
    const statusDiv = card.footer.createDiv("shard-plugin-card__status");
    const digestShort = installedInfo.digest.substring(0, 23) + "...";
    statusDiv.setText(`Installed: ${installedInfo.tag} (${digestShort})`);
    statusDiv.title = installedInfo.digest;
  }

  return card as HTMLDivElement;
}
