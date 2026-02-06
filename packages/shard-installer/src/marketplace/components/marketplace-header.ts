import { IconButton } from "../../ui";

export interface MarketplaceHeaderOptions {
  onRefresh: () => void;
}

export function MarketplaceHeader(
  container: HTMLElement,
  options: MarketplaceHeaderOptions,
): HTMLDivElement {
  const header = container.createDiv("shard-marketplace-header");

  // Title
  header.createEl("h2", {
    text: "Shard Marketplace",
    cls: "shard-marketplace-header__title",
  });

  // Actions
  const actions = header.createDiv("shard-marketplace-header__actions");
  IconButton(actions, {
    icon: "refresh-cw",
    ariaLabel: "Refresh marketplace",
    onClick: options.onRefresh,
  });

  return header;
}
