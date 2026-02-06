import { setIcon } from "obsidian";

export interface IconButtonOptions {
  icon: string;
  ariaLabel: string;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
}

export function IconButton(
  container: HTMLElement,
  options: IconButtonOptions,
): HTMLDivElement {
  const button = container.createDiv("shard-icon-button clickable-icon");

  // Size
  if (options.size) {
    button.addClass(`shard-icon-button--${options.size}`);
  }

  // Icon
  setIcon(button, options.icon);

  // Accessibility
  button.setAttribute("aria-label", options.ariaLabel);

  // Click handler
  if (options.onClick) {
    button.onclick = options.onClick;
  }

  return button;
}
