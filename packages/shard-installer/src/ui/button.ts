import { setIcon } from "obsidian";

export interface ButtonOptions {
  text?: string;
  icon?: string;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  ariaLabel?: string;
  disabled?: boolean;
}

export function Button(
  container: HTMLElement,
  options: ButtonOptions,
): HTMLButtonElement {
  const button = container.createEl("button");
  button.addClass("shard-button");

  // Variant
  if (options.variant) {
    button.addClass(`shard-button--${options.variant}`);
  }

  // Size
  if (options.size) {
    button.addClass(`shard-button--${options.size}`);
  }

  // Icon
  if (options.icon) {
    const iconEl = button.createSpan("shard-button__icon");
    setIcon(iconEl, options.icon);
  }

  // Text
  if (options.text) {
    button.createSpan({ text: options.text, cls: "shard-button__text" });
  }

  // Click handler
  if (options.onClick) {
    button.onclick = options.onClick;
  }

  // Accessibility
  if (options.ariaLabel) {
    button.setAttribute("aria-label", options.ariaLabel);
  }

  // Disabled state
  if (options.disabled) {
    button.disabled = true;
  }

  return button;
}
