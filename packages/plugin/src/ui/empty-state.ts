import { setIcon } from "obsidian";

export interface EmptyStateOptions {
  icon?: string;
  message: string;
}

export function EmptyState(
  container: HTMLElement,
  options: EmptyStateOptions,
): HTMLDivElement {
  const emptyState = container.createDiv("shard-empty-state");

  // Icon
  if (options.icon) {
    const iconEl = emptyState.createDiv("shard-empty-state__icon");
    setIcon(iconEl, options.icon);
  }

  // Message
  emptyState.createDiv({
    text: options.message,
    cls: "shard-empty-state__message",
  });

  return emptyState;
}
